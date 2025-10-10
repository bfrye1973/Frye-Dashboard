/* -------------------------------------------------------------
   Frye Candles SDK — seed + stream + merge (final bars only)
   History  : REACT_APP_API_BASE   (/api/v1/ohlc)
   Streaming: REACT_APP_STREAM_BASE (/stream/agg)
   ------------------------------------------------------------- */
export type Timeframe =
  | "1m" | "5m" | "10m" | "15m" | "30m"
  | "1h" | "4h" | "1d";

export type Bar = {
  time: number;   // epoch seconds (bucket start)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type SeedOptions = {
  symbol: string;
  timeframe: Timeframe;
  limit?: number;
};

export type StreamOptions = {
  symbol: string;
  timeframe: Timeframe;
  onBar: (bar: Bar) => void;
};

const API_BASE =
  (typeof process !== "undefined" && (process as any).env?.REACT_APP_API_BASE) ||
  (typeof window !== "undefined" && (window as any).__API_BASE__) ||
  "";

const STREAM_BASE =
  (typeof process !== "undefined" && (process as any).env?.REACT_APP_STREAM_BASE) ||
  "";

// ---------- utils ----------
const MINUTES: Record<Timeframe, number> = {
  "1m": 1, "5m": 5, "10m": 10, "15m": 15, "30m": 30,
  "1h": 60, "4h": 240, "1d": 1440,
};

export function bucketStartSec(sec: number, tf: Timeframe): number {
  const size = MINUTES[tf] * 60;
  return Math.floor(sec / size) * size;
}

export function mergeBar(list: Bar[], bar: Bar): Bar[] {
  if (!Array.isArray(list) || list.length === 0) return [bar];
  const last = list[list.length - 1];
  if (last.time === bar.time) {
    const next = list.slice(0, -1);
    next.push(bar);
    return next;
  }
  return [...list, bar];
}

export function mergeBars(list: Bar[], incoming: Bar[]): Bar[] {
  let out = list.slice();
  for (const b of incoming) out = mergeBar(out, b);
  return out;
}

// Optional local aggregation (1m → higher TF), final bars only
export function bucketAggregate(src: Bar[], tf: Timeframe): Bar[] {
  if (tf === "1m" || src.length === 0) return src.slice();
  const out: Bar[] = [];
  let cur: Bar | null = null;
  for (const b of src) {
    const t0 = bucketStartSec(b.time, tf);
    if (!cur || cur.time < t0) {
      cur = { time: t0, open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume };
      out.push(cur);
    } else {
      cur.high   = Math.max(cur.high, b.high);
      cur.low    = Math.min(cur.low,  b.low);
      cur.close  = b.close;
      cur.volume = (cur.volume || 0) + (b.volume || 0);
    }
  }
  return out;
}

// ---------- history (seed) ----------
export async function fetchHistory({ symbol, timeframe, limit }: SeedOptions): Promise<Bar[]> {
  const sym = encodeURIComponent(String(symbol || "SPY").toUpperCase());
  const tf = encodeURIComponent(timeframe);
  const lim = typeof limit === "number" && limit > 0 ? limit : timeframe === "1m" ? 50000 : 5000;

  if (!API_BASE) throw new Error("[frye-candles] API_BASE is empty. Set REACT_APP_API_BASE.");
  const url = `${API_BASE.replace(/\/+$/, "")}/api/v1/ohlc?symbol=${sym}&timeframe=${tf}&limit=${lim}`;

  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`[frye-candles] OHLC ${r.status}: ${url}`);
  const data = await r.json();
  const arr: Bar[] = Array.isArray(data) ? data : (data?.bars || []);
  return arr
    .filter(Boolean)
    .filter(b =>
      Number.isFinite(b.time) &&
      Number.isFinite(b.open) &&
      Number.isFinite(b.high) &&
      Number.isFinite(b.low) &&
      Number.isFinite(b.close)
    )
    .sort((a, b) => a.time - b.time);
}

// ---------- live stream (SSE) ----------
export function subscribeStream({ symbol, timeframe, onBar }: StreamOptions): () => void {
  if (!STREAM_BASE) {
    console.warn("[frye-candles] STREAM_BASE empty; live disabled. Set REACT_APP_STREAM_BASE.");
    return () => {};
  }
  const base = STREAM_BASE.replace(/\/+$/, "");
  const url  = `${base}/stream/agg?symbol=${encodeURIComponent(symbol)}&tf=${encodeURIComponent(timeframe)}`;

  const es = new EventSource(url);
  es.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data);
      if (msg && msg.ok && msg.type === "bar" && msg.bar && Number.isFinite(msg.bar.time)) {
        onBar(msg.bar as Bar);
      }
    } catch { /* ignore heartbeats */ }
  };
  es.onerror = () => { /* browser auto-reconnects */ };
  return () => es.close();
}

// ---------- convenience: seed + stream ----------
export type SeedAndStreamResult = { bars: Bar[]; unsubscribe: () => void; };

export async function seedAndStream(
  opts: SeedOptions & { onBar?: (bar: Bar) => void }
): Promise<SeedAndStreamResult> {
  let bars = await fetchHistory(opts);
  const unsubscribe = subscribeStream({
    symbol: opts.symbol,
    timeframe: opts.timeframe,
    onBar: (bar) => {
      bars = mergeBar(bars, bar);
      opts.onBar?.(bar);
    },
  });
  return { bars, unsubscribe };
}

// ---------- helper: Phoenix time ----------
export function phoenixTime(sec: number, daily = false): string {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Phoenix",
    hour12: true,
    ...(daily ? { month: "short", day: "2-digit" } : { hour: "numeric", minute: "2-digit" }),
  });
  return fmt.format(new Date(sec * 1000));
}

export default {
  fetchHistory,
  subscribeStream,
  seedAndStream,
  mergeBar,
  mergeBars,
  bucketAggregate,
  bucketStartSec,
  phoenixTime,
};
