// src/components/LiveLWChart.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  createChart,
  CrosshairMode,
  LineStyle,
} from "lightweight-charts";

/**
 * Phase 3: Candles + EMA(10/20) + Volume histogram + MFI overlay
 * - Fetches OHLCV from your backend: /api/v1/ohlc?symbol=...&timeframe=...
 * - Renders: candles, EMA10, EMA20, volume histogram (bottom), MFI overlay (0..100) with 80/20 lines
 * - Simple controls for symbol, timeframe, and indicator toggles
 */

const TF_OPTIONS = ["1m", "1h", "1d"];
const SYMBOLS = ["AAPL", "MSFT", "SPY", "QQQ", "IWM", "MDY"];

function toSec(ts) {
  // server sends ms; lightweight-charts wants seconds or businessDay
  return typeof ts === "number" ? Math.round(ts / 1000) : ts;
}

async function fetchOHLC(symbol, timeframe) {
  const url = `/api/v1/ohlc?symbol=${encodeURIComponent(
    symbol
  )}&timeframe=${encodeURIComponent(timeframe)}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`OHLC ${res.status}: ${msg}`);
  }
  const j = await res.json();
  const bars = Array.isArray(j?.bars) ? j.bars : [];
  // Normalize for chart + calcs
  return bars.map((b) => ({
    time: toSec(b.t),
    open: +b.o,
    high: +b.h,
    low: +b.l,
    close: +b.c,
    volume: b.v != null ? +b.v : 0,
  }));
}

function calcEMA(data, period = 10) {
  if (!Array.isArray(data) || data.length === 0) return [];
  const k = 2 / (period + 1);
  let emaPrev = data[0].close;
  const out = [{ time: data[0].time, value: emaPrev }];

  for (let i = 1; i < data.length; i++) {
    const v = data[i].close * k + emaPrev * (1 - k);
    out.push({ time: data[i].time, value: v });
    emaPrev = v;
  }
  return out;
}

// Money Flow Index (MFI) overlay (default 14)
function calcMFI(data, period = 14) {
  if (!Array.isArray(data) || data.length === 0) return [];
  const tp = (d) => (d.high + d.low + d.close) / 3;
  const flows = data.map((d, i) => {
    const t = tp(d);
    const prev = i > 0 ? tp(data[i - 1]) : t;
    const raw = t * (d.volume ?? 0);
    const pos = t > prev ? raw : 0;
    const neg = t < prev ? raw : 0;
    return { time: d.time, pos, neg };
  });

  let sumPos = 0;
  let sumNeg = 0;
  const q = [];
  const out = [];

  for (let i = 0; i < flows.length; i++) {
    const f = flows[i];
    q.push(f);
    sumPos += f.pos;
    sumNeg += f.neg;

    if (q.length > period) {
      const old = q.shift();
      sumPos -= old.pos;
      sumNeg -= old.neg;
    }

    if (q.length === period) {
      const ratio = sumNeg === 0 ? 1000 : sumPos / sumNeg;
      const mfi = 100 - 100 / (1 + ratio);
      out.push({ time: f.time, value: mfi });
    } else {
      // pad with null until the first full window
      out.push({ time: f.time, value: null });
    }
  }

  return out;
}

export default function LiveLWChart({
  height = 560,
  initialSymbol = "SPY",
  initialTf = "1d",
}) {
  const wrapRef = useRef(null);
  const chartRef = useRef(null);

  const candleRef = useRef(null);
  const ema10Ref = useRef(null);
  const ema20Ref = useRef(null);
  const volRef = useRef(null);
  const mfiRef = useRef(null);
  const mfi80LineRef = useRef(null);
  const mfi20LineRef = useRef(null);

  const [symbol, setSymbol] = useState(initialSymbol);
  const [tf, setTf] = useState(initialTf);

  const [showVolume, setShowVolume] = useState(true);
  const [showMfi, setShowMfi] = useState(true);
  const [mfiPeriod, setMfiPeriod] = useState(14);

  // Fetch & memoize data
  const [raw, setRaw] = useState([]);
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const d = await fetchOHLC(symbol, tf);
        if (live) setRaw(d);
      } catch (e) {
        console.error("fetchHistory error:", e);
        if (live) setRaw([]);
      }
    })();
    return () => {
      live = false;
    };
  }, [symbol, tf]);

  const ema10 = useMemo(() => calcEMA(raw, 10), [raw]);
  const ema20 = useMemo(() => calcEMA(raw, 20), [raw]);

  const mfi = useMemo(() => calcMFI(raw, mfiPeriod), [raw, mfiPeriod]);

  const candleData = useMemo(
    () =>
      raw.map((d) => ({
        time: d.time,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      })),
    [raw]
  );

  const volumeData = useMemo(
    () =>
      raw.map((d) => ({
        time: d.time,
        value: d.volume ?? 0,
        color: d.close >= d.open ? "rgba(38,166,154,0.6)" : "rgba(239,83,80,0.6)",
      })),
    [raw]
  );

  // Build chart & series once
  useEffect(() => {
    if (!wrapRef.current) return;

    const chart = createChart(wrapRef.current, {
      width: wrapRef.current.clientWidth || 1200,
      height,
      layout: {
        background: { type: "Solid", color: "#0f1117" },
        textColor: "#d1d4dc",
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.06)" },
        horzLines: { color: "rgba(255,255,255,0.06)" },
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.08, bottom: 0.22 }, // leave room for bottom volume
      },
      timeScale: {
        borderVisible: false,
        timeVisible: tf !== "1d",
        secondsVisible: tf === "1m",
      },
      crosshair: { mode: CrosshairMode.Normal },
      localization: { priceFormatter: (p) => (p ?? 0).toFixed(2) },
    });

    // Candles
    const candles = chart.addCandlestickSeries({
      upColor: "#26a69a",
      downColor: "#ef5350",
      borderUpColor: "#26a69a",
      borderDownColor: "#ef5350",
      wickUpColor: "#26a69a",
      wickDownColor: "#ef5350",
    });

    // EMA 10
    const ema10Series = chart.addLineSeries({
      color: "#2dd4bf", // teal-ish
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
    });

    // EMA 20
    const ema20Series = chart.addLineSeries({
      color: "#f59e0b", // amber-ish
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
    });

    // Volume (special empty price scale id groups histogram at bottom)
    const volume = chart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "",
      priceLineVisible: false,
      lastValueVisible: false,
      base: 0,
    });
    chart.priceScale("").applyOptions({
      scaleMargins: { top: 0.85, bottom: 0.0 },
    });

    // MFI overlay with its own hidden scale
    const mfiSeries = chart.addLineSeries({
      priceScaleId: "mfi",
      color: "#00bcd4",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
    });
    chart.priceScale("mfi").applyOptions({
      visible: false, // hide labels/ticks for this scale
      scaleMargins: { top: 0.02, bottom: 0.72 }, // small band toward top
    });

    // Keep refs
    chartRef.current = chart;
    candleRef.current = candles;
    ema10Ref.current = ema10Series;
    ema20Ref.current = ema20Series;
    volRef.current = volume;
    mfiRef.current = mfiSeries;

    // responsive
    const ro = new ResizeObserver(() => {
      chart.applyOptions({
        width: wrapRef.current?.clientWidth || 1200,
        height,
      });
    });
    ro.observe(wrapRef.current);

    return () => {
      try {
        ro.disconnect();
      } catch {}
      try {
        chart.remove();
      } catch {}
      chartRef.current = null;
      candleRef.current = null;
      ema10Ref.current = null;
      ema20Ref.current = null;
      volRef.current = null;
      mfiRef.current = null;
      mfi80LineRef.current = null;
      mfi20LineRef.current = null;
    };
  }, [height, tf]); // recreate chart if timeframe mode changes secondsVisible

  // Push data into series
  useEffect(() => {
    if (!chartRef.current) return;

    candleRef.current?.setData(candleData);
    ema10Ref.current?.setData(ema10);
    ema20Ref.current?.setData(ema20);

    if (showVolume) {
      volRef.current?.setData(volumeData);
    } else {
      volRef.current?.setData([]);
    }

    if (showMfi) {
      mfiRef.current?.setData(mfi);
      // recreate guide lines
      if (mfi80LineRef.current) mfiRef.current.removePriceLine(mfi80LineRef.current);
      if (mfi20LineRef.current) mfiRef.current.removePriceLine(mfi20LineRef.current);
      mfi80LineRef.current = mfiRef.current.createPriceLine({
        price: 80,
        color: "rgba(255,99,132,0.6)",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: false,
        title: "80",
      });
      mfi20LineRef.current = mfiRef.current.createPriceLine({
        price: 20,
        color: "rgba(99,255,132,0.6)",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: false,
        title: "20",
      });
    } else {
      mfiRef.current?.setData([]);
      if (mfi80LineRef.current) {
        mfiRef.current.removePriceLine(mfi80LineRef.current);
        mfi80LineRef.current = null;
      }
      if (mfi20LineRef.current) {
        mfiRef.current.removePriceLine(mfi20LineRef.current);
        mfi20LineRef.current = null;
      }
    }

    chartRef.current.timeScale().fitContent();
  }, [candleData, ema10, ema20, volumeData, mfi, showVolume, showMfi]);

  return (
    <div style={{ padding: "8px 10px 0" }}>
      {/* Controls */}
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          marginBottom: 8,
          flexWrap: "wrap",
        }}
      >
        <strong>Symbol</strong>
        <select
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          style={{ background: "#0f1117", color: "#d1d4dc", borderRadius: 6, padding: "4px 8px", border: "1px solid #1b2130" }}
        >
          {SYMBOLS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <strong style={{ marginLeft: 8 }}>Timeframe</strong>
        <div style={{ display: "inline-flex", gap: 6 }}>
          {TF_OPTIONS.map((x) => (
            <button
              key={x}
              onClick={() => setTf(x)}
              style={{
                padding: "4px 10px",
                borderRadius: 6,
                border: "1px solid #1b2130",
                background: tf === x ? "#263046" : "#0f1117",
                color: "#d1d4dc",
                cursor: "pointer",
              }}
            >
              {x}
            </button>
          ))}
        </div>

        <span style={{ marginLeft: 16 }} />

        <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <input
            type="checkbox"
            checked={showVolume}
            onChange={() => setShowVolume((v) => !v)}
          />
          <span>Volume</span>
        </label>

        <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <input
            type="checkbox"
            checked={showMfi}
            onChange={() => setShowMfi((v) => !v)}
          />
          <span>MFI</span>
        </label>

        <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span>MFI Period</span>
          <input
            type="number"
            value={mfiPeriod}
            min={3}
            max={100}
            onChange={(e) => setMfiPeriod(Math.max(3, Math.min(100, +e.target.value || 14)))}
            style={{
              width: 60,
              background: "#0f1117",
              color: "#d1d4dc",
              border: "1px solid #1b2130",
              borderRadius: 6,
              padding: "4px 6px",
            }}
          />
        </label>
      </div>

      {/* Chart */}
      <div
        ref={wrapRef}
        style={{
          position: "relative",
          width: "100%",
          minHeight: height,
          borderRadius: 10,
          overflow: "hidden",
          border: "1px solid #1b2130",
          background: "#0f1117",
        }}
        aria-label="Lightweight Charts price chart with EMA, Volume, and MFI"
      />
    </div>
  );
}
