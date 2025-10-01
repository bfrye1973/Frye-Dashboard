// /src/components/LiveLWChart/LiveLWChart.jsx
import React, { useEffect, useRef, useState } from "react";
import { createChart } from "lightweight-charts";
import { baseChartOptions } from "./chartConfig";
import { getFeed, subscribeStream } from "../../services/feed";

export default function LiveLWChart({
  symbol = "SPY",
  timeframe = "10m",
  height = 520,
}) {
  const rootRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const volRef = useRef(null);
  const roRef = useRef(null);
  const dprCleanupRef = useRef(null);
  const [candles, setCandles] = useState([]);

  const safeResize = () => {
    const el = rootRef.current;
    const chart = chartRef.current;
    if (!el || !chart) return;
    chart.resize(el.clientWidth, el.clientHeight);
  };

  const phoenix = (ts) => {
    const seconds =
      typeof ts === "number"
        ? ts
        : ts && typeof ts.timestamp === "number"
        ? ts.timestamp
        : 0;
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Phoenix",
      hour12: true,
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(seconds * 1000));
  };

  // INIT
  useEffect(() => {
    const holder = rootRef.current;
    if (!holder) return;

    const chart = createChart(holder, {
      ...baseChartOptions,
      width: holder.clientWidth,
      height,
      localization: {
        ...(baseChartOptions.localization || {}),
        timezone: "America/Phoenix",
        dateFormat: "yyyy-MM-dd",
        timeFormatter: phoenix,
      },
    });
    chartRef.current = chart;

    const s = chart.addCandlestickSeries({
      upColor: baseChartOptions?.upColor ?? "#26a69a",
      downColor: baseChartOptions?.downColor ?? "#ef5350",
      borderUpColor: baseChartOptions?.borderUpColor ?? "#26a69a",
      borderDownColor: baseChartOptions?.borderDownColor ?? "#ef5350",
      wickUpColor: baseChartOptions?.wickUpColor ?? "#26a69a",
      wickDownColor: baseChartOptions?.wickDownColor ?? "#ef5350",
    });
    seriesRef.current = s;

    const v = chart.addHistogramSeries({
      priceScaleId: "",
      priceFormat: { type: "volume" },
    });
    v.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
    volRef.current = v;

    chart.timeScale().applyOptions({
      visible: true,
      timeVisible: true,
      borderVisible: true,
      minimumHeight: 20,
      tickMarkFormatter: (time) => phoenix(time),
    });

    const ro = new ResizeObserver(safeResize);
    ro.observe(holder);
    roRef.current = ro;

    const mq = window.matchMedia(
      `(resolution:${window.devicePixelRatio}dppx)`
    );
    const onDpr = () => safeResize();
    if (mq.addEventListener) {
      mq.addEventListener("change", onDpr);
      dprCleanupRef.current = () =>
        mq.removeEventListener("change", onDpr);
    } else if (mq.addListener) {
      mq.addListener(onDpr);
      dprCleanupRef.current = () => mq.removeListener(onDpr);
    }

    safeResize();
    return () => {
      try {
        roRef.current?.disconnect();
      } catch {}
      try {
        dprCleanupRef.current?.();
      } catch {}
      try {
        chart.remove();
      } catch {}
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

    // 1) History seed
    (async () => {
      try {
        const feed = getFeed(symbol, timeframe);
        const seed = await feed.history();
        if (disposed) return;

        series.setData(seed);
        if (volRef.current) {
          volRef.current.setData(
            seed.map((b) => ({
              time: b.time,
              value: Number(b.volume || 0),
              color:
                b.close >= b.open
                  ? "rgba(38,166,154,0.5)"
                  : "rgba(239,83,80,0.5)",
            }))
          );
        }
        setCandles(seed);
        chart.timeScale().fitContent();
      } catch (e) {
        console.error("[LiveLWChart] history failed:", e);
        series.setData([]);
        setCandles([]);
      }
    })();

    // 2) Live updates
    //    Prefer SSE if your backend stream is ready; otherwise the poller still works.
    unsubscribe = subscribeStream(symbol, timeframe, (bar) => {
      if (disposed || !bar || bar.time == null) return;
      series.update(bar);
      if (volRef.current) {
        volRef.current.update({
          time: bar.time,
          value: Number(bar.volume || 0),
          color:
            bar.close >= bar.open
              ? "rgba(38,166,154,0.5)"
              : "rgba(239,83,80,0.5)",
        });
      }
      setCandles((prev) => mergeBar(prev, bar));
    });

    return () => {
      disposed = true;
      try {
        unsubscribe?.();
      } catch {}
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
        ref={rootRef}
        className="chart-root"
        style={{ position: "relative", width: "100%", height }}
      />
    </section>
  );
}

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
