import test from 'node:test';
import assert from 'node:assert/strict';
import { makeDemo } from '../src/lib/demo';
import { contractHistory, findings, normalize, pairSeries } from '../src/lib/analytics';
import { backtest, validateParams } from '../src/lib/research';
import { ingestCSV, ImportError, parseCSV, strictDate } from '../src/lib/ingest';
import type { Dataset, ResearchParams } from '../src/lib/types';
import { localBoundary } from '../src/lib/api';
const demo=makeDemo();
const params:ResearchParams={a:'GOLDTEN-2026-10-30',b:'GOLDGUINEA-2026-10-30',lookback:20,entryZ:2,exitZ:0.5,maxHold:5,costBps:5,capital:1000000,minVolume:100,exitBuffer:5};
const header='trade_date,requested_date,symbol,expiry,tender_start,open,high,low,close,volume,open_interest,settlement';
const good='2026-09-30,2026-09-30,GOLDTEN,2026-10-30,2026-10-28,140000,141000,139000,140500,100,300,';
const csv=`${header}\n${good}\n`;
function clone(){return structuredClone(demo);}
test('normalization removes both quote unit and purity across all four families',()=>{
  for(const c of demo.contracts)assert.ok(Math.abs(normalize(15000*c.quoteGrams*c.purity,c)-15000)<1e-8);
});
test('z-score baseline excludes the current observation',()=>{
  const points=pairSeries(demo,params.a,params.b,20),p=points[30];
  const prior=points.slice(10,30).map(x=>x.spread),expected=prior.reduce((a,b)=>a+b,0)/20;
  assert.ok(Math.abs(p.mean!-expected)<1e-12);
  assert.equal(points[19].z,null);assert.notEqual(points[20].z,null);
});
test('appending or changing future data cannot change earlier statistics',()=>{
  const original=pairSeries(demo,params.a,params.b,20),cutoff=original[40].date;
  const modified=clone();modified.observations.forEach(o=>{if(o.date>cutoff){o.close*=100;o.open*=100;}});
  assert.deepEqual(pairSeries(modified,params.a,params.b,20).filter(p=>p.date<=cutoff),original.filter(p=>p.date<=cutoff));
});
test('future mutations cannot change earlier backtest decisions or capital marks',()=>{
  const cutoff='2026-09-01',baseline=backtest(demo,params),changed=clone();
  changed.observations.forEach(o=>{if(o.date>cutoff){o.open*=3;o.close*=3;o.volume=0;}});
  const replay=backtest(changed,params);
  assert.deepEqual(replay.equity.filter(p=>p.date<=cutoff),baseline.equity.filter(p=>p.date<=cutoff));
  assert.deepEqual(replay.trades.filter(t=>t.exitDate&&t.exitDate<=cutoff),baseline.trades.filter(t=>t.exitDate&&t.exitDate<=cutoff));
});
test('simulation enters later and reconciles native quote P&L, integer lots, both-leg costs and attribution',()=>{
  const r=backtest(demo,params),a=demo.contracts.find(c=>c.id===params.a)!,b=demo.contracts.find(c=>c.id===params.b)!;
  assert.ok(r.tradesCount>0,'sample should exercise real accounting paths');
  for(const t of r.trades.filter(t=>t.exitDate)) {
    assert.ok(t.entryDate>t.decisionDate);assert.ok(t.exitDate!<a.tenderStart);assert.ok(t.exitDate!<b.tenderStart);
    assert.ok(Number.isInteger(t.lotsA)&&Number.isInteger(t.lotsB));
    const expected=t.direction*(t.lotsA*a.lotGrams/a.quoteGrams*(t.exitA!-t.entryA)-t.lotsB*b.lotGrams/b.quoteGrams*(t.exitB!-t.entryB));
    const costs=(t.lotsA*a.lotGrams/a.quoteGrams*(t.entryA+t.exitA!)+t.lotsB*b.lotGrams/b.quoteGrams*(t.entryB+t.exitB!))*params.costBps/20000;
    assert.ok(Math.abs(t.gross-expected)<1e-8);assert.ok(Math.abs(t.costs-costs)<1e-8);assert.ok(Math.abs(t.net-(t.gross-t.costs))<1e-8);
  }
  assert.ok(Math.abs(r.attribution.reconciliation)<1e-8);
  assert.match(r.verdict,/Demonstration|unresolved/);
});
test('zero-volume legs cannot become hypothetical fills',()=>{
  const d=clone();d.observations.forEach(o=>{if(o.contractId===params.b)o.volume=0;});
  assert.equal(pairSeries(d,params.a,params.b).length,0);assert.equal(backtest(d,params).tradesCount,0);
});
test('maturity and delivery-location mismatches suppress entry',()=>{
  const r=backtest(demo,{...params,a:'GOLDM-2026-11-05'});assert.equal(r.trades.length,0);
  const s=backtest(demo,{...params,b:'GOLDPETAL-2026-10-30',costBps:0,minVolume:1});assert.equal(s.trades.length,0);
});
test('unresolved liquidation retains exposure and blocks any performance verdict',()=>{
  const baseline=backtest(demo,params),first=baseline.trades.find(t=>t.exitDate)!;
  const d=clone();d.observations=d.observations.filter(o=>o.date<=first.entryDate);
  const r=backtest(d,params);assert.equal(r.unresolved,true);assert.equal(r.trades.length,1);assert.equal(r.trades[0].exitDate,null);assert.match(r.verdict,/unresolved/);
});
test('signals remain non-tradable with an explicit explanation',()=>{
  const f=findings(demo);assert.equal(f.length,6);assert.ok(f.every(x=>x.tradable===false&&x.reasons.length>=3));
});
test('canonical ingestion is deterministic and separates Close from Settlement',()=>{
  const a=ingestCSV(csv,'file','2026-10-04'),b=ingestCSV(csv,'another name','2026-10-04');
  assert.equal(a.id,b.id);assert.equal(a.id.length,64);assert.equal(a.observations[0].close,140500);assert.equal(a.observations[0].settlement,null);assert.equal(a.provenance,'user-import');
  const withSettlement=ingestCSV(csv.replace('100,300,','100,300,140100'),'settlement','2026-10-04');assert.equal(withSettlement.observations[0].settlement,140100);
});
test('holiday fallback mismatches never publish',()=>{
  assert.throws(()=>ingestCSV(`${header}\n${good.replace('2026-09-30,2026-09-30','2026-09-30,2026-10-02')}`,'bad','2026-10-04'),(e:unknown)=>e instanceof ImportError&&e.code==='DATA_DATE_MISMATCH');
});
test('duplicates, malformed dates, future dates, NaN and inconsistent OHLC fail closed',()=>{
  const inputs=[`${header}\n${good}\n${good}`,csv.replaceAll('2026-09-30','2026-02-30'),csv.replaceAll('2026-09-30','2026-10-10'),csv.replace('140500','NaN'),csv.replace('141000','138000'),csv.replace('GOLDTEN','UNKNOWN')];
  for(const input of inputs)assert.throws(()=>ingestCSV(input,'bad','2026-10-04'),ImportError);
});
test('content validation rejects HTML, excessive fields, missing columns and quote errors',()=>{
  for(const bad of ['<!doctype html>server error',`${header}\n${'a'.repeat(1001)}`,'symbol,close\nGOLDTEN,1',`${header}\n"unclosed`])assert.throws(()=>ingestCSV(bad,'bad','2026-10-04'),ImportError);
  assert.deepEqual(parseCSV('a,b\n"x,y","quoted ""field"""\n'),[['a','b'],['x,y','quoted "field"']]);
});
test('strict dates do not silently roll into another month',()=>{assert.equal(strictDate('2026-02-30'),false);assert.equal(strictDate('2026-2-03'),false);assert.equal(strictDate('2024-02-29'),true);});
test('research parameters reject resource abuse and invalid numeric bounds',()=>{
  for(const p of [{...params,lookback:10000},{...params,costBps:NaN},{...params,entryZ:Infinity},{...params,b:params.a},{...params,capital:0},{...params,maxHold:1.5}])assert.throws(()=>validateParams(p,demo));
});
test('local origin validation respects the browser Host even if Next canonicalizes localhost',()=>{
  const request=new Request('http://localhost:3000/api/research',{method:'POST',headers:{Host:'127.0.0.1:3000',Origin:'http://127.0.0.1:3000'}});
  assert.equal(localBoundary(request),null);
  assert.equal(localBoundary(new Request('http://localhost:3000/api/research',{method:'POST',headers:{Host:'127.0.0.1:3000',Origin:'https://untrusted.example'}}))!.status,403);
  assert.equal(localBoundary(new Request('http://localhost:3000/api/research',{method:'POST',headers:{Host:'public.example'}}))!.status,403);
});
test('a bar has one full observed-session availability lag before the decision',()=>{
  const r=backtest(demo,params),dates=contractHistory(demo,params.a).map(o=>o.date);
  const points=pairSeries(demo,params.a,params.b,params.lookback);
  for(const t of r.trades){const informationDate=dates[dates.indexOf(t.decisionDate)-1];assert.ok(informationDate<t.decisionDate);assert.ok(Math.abs(points.find(p=>p.date===informationDate)!.z!)>=params.entryZ);}
});
test('failed exits and missing valuations retain exposure instead of synthesizing liquidation',()=>{
  const r=backtest(demo,params),first=r.trades.find(t=>t.exitDate)!;
  const nofill=clone();nofill.observations.forEach(o=>{if(o.contractId===params.b&&o.date>first.entryDate)o.volume=0;});
  const simulated=backtest(nofill,params);assert.equal(simulated.unresolved,true);assert.equal(simulated.trades[0].exitDate,null);
  const missing=clone();missing.observations=missing.observations.filter(o=>!(o.contractId===params.b&&o.date===first.exitDate));
  const m=backtest(missing,params);assert.equal(m.unresolved,true);assert.ok(m.rejected['Missing held-contract valuation']>0);
});
