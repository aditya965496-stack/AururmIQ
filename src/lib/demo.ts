import type { Contract, Dataset, Observation, SymbolName } from './types';
export const SPECS: Record<SymbolName, { lotGrams: number; quoteGrams: number; purity: number; location: string }> = {
  GOLDM: {lotGrams: 100, quoteGrams: 10, purity: 0.995, location: 'Ahmedabad'},
  GOLDTEN: {lotGrams: 10, quoteGrams: 10, purity: 0.999, location: 'Ahmedabad'},
  GOLDGUINEA: {lotGrams: 8, quoteGrams: 8, purity: 0.999, location: 'Ahmedabad'},
  GOLDPETAL: {lotGrams: 1, quoteGrams: 1, purity: 0.999, location: 'Mumbai'}
};
export const SYMBOLS = Object.keys(SPECS) as SymbolName[];
export function makeDemo(): Dataset {
  const definitions: [SymbolName, string, string][] = [
    ['GOLDM', '2026-11-05', '2026-11-02'], ['GOLDM', '2026-12-04', '2026-12-02'],
    ['GOLDTEN', '2026-10-30', '2026-10-28'], ['GOLDTEN', '2026-11-30', '2026-11-26'],
    ['GOLDGUINEA', '2026-10-30', '2026-10-28'], ['GOLDPETAL', '2026-10-30', '2026-10-28']
  ];
  const contracts: Contract[] = definitions.map(([symbol, expiry, tenderStart]) => ({id: `${symbol}-${expiry}`, symbol, expiry, tenderStart, ...SPECS[symbol], specStatus: 'provisional'}));
  const observations: Observation[] = [];
  let index = 0;
  for (let time = Date.UTC(2026, 6, 1); time <= Date.UTC(2026, 9, 1); time += 86400000) {
    const day = new Date(time);
    if (day.getUTCDay() === 0 || day.getUTCDay() === 6) continue;
    const gold = 14040 + index * 9.3 + Math.sin(index * 0.15) * 95 + Math.cos(index * 1.6) * 11;
    contracts.forEach((c, ci) => {
      const pulse = Math.exp(-Math.pow((index - 30) / 3.2, 2)) * 42 + Math.exp(-Math.pow((index - 52) / 2.8, 2)) * -38 + Math.exp(-Math.pow((index - 66) / 3, 2)) * 35;
      const basis = [4, 19, 2, 16, 8 + pulse + Math.sin(index * 0.8) * 7, 35 + Math.cos(index * 0.3) * 5][ci];
      const normalized = gold + basis;
      const close = Math.round(normalized * c.quoteGrams * c.purity);
      const open = Math.round((normalized - Math.sin(index * 0.8 + ci) * 18) * c.quoteGrams * c.purity);
      const volume = Math.round([11400, 7800, 2800, 1300, 540, 28][ci] * (0.85 + 0.25 * Math.sin(index * 0.4 + ci)));
      observations.push({contractId: c.id, date: day.toISOString().slice(0, 10), open, high: Math.max(open, close) + c.quoteGrams * 20, low: Math.min(open, close) - c.quoteGrams * 20, close, settlement: null, volume, oi: Math.round(volume * 2.8 + 150)});
    });
    index++;
  }
  return {id: 'demo', name: 'Gold research sandbox', provenance: 'synthetic', hash: 'synthetic-v1-deterministic', rawHash: 'not-an-exchange-file', createdAt: '2026-10-04T00:00:00Z', parserVersion: 'demo-v1', contracts, observations,
    warnings: ['All prices and volumes in this sandbox are generated examples, not MCX observations.', 'Contract mechanics and tender dates are provisional assumptions from the supplied plan; historical circulars and the exchange calendar are not verified.', 'Weekday-only sample calendar does not model exchange holidays.', 'Close prices are used; official settlement data is not provided.']};
}
