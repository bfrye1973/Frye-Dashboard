// src/pages/LiveFeeds.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createChart } from "lightweight-charts";
import { fetchHistory, fetchMetrics } from "../lib/api.js";
import { openMarketSocket } from "../lib/ws.js";

// Small sector tile
function Tile({ title, ts, newHighs, newLows, adrAvg }) {
  return (
    <div style={{
      background: "#11151f", border: "1px solid #1b2130", borderRadius: 10,
      padding: 14, minWidth: 260, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)"
    }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>
        TS {new Date((ts ?? Math.floor(Date.now()/1000)) * 1000).toLocaleString()}
      </div>
      <div style={{ fontSize: 13, lineHeight: "18px" }}>
        <div><b>New Highs</b>: {newHighs}</div>
        <div><b>New Lows</b> : {newLows}</div>
        <div><b>ADR Avg</b>  : {adrAvg ?? "—"}</div>
      </div>
    </div>
  );
}

export default function LiveFeeds() {
  // ----- Controls -----
  const [ticker, setTicker] = useState("AAPL");
  const [tf, setTf] = useState("minute"); // minute | hour | day

  // ----- Metrics (tiles) -----
  const [metrics, setMetrics] = useState([]);
  const [metricsTs, setMetricsTs] = useState(null);

  // ----- Chart refs -----
  const wrapRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const lastTimeRef = useRef(null);
  const stopWSRef = useRef(null);

  // Last 7 days range
  const { fromISO, toISO } = useMemo(() => {
    const to = new Date();
    const from = new Date(Date.now() - 7 * 864e5);
    const d = (x) => x.toISOString().slice(0, 10);
    return { fromISO: d(from), toISO: d(to) };
  }, []);

  // ----- Build chart once -----
  useEffect(() => {
    if (!wrapRef.current) return;
    const chart = createChart(wrapRef.current, {
      width: wrapRef.current.clientWidth || 960,
      height: 420,
      layout: { background: { type: "Solid", color: "#0f0f0f" }, textColor: "#d8d8d8" },
      grid: { vertLines: { color: "rgba(255,255,255,0.06)" }, horzLines: { color: "rgba(255,255,255,0.06)" } },
      timeScale: { timeVisible: tf !== "day", secondsVisible: tf === "minute" },
      rightPriceScale: { borderVisible: false },
    });
    const series = chart.addCandlestickSeries();

    chartRef.current = chart;
    seriesRef.current = series;

    const ro = new ResizeObserver(() => {
      chart.applyOptions({ width: wrapRef.current.clientWidth || 960 });
    });
    ro.observe(wrapRef.current);

    return () => { ro.disconnect(); try { chart.remove(); } catch {} };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ----- Load history & open WS on ticker/tf change -----
  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!seriesRef.current) return;

      // History
      try {
        const candles = await fetchHistory(ticker, tf, fromISO, toISO);
        if (cancelled) return;
        seriesRef.current.setData(candles);
        lastTimeRef.current = candles.at(-1)?.time ?? null;
        // Fit content
        try { chartRef.current.timeScale().fitContent(); } catch {}
      } catch (e) {
        console.error("history error", e);
      }

      // Close old WS (if any)
      try { stopWSRef.current && stopWSRef.current(); } catch {}

      // Open WS — support both older onMsg(fn) and newer {onBar,onMetrics}
      const handler = (msg) => {
        if (!msg || !msg.type) return;
        if (msg.type === "bar" && msg.payload) {
          const b = msg.payload;
          if (b.ticker && b.ticker !== ticker) return;
          if (lastTimeRef.current && b.time === lastTimeRef.current) {
            seriesRef.current.update(b);
          } else {
            seriesRef.current.update(b);
            lastTimeRef.current = b.time;
          }
        } else if (msg.type === "metrics" && msg.payload) {
          setMetrics(msg.payload.sectors || []);
          setMetricsTs(msg.payload.timestamp || Math.floor(Date.now()/1000));
        }
      };

      const closer = openMarketSocket.length === 1
        ? openMarketSocket(handler)                     // older signature: (onMsg)=>()
        : openMarketSocket({                            // newer signature: ({onBar,onMetrics})=>()
            onBar: (b) => handler({ type: "bar", payload: b }),
            onMetrics: (m) => handler({ type: "metrics", payload: m }),
          });

      stopWSRef.current = closer;
    }

    load();
    return () => { cancelled = true; };
  }, [ticker, tf, fromISO, toISO]);

  // ----- One-time metrics pull (tiles boot-up) -----
  useEffect(() => {
    (async () => {
      try {
        const m = await fetchMetrics();
        setMetrics(m.sectors || []);
        setMetricsTs(m.timestamp || Math.floor(Date.now() / 1000));
      } catch (e) {
        console.error("metrics error", e);
      }
    })();
  }, []);

  return (
    <section>
      {/* Controls */}
      <div style={{
        display: "flex", gap: 12, alignItems: "center", margin: "8px 0 18px",
        flexWrap: "wrap"
      }}>
        <label style={{ fontSize: 14, opacity: 0.8 }}>Ticker</label>
        <input
          value={ticker}
          onChange={(e) => setTicker(e.target.value.toUpperCase().slice(0, 10))}
          placeholder="AAPL"
          style={{
            background: "#10141f", color: "#e6edf7", border: "1px solid #1b2130",
            borderRadius: 8, padding: "8px 10px", width: 120, outline: "none"
          }}
        />
        <div style={{ display: "flex", gap: 6 }}>
          {["minute", "hour", "day"].map((k) => (
            <button
              key={k}
              onClick={() => setTf(k)}
              style={{
                padding: "8px 10px", borderRadius: 8, border: "1px solid #1b2130",
                background: tf === k ? "#21304b" : "#10141f", color: "#e6edf7",
                cursor: "pointer"
              }}
              title={`Timeframe: ${k}`}
            >
              {k === "minute" ? "1m" : k === "hour" ? "1h" : "1d"}
            </button>
          ))}
        </div>
      </div>

      {/* Tiles */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px,1fr))",
        gap: 12, marginBottom: 18
      }}>
        {metrics?.length
          ? metrics.map((s, i) => (
              <Tile
                key={i}
                title={s.sector}
                ts={metricsTs}
                newHighs={s.newHighs}
                newLows={s.newLows}
                adrAvg={s.adrAvg}
              />
            ))
          : <div style={{ opacity: 0.7 }}>Loading market metrics…</div>}
      </div>

      {/* Chart container */}
      <div
        ref={wrapRef}
        style={{
          width: "100%", minHeight: 420, borderRadius: 10, overflow: "hidden",
          border: "1px solid #1b2130", background: "#0f0f0f"
        }}
      />
    </section>
  );
}
