// ============================================================
// RowChart — Final Clean Version (Historical + Live + Aggregation)
// ============================================================

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createChart } from "lightweight-charts";
import Controls from "./Controls";
import { getOHLC, subscribeStream } from "../../../lib/ohlcClient";

// How many historical bars to seed from Backend-1
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

// UX helpers -------------------------------------------------
function phoenixTime(ts, isDaily = false) {
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

// map timeframe label → seconds per bucket
const TF_SEC = {
  "1m": 60,
  "5m": 300,
  "10m": 600,
  "15m": 900,
  "30m": 1800,
  "1h": 3600,
  "4h": 14400,
  "1d": 86400,
};
const LIVE_TF = "1m"; // we always subscribe to 1m and aggregate up

// ============================================================

export default function RowChart({
  apiBase = process.env.REACT_APP_API_BASE, // (not used directly here; getOHLC reads it)
  streamBase = process.env.REACT_APP_STREAM_BASE, // subscribeStream reads it
  defaultSymbol = "SPY",
  defaultTimeframe = "10m",
  showDebug = false,
}) {
  // DOM + series refs ---------------------------------------
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const volSeriesRef = useRef(null);
  const roRef = useRef(null);

  // bar state (visual + logical) -----------------------------
  const [bars, setBars] = useState([]);
  const barsRef = useRef([]); // canonical working copy for range logic, etc.

  // UI state -------------------------------------------------
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

  // ----------------------------------------------------------
  // 1) Mount Chart (once)
  // ----------------------------------------------------------
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ----------------------------------------------------------
  // 2) Load Historical Seed (Backend-1)
  // ----------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    async function loadSeed() {
      setState((s) => ({ ...s, disabled: true }));
      try {
        const seed = await getOHLC(state.symbol, state.timeframe, SEED_LIMIT);
        if (cancelled) return;

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
        barsRef.current = [];
        setBars([]);
      } finally {
        if (!cancelled) setState((s) => ({ ...s, disabled: false }));
      }
    }

    loadSeed();
    return () => { cancelled = true; };
  }, [state.symbol, state.timeframe, showDebug]);

  // ----------------------------------------------------------
  // 3) Render Bars + Range
  // ----------------------------------------------------------
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

  // ----------------------------------------------------------
  // 4) Live Stream → ALWAYS subscribe to 1m, aggregate to selected TF
  // ----------------------------------------------------------
  useEffect(() => {
    if (!seriesRef.current || !volSeriesRef.current) return;

    const bucketSize = TF_SEC[state.timeframe] ?? TF_SEC["10m"]; // seconds per bucket
    const floorToBucket = (tSec) => Math.floor(tSec / bucketSize) * bucketSize;

    // rolling bucket we build live
    let currentStart = null;
    let currentBar = null;

    // use last seeded bar to align the first bucket correctly
    const lastSeed = barsRef.current[barsRef.current.length - 1] || null;
    if (lastSeed) {
      currentStart = floorToBucket(lastSeed.time);
      currentBar = { ...lastSeed };
    }

    if (showDebug) {
      console.log("[RowChart] Live subscribe", {
        symbol: state.symbol,
        from: LIVE_TF,
        to: state.timeframe,
        bucketSize,
      });
    }

    const unsub = subscribeStream(state.symbol, LIVE_TF, (oneMin) => {
      const t = Number(oneMin.time);
      if (!Number.isFinite(t)) return;

      // If we are on 1m UI timeframe, just forward the bar
      if (bucketSize === TF_SEC["1m"]) {
        seriesRef.current.update(oneMin);
        volSeriesRef.current.update({
          time: oneMin.time,
          value: Number(oneMin.volume || 0),
          color: oneMin.close >= oneMin.open ? DEFAULTS.volUp : DEFAULTS.volDown,
        });

        const next = [...barsRef.current];
        const last = next[next.length - 1];
        if (!last || oneMin.time > last.time) next.push(oneMin);
        else next[next.length - 1] = oneMin;
        barsRef.current = next;
        setBars(next);
        return;
      }

      // Aggregate: 1m → selected timeframe
      const bStart = floorToBucket(t);

      // moved into a new bucket?
      if (currentStart == null || bStart > currentStart) {
        // finalize previous bucket (if any & at/after last seed)
        if (currentBar && (!lastSeed || currentBar.time >= lastSeed.time)) {
          seriesRef.current.update(currentBar);
          volSeriesRef.current.update({
            time: currentBar.time,
            value: Number(currentBar.volume || 0),
            color:
              currentBar.close >= currentBar.open
                ? DEFAULTS.volUp
                : DEFAULTS.volDown,
          });

          const next = [...barsRef.current];
          const last = next[next.length - 1];
          if (!last || currentBar.time > last.time) next.push(currentBar);
          else next[next.length - 1] = currentBar;
          barsRef.current = next;
          setBars(next);
        }

        // start a fresh bucket with this 1m bar
        currentStart = bStart;
        currentBar = {
          time: bStart,
          open: oneMin.open,
          high: oneMin.high,
          low: oneMin.low,
          close: oneMin.close,
          volume: Number(oneMin.volume || 0),
        };
      } else {
        // still inside same bucket: update OHLCV
        currentBar.high = Math.max(currentBar.high, oneMin.high);
        currentBar.low = Math.min(currentBar.low, oneMin.low);
        currentBar.close = oneMin.close;
        currentBar.volume = Number(currentBar.volume || 0) + Number(oneMin.volume || 0);
      }

      // Show in-progress candle live
      seriesRef.current.update(currentBar);
      volSeriesRef.current.update({
        time: currentBar.time,
        value: Number(currentBar.volume || 0),
        color:
          currentBar.close >= currentBar.open ? DEFAULTS.volUp : DEFAULTS.volDown,
      });

      const next = [...barsRef.current];
      const last = next[next.length - 1];
      if (!last || currentBar.time > last.time) next.push({ ...currentBar });
      else next[next.length - 1] = { ...currentBar };
      barsRef.current = next;
      setBars(next);
    });

    return () => unsub?.();
  }, [state.symbol, state.timeframe, showDebug]);

  // ----------------------------------------------------------
  // 5) Controls + UI
  // ----------------------------------------------------------
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

      {showDebug && (
        <div style={{ fontSize: 12, opacity: 0.7, padding: "4px 8px" }}>
          Live via SSE: {LIVE_TF} → {state.timeframe}
        </div>
      )}

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
