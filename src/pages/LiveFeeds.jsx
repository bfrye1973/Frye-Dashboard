// src/pages/LiveFeeds.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createChart } from "lightweight-charts";
import MoneyFlowOverlay from "../components/overlays/MoneyFlowOverlay";
import SessionShadingOverlay from "../components/overlays/SessionShadingOverlay";

/* -------------------- API endpoints -------------------- */
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

/* -------------------- helpers -------------------- */
function fmtTs(tsSec) {
  try { return new Date(tsSec * 1000).toLocaleString(); } catch { return "—"; }
}
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

/* ========================================================= */
export default function LiveFeeds() {
  const [ticker, setTicker] = useState("SPY");
  const [tf, setTf] = useState("minute"); // minute | hour | day
  const [metrics, setMetrics] = useState([]);
  const [metricsTs, setMetricsTs] = useState(null);
  const [candles, setCandles] = useState([]);

  const wrapRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const priceLineRef = useRef(null);
  const volumeRef = useRef(null);
  const wsStopRef = useRef(null);
  const lastTimeRef = useRef(null);

  const { fromISO, toISO } = useMemo(() => {
    const to = new Date();
    const from = new Date(Date.now() - 7 * 864e5);
    return {
      fromISO: from.toISOString().slice(0, 10),
      toISO: to.toISOString().slice(0, 10),
    };
  }, []);

  /* ---------- chart ---------- */
  useEffect(() => {
    if (!wrapRef.current) return;

    const chart = createChart(wrapRef.current, {
      width: wrapRef.current.clientWidth || 1000,
      height: 520,
      layout: {
        background: { type: "Solid", color: "#0c0f14" },
        textColor: "#b9c8e8",
        fontSize: 12,
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.06)" },
        horzLines: { color: "rgba(255,255,255,0.06)" },
      },
      timeScale: {
        timeVisible: tf !== "day",
        secondsVisible: tf === "minute",
        rightOffset: 6,
        barSpacing: 8,
        borderColor: "rgba(255,255,255,0.08)",
      },
      rightPriceScale: {
        borderVisible: true,
        borderColor: "rgba(255,255,255,0.08)",
      },
      crosshair: { mode: 1 },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
      handleScale: { axisPressedMouseMove: true, pinch: true, mouseWheel: true },
    });

    // Candles styled like TradingView
    const candleSeries = chart.addCandlestickSeries({
      upColor: "#22c55e",         // green
      downColor: "#ef4444",       // red
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
      borderUpColor: "#18994a",
      borderDownColor: "#c23333",
      borderVisible: true,
      wickVisible: true,
      priceLineVisible: true,
    });

    // Close-price line
    const priceLine = chart.addLineSeries({
      color: "#66d9ff",
      lineWidth: 1,
      lastValueVisible: true,
      priceLineVisible: true,
      crosshairMarkerVisible: true,
    });

    // Volume bottom pane (auto-colored)
    const volume = chart.addHistogramSeries({
      priceScaleId: "",
      priceFormat: { type: "volume" },
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    priceLineRef.current = priceLine;
    volumeRef.current = volume;

    const ro = new ResizeObserver(() => {
      chart.applyOptions({ width: wrapRef.current.clientWidth || 1000 });
    });
    ro.observe(wrapRef.current);

    return () => {
      try { ro.disconnect(); } catch {}
      try { wsStopRef.current && wsStopRef.current(); } catch {}
      try { chart.remove(); } catch {}
      chartRef.current = null;
      candleSeriesRef.current = null;
      priceLineRef.current = null;
      volumeRef.current = null;
    };
  }, [tf]);

  /* ---------- data ---------- */
  useEffect(() => {
    let cancelled = false;

    function buildVolume(bars) {
      return bars.map((b) => ({
        time: b.time,
        value: b.volume ?? 0,
        color: (b.close >= b.open) ? "rgba(34,197,94,0.6)" : "rgba(239,68,68,0.6)",
      }));
    }

    async function loadHistory() {
      try {
        const url = `${API_BASE}/api/history?ticker=${encodeURIComponent(
          ticker
        )}&tf=${encodeURIComponent(tf)}&from=${fromISO}&to=${toISO}`;
        const r = await fetch(url);
        if (!r.ok) throw new Error(`history ${r.status}`);
        const rows = await r.json(); // [{time,open,high,low,close,volume}]
        if (cancelled) return;

        candleSeriesRef.current?.setData(rows);
        priceLineRef.current?.setData(rows.map((b) => ({ time: b.time, value: b.close })));
        volumeRef.current?.setData(buildVolume(rows));

        setCandles(rows);
        lastTimeRef.current = rows.at(-1)?.time ?? null;

        chartRef.current?.timeScale().fitContent();
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

            const volPoint = {
              time: b.time,
              value: b.volume ?? 0,
              color: (b.close >= b.open) ? "rgba(34,197,94,0.6)" : "rgba(239,68,68,0.6)",
            };

            if (lastTimeRef.current && b.time === lastTimeRef.current) {
              candleSeriesRef.current?.update(b);
              priceLineRef.current?.update({ time: b.time, value: b.close });
              volumeRef.current?.update(volPoint);
              setCandles((prev) => {
                if (!prev.length) return [b];
                const copy = prev.slice();
                copy[copy.length - 1] = b;
                return copy;
              });
            } else {
              candleSeriesRef.current?.update(b);
              priceLineRef.current?.update({ time: b.time, value: b.close });
              volumeRef.current?.update(volPoint);
              lastTimeRef.current = b.time;
              setCandles((prev) => prev.concat(b));
            }
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

  /* ---------- seed metrics once ---------- */
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
          placeholder="SPY"
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

      {/* Strategy strips */}
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

      {/* Chart + overlays */}
      <div ref={wrapRef} style={S.chartBox}>
        {/* Background shading for ETH (session bands) */}
        {chartRef.current && wrapRef.current && (
          <SessionShadingOverlay
            chart={chartRef.current}
            container={wrapRef.current}
          />
        )}

        {/* Right-side Money Flow overlay */}
        <MoneyFlowOverlay chartContainer={wrapRef.current} candles={candles} />
      </div>
    </section>
  );
}

/* -------------------- styles -------------------- */
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
    minHeight: 520,
    borderRadius: 10,
    overflow: "hidden",
    border: "1px solid #1b2130",
    background: "#0c0f14",
    position: "relative",
  },
};
