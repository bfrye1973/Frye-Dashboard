import React, { useEffect, useRef, useState } from "react";
import { createChart } from "lightweight-charts";
import Controls from "./Controls";
import { getOHLC } from "../../../lib/ohlcClient";
import { SYMBOLS, TIMEFRAMES } from "./constants";

const API_BASE =
  (typeof window !== "undefined" && (window.__API_BASE__ || "")) ||
  "https://frye-market-backend-1.onrender.com";

const SEED_LIMIT = 5000;

const DEFAULTS = {
  upColor: "#26a69a",
  downColor: "#ef5350",
  volUp: "rgba(38,166,154,0.5)",
  volDown: "rgba(239,83,80,0.5)",
  gridColor: "rgba(255,255,255,0.06)",
  bg: "#0b0b14",
  border: "#1f2a44",
};

export default function RowChart({
  defaultSymbol = "SPY",
  defaultTimeframe = "10m",
}) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const volSeriesRef = useRef(null);

  const [state, setState] = useState({
    symbol: defaultSymbol,
    timeframe: defaultTimeframe,
  });

  // create chart once
  useEffect(() => {
    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 520,
      layout: { background: { color: DEFAULTS.bg }, textColor: "#d1d5db" },
      grid: {
        vertLines: { color: DEFAULTS.gridColor },
        horzLines: { color: DEFAULTS.gridColor },
      },
      rightPriceScale: { borderColor: DEFAULTS.border, scaleMargins: { top: 0.1, bottom: 0.2 } },
      timeScale: { borderColor: DEFAULTS.border, timeVisible: true },
    });
    chartRef.current = chart;

    const series = chart.addCandlestickSeries({
      upColor: DEFAULTS.upColor,
      downColor: DEFAULTS.downColor,
      wickUpColor: DEFAULTS.upColor,
      wickDownColor: DEFAULTS.downColor,
      borderUpColor: DEFAULTS.upColor,
      borderDownColor: DEFAULTS.downColor,
    });
    seriesRef.current = series;

    const vol = chart.addHistogramSeries({ priceScaleId: "", priceFormat: { type: "volume" } });
    vol.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
    volSeriesRef.current = vol;

    return () => chart.remove();
  }, []);

  // seed history
  useEffect(() => {
    (async () => {
      const seed = await getOHLC(state.symbol, state.timeframe, SEED_LIMIT);
      if (seriesRef.current) seriesRef.current.setData(seed);
      if (volSeriesRef.current) {
        volSeriesRef.current.setData(
          seed.map((b) => ({
            time: b.time,
            value: b.volume,
            color: b.close >= b.open ? DEFAULTS.volUp : DEFAULTS.volDown,
          }))
        );
      }
    })();
  }, [state.symbol, state.timeframe]);

  // live poller
  useEffect(() => {
    let timer;
    async function tick() {
      try {
        const r = await fetch(
          `${API_BASE}/api/v1/live/nowbar?symbol=${state.symbol}&tf=${state.timeframe}&t=${Date.now()}`
        );
        const j = await r.json();
        if (j?.ok && j.bar && seriesRef.current) {
          const b = {
            time: Math.floor(Number(j.bar.time) / 1000),
            open: Number(j.bar.open),
            high: Number(j.bar.high),
            low: Number(j.bar.low),
            close: Number(j.bar.close),
            volume: Number(j.bar.volume),
          };
          seriesRef.current.update(b);
          if (volSeriesRef.current) {
            volSeriesRef.current.update({
              time: b.time,
              value: b.volume,
              color: b.close >= b.open ? DEFAULTS.volUp : DEFAULTS.volDown,
            });
          }
        }
      } catch {}
      timer = setTimeout(tick, 10000); // every 10s
    }
    tick();
    return () => clearTimeout(timer);
  }, [state.symbol, state.timeframe]);

  return (
    <div style={{ border: `1px solid ${DEFAULTS.border}`, borderRadius: 8, background: DEFAULTS.bg }}>
      <Controls
        symbols={SYMBOLS}
        timeframes={TIMEFRAMES}
        value={state}
        onChange={(patch) => setState((s) => ({ ...s, ...patch }))}
      />
      <div ref={containerRef} style={{ width: "100%", height: 520 }} />
    </div>
  );
}
