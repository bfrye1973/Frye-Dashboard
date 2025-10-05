// ============================================================
// RowChart — Final Clean Version (Live + Historical + Indicators)
// ============================================================

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createChart } from "lightweight-charts";
import Controls from "./Controls";
import { getOHLC, subscribeStream } from "../../../lib/ohlcClient"; // ⟵ add subscribeStream

const SEED_LIMIT = 5000; // match backend cap

const DEFAULTS = {
  upColor: "#26a69a",
  downColor: "#ef5350",
  volUp: "rgba(38,166,154,0.5)",
  volDown: "rgba(239,83,80,0.5)",
  gridColor: "rgba(255,255,255,0.06)",
  bg: "#0b0b14",
  border: "#1f2a44",
};

function phoenixTime(ts, isDaily = false) {
  // ts is UNIX seconds in our pipeline; normalize if needed
  const seconds =
    typeof ts === "number"
      ? ts
      : ts && typeof ts.timestamp === "number"
      ? ts.timestamp
      : 0;

  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Phoenix",
    hour12: true,
    ...(isDaily
      ? { month: "short", day: "2-digit" }
      : { hour: "numeric", minute: "2-digit" }),
  }).format(new Date(seconds * 1000));
}

export default function RowChart({
  apiBase = process.env.REACT_APP_API_BASE,      // backend-1 (historical)
  streamBase = process.env.REACT_APP_STREAM_BASE, // backend-2 (live stream)
  defaultSymbol = "SPY",
  defaultTimeframe = "10m",
  showDebug = false,
}) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const volSeriesRef = useRef(null);
  const roRef = useRef(null);

  const [bars, setBars] = useState([]);
  const barsRef = useRef([]);

  const [state, setState] = useState({
    symbol: defaultSymbol,
    timeframe: defaultTimeframe,
    range: 200,
    disabled: false,
  });

  const symbols = useMemo(() => ["SPY", "QQQ", "IWM"], []);
  const timeframes = useMemo(
    () => ["1m", "5m", "10m", "15m", "30m", "1h", "4h", "1d"],
    []
  );

  // -----------------------------------------------
  // Mount chart (once)
  // -----------------------------------------------
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      width: el.clientWidth,
      height: el.clientHeight,
      layout: { background: { color: DEFAULTS.bg }, textColor: "#d1d5db" },
      grid: {
        vertLines: { color: DEFAULTS.gridColor },
        horzLines: { color: DEFAULTS.gridColor },
      },
      rightPriceScale: {
        borderColor: DEFAULTS.border,
        scaleMargins: { top: 0.1, bottom: 0.2 },
      },
      timeScale: { borderColor: DEFAULTS.border, timeVisible: true },
      localization: {
        timezone: "America/Phoenix",
        timeFormatter: (t) => phoenixTime(t, state.timeframe === "1d"),
      },
      crosshair: { mode: 0 },
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

    const vol = chart.addHistogramSeries({
      priceScaleId: "",
      priceFormat: { type: "volume" },
    });
    vol.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
    volSeriesRef.current = vol;

    const ro = new ResizeObserver(() => {
      chart.resize(el.clientWidth, el.clientHeight);
    });
    ro.observe(el);
    roRef.current = ro;

    return () => {
      try { ro.disconnect(); } catch {}
      try { chart.remove(); } catch {}
      chartRef.current = null;
      seriesRef.current = null;
      volSeriesRef.current = null;
    };
  }, []);

  // -----------------------------------------------
  // Load historical OHLC (backend-1)
  // -----------------------------------------------
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState((s) => ({ ...s, disabled: true }));
      try {
        const seed = await getOHLC(state.symbol, state.timeframe, SEED_LIMIT);
        if (cancelled) return;

        // Ensure ascending by time (seconds)
        const asc = (Array.isArray(seed) ? seed : [])
          .slice()
          .sort((a, b) => a.time - b.time);

        barsRef.current = asc;
        setBars(asc);

        if (showDebug) {
          console.log("[RowChart] Seed bars:", asc.length, {
            symbol: state.symbol,
            timeframe: state.timeframe,
            first: asc[0],
            last: asc[asc.length - 1],
          });
        }
      } catch (e) {
        console.error("[RowChart] OHLC load error:", e);
        setBars([]);
      } finally {
        if (!cancelled) setState((s) => ({ ...s, disabled: false }));
      }
    }
    load();
    return () => { cancelled = true; };
  }, [state.symbol, state.timeframe, showDebug]);

  // -----------------------------------------------
  // Render + range
  // -----------------------------------------------
  useEffect(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    const vol = volSeriesRef.current;
    if (!chart || !series) return;

    series.setData(bars);
    if (vol) {
      vol.setData(
        bars.map((b) => ({
          time: b.time, // UNIX seconds
          value: Number(b.volume ?? 0),
          color: b.close >= b.open ? DEFAULTS.volUp : DEFAULTS.volDown,
        }))
      );
    }

    const ts = chart.timeScale();
    const r = state.range;
    const len = bars.length;
    if (!r || r === 200 || !len) {
      ts.fitContent();
    } else {
      const to = len - 1;
      const from = Math.max(0, to - (r - 1));
      ts.setVisibleLogicalRange({ from, to });
    }
  }, [bars, state.range]);

  // -----------------------------------------------
  // Live Stream (backend-2) — uses helper with :ping tolerance & ms→sec safety
  // -----------------------------------------------
  useEffect(() => {
    if (!seriesRef.current || !volSeriesRef.current) return;

    if (showDebug) {
      console.log("[RowChart] streamBase =", streamBase);
    }

    // subscribeStream handles EventSource, :ping lines, and normalization
    const unsub = subscribeStream(state.symbol, state.timeframe, (bar) => {
      // Update price series
      seriesRef.current.update(bar);

      // Update volume series
      volSeriesRef.current.update({
        time: bar.time,
        value: Number(bar.volume || 0),
        color: bar.close >= bar.open ? DEFAULTS.volUp : DEFAULTS.volDown,
      });

      // Keep an in-memory tail so range adjustments work live
      const next = [...barsRef.current];
      const last = next[next.length - 1];
      if (!last || bar.time > last.time) next.push(bar);
      else next[next.length - 1] = bar; // in-bar update

      barsRef.current = next;
      setBars(next);
    });

    return () => unsub?.();
  }, [streamBase, state.symbol, state.timeframe, showDebug]);

  // -----------------------------------------------
  // Controls + UI
  // -----------------------------------------------
  const handleControlsChange = (patch) =>
    setState((s) => ({ ...s, ...patch }));

  const applyRange = (nextRange) => {
    const chart = chartRef.current;
    if (!chart) return;
    const ts = chart.timeScale();
    const list = barsRef.current;
    const len = list.length;
    if (!nextRange || nextRange === 200 || !len) {
      ts.fitContent();
      return;
    }
    const to = len - 1;
    const from = Math.max(0, to - (nextRange - 1));
    ts.setVisibleLogicalRange({ from, to });
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        border: `1px solid ${DEFAULTS.border}`,
        borderRadius: 8,
        overflow: "hidden",
        background: DEFAULTS.bg,
      }}
    >
      <Controls
        symbols={symbols}
        timeframes={timeframes}
        value={state}
        onChange={handleControlsChange}
        onRange={applyRange}
      />
      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: 520,
          minHeight: 360,
          background: DEFAULTS.bg,
        }}
      />
    </div>
  );
}
