import { randomUUID } from 'node:crypto';
import { contractHistory, daysBetween, MODEL_VERSION, normalize, pairSeries } from './analytics';
import type { Dataset, EquityPoint, Observation, ResearchParams, ResearchResult, Trade } from './types';
export function validateParams(value: unknown, d: Dataset): ResearchParams {
  if (!value || typeof value!=='object') throw new Error('INVALID_PARAMETERS');
  const p = value as ResearchParams;
  if (!d.contracts.some(c=>c.id===p.a) || !d.contracts.some(c=>c.id===p.b) || p.a===p.b) throw new Error('INVALID_PAIR');
  const ranges: [keyof ResearchParams, number, number, boolean][] = [['lookback',10,60,true],['entryZ',1,5,false],['exitZ',0,1.5,false],['maxHold',1,20,true],['costBps',0,100,false],['capital',100000,100000000,false],['minVolume',1,10000,true],['exitBuffer',2,15,true]];
  for (const [key,min,max,integer] of ranges) {
    const v = p[key];
    if (typeof v!=='number' || !Number.isFinite(v) || v<min || v>max || (integer&&!Number.isInteger(v))) throw new Error('INVALID_PARAMETERS');
  }
  if (p.exitZ>=p.entryZ) throw new Error('INVALID_THRESHOLDS');
  return Object.fromEntries(['a','b',...ranges.map(r=>r[0])].map(k=>[k,p[k as keyof ResearchParams]])) as ResearchParams;
}
export function backtest(d: Dataset, parameters: ResearchParams): ResearchResult {
  const p=validateParams(parameters,d), a=d.contracts.find(c=>c.id===p.a)!, b=d.contracts.find(c=>c.id===p.b)!;
  const aMap=new Map(contractHistory(d,p.a).map(o=>[o.date,o])), bMap=new Map(contractHistory(d,p.b).map(o=>[o.date,o]));
  const dates=[...new Set([...aMap.keys(),...bMap.keys()])].sort();
  const stats=new Map(pairSeries(d,p.a,p.b,p.lookback).map(pt=>[pt.date,pt]));
  const tender=[a.tenderStart,b.tenderStart].sort()[0];
  const targetGrams=Math.max(40,a.lotGrams,b.lotGrams);
  const lotsA=Math.max(1,Math.round(targetGrams/(a.lotGrams*a.purity)));
  const lotsB=Math.max(1,Math.round(lotsA*a.lotGrams*a.purity/(b.lotGrams*b.purity)));
  const fineA=lotsA*a.lotGrams*a.purity, fineB=lotsB*b.lotGrams*b.purity;
  const multA=lotsA*a.lotGrams/a.quoteGrams, multB=lotsB*b.lotGrams/b.quoteGrams;
  const residualGrams=fineA-fineB;
  const trades: Trade[]=[], equity: EquityPoint[]=[], rejected: Record<string,number>={};
  let position: Trade|null=null, pending: {kind:'entry'|'exit';direction:number;date:string;reason:string}|null=null;
  let realized=0, peak=p.capital, heldSessions=0, unresolved=false, goldAttribution=0;
  let priorMark: {a:number;b:number}|null=null;
  const reject=(why:string)=>{rejected[why]=(rejected[why]??0)+1;};
  const pnl=(t:Trade,pa:number,pb:number)=>t.direction*(multA*(pa-t.entryA)-multB*(pb-t.entryB));
  const costs=(pa:number,pb:number)=>(Math.abs(multA*pa)+Math.abs(multB*pb))*p.costBps/20000;
  const active=(ar:Observation,br:Observation)=>ar.volume>=p.minVolume&&br.volume>=p.minVolume;
  for (let dateIndex=0;dateIndex<dates.length;dateIndex++) {
    const date=dates[dateIndex];
    const ar=aMap.get(date), br=bMap.get(date);
    if (!ar || !br) {
      if (position) { unresolved=true; reject('Missing held-contract valuation'); }
      if (pending) reject('Missing next-session leg');
      // Pending orders remain pending, rather than being counted as successful fills.
      continue;
    }
    if (pending) {
      if (!active(ar,br)) { reject('No-fill scenario: insufficient realized daily activity'); if(pending.kind==='entry')pending=null; }
      else if (pending.kind==='entry') {
        if (daysBetween(date,tender)<=p.maxHold+p.exitBuffer) {reject('Insufficient time before tender'); pending=null;}
        else if ((Math.abs(multA*ar.open)+Math.abs(multB*br.open))*0.2>p.capital) {reject('Assumed 20% collateral exceeds allocated capital'); pending=null;}
        else {
          position={decisionDate:pending.date,entryDate:date,exitDate:null,direction:pending.direction,lotsA,lotsB,entryA:ar.open,entryB:br.open,exitA:null,exitB:null,gross:0,costs:costs(ar.open,br.open),net:0,reason:''};
          priorMark={a:ar.open,b:br.open}; heldSessions=0; pending=null;
        }
      } else if (position) {
        if (date>=tender) { unresolved=true;reject('Lifecycle breach: exposure reached tender'); }
        const t=position;
        if (priorMark) goldAttribution+=t.direction*residualGrams*(normalize(ar.open,a)-normalize(priorMark.a,a));
        t.exitDate=date;t.exitA=ar.open;t.exitB=br.open;t.gross=pnl(t,ar.open,br.open);t.costs+=costs(ar.open,br.open);t.net=t.gross-t.costs;t.reason=pending.reason;
        trades.push(t);realized+=t.net;position=null;pending=null;priorMark=null;
      } else pending=null;
    }
    let mark=0,entryCost=0;
    if (position) {
      heldSessions++;
      mark=pnl(position,ar.close,br.close);entryCost=position.costs;
      if (priorMark) goldAttribution+=position.direction*residualGrams*(normalize(ar.close,a)-normalize(priorMark.a,a));
      priorMark={a:ar.close,b:br.close};
      if (date>=tender) {unresolved=true;reject('Lifecycle breach: exposure reached tender');}
    }
    const current=p.capital+realized+mark-entryCost;
    peak=Math.max(peak,current);
    const initial=aMap.get(dates[0]);
    equity.push({date,equity:current,drawdown:(current-peak)/peak*100,gold:initial?p.capital*ar.close/initial.close:p.capital});
    // A full observed session of availability lag is assumed. Decisions on
    // this close use the preceding session's bar; a later Open is the fill.
    const informationDate=dates[dateIndex-1];
    const point=informationDate?stats.get(informationDate):undefined;
    if (position) {
      if (!pending) {
        const convergence=point?.z!==null&&point?.z!==undefined&&Math.abs(point.z)<=p.exitZ;
        const deadline=daysBetween(date,tender)<=p.exitBuffer+1;
        if (convergence||deadline||heldSessions>=p.maxHold) pending={kind:'exit',direction:position.direction,date,reason:deadline?'Lifecycle buffer':convergence?'Spread convergence':'Maximum holding period'};
      }
      continue;
    }
    if (pending) continue;
    if (!point || point.z===null) {reject('Insufficient active prior observations');continue;}
    if (Math.abs(point.z)<p.entryZ) continue;
    if (a.expiry!==b.expiry) {reject('Maturity mismatch: carry model unavailable');continue;}
    if (a.location!==b.location) {reject('Delivery location basis unresolved');continue;}
    const knownA=aMap.get(informationDate),knownB=bMap.get(informationDate);
    if (!knownA||!knownB||!active(knownA,knownB)) {reject('Decision-time activity below minimum');continue;}
    if (daysBetween(date,tender)<=p.maxHold+p.exitBuffer+1) {reject('Insufficient time before tender');continue;}
    // Cost bps apply to each leg's notional. Relative basis converges on one leg,
    // so the simple full-reversion hurdle is approximately twice the per-leg rate.
    if (Math.abs(point.spread-(point.mean??point.spread))<=p.costBps*2) {reject('Assumed costs exceed full mean-reversion estimate');continue;}
    pending={kind:'entry',direction:point.z>0?1:-1,date,reason:'Prior-window anomaly'};
  }
  if (position) {
    unresolved=true;
    const last=equity.at(-1);
    position.gross=last?last.equity-p.capital-realized+position.costs:0;
    position.net=position.gross-position.costs;position.reason='Open exposure at dataset end; liquidation unresolved';
    trades.push(position);
  }
  const gross=trades.reduce((s,t)=>s+t.gross,0), totalCosts=trades.reduce((s,t)=>s+t.costs,0), net=gross-totalCosts;
  const closed=trades.filter(t=>t.exitDate!==null);
  const basis=gross-goldAttribution;
  return {id:randomUUID(),datasetId:d.id,datasetHash:d.hash,modelVersion:MODEL_VERSION,createdAt:new Date().toISOString(),params:p,trades,equity,rejected,gross,costs:totalCosts,net,maxDrawdown:Math.min(0,...equity.map(e=>e.drawdown)),winRate:closed.length?closed.filter(t=>t.net>0).length/closed.length*100:null,residualGrams,tradesCount:closed.length,unresolved,
    attribution:{gold:goldAttribution,basis,costs:-totalCosts,reconciliation:net-(goldAttribution+basis-totalCosts)},
    verdict:unresolved?'Inconclusive · unresolved exposure':d.provenance==='synthetic'?'Demonstration · no market conclusion':closed.length<30?'Inconclusive · short sample':net>0?'Positive research result · execution unverified':'No positive result under these assumptions',
    warnings:[...d.warnings,'Statistical significance is not established: no block-bootstrap confidence interval or independent holdout is implemented.','No executable return, Sharpe, or causal alpha is claimed. Imported revisions have no verified historical availability timestamps.'],
    assumptions:['Close-based daily-bar research simulation. A bar is assumed available one full observed session later; decisions use that earlier bar. Entry/exit follows at a still later observed session’s Open.','Both legs assumed filled simultaneously if realized daily volume passes the threshold. This is a scenario, not evidence of liquidity at the open. Failed entries are canceled; failed exits retain exposure.','Integer lots chosen using provisional fine-gold exposure. No contract switching or implicit rolls.','Cost is per-leg round-trip bps, split equally across entry and exit; includes assumed all-in fees/slippage. No double-counted fill adjustment.','Capital is fixed; collateral proxy is 20% of gross entry notional. Historical margins, financing and forced liquidation are not modeled.','Gold attribution uses the first held contract as a common futures proxy. Basis includes carry and all other residuals; it is not pure alpha.','No-fill checks cannot establish intraday depth. A strict no-fill scenario is zero executions; adverse legging remains a production gate.','The one-session availability lag is an assumption. Original publication/revision timestamps are unavailable, so point-in-time source validity remains unverified.']};
}
