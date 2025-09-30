// src/pages/rows/RowChart/index.jsx
// RowChart — history + live aggregates (WS with polling fallback)
// - Seeds with getOHLC(limit=5000)
// - Live updates via Polygon WS minute aggregates ("AM.SYMBOL") or backend proxy /ws/agg
// - Client bucketizes 1m aggregates into active TF (5m/10m/15m/30m/1h/4h)
// - AZ time, volume histogram, fixed height, Range 200 = Full

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createChart } from "lightweight-charts";
import Controls from "./Controls";
import { getOHLC } from "../../../lib/ohlcClient";

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

const TF_MINUTES = {
  "1m": 1,
  "5m": 5,
  "10m": 10,
  "15m": 15,
  "30m": 30,
  "1h": 60,
  "4h": 240,
  "1d": 1440, // not bucketized from minutes; we keep it read-only
};

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

export default function RowChart({
  apiBase = "https://frye-market-backend-1.onrender.com",
  defaultSymbol = "SPY",
  defaultTimeframe = "1h",
  showDebug = false,
}) {
  // Make sure lib client sees the same base (for getOHLC)
  useEffect(() => {
    if (typeof window !== "undefined" && apiBase) {
      window.__API_BASE__ = apiBase.replace(/\/+$/, "");
    }
  }, [apiBase]);

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

  // Create chart once
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

    chart.timeScale().applyOptions({
      tickMarkFormatter: (t) => phoenixTime(t, state.timeframe === "1d"),
      minimumHeight: 20,
    });

    const ro = new ResizeObserver(() => {
      if (!chartRef.current || !containerRef.current) return;
      chartRef.current.resize(
        containerRef.current.clientWidth,
        containerRef.current.clientHeight
      );
    });
    ro.observe(el);
    roRef.current = ro;

    return () => {
      try { roRef.current?.disconnect(); } catch {}
      try { chartRef.current?.remove(); } catch {}
      chartRef.current = null;
      seriesRef.current = null;
      volSeriesRef.current = null;
    };
  }, []);

  // Update bottom axis when timeframe changes
  useEffect(() => {
    if (!chartRef.current) return;
    chartRef.current.timeScale().applyOptions({
      tickMarkFormatter: (t) => phoenixTime(t, state.timeframe === "1d"),
      timeVisible: state.timeframe !== "1d",
    });
  }, [state.timeframe]);

  // Seed on symbol/timeframe change — NO slicing
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState((s) => ({ ...s, disabled: true }));
      try {
        const seed = await getOHLC(state.symbol, state.timeframe, SEED_LIMIT);
        if (cancelled) return;

        const asc = (Array.isArray(seed) ? seed : [])
          .slice()
          .sort((a, b) => a.time - b.time);

        barsRef.current = asc;
        setBars(asc);

        if (typeof window !== "undefined") {
          const first = asc[0]?.time ?? 0;
          const last = asc[asc.length - 1]?.time ?? 0;
          const spanDays =
            first && last ? Math.round((last - first) / 86400) : 0;
          window.__ROWCHART_INFO__ = {
            tf: state.timeframe,
            bars: asc.length,
            spanDays,
            source: "api/v1/ohlc",
          };
          if (showDebug) console.log("[ROWCHART seed]", window.__ROWCHART_INFO__);
        }
      } catch (e) {
        if (showDebug) console.error("[ROWCHART] load error:", e);
        barsRef.current = [];
        setBars([]);
      } finally {
        if (!cancelled) setState((s) => ({ ...s, disabled: false }));
      }
    }
    load();
    return () => { cancelled = true; };
  }, [state.symbol, state.timeframe, showDebug]);

  // Render + viewport
  useEffect(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    const vol = volSeriesRef.current;
    if (!chart || !series) return;

    series.setData(bars);

    if (vol) {
      vol.setData(
        bars.map((b) => ({
          time: b.time,
          value: Number(b.volume ?? 0),
          color: b.close >= b.open ? DEFAULTS.volUp : DEFAULTS.volDown,
        }))
      );
    }

    requestAnimationFrame(() => {
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
    });
  }, [bars, state.range]);

  // --- LIVE via WebSocket aggregates (AM.SYMBOL) + client bucketizer ---
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    const tfMin = TF_MINUTES[state.timeframe] ?? 60;

    // do not attempt WS for daily timeframe
    if (state.timeframe === "1d") return;

    // Resolve a WS URL:
    // Option 1: direct Polygon (set window.__POLY_KEY__ = "<your_key>")
    // Option 2: backend proxy: wss(s)://<API_BASE>/ws/agg?symbol=SPY
    const polyKey =
      (typeof window !== "undefined" && window.__POLY_KEY__) || "";
    const directWs =
      polyKey &&
      `wss://socket.polygon.io/stocks`;
    const proxyWsBase =
      (typeof window !== "undefined" && window.__API_BASE__) ||
      apiBase.replace(/^http/, "ws");
    const proxyWs = `${proxyWsBase.replace(/\/+$/, "")}/ws/agg?symbol=${encodeURIComponent(
      state.symbol
    )}`;

    // We'll try direct Polygon first (only if key present), else proxy
    let wsUrl = polyKey ? directWs : proxyWs;
    let ws = null;
    let alive = true;
    let reconnectTimer = null;

    // Internal helper: compute current bucket start (seconds)
    const bucketStart = (sec) =>
      Math.floor(sec / (tfMin * 60)) * (tfMin * 60);

    // Merge an incoming 1-minute aggregate into current TF bucket
    function mergeMinuteAgg(msg) {
      // Support both polygon AM payload or proxy { time, o,h,l,c,v }
      const ms = Number(
        msg.s ?? msg.S ?? msg.t ?? msg.T ?? (msg.time ? msg.time * 1000 : 0)
      ); // start time ms
      const o = Number(msg.o ?? msg.open);
      const h = Number(msg.h ?? msg.high);
      const l = Number(msg.l ?? msg.low);
      const c = Number(msg.c ?? msg.close);
      const v = Number(msg.v ?? msg.volume ?? 0);
      if (!ms || !Number.isFinite(c)) return;

      const minuteSec = Math.floor(ms / 1000);
      const bStart = bucketStart(minuteSec);

      const list = barsRef.current;
      const last = list[list.length - 1];

      // If last bar aligns with our bucket → update; else start a new bucket
      if (last && last.time === bStart) {
        const merged = {
          time: last.time,
          open: Number.isFinite(last.open) ? last.open : o,
          high: Math.max(Number.isFinite(last.high) ? last.high : h, h),
          low: Math.min(Number.isFinite(last.low) ? last.low : l, l),
          close: c,
          volume: Number(last.volume ?? 0) + v,
        };
        series.update(merged);
        list[list.length - 1] = merged;
      } else if (last && last.time > bStart) {
        // out-of-order (rare) → ignore
        return;
      } else {
        const fresh = {
          time: bStart,
          open: o,
          high: h,
          low: l,
          close: c,
          volume: v,
        };
        series.update(fresh);
        barsRef.current = [...list, fresh];
      }
    }

    function connect() {
      try {
        ws = new WebSocket(wsUrl);
      } catch {
        scheduleReconnect();
        return;
      }

      ws.onopen = () => {
        if (!alive) return;
        if (polyKey && wsUrl === directWs) {
          // Authenticate + subscribe to AM.SYMBOL (minute aggregates)
          ws.send(JSON.stringify({ action: "auth", params: polyKey }));
          ws.send(JSON.stringify({ action: "subscribe", params: `AM.${state.symbol}` }));
        } else {
          // Backend proxy should already be subscribed by query param (?symbol=)
        }
      };

      ws.onmessage = (ev) => {
        if (!alive) return;
        try {
          const data = JSON.parse(ev.data);
          const arr = Array.isArray(data) ? data : [data];
          for (const msg of arr) {
            // Polygon v2 AM message has ev:"AM", sym:"SPY", o,h,l,c,v, s( start ms )
            if (msg && (msg.ev === "AM" || msg.type === "agg" || msg.open !== undefined)) {
              mergeMinuteAgg(msg);
            }
          }
        } catch {
          /* ignore */
        }
      };

      ws.onerror = () => {
        cleanupSocket();
        scheduleReconnect();
      };

      ws.onclose = () => {
        cleanupSocket();
        scheduleReconnect();
      };
    }

    function cleanupSocket() {
      try { ws && ws.close && ws.readyState === 1 && ws.close(); } catch {}
      ws = null;
    }

    function scheduleReconnect() {
      if (!alive) return;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(connect, 4000);
    }

    connect();

    return () => {
      alive = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      cleanupSocket();
    };
  }, [state.symbol, state.timeframe, apiBase, showDebug]);

  // --- POLLING FALLBACK (keeps price updating if WS not available) ---
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    if (state.timeframe === "1d") return; // skip daily

    const POLL_MS = 5000;
    let alive = true;
    let timer = null;

    async function tick() {
      try {
        const lastTwo = await getOHLC(state.symbol, state.timeframe, 2);
        if (!alive || !Array.isArray(lastTwo) || lastTwo.length === 0) return;
        const last = lastTwo[lastTwo.length - 1];
        const list = barsRef.current;
        const prevLast = list[list.length - 1];
        if (prevLast && prevLast.time === last.time) {
          series.update(last);
          list[list.length - 1] = last;
        } else if (!prevLast || prevLast.time < last.time) {
          series.update(last);
          barsRef.current = [...list, last];
        }
      } catch { /* ignore */ }
      finally { if (alive) timer = setTimeout(tick, POLL_MS); }
    }

    timer = setTimeout(tick, POLL_MS);
    return () => { alive = false; if (timer) clearTimeout(timer); };
  }, [state.symbol, state.timeframe]);

  // Camera only (Range buttons)
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

  const handleControlsChange = (patch) =>
    setState((s) => ({ ...s, ...patch }));

  const handleTest = async () => {
    try {
      const bars = await getOHLC(state.symbol, state.timeframe, SEED_LIMIT);
      alert(`Fetched ${bars.length} bars from /api/v1/ohlc`);
    } catch {
      alert("Fetch failed");
    }
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
        onTest={showDebug ? handleTest : null}
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
