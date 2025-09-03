// src/components/LiveLWChart/LiveLWChart.jsx
// Lightweight Charts: price pane + optional squeeze/SMI/volume panes
// - Resilient to feed/indicator errors (try/catch)
// - Guards: only attach indicators that implement compute & attach

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createChart } from "lightweight-charts";
import { baseChartOptions } from "./chartConfig";
import { resolveIndicators } from "../../indicators";
import { getFeed } from "../../services/feed";

const DEFAULT_HEIGHTS = { price: 620, squeeze: 140, smi: 140, vol: 160 };

export default function LiveLWChart({
  symbol = "SPY",
  timeframe = "1D",
  height = DEFAULT_HEIGHTS.price, // legacy param
  enabledIndicators = [],
  indicatorSettings = {},
  onCandles,
}) {
  /*** DOM refs ***/
  const wrapperRef = useRef(null);
  const priceRef   = useRef(null);
  const squeezeRef = useRef(null);
  const smiRef     = useRef(null);
  const volRef     = useRef(null);

  /*** Chart APIs ***/
  const priceChartRef   = useRef(null);
  const squeezeChartRef = useRef(null);
  const smiChartRef     = useRef(null);
  const volChartRef     = useRef(null);

  /*** Primary series (price) & indicator series map ***/
  const priceSeriesRef  = useRef(null);
  const seriesMapRef    = useRef(new Map()); // key -> series or cleanup

  /*** State ***/
  const [candles, setCandles] = useState([]);

  const needSqueeze = useMemo(() => enabledIndicators.includes("squeeze"), [enabledIndicators]);
  const needSMI     = useMemo(() => enabledIndicators.includes("smi"),      [enabledIndicators]);
  const needVol     = useMemo(() => enabledIndicators.includes("vol"),      [enabledIndicators]);

  const [heights, setHeights] = useState(DEFAULT_HEIGHTS);
  const inc = (key, amt = 40) => setHeights(h => ({ ...h, [key]: Math.min(h[key] + amt, 480) }));
  const dec = (key, amt = 40) => setHeights(h => ({ ...h, [key]: Math.max(h[key] - amt, 60)  }));

  /*** Legend ***/
  const legendRef = useRef(null);

  /*****************************************************************
   * INIT CHARTS (once)
   *****************************************************************/
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
      try { priceChartRef.current?.remove(); }   catch {}
      try { squeezeChartRef.current?.remove(); } catch {}
      try { smiChartRef.current?.remove(); }     catch {}
      try { volChartRef.current?.remove(); }     catch {}
      priceChartRef.current = squeezeChartRef.current = smiChartRef.current = volChartRef.current = null;
      priceSeriesRef.current = null;
      seriesMapRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /*****************************************************************
   * RESIZE OBSERVER
   *****************************************************************/
  useEffect(() => {
    if (!wrapperRef.current) return;
    const ro = new ResizeObserver(() => {
      const w = wrapperRef.current?.clientWidth ?? 800;
      try { priceChartRef.current?.resize(w, heights.price); }                   catch {}
      try { squeezeChartRef.current?.resize(w, needSqueeze ? heights.squeeze : 0); } catch {}
      try { smiChartRef.current?.resize(w, needSMI ? heights.smi : 0); }        catch {}
      try { volChartRef.current?.resize(w, needVol ? heights.vol : 0); }        catch {}
    });
    ro.observe(wrapperRef.current);
    return () => { try { ro.disconnect(); } catch {} };
  }, [heights, needSqueeze, needSMI, needVol]);

  /*****************************************************************
   * LOAD + STREAM DATA
   *****************************************************************/
  useEffect(() => {
    if (!priceChartRef.current || !priceSeriesRef.current) return;

    const feed = getFeed(symbol, timeframe);
    let disposed = false;

    (async () => {
      try {
        const seed = await feed.history();
        if (disposed) return;
        if (!Array.isArray(seed)) throw new Error("bad history payload");
        setCandles(seed);
        priceSeriesRef.current.setData(seed);

        // expose candles for sibling panes
        priceChartRef.current._candles = seed;
        if (squeezeChartRef.current) squeezeChartRef.current._candles = seed;
        if (smiChartRef.current)     smiChartRef.current._candles     = seed;
        if (volChartRef.current)     volChartRef.current._candles     = seed;
        try { onCandles?.(seed); } catch {}
        syncVisibleRange("price");
      } catch (e) {
        console.error("[chart] history failed:", e);
      }
    })();

    const unsub = feed.subscribe((bar) => {
      try {
        if (disposed) return;
        if (!bar || bar.time == null) return;
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
      } catch (e) {
        console.error("[chart] update failed:", e);
      }
    });

    return () => { disposed = true; unsub?.(); feed.close?.(); };
  }, [symbol, timeframe, onCandles]);

  /*****************************************************************
   * 60s SAFETY REFRESH
   *****************************************************************/
  useEffect(() => {
    let stop = false;
    async function refreshHistory() {
      if (stop || !priceSeriesRef.current) return;
      try {
        const seed = await getFeed(symbol, timeframe).history();
        if (!seed?.length) return;
        priceSeriesRef.current.setData(seed);
        setCandles(seed);

        if (priceChartRef.current)  priceChartRef.current._candles  = seed;
        if (squeezeChartRef.current) squeezeChartRef.current._candles = seed;
        if (smiChartRef.current)      smiChartRef.current._candles      = seed;
        if (volChartRef.current)      volChartRef.current._candles      = seed;

        try { onCandles?.(seed); } catch {}
      } catch {}
    }
    const id = setInterval(refreshHistory, 60_000);
    return () => { stop = true; clearInterval(id); };
  }, [symbol, timeframe, onCandles]);

  /*****************************************************************
   * SYNC TIME SCALES
   *****************************************************************/
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

  /*****************************************************************
   * ATTACH INDICATORS (guards)
   *****************************************************************/
  useEffect(() => {
    const priceChart   = priceChartRef.current;
    const squeezeChart = squeezeChartRef.current;
    const smiChart     = smiChartRef.current;
    const volChart     = volChartRef.current;
    if (!priceChart || !candles.length) return;

    // cleanup previous
    for (const [key, obj] of seriesMapRef.current) {
      if (key.endsWith("__cleanup") && typeof obj === "function") {
        try { obj(); } catch {}
      } else {
        try { priceChart.removeSeries?.(obj); }     catch {}
        try { squeezeChart?.removeSeries?.(obj); }  catch {}
        try { smiChart?.removeSeries?.(obj); }      catch {}
        try { volChart?.removeSeries?.(obj); }      catch {}
      }
    }
    seriesMapRef.current.clear();

    const paneForId = (id) => {
      if (id === "squeeze") return squeezeChart;
      if (id === "smi")     return smiChart;
      if (id === "vol")     return volChart;
      return priceChart;
    };

    // expose containers to indicators
    priceChart._container   = priceRef.current;
    priceChart._priceSeries = priceSeriesRef.current;
    if (squeezeChart) { squeezeChart._container = squeezeRef.current; squeezeChart._priceSeries = null; }
    if (smiChart)     { smiChart._container     = smiRef.current;     smiChart._priceSeries     = null; }
    if (volChart)     { volChart._container     = volRef.current;     volChart._priceSeries     = null; }

    const defs = resolveIndicators(enabledIndicators, indicatorSettings)
      .filter(({ def }) => def && typeof def.compute === "function" && typeof def.attach === "function");

    defs.forEach(({ def, inputs }) => {
      try {
        const isSeparate = String(def.kind || "").toUpperCase() === "SEPARATE";
        const chartApi = isSeparate ? paneForId(def.id) : priceChart;
        if (!chartApi) return;

        const result  = def.compute(candles, inputs);
        const cleanup = def.attach(chartApi, seriesMapRef.current, result, inputs);
        if (typeof cleanup === "function") {
          seriesMapRef.current.set(`${def.id}__cleanup`, cleanup);
        }
      } catch (e) {
        console.error(`[indicator] ${def?.id || "unknown"} failed:`, e);
      }
    });

    const w = wrapperRef.current?.clientWidth ?? 800;
    try { priceChart.resize(w, heights.price); } catch {}
    try { squeezeChart?.resize(w, needSqueeze ? heights.squeeze : 0); } catch {}
    try { smiChart?.resize(w, needSMI ? heights.smi : 0); } catch {}
    try { volChart?.resize(w, needVol ? heights.vol : 0); } catch {}

    syncVisibleRange("price");
  }, [candles, enabledIndicators, indicatorSettings, heights, needSqueeze, needSMI, needVol]);

  /*****************************************************************
   * CROSSHAIR LEGEND
   *****************************************************************/
  useEffect(() => {
    const chart = priceChartRef.current;
    const priceSeries = priceSeriesRef.current;
    if (!chart || !priceSeries || !legendRef.current) return;

    const ema10 = seriesMapRef.current.get("ema10") || null;
    const ema20 = seriesMapRef.current.get("ema20") || null;
    const mfi   = seriesMapRef.current.get("mfi")   || null;

    const fmt = (n) => (n == null || Number.isNaN(n) ? "—" : Number(n).toFixed(2));
    const toNum = (v) => (typeof v === "object" && v?.price != null ? v.price : v);

    function write(payload) {
      const node = legendRef.current;
      if (!node) return;

      const last = {
        px:  priceSeries.getLastPrice?.() ?? {},
        e10: ema10?.getLastPrice?.() ?? {},
        e20: ema20?.getLastPrice?.() ?? {},
        mfi: mfi?.getLastPrice?.()   ?? {},
      };

      let px = last.px, e10 = last.e10, e20 = last.e20, mfiv = last.mfi;

      if (payload?.time && payload?.seriesPrices) {
        const sp = payload.seriesPrices;
        px   = sp.get(priceSeries)?.close ?? last.px;
        if (ema10) e10 = sp.get(ema10) ?? last.e10;
        if (ema20) e20 = sp.get(ema20) ?? last.e20;
        if (mfi)   mfiv = sp.get(mfi)   ?? last.mfi;
      }

      node.innerHTML = `
        <div style="display:flex; gap:12px; align-items:center">
          <span>Px <b>${fmt(toNum(px))}</b></span>
          <span style="color:#2dd4bf">EMA10 <b>${fmt(toNum(e10))}</b></span>
          <span style="color:#fb923c">EMA20 <b>${fmt(toNum(e20))}</b></span>
          <span style="color:#60a5fa">MFI14 <b>${fmt(toNum(mfiv))}</b></span>
        </div>
      `;
    }

    write(); // seed
    chart.subscribeCrosshairMove(write);
    return () => { try { chart.unsubscribeCrosshairMove(write); } catch {} };
  }, [candles]);

  /*****************************************************************
   * RENDER
   *****************************************************************/
  const show = { display: "block" };
  const hide = { display: "none" };
  const btnMini = {
    padding: "2px 6px", borderRadius: 6, fontSize: 12,
    background: "#0b1220", color: "#e5e7eb", border: "1px solid #334155", cursor: "pointer"
  };
  const PaneHeader = ({ label, onInc, onDec }) => (
    <div style={{ position: "absolute", left: 6, top: 6, zIndex: 10, display: "flex", gap: 8, alignItems: "center" }}>
      <span style={{ fontSize: 12, color: "#93a3b8" }}>{label}</span>
      <button onClick={onDec} style={btnMini}>–</button>
      <button onClick={onInc} style={btnMini}>+</button>
    </div>
  );

  return (
    <div ref={wrapperRef} style={{ width: "100%", display: "flex", flexDirection: "column", gap: 8 }}>
      {/* PRICE pane with legend */}
      <div ref={priceRef} style={{ height: heights.price, position: "relative" }}>
        <div
          ref={legendRef}
          style={{
            position: "absolute", top: 8, left: 10, zIndex: 6,
            fontSize: 12, background: "rgba(15,17,23,.85)",
            border: "1px solid #1f2937", borderRadius: 6,
            padding: "6px 8px", color: "#d1d4dc", pointerEvents: "none"
          }}
        />
      </div>

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

/*** MERGE CANDLE (same timestamp → replace) ***/
function mergeBar(prev, bar) {
  if (!prev?.length) return [bar];
  const last = prev[prev.length - 1];
  if (last.time === bar.time) { const next = prev.slice(0, -1); next.push(bar); return next; }
  return [...prev, bar];
}
