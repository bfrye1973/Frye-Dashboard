// src/components/LiveLWChart/LiveLWChart.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createChart } from "lightweight-charts";
import { baseChartOptions } from "./chartConfig";
import { resolveIndicators } from "../../indicators";
import { getFeed } from "../../services/feed";

const DEFAULT_HEIGHTS = {
  price: 620,
  squeeze: 140,
  smi: 140,
  vol: 160,
};

export default function LiveLWChart({
  symbol = "SPY",
  timeframe = "1D",
  height = DEFAULT_HEIGHTS.price, // legacy
  enabledIndicators = [],
  indicatorSettings = {},
  onCandles, // NEW
}) {
  // wrapper for width
  const wrapperRef = useRef(null);

  // pane containers
  const priceRef   = useRef(null);
  const squeezeRef = useRef(null);
  const smiRef     = useRef(null);
  const volRef     = useRef(null);

  // charts
  const priceChartRef   = useRef(null);
  const squeezeChartRef = useRef(null);
  const smiChartRef     = useRef(null);
  const volChartRef     = useRef(null);

  // main price series
  const priceSeriesRef  = useRef(null);

  const seriesMapRef = useRef(new Map());
  const [candles, setCandles] = useState([]);

  // which panes are needed
  const needSqueeze = useMemo(() => enabledIndicators.includes("squeeze"), [enabledIndicators]);
  const needSMI     = useMemo(() => enabledIndicators.includes("smi"), [enabledIndicators]);
  const needVol     = useMemo(() => enabledIndicators.includes("vol"), [enabledIndicators]);

  // pane heights (+/-)
  const [heights, setHeights] = useState(DEFAULT_HEIGHTS);
  const inc = (key, amt=40) => setHeights(h => ({ ...h, [key]: Math.min(h[key] + amt, 480)}));
  const dec = (key, amt=40) => setHeights(h => ({ ...h, [key]: Math.max(h[key] - amt, 60)}));

  // create charts once
  useEffect(() => {
    const w = wrapperRef.current?.clientWidth ?? 800;

    if (priceRef.current && !priceChartRef.current) {
      const chart = createChart(priceRef.current, { ...baseChartOptions, height: heights.price, width: w });
      priceChartRef.current = chart;
      const price = chart.addCandlestickSeries();
      priceSeriesRef.current = price;

      chart._container   = priceRef.current;
      chart._priceSeries = priceSeriesRef.current;
    }
    if (squeezeRef.current && !squeezeChartRef.current) {
      const chart = createChart(squeezeRef.current, { ...baseChartOptions, height: heights.squeeze, width: w, rightPriceScale: { visible: true } });
      squeezeChartRef.current = chart;
      chart._container = squeezeRef.current;
      chart._priceSeries = null;
    }
    if (smiRef.current && !smiChartRef.current) {
      const chart = createChart(smiRef.current, { ...baseChartOptions, height: heights.smi, width: w, rightPriceScale: { visible: true } });
      smiChartRef.current = chart;
      chart._container = smiRef.current;
      chart._priceSeries = null;
    }
    if (volRef.current && !volChartRef.current) {
      const chart = createChart(volRef.current, { ...baseChartOptions, height: heights.vol, width: w, rightPriceScale: { visible: true } });
      volChartRef.current = chart;
      chart._container = volRef.current;
      chart._priceSeries = null;
    }

    return () => {
      try { priceChartRef.current?.remove(); } catch {}
      try { squeezeChartRef.current?.remove(); } catch {}
      try { smiChartRef.current?.remove(); } catch {}
      try { volChartRef.current?.remove(); } catch {}
      priceChartRef.current = null;
      squeezeChartRef.current = null;
      smiChartRef.current = null;
      volChartRef.current = null;
      priceSeriesRef.current = null;
      seriesMapRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // observe wrapper width and resize charts
  useEffect(() => {
    if (!wrapperRef.current) return;
    const ro = new ResizeObserver(() => {
      const w = wrapperRef.current?.clientWidth ?? 800;
      try { priceChartRef.current?.resize(w, heights.price); } catch {}
      try { squeezeChartRef.current?.resize(w, needSqueeze ? heights.squeeze : 0); } catch {}
      try { smiChartRef.current?.resize(w, needSMI ? heights.smi : 0); } catch {}
      try { volChartRef.current?.resize(w, needVol ? heights.vol : 0); } catch {}
    });
    ro.observe(wrapperRef.current);
    return () => { try { ro.disconnect(); } catch {} };
  }, [heights, needSqueeze, needSMI, needVol]);

  // load data
  useEffect(() => {
    if (!priceChartRef.current || !priceSeriesRef.current) return;

    const feed = getFeed(symbol, timeframe);
    let disposed = false;

    (async () => {
      const seed = await feed.history();
      if (disposed) return;
      setCandles(seed);
      priceSeriesRef.current.setData(seed);

      // expose candles across panes
      priceChartRef.current._candles = seed;
      if (squeezeChartRef.current) squeezeChartRef.current._candles = seed;
      if (smiChartRef.current)     smiChartRef.current._candles     = seed;
      if (volChartRef.current)     volChartRef.current._candles     = seed;
      try { onCandles?.(seed); } catch {}
      syncVisibleRange("price");
    })();

    const unsub = feed.subscribe((bar) => {
      if (disposed) return;
      setCandles(prev => {
        const next = mergeBar(prev, bar);
        priceSeriesRef.current.update(bar);
        priceChartRef.current._candles = next;
        if (squeezeChartRef.current) squeezeChartRef.current._candles = next;
        if (smiChartRef.current)     smiChartRef.current._candles     = next;
        if (volChartRef.current)     volChartRef.current._candles     = next;
        try { onCandles?.(next); } catch {}
        return next;
      });
    });

    return () => { disposed = true; unsub?.(); feed.close?.(); };
  }, [symbol, timeframe, onCandles]);

  // sync time scales both ways
  useEffect(() => {
    if (!priceChartRef.current) return;

    const price = priceChartRef.current;
    const panes = [squeezeChartRef.current, smiChartRef.current, volChartRef.current].filter(Boolean);

    const unsubPrice = price.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      panes.forEach(c => { try { c.timeScale().setVisibleLogicalRange(range); } catch {} });
    });

    const childUnsubs = panes.map((c) =>
      c.timeScale().subscribeVisibleLogicalRangeChange((range) => {
        try { price.timeScale().setVisibleLogicalRange(range); } catch {}
        panes.forEach(sib => { if (sib !== c) try { sib.timeScale().setVisibleLogicalRange(range); } catch {} });
      })
    );

    return () => {
      try { price.timeScale().unsubscribeVisibleLogicalRangeChange(unsubPrice); } catch {}
      childUnsubs.forEach((fn, i) => {
        const c = panes[i];
        try { c?.timeScale().unsubscribeVisibleLogicalRangeChange(fn); } catch {}
      });
    };
  }, [candles]);

  function syncVisibleRange(source) {
    const src = source === "price" ? priceChartRef.current
      : source === "squeeze" ? squeezeChartRef.current
      : source === "smi" ? smiChartRef.current
      : volChartRef.current;
    if (!src) return;
    const range = src.timeScale().getVisibleLogicalRange?.();
    if (!range) return;
    [priceChartRef.current, squeezeChartRef.current, smiChartRef.current, volChartRef.current]
      .filter(c => c && c !== src)
      .forEach(c => { try { c.timeScale().setVisibleLogicalRange(range); } catch {} });
  }

  // attach indicators to correct pane
  useEffect(() => {
    const priceChart   = priceChartRef.current;
    const squeezeChart = squeezeChartRef.current;
    const smiChart     = smiChartRef.current;
    const volChart     = volChartRef.current;
    if (!priceChart || !candles.length) return;

    // cleanup
    for (const [key, obj] of seriesMapRef.current) {
      if (key.endsWith("__cleanup") && typeof obj === "function") {
        try { obj(); } catch {}
      } else {
        try { priceChart.removeSeries?.(obj); } catch {}
        try { squeezeChart?.removeSeries?.(obj); } catch {}
        try { smiChart?.removeSeries?.(obj); } catch {}
        try { volChart?.removeSeries?.(obj); } catch {}
      }
    }
    seriesMapRef.current.clear();

    const paneForId = (id) => {
      if (id === "squeeze") return squeezeChart;
      if (id === "smi")     return smiChart;
      if (id === "vol")     return volChart;
      return priceChart;
    };

    // expose containers
    priceChart._container   = priceRef.current;
    priceChart._priceSeries = priceSeriesRef.current;
    if (squeezeChart) { squeezeChart._container = squeezeRef.current; squeezeChart._priceSeries = null; }
    if (smiChart)     { smiChart._container     = smiRef.current;     smiChart._priceSeries     = null; }
    if (volChart)     { volChart._container     = volRef.current;     volChart._priceSeries     = null; }

    const defs = resolveIndicators(enabledIndicators, indicatorSettings);
    defs.forEach(({ def, inputs }) => {
      const isSeparate = String(def.kind || "").toUpperCase() === "SEPARATE";
      const chartApi = isSeparate ? paneForId(def.id) : priceChart;
      if (!chartApi) return;
      const result  = def.compute(candles, inputs);
      const cleanup = def.attach(chartApi, seriesMapRef.current, result, inputs);
      seriesMapRef.current.set(`${def.id}__cleanup`, cleanup);
    });

    // ensure size after attach
    const w = wrapperRef.current?.clientWidth ?? 800;
    try { priceChart.resize(w, heights.price); } catch {}
    try { squeezeChart?.resize(w, needSqueeze ? heights.squeeze : 0); } catch {}
    try { smiChart?.resize(w, needSMI ? heights.smi : 0); } catch {}
    try { volChart?.resize(w, needVol ? heights.vol : 0); } catch {}

    syncVisibleRange("price");
  }, [candles, enabledIndicators, indicatorSettings, heights, needSqueeze, needSMI, needVol]);

  const show = { display: "block" };
  const hide = { display: "none" };

  const PaneHeader = ({ label, onInc, onDec }) => (
    <div style={{ position: "absolute", left: 6, top: 6, zIndex: 10, display: "flex", gap: 8, alignItems: "center" }}>
      <span style={{ fontSize: 12, color: "#93a3b8" }}>{label}</span>
      <button onClick={onDec} style={btnMini}>–</button>
      <button onClick={onInc} style={btnMini}>+</button>
    </div>
  );
  const btnMini = {
    padding: "2px 6px", borderRadius: 6, fontSize: 12,
    background: "#0b1220", color: "#e5e7eb", border: "1px solid #334155", cursor: "pointer"
  };

  return (
    <div ref={wrapperRef} style={{ width: "100%", display: "flex", flexDirection: "column", gap: 8 }}>
      {/* PRICE */}
      <div ref={priceRef} style={{ height: heights.price, position: "relative" }} />

      {/* SQUEEZE */}
      <div ref={squeezeRef} style={{ height: needSqueeze ? heights.squeeze : 0, position: "relative", ...(needSqueeze ? show : hide) }}>
        {needSqueeze && <PaneHeader label="Squeeze (LuxAlgo)" onInc={() => inc("squeeze")} onDec={() => dec("squeeze")} />}
      </div>

      {/* SMI */}
      <div ref={smiRef} style={{ height: needSMI ? heights.smi : 0, position: "relative", ...(needSMI ? show : hide) }}>
        {needSMI && <PaneHeader label="SMI" onInc={() => inc("smi")} onDec={() => dec("smi")} />}
      </div>

      {/* VOLUME */}
      <div ref={volRef} style={{ height: needVol ? heights.vol : 0, position: "relative", ...(needVol ? show : hide) }}>
        {needVol && <PaneHeader label="Volume" onInc={() => inc("vol")} onDec={() => dec("vol")} />}
      </div>
    </div>
  );
}

// merge candle on same timestamp else append
function mergeBar(prev, bar) {
  if (!prev?.length) return [bar];
  const last = prev[prev.length - 1];
  if (last.time === bar.time) { const next = prev.slice(0, -1); next.push(bar); return next; }
  return [...prev, bar];
}
