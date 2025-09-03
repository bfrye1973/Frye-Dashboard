// src/components/LiveLWChart/LiveLWChart.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createChart } from "lightweight-charts";
import { baseChartOptions } from "./chartConfig";
import { resolveIndicators } from "../../indicators";
import { getFeed } from "../../services/feed";

const DEFAULT_HEIGHTS = { price: 620, squeeze: 140, smi: 140, vol: 160 };

export default function LiveLWChart({
  symbol = "SPY",
  timeframe = "1D",
  height = DEFAULT_HEIGHTS.price,
  enabledIndicators = [],
  indicatorSettings = {},
  onCandles,
}) {
  const wrapperRef = useRef(null);
  const priceRef   = useRef(null);
  const squeezeRef = useRef(null);
  const smiRef     = useRef(null);
  const volRef     = useRef(null);

  const priceChartRef   = useRef(null);
  const squeezeChartRef = useRef(null);
  const smiChartRef     = useRef(null);
  const volChartRef     = useRef(null);

  const priceSeriesRef  = useRef(null);
  const seriesMapRef    = useRef(new Map());

  const [candles, setCandles] = useState([]);

  const needSqueeze = useMemo(() => enabledIndicators.includes("squeeze"), [enabledIndicators]);
  const needSMI     = useMemo(() => enabledIndicators.includes("smi"),     [enabledIndicators]);
  const needVol     = useMemo(() => enabledIndicators.includes("vol"),     [enabledIndicators]);

  const [heights, setHeights] = useState(DEFAULT_HEIGHTS);
  const inc = (key, amt=40) => setHeights(h => ({ ...h, [key]: Math.min(h[key] + amt, 480)}));
  const dec = (key, amt=40) => setHeights(h => ({ ...h, [key]: Math.max(h[key] - amt, 60)}));

  const legendRef = useRef(null);

  // init charts
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
      priceChartRef.current = squeezeChartRef.current = smiChartRef.current = volChartRef.current = null;
      priceSeriesRef.current = null;
      seriesMapRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // resize observer
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

  // load + stream
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

  // 60s safety refresh
  useEffect(() => {
    let stop = false;
    async function refreshHistory() {
      if (stop || !priceSeriesRef.current) return;
      try {
        const seed = await getFeed(symbol, timeframe).history();
        if (!seed?.length) return;
        price
