// src/pages/FullChart.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import useLwcChart from "./rows/RowChart/useLwcChart";

/* ---------------- config ---------------- */
const API_BASE =
  (typeof window !== "undefined" && (window.__API_BASE__ || "")) ||
  process.env.REACT_APP_API_BASE ||
  "https://frye-market-backend-1.onrender.com";

/* Map multiple query styles to our internal tf */
function normalizeTf(q) {
  const v = String(q || "").trim().toLowerCase();
  if (["5", "5m", "5min"].includes(v)) return "5m";
  if (["10", "10m", "10min"].includes(v)) return "10m";
  if (["60", "1h", "60m", "hour"].includes(v)) return "1h";
  if (["4h", "240", "240m"].includes(v)) return "4h";
  if (["d", "1d", "day", "daily"].includes(v)) return "D";
  if (["w", "1w", "week", "weekly"].includes(v)) return "W";
  return "10m";
}

const clampSymbol = (s) =>
  String(s || "SPY").toUpperCase().replace(/[^A-Z0-9\.\-:]/g, "");

/* ---------------- small helpers ---------------- */
const toCandles = (rows = []) =>
  Array.isArray(rows)
    ? rows
        .map((r) => ({
          time:
            typeof r.time === "number"
              ? r.time
              : Math.floor(new Date(r.time).getTime() / 1000),
          open: +r.open,
          high: +r.high,
          low: +r.low,
          close: +r.close,
          volume: r.volume != null ? +r.volume : undefined,
        }))
        .filter(
          (b) =>
            Number.isFinite(b.time) &&
            [b.open, b.high, b.low, b.close].every(Number.isFinite)
        )
    : [];

/* --------------- data sources (fallback chain) --------------- */
async function fetchCandles({ symbol, tf }) {
  const base = API_BASE.replace(/\/+$/, "");
  // 1) direct OHLC if your backend provides it (safe to 404)
  const ohlcUrl = `${base}/api/v1/ohlc?symbol=${encodeURIComponent(
    symbol
  )}&tf=${encodeURIComponent(tf)}&limit=600`;
  // 2) prebuilt outlook feeds (intraday/hourly/eod)
  const intradayUrl = `${base}/live/intraday`;
  const hourlyUrl = `${base}/live/hourly`;
  const eodUrl = `${base}/live/eod`;

  // try direct OHLC first
  for (const url of [ohlcUrl, intradayUrl, hourlyUrl, eodUrl]) {
    try {
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) continue;
      const json = await r.json();
      // shape adapter:
      if (Array.isArray(json)) {
        const bars = toCandles(json);
        if (bars.length) return { source: url, bars };
      }
      // outlook feeds may embed series under keys — try common shapes:
      if (json && typeof json === "object") {
        const seq =
          json?.series ||
          json?.ohlc ||
          json?.[symbol]?.[tf] ||
          json?.[symbol] ||
          json?.data ||
          [];
        const bars = toCandles(seq);
        if (bars.length) return { source: url, bars };
      }
    } catch {
      // continue to next fallback
    }
  }
  return { source: null, bars: [] };
}

/* -------------------- page -------------------- */
export default function FullChart() {
  const [params] = useSearchParams();
  const symbol = useMemo(
    () => clampSymbol(params.get("symbol") || params.get("s") || "SPY"),
    [params]
  );
  const timeframe = useMemo(
    () => normalizeTf(params.get("tf") || params.get("timeframe") || "10m"),
    [params]
  );

  const hostRef = useRef(null);
  const { chart, addOrGetSeries, setTimezone } = useLwcChart({
    theme: "dark",
    hostRef,
  });

  const [state, setState] = useState({
    loading: true,
    bars: [],
    source: "",
    error: null,
  });

  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    (async () => {
      const { bars, source } = await fetchCandles({ symbol, tf: timeframe });
      if (!alive) return;
      if (!bars.length) {
        console.warn("[FullChart] No bars after fallbacks — check data pipeline/params", {
          symbol,
          timeframe,
        });
        setState({ loading: false, bars: [], source: source || "", error: "No data" });
        return;
      }
      setState({ loading: false, bars, source, error: null });
    })();
    return () => {
      alive = false;
    };
  }, [symbol, timeframe]);

  useEffect(() => {
    if (!chart) return;
    setTimezone("America/Phoenix");
    const series = addOrGetSeries(`candle:${symbol}`);
    if (series && state.bars.length) {
      series.setData(state.bars);
      // simple title
      chart.applyOptions({
        localization: { timeFormatter: undefined },
      });
    }
  }, [chart, addOrGetSeries, setTimezone, symbol, state.bars]);

  return (
    <div
      id="full-chart-shell"
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        height: "100%",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          padding: "8px 10px",
          borderBottom: "1px solid #1f2937",
          background: "#0b0f14",
          color: "#e5e7eb",
        }}
      >
        <Link to="/" style={{ color: "#93c5fd", textDecoration: "none" }}>
          ← Back
        </Link>
        <strong style={{ color: "#93c5fd" }}>Full Chart</strong>
        <span style={{ opacity: 0.7 }}>
          {symbol} • {timeframe.toUpperCase()}
        </span>
        <span style={{ marginLeft: "auto", opacity: 0.6, fontSize: 12 }}>
          {state.source ? `source: ${state.source}` : ""}
          {state.error ? " • no data" : ""}
        </span>
      </div>

      {/* Chart host (must fill all remaining space) */}
      <div
        style={{
          position: "relative",
          flex: "1 1 auto",
          minHeight: "0",
          display: "flex",
        }}
      >
        <div
          ref={hostRef}
          className="tv-lightweight-charts"
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            minHeight: "520px",
            // IMPORTANT: no padding/margins here
          }}
          data-chart-host
        />
      </div>

      {/* Debug strip */}
      <div
        style={{
          padding: "6px 10px",
          borderTop: "1px solid #1f2937",
          background: "#0b0f14",
          color: "#9ca3af",
          fontSize: 12,
        }}
      >
        {state.loading
          ? "Loading…"
          : `Bars: ${state.bars.length}${state.bars.length ? ` • first=${new Date(
              state.bars[0].time * 1000
            ).toLocaleString()} • last=${new Date(
              state.bars[state.bars.length - 1].time * 1000
            ).toLocaleString()}` : ""}`}
      </div>
    </div>
  );
}

