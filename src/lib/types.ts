export type SymbolName = 'GOLDM' | 'GOLDTEN' | 'GOLDGUINEA' | 'GOLDPETAL';
export type Contract = {
  id: string; symbol: SymbolName; expiry: string; tenderStart: string;
  lotGrams: number; quoteGrams: number; purity: number; location: string;
  specStatus: 'provisional';
};
export type Observation = {
  contractId: string; date: string; open: number; high: number; low: number;
  close: number; settlement: number | null; volume: number; oi: number;
};
export type Dataset = {
  id: string; name: string; provenance: 'synthetic' | 'user-import';
  hash: string; createdAt: string; parserVersion: string; contracts: Contract[];
  observations: Observation[]; warnings: string[]; rawHash: string;
};
export type PairPoint = { date: string; a: number; b: number; spread: number; z: number | null; mean: number | null; std: number | null; volumeA: number; volumeB: number };
export type Finding = {
  a: Contract; b: Contract; spread: number; z: number | null; liquidity: number;
  edge: number; status: 'WATCH' | 'NO SIGNAL' | 'NORMAL'; reasons: string[];
  tradable: false; sameExpiry: boolean;
};
export type ResearchParams = { a: string; b: string; lookback: number; entryZ: number; exitZ: number; maxHold: number; costBps: number; capital: number; minVolume: number; exitBuffer: number };
export type Trade = {
  decisionDate: string; entryDate: string; exitDate: string | null; direction: number;
  lotsA: number; lotsB: number; entryA: number; entryB: number; exitA: number | null; exitB: number | null;
  gross: number; costs: number; net: number; reason: string;
};
export type EquityPoint = { date: string; equity: number; drawdown: number; gold: number };
export type ResearchResult = {
  id: string; datasetId: string; datasetHash: string; modelVersion: string; createdAt: string;
  params: ResearchParams; trades: Trade[]; equity: EquityPoint[]; rejected: Record<string, number>;
  gross: number; costs: number; net: number; maxDrawdown: number; winRate: number | null;
  residualGrams: number; tradesCount: number; unresolved: boolean;
  attribution: { gold: number; basis: number; costs: number; reconciliation: number };
  verdict: string; warnings: string[]; assumptions: string[];
};
