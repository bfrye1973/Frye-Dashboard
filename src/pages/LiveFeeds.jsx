// src/pages/LiveFeeds.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createChart } from "lightweight-charts";
import MoneyFlowOverlay from "../components/overlays/MoneyFlowOverlay";

/** ---------- Backend config ---------- */
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

/** ---------- helpers ---------- */
function fmtTs(tsSec) {
  try {
    return new Date(tsSec * 1000).toLocaleString();
  } catch {
    return "—";
  }
}

/** ---------- Tile (metrics) ---------- */
function Tile({ title, ts, newHighs, newLows, adrAvg }) {
  return (
    <div style={S.tile}>
      <div style={S.tileHead}>
        <b>{title}</b>
        <span style={S.tileTs}>{fmtTs(ts)}</span>
      </div>
      <div style={S.tileRow}><b>New Highs:</b>&nbsp;{newHighs ?? "—"}</div>
      <div style={S.tileRow}><b>New Lows:</b>&nbsp;{newLows ?? "—"}</div>
      <div style={S.tileRow}><b>ADR Avg:</b>&nbsp;{adrAvg ?? "—"}</div>
    </div>
  );
}

/** =========================================================
 * LiveFeeds page
 * ======================================================= */
export default function LiveFeeds() {
  // Controls
  const [ticker, setTicker] = useState("AAPL");
  const [tf, setTf] = useState("minute"); // minute | hour | day

  // Market metrics (sector tiles)
  const [metrics, setMetrics] = useState([]);
  const [metricsTs, setMetricsTs] = useState(null);

  // Candles we show + stream (also given to overlay)
  const [candles, setCandles] = useState([]);

  // Chart refs
  const wrapRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const wsStopRef = useRef(null);
  const lastTimeRef = useRef(null);

  // Time range (last 7 days)
  const { fromISO, toISO } = useMemo(() => {
    const to = new Date();
    const from = new Date(Date.now() - 7 * 864e5);
    return {
      fromISO: from.toISOString().slice(0, 10),
      toISO: to.toISOString().slice(0, 10),
    };
  }, []);

  /** ----- create chart once ----- */
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
      timeScale: { timeVisible: true, secondsVisible: true },
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
      try { ro.disconnect(); } catch {}
      try { wsStopRef.current && wsStopRef.current(); } catch {}
      try { chart.remove(); } catch {}
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  /** ----- load history + open WS when ticker/tf changes ----- */
  useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      const url = `${API_BASE}/api/history?ticker=${encodeURIComponent(
        ticker
      )}&tf=${encodeURIComponent(tf)}&from=${fromISO}&to=${toISO}`;
      try {
        const r = await fetch(url);
        if (!r.ok) throw new Error(`history ${r.status}`);
        const rows = await r.json(); // [{time,open,high,low,close,volume}]
        if (cancelled) return;

        // push into chart + local state
        seriesRef.current?.setData(rows);
        setCandles(rows);
        lastTimeRef.current = rows.at(-1)?.time ?? null;
        try { chartRef.current?.timeScale().fitContent(); } catch {}
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
            const b = msg.payload; // {ticker,time,open,high,low,close,volume}
            if (b.ticker && b.ticker !== ticker) return;

            // Update chart
            if (lastTimeRef.current && b.time === lastTimeRef.current) {
              seriesRef.current?.update(b);
              setCandles((prev) => {
                if (!prev.length) return [b];
                const copy = prev.slice();
                copy[copy.length - 1] = b;
                return copy;
              });
            } else {
              seriesRef.current?.update(b);
              lastTimeRef.current = b.time;
              setCandles((prev) => prev.concat(b));
            }
          } else if (msg.type === "metrics" && msg.payload) {
            setMetrics(msg.payload.sectors || []);
            setMetricsTs(msg.payload.timestamp || Math.floor(Date.now() / 1000));
          }
        } catch {}
      };

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

  /** ----- one-time metrics seed ----- */
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
      <div style={S.controls}>
        <label style={S.label}>Ticker</label>
        <input
          value={ticker}
          onChange={(e) => setTicker(e.target.value.toUpperCase().slice(0, 10))}
          placeholder="AAPL"
          style={S.input}
        />
        <div style={{ display: "flex", gap: 6 }}>
          {["minute", "hour", "day"].map((k) => (
            <button
              key={k}
              onClick={() => setTf(k)}
              style={{ ...S.btn, background: tf === k ? "#21304b" : "#10141f" }}
              title={`Timeframe: ${k}`}
            >
              {k === "minute" ? "1m" : k === "hour" ? "1h" : "1d"}
            </button>
          ))}
        </div>
      </div>

      {/* Strategy strips (placeholders) */}
      <div style={S.strips}>
        <div style={S.strip}><b>Wave 3</b> • signals feed</div>
        <div style={S.strip}><b>Flagpole</b> • breakouts</div>
        <div style={S.strip}><b>EMA Run</b> • daily/weekly</div>
      </div>

      {/* Tiles */}
      <div style={S.tiles}>
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

      {/* Chart + Overlay */}
      <div ref={wrapRef} style={S.chartBox}>
        {/* Overlay needs the container + current candles */}
        <MoneyFlowOverlay chartContainer={wrapRef.current} candles={candles} />
      </div>
    </section>
  );
}

/** ---------- styles ---------- */
const S = {
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
    position: "relative",
  },
};
