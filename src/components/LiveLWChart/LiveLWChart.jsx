// /src/components/LiveLWChart/LiveLWChart.jsx
// Lightweight Charts wrapper — seed from /api/v1/ohlc + SSE live from /stream/agg

import React, { useEffect, useRef, useState } from "react";
import { createChart } from "lightweight-charts";
import { baseChartOptions } from "./chartConfig";
import { getOHLC } from "../../services/ohlc";
import { subscribeStream } from "../../services/feed";

export default function LiveLWChart({
  symbol = "SPY",
  timeframe = "10m",
  height = 520,
}) {
  const chartRootRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const volRef = useRef(null);
  const roRef = useRef(null);
  const dprCleanupRef = useRef(null);

  const [candles, setCandles] = useState([]);

  const safeResize = () => {
    const el = chartRootRef.current;
    const chart = chartRef.current;
    if (!el || !chart) return;
    chart.resize(el.clientWidth, el.clientHeight);
  };

  const phoenixFormatter = (ts) => {
    const seconds =
      typeof ts === "number"
        ? ts
        : ts && typeof ts.timestamp === "number"
        ? ts.timestamp
        : 0;
    const d = new Date(seconds * 1000);
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Phoenix",
      hour12: true,
      hour: "numeric",
      minute: "2-digit",
    }).format(d);
  };

  // INIT
  useEffect(() => {
    const holder = chartRootRef.current;
    if (!holder) return;

    holder.style.position = "relative";
    holder.style.zIndex = "1";

    const chart = createChart(holder, {
      ...baseChartOptions,
      width: holder.clientWidth,
      height,
      localization: {
        ...(baseChartOptions.localization || {}),
        timezone: "America/Phoenix",
        dateFormat: "yyyy-MM-dd",
        timeFormatter: phoenixFormatter,
      },
    });
    chartRef.current = chart;

    const candleSeries = chart.addCandlestickSeries({
      upColor: baseChartOptions?.upColor ?? "#26a69a",
      downColor: baseChartOptions?.downColor ?? "#ef5350",
      borderUpColor: baseChartOptions?.borderUpColor ?? "#26a69a",
      borderDownColor: baseChartOptions?.borderDownColor ?? "#ef5350",
      wickUpColor: baseChartOptions?.wickUpColor ?? "#26a69a",
      wickDownColor: baseChartOptions?.wickDownColor ?? "#ef5350",
    });
    seriesRef.current = candleSeries;

    const vol = chart.addHistogramSeries({ priceScaleId: "", priceFormat: { type: "volume" } });
    vol.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
    volRef.current = vol;

    chart.timeScale().applyOptions({
      visible: true,
      timeVisible: true,
      borderVisible: true,
      minimumHeight: 20,
      tickMarkFormatter: (time) => phoenixFormatter(time),
    });

    const ro = new ResizeObserver(safeResize);
    ro.observe(holder);
    roRef.current = ro;

    const mq = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    const onDpr = () => safeResize();
    if (mq.addEventListener) {
      mq.addEventListener("change", onDpr);
      dprCleanupRef.current = () => mq.removeEventListener("change", onDpr);
    } else if (mq.addListener) {
      mq.addListener(onDpr);
      dprCleanupRef.current = () => mq.removeListener(onDpr);
    }

    safeResize();

    return () => {
      try { roRef.current?.disconnect(); } catch {}
      try { dprCleanupRef.current?.(); } catch {}
      try { chart.remove(); } catch {}
      chartRef.current = null;
      seriesRef.current = null;
      volRef.current = null;
    };
  }, [height]);

  // LOAD + STREAM
  useEffect(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    if (!chart || !series) return;

    let disposed = false;
    let unsubscribe = null;

    // 1) Seed
    (async () => {
      try {
        const seed = await getOHLC(symbol, timeframe, 5000);
        if (disposed) return;
        if (Array.isArray(seed) && seed.length) {
          series.setData(seed);
          if (volRef.current) {
            volRef.current.setData(
              seed.map((b) => ({
                time: b.time,
                value: Number(b.volume || 0),
                color: b.close >= b.open
                  ? "rgba(38,166,154,0.5)"
                  : "rgba(239,83,80,0.5)",
              }))
            );
          }
          setCandles(seed);
          chart.timeScale().fitContent();
        } else {
          series.setData([]);
          setCandles([]);
        }
      } catch (e) {
        console.error("[LiveLWChart] history failed:", e);
        series.setData([]);
        setCandles([]);
      }
    })();

    // 2) Stream (SSE)
    if (timeframe !== "1d") {
      unsubscribe = subscribeStream(symbol, timeframe, (bar) => {
        if (disposed || !bar || bar.time == null) return;
        series.update(bar);
        if (volRef.current) {
          volRef.current.update({
            time: bar.time,
            value: Number(bar.volume || 0),
            color: bar.close >= bar.open
              ? "rgba(38,166,154,0.5)"
              : "rgba(239,83,80,0.5)",
          });
        }
        setCandles((prev) => mergeBar(prev, bar));
      });
    }

    return () => {
      disposed = true;
      try { unsubscribe?.(); } catch {}
    };
  }, [symbol, timeframe]);

  return (
    <section
      className="panel chart-card"
      style={{
        position: "relative",
        zIndex: 1,
        width: "100%",
        minHeight: height,
        border: "1px solid #1f2a44",
        borderRadius: 8,
        background: "#0b0b14",
        overflow: "hidden",
        marginTop: 12,
      }}
    >
      <div
        ref={chartRootRef}
        className="chart-root"
        style={{ position: "relative", width: "100%", height }}
      />
    </section>
  );
}

/* -------------------- helpers -------------------- */
function mergeBar(prev, bar) {
  if (!Array.isArray(prev) || prev.length === 0) return [bar];
  const last = prev[prev.length - 1];
  if (last && last.time === bar.time) {
    const next = prev.slice(0, -1);
    next.push(bar);
    return next;
  }
  return [...prev, bar];
}
