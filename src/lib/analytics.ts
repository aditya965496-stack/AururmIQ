import type { Contract, Dataset, Finding, Observation, PairPoint } from './types';
export const MODEL_VERSION = 'rv-prior-window-1.0';
export function normalize(price: number, c: Contract) { return price / (c.quoteGrams * c.purity); }
export function daysBetween(a: string, b: string) { return Math.round((Date.parse(b) - Date.parse(a)) / 86400000); }
export function contractHistory(d: Dataset, id: string) { return d.observations.filter(o => o.contractId === id).sort((a,b) => a.date.localeCompare(b.date)); }
export function liquidity(o: Observation | undefined) {
  if (!o || o.volume <= 0 || o.oi <= 0) return 0;
  return Math.round(Math.min(100, (Math.log10(o.volume + 1) / 4) * 65 + (Math.log10(o.oi + 1) / 5) * 35));
}
export function pairSeries(d: Dataset, aId: string, bId: string, lookback = 20): PairPoint[] {
  const a = d.contracts.find(c=>c.id===aId), b = d.contracts.find(c=>c.id===bId);
  if (!a || !b || aId === bId) return [];
  const aRows = contractHistory(d, aId), bRows = new Map(contractHistory(d, bId).map(o=>[o.date,o]));
  const output: PairPoint[] = [];
  for (const ar of aRows) {
    const br = bRows.get(ar.date);
    if (!br || ar.volume <= 0 || br.volume <= 0 || ar.oi <= 0 || br.oi <= 0) continue;
    const av = normalize(ar.close,a), bv = normalize(br.close,b);
    const spread = (bv-av)/((av+bv)/2)*10000;
    const prior = output.slice(-lookback).map(p=>p.spread);
    const mean = prior.length===lookback ? prior.reduce((s,v)=>s+v,0)/lookback : null;
    const std = mean===null ? null : Math.sqrt(prior.reduce((s,v)=>s+(v-mean)**2,0)/(lookback-1));
    const z = mean!==null && std!==null && std>1e-8 ? (spread-mean)/std : null;
    output.push({date: ar.date, a: av, b: bv, spread, z, mean, std, volumeA: ar.volume, volumeB: br.volume});
  }
  return output;
}
export function findings(d: Dataset, lookback=20, costs=10): Finding[] {
  const asOf = [...d.observations.map(o=>o.date)].sort().at(-1);
  const front = [...new Set(d.contracts.map(c=>c.symbol))].map(symbol=>d.contracts.filter(c=>c.symbol===symbol && (!asOf || c.expiry>=asOf)).sort((a,b)=>a.expiry.localeCompare(b.expiry))[0]).filter(Boolean);
  const results: Finding[] = [];
  for (let i=0;i<front.length;i++) for (let j=i+1;j<front.length;j++) {
    const a = front[i], b = front[j], series = pairSeries(d,a.id,b.id,lookback), point = series.at(-1);
    if (!point) continue;
    const la = contractHistory(d,a.id).find(o=>o.date===point.date), lb = contractHistory(d,b.id).find(o=>o.date===point.date);
    const liq = Math.min(liquidity(la),liquidity(lb));
    const edge = point.mean===null ? 0 : Math.abs(point.spread-point.mean)-costs;
    const reasons: string[] = [];
    if (point.date !== asOf) reasons.push('Pair has no jointly active observations on the dataset’s latest date');
    if (d.provenance==='synthetic') reasons.push('Synthetic data — demonstration only');
    reasons.push('Contract specifications and trading calendar need verification');
    if (a.expiry!==b.expiry) reasons.push('Maturity mismatch — no validated carry model');
    if (a.location!==b.location) reasons.push('Different delivery locations — structural basis unresolved');
    if (liq<60) reasons.push('Thin activity — liquidity proxy below 60');
    if (point.z===null) reasons.push('Insufficient prior observations or constant spread');
    if (edge<=0) reasons.push('Estimated convergence does not cover assumed round-trip cost');
    if (daysBetween(point.date,a.tenderStart)<=10 || daysBetween(point.date,b.tenderStart)<=10) reasons.push('Tender window approaching — entry buffer not available');
    reasons.push('Daily bars cannot establish executable bid/ask or simultaneous fills');
    const status = point.z===null ? 'NO SIGNAL' : Math.abs(point.z)>=2 ? 'WATCH' : 'NORMAL';
    results.push({a,b,spread: point.spread,z:point.z,liquidity:liq,edge,status,reasons,tradable:false,sameExpiry:a.expiry===b.expiry});
  }
  return results.sort((a,b)=>Math.abs(b.z??0)-Math.abs(a.z??0));
}
