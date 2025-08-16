// src/pages/LiveFeeds.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createChart } from "lightweight-charts";

/** ---------- Config (backend URLs) ---------- */
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
  API_BASE.replace(/^http/i, "ws"); // derive wss:// from https://

/** ---------- Helpers ---------- */
function fmtTsSec(ts) {
  try {
    return new Date(ts * 1000).toLocaleString();
  } catch {
    return "—";
  }
}
function clamp(v, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, v));
}

/** ---------- Sector Tile ---------- */
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

/** ---------- LiveFeeds Page ---------- */
export default function LiveFeeds() {
  // Controls
  const [ticker, setTicker] = useState("AAPL");
  const [tf, setTf] = useState("minute"); // minute | hour | day

  // Metrics (sector tiles)
  const [metrics, setMetrics] = useState([]);
  const [metricsTs, setMetricsTs] = useState(null);

  // Chart refs
  const wrapRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const lastTimeRef = useRef(null);
  const wsStopRef = useRef(null);

  // Time range (last 7d by default)
  const { fromISO, toISO } = useMemo(() => {
    const to = new Date();
    const from = new Date(Date.now() - 7 * 864e5);
    const toS = to.toISOString().slice(0, 10);
    const fromS = from.toISOString().slice(0, 10);
    return { fromISO: fromS, toISO: toS };
  }, []);

  /** ----- Build chart once ----- */
  useEffect(() => {
    if (!wrapRef.current) return;
    const chart = createChart(wrapRef.current, {
      width: wrapRef.current.clientWidth || 960,
      height: 420,
      layout: { background: { type: "Solid", color: "#0f0f0f" }, textColor: "#e6edf7" },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.06)" },
        horzLines: { color: "rgba(255,255,255,0.06)" },
      },
      timeScale: { timeVisible: tf !== "day", secondsVisible: tf === "minute" },
      rightPriceScale: { borderVisible: false },
      crosshair: { mode: 1 },
    });
    const series = chart.addCandlestickSeries();
    chartRef.current = chart;
    seriesRef.current = series;

    const ro = new ResizeObserver(() => {
      try {
        chart.applyOptions({ width: wrapRef.current.clientWidth || 960 });
      } catch {}
    });
    ro.observe(wrapRef.current);

    return () => {
      ro.disconnect();
      try { chart.remove(); } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // build once

  /** ----- Load history & open WS when ticker/tf changes ----- */
  useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      const url = `${API_BASE}/api/history?ticker=${encodeURIComponent(
        ticker
      )}&tf=${encodeURIComponent(tf)}&from=${fromISO}&to=${toISO}`;
      try {
        const r = await fetch(url);
        if (!r.ok) throw new Error(`history ${r.status}`);
        const candles = await r.json(); // [{time,open,high,low,close,volume}]
        if (cancelled || !seriesRef.current) return;
        seriesRef.current.setData(candles);
        lastTimeRef.current = candles.at(-1)?.time ?? null;
        try { chartRef.current.timeScale().fitContent(); } catch {}
      } catch (e) {
        console.error("loadHistory error:", e);
      }
    }

    function openWS() {
      // Close previous socket
      try { wsStopRef.current && wsStopRef.current(); } catch {}
      let ws;
      try {
        ws = new WebSocket(WS_BASE);
      } catch (e) {
        console.error("WS open failed:", e);
        return () => {};
      }

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (!msg || !msg.type) return;

          if (msg.type === "bar" && msg.payload) {
            const b = msg.payload; // {ticker,time,open,high,low,close,volume}
            if (b.ticker && b.ticker !== ticker) return; // filter other symbols if backend fans out
            if (!seriesRef.current) return;
            if (lastTimeRef.current && b.time === lastTimeRef.current) {
              seriesRef.current.update(b);
            } else {
              seriesRef.current.update(b);
              lastTimeRef.current = b.time;
            }
          } else if (msg.type === "metrics" && msg.payload) {
            setMetrics(msg.payload.sectors || []);
            setMetricsTs(msg.payload.timestamp || Math.floor(Date.now() / 1000));
          }
        } catch {}
      };

      ws.onerror = () => {/* ignore, backend may restart */};
      ws.onclose = () => {/* allow reconnect by caller if needed */};

      return () => {
        try { ws.close(); } catch {}
      };
    }

    loadHistory();
    wsStopRef.current = openWS();

    return () => {
      cancelled = true;
      try { wsStopRef.current && wsStopRef.current(); } catch {}
    };
  }, [ticker, tf, fromISO, toISO]);

  /** ----- One-time metrics boot ----- */
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

      {/* Strategy strips (placeholder hooks for now) */}
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

      {/* Chart */}
      <div ref={wrapRef} style={styles.chartBox} />
    </section>
  );
}

/** ---------- Styles ---------- */
const styles = {
  controls: {
    display: "flex",
    gap: 12,
    alignItems: "center",
    margin: "8px 0 14px",
    flexWrap: "wrap",
  },
  label: { fontSize: 14, opacity: 0.8 },
  input: {
    background: "#10141f",
    color: "#e6edf7",
    border: "1px solid #1b2130",
    borderRadius: 8,
    padding: "8px 10px",
    width: 120,
    outline: "none",
  },
  btn: {
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid #1b2130",
    color: "#e6edf7",
    cursor: "pointer",
  },
  strips: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px,1fr))",
    gap: 8,
    marginBottom: 10,
  },
  strip: {
    background: "#11151f",
    border: "1px solid #1b2130",
    borderRadius: 10,
    padding: "8px 10px",
    fontSize: 13,
    color: "#cfd8ec",
  },
  tiles: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px,1fr))",
    gap: 12,
    marginBottom: 14,
  },
  tile: {
    background: "#11151f",
    border: "1px solid #1b2130",
    borderRadius: 10,
    padding: 12,
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
  },
  tileHead: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  tileTs: { fontSize: 12, opacity: 0.6 },
  tileRow: { fontSize: 13, lineHeight: "18px" },
  chartBox: {
    width: "100%",
    minHeight: 420,
    borderRadius: 10,
    overflow: "hidden",
    border: "1px solid #1b2130",
    background: "#0f0f0f",
  },
};
