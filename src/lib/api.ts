const API = process.env.REACT_APP_API_BASE!;

export async function apiHealth(): Promise<{ ok: boolean }> {
  const r = await fetch(`${API}/api/health`);
  if (!r.ok) throw new Error(`health ${r.status}`);
  return r.json();
}

export type Candle = { time:number; open:number; high:number; low:number; close:number; volume?:number };
export async function fetchHistory(ticker:string, tf:'minute'|'hour'|'day', from:string, to:string) {
  const q = new URLSearchParams({ ticker, tf, from, to }).toString();
  const r = await fetch(`${API}/api/history?${q}`, { cache:'no-store' });
  if (!r.ok) throw new Error(`history ${r.status}`);
  const data = await r.json();
  return (data ?? []).map((b:any) => ({
    time: Math.round((b.time ?? b.t) / ((b.time ?? b.t) > 2_000_000_000 ? 1000 : 1)),
    open: b.open ?? b.o, high: b.high ?? b.h, low: b.low ?? b.l, close: b.close ?? b.c, volume: b.volume ?? b.v,
  })) as Candle[];
}

export type Metrics = { timestamp:number; sectors:{ sector:string; newHighs:number; newLows:number; adrAvg:number|null }[] };
export async function fetchMetrics(): Promise<Metrics> {
  const r = await fetch(`${API}/api/market-metrics`, { cache:'no-store' });
  if (!r.ok) throw new Error(`metrics ${r.status}`);
  return r.json();
}
