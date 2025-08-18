import React, { useEffect, useMemo, useRef, useState } from "react";
import LiveFeedsChart from "../components/LiveFeedsChart";

const API_BASE =
  (typeof window !== "undefined" && window.__API_BASE__) ||
  (typeof process !== "undefined" &&
    process.env &&
    (process.env.API_BASE_URL ||
      process.env.REACT_APP_API_BASE_URL ||
      process.env.VITE_API_BASE_URL)) ||
  "https://frye-market-backend-1.onrender.com";

const WS_BASE =
  (typeof window !== "undefined" && window.__WS_BASE__) ||
  (typeof process !== "undefined" &&
    process.env &&
    (process.env.WS_BASE_URL ||
      process.env.REACT_APP_WS_BASE ||
      process.env.VITE_WS_BASE_URL)) ||
  API_BASE.replace(/^http/i, "ws");

function fmtTsSec(ts) {
  try { return new Date(ts * 1000).toLocaleString(); } catch { return "—"; }
}

function Tile({ title, ts, newHighs, newLows, adrAvg }) {
  return (
    <div style={styles.tile}>
      <div style={styles.tileHead}>
        <span style={{ fontWeight: 800 }}>{title}</span>
        <span style={styles.tileTs}>{fmtTsSec(ts)}</span>
      </div>
      <div style={styles.tileRow}><b>New Highs:</b>&nbsp;{newHighs ?? "—"}</div>
      <div style={styles.tileRow}><b>New Lows:</b>&nbsp;{newLows ?? "—"}</div>
      <div style={styles.tileRow}><b>ADR Avg:</b>&nbsp;{adrAvg ?? "—"}</div>
    </div>
  );
}

export default function LiveFeeds() {
  const [ticker, setTicker] = useState("AAPL");
  const [tf, setTf] = useState("minute"); // minute | hour | day
  const [metrics, setMetrics] = useState([]);
  const [metricsTs, setMetricsTs] = useState(null);

  // candles state for the chart + overlay
  const [candles, setCandles] = useState([]);
  const lastTimeRef = useRef(null);
  const wsStopRef = useRef(null);

  // Time range (last 7d)
  const { fromISO, toISO } = useMemo(() => {
    const to = new Date();
    const from = new Date(Date.now() - 7 * 864e5);
    return {
      fromISO: from.toISOString().slice(0, 10),
      toISO: to.toISOString().slice(0, 10),
    };
  }, []);

  // load history + open WS on ticker/tf change
  useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      const url = `${API_BASE}/api/history?ticker=${encodeURIComponent(
        ticker
      )}&tf=${encodeURIComponent(tf)}&from=${fromISO}&to=${toISO}`;
      try {
        const r = await fetch(url);
        if (!r.ok) throw new Error(`history ${r.status}`);
        const data = await r.json();
        const list = (data ?? []).map(b => {
          const raw = b.time ?? b.t;
          const time = Math.round(raw / (raw > 2_000_000_000 ? 1000 : 1)); // seconds
          return {
            time,
            open: b.open ?? b.o,
            high: b.high ?? b.h,
            low: b.low ?? b.l,
            close: b.close ?? b.c,
            volume: b.volume ?? b.v,
          };
        });
        if (cancelled) return;
        setCandles(list);
        lastTimeRef.current = list.at(-1)?.time ?? null;
      } catch (e) {
        console.error("loadHistory error:", e);
      }
    }

    function openWS() {
      try { wsStopRef.current && wsStopRef.current(); } catch {}
      let ws;
      try { ws = new WebSocket(WS_BASE); } catch { return () => {}; }

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (!msg || !msg.type) return;

          if (msg.type === "bar" && msg.payload) {
            const b = msg.payload;
            if (b.ticker && b.ticker !== ticker) return;

            const time = Math.round(b.time / (b.time > 2_000_000_000 ? 1000 : 1));
            const bar = {
              time,
              open: b.open, high: b.high, low: b.low, close: b.close,
              volume: b.volume,
            };

            setCandles((prev) => {
              if (!prev?.length) return [bar];
              const last = prev[prev.length - 1];
              if (last.time === bar.time) {
                const copy = prev.slice();
                copy[copy.length - 1] = bar;
                return copy;
              } else {
                return [...prev, bar];
              }
            });
            lastTimeRef.current = time;
          } else if (msg.type === "metrics" && msg.payload) {
            setMetrics(msg.payload.sectors || []);
            setMetricsTs(msg.payload.timestamp || Math.floor(Date.now() / 1000));
          }
        } catch {}
      };

      return () => { try { ws.close(); } catch {} };
    }

    loadHistory();
    wsStopRef.current = openWS();

    return () => {
      cancelled = true;
      try { wsStopRef.current && wsStopRef.current(); } catch {}
    };
  }, [ticker, tf, fromISO, toISO]);

  // one-time metrics boot
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/api/market-metrics`);
        if (!r.ok) return;
        const m = await r.json();
        setMetrics(m.sectors || []);
        setMetricsTs(m.timestamp || Math.floor(Date.now() / 1000));
      } catch {}
    })();
  }, []);

  return (
    <section>
      {/* Controls */}
      <div style={styles.controls}>
        <label style={styles.label}>Ticker</label>
        <input
          value={ticker}
          onChange={(e) => setTicker(e.target.value.toUpperCase().slice(0, 10))}
          placeholder="AAPL"
          style={styles.input}
        />
        <div style={{ display: "flex", gap: 6 }}>
          {["minute", "hour", "day"].map((k) => (
            <button
              key={k}
              onClick={() => setTf(k)}
              style={{
                ...styles.btn,
                background: tf === k ? "#21304b" : "#10141f",
              }}
              title={`Timeframe: ${k}`}
            >
              {k === "minute" ? "1m" : k === "hour" ? "1h" : "1d"}
            </button>
          ))}
        </div>
      </div>

      {/* Strategy strips */}
      <div style={styles.strips}>
        <div style={styles.strip}><b>Wave 3</b> • signals feed</div>
        <div style={styles.strip}><b>Flagpole</b> • breakouts</div>
        <div style={styles.strip}><b>EMA Run</b> • daily/weekly</div>
      </div>

      {/* Tiles */}
      <div style={styles.tiles}>
        {metrics?.length ? (
          metrics.map((s, i) => (
            <Tile
              key={i}
              title={s.sector}
              ts={metricsTs}
              newHighs={s.newHighs}
              newLows={s.newLows}
              adrAvg={s.adrAvg}
            />
          ))
        ) : (
          <div style={{ opacity: 0.7 }}>Loading market metrics…</div>
        )}
      </div>

      {/* Chart + overlay */}
      <LiveFeedsChart candles={candles} height={480} />
    </section>
  );
}

const styles = {
  controls: {
    display: "flex", gap: 12, alignItems: "center",
    margin: "8px 0 14px", flexWrap: "wrap",
  },
  label: { fontSize: 14, opacity: 0.8 },
  input: {
    background: "#10141f", color: "#e6edf7",
    border: "1px solid #1b2130", borderRadius: 8,
    padding: "8px 10px", width: 120, outline: "none",
  },
  btn: {
    padding: "8px 10px", borderRadius: 8,
    border: "1px solid #1b2130", color: "#e6edf7", cursor: "pointer",
  },
  strips: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px,1fr))",
    gap: 8, marginBottom: 10,
  },
  strip: {
    background: "#11151f", border: "1px solid #1b2130",
    borderRadius: 10, padding: "8px 10px", fontSize: 13, color: "#cfd8ec",
  },
  tiles: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px,1fr))",
    gap: 12, marginBottom: 14,
  },
  tile: {
    background: "#11151f", border: "1px solid #1b2130",
    borderRadius: 10, padding: 12,
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
  },
  tileHead: { display: "flex", justifyContent: "space-between", marginBottom: 6 },
  tileTs: { fontSize: 12, opacity: 0.6 },
  tileRow: { fontSize: 13, lineHeight: "18px" },
};
