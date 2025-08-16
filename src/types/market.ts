export type Candle = {
  time: number; open: number; high: number; low: number; close: number; volume?: number;
};

export type Metrics = {
  timestamp: number;
  sectors: { sector: string; newHighs: number; newLows: number; adrAvg: number | null }[];
};

export type WsMsg =
  | { type: 'metrics'; payload: Metrics }
  | { type: 'bar'; payload: Candle & { ticker: string } };
