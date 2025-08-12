// src/pages/Platform.jsx
import React, { useMemo, useRef, useEffect } from "react";
import ChartContainer from "../components/ChartContainer";
import { createLiveFeed } from "../services/liveFeed";
import { createAggregator } from "../lib/aggregator";

/* ===================== Config ===================== */
// Set your timeframe in seconds: 60=1m, 300=5m, 3600=1h, 86400=1D
const TIMEFRAME_SEC = 86400;

// Flip to false when your WebSocket URL is ready
const SIMULATION = true;

// Put your provider details here when ready
const FEED_URL = "wss://YOUR_PROVIDER_ENDPOINT";
const FEED_SYMBOL = "AAPL";

/* ================= Seed data (daily bars, seconds) ================= */
function makeSeed(n = 240) {
  const out = [];
  let t = Math.floor(Date.now() / 1000) - n * TIMEFRAME_SEC;
  let price = 100;
  for (let i = 0; i < n; i++) {
    const open = price;
    const high = open + Math.random() * 3 + 1;
    const low = open - (Math.random() * 3 + 1);
    const close = low + Math.random() * (high - low);
    price = close;
    out.push({ time: t, open, high, low, close });
    t += TIMEFRAME_SEC;
  }
  return out;
}

function sma(arr, startIdx, len) {
  let s = 0;
  for (let i = startIdx; i < startIdx + len; i++) s += arr[i];
  return s / len;
}

export default function Platform() {
  const seed = useMemo(() => makeSeed(240), []);
  const closesSeed = useMemo(() => seed.map(b => b.close), [seed]);

  // series refs
  const candleSeriesRef = useRef(null);
  const ema12SeriesRef = useRef(null);
  const ema26SeriesRef = useRef(null);
  const rsiSeriesRef   = useRef(null);

  // live state refs
  const dataRef = useRef({
    candles: [...seed],
    lastTime: seed[seed.length - 1].time,
    lastClose: seed[seed.length - 1].close,
  });

  // EMA state
  const ema12Ref = useRef(null);
  const ema26Ref = useRef(null);

  // RSI state
  const rsiPeriod = 14;
  const rsiAvgGainRef = useRef(0);
  const rsiAvgLossRef = useRef(0);
  const rsiReadyRef   = useRef(false);

  /* =============== Top pane: Candles + EMA12/26 =============== */
  const onReadyTop = (chart) => {
    const candle = chart.addCandlestickSeries({ priceScaleId: "right" });
    candle.setData(seed);
    candleSeriesRef.current = candle;

    // build EMA points from history
    const ema12Pts = [];
    const ema26Pts = [];

    // EMA(12)
    for (let i = 0; i < closesSeed.length; i++) {
      if (i === 11) {
        ema12Ref.current = sma(closesSeed, i - 11, 12);
        ema12Pts.push({ time: seed[i].time, value: ema12Ref.current });
      } else if (i > 11) {
        const k12 = 2 / (12 + 1);
        ema12Ref.current = closesSeed[i] * k12 + ema12Ref.current * (1 - k12);
        ema12Pts.push({ time: seed[i].time, value: ema12Ref.current });
      }
    }

    // EMA(26)
    for (let i = 0; i < closesSeed.length; i++) {
      if (i === 25) {
        ema26Ref.current = sma(closesSeed, i - 25, 26);
        ema26Pts.push({ time: seed[i].time, value: ema26Ref.current });
      } else if (i > 25) {
        const k26 = 2 / (26 + 1);
        ema26Ref.current = closesSeed[i] * k26 + ema26Ref.current * (1 - k26);
        ema26Pts.push({ time: seed[i].time, value: ema26Ref.current });
      }
    }

    const ema12Line = chart.addLineSeries({ priceScaleId: "right", lineWidth: 2 });
    const ema26Line = chart.addLineSeries({ priceScaleId: "right", lineWidth: 2 });
    ema12Line.setData(ema12Pts);
    ema26Line.setData(ema26Pts);

    ema12SeriesRef.current = ema12Line;
    ema26SeriesRef.current = ema26Line;

    chart.timeScale().fitContent();
  };

  /* =============== Bottom pane: RSI(14) =============== */
  const onReadyBottom = (chart) => {
    const rsiLine = chart.addLineSeries({ priceScaleId: "right", lineWidth: 2 });
    rsiSeriesRef.current = rsiLine;

    const rsiPts = new Array(seed.length).fill(null);
    let gains = 0, losses = 0;

    for (let i = 1; i < closesSeed.length; i++) {
      const ch = closesSeed[i] - closesSeed[i - 1];
      const up = Math.max(ch, 0);
      const down = Math.max(-ch, 0);

      if (i <= rsiPeriod) {
        gains += up; losses += down;
        if (i === rsiPeriod) {
          rsiAvgGainRef.current = gains / rsiPeriod;
          rsiAvgLossRef.current = losses / rsiPeriod;
          const rs = rsiAvgLossRef.current === 0 ? 100 : rsiAvgGainRef.current / rsiAvgLossRef.current;
          rsiPts[i] = { time: seed[i].time, value: 100 - 100 / (1 + rs) };
          rsiReadyRef.current = true;
        }
      } else {
        rsiAvgGainRef.current = (rsiAvgGainRef.current * (rsiPeriod - 1) + up) / rsiPeriod;
        rsiAvgLossRef.current = (rsiAvgLossRef.current * (rsiPeriod - 1) + down) / rsiPeriod;
        const rs = rsiAvgLossRef.current === 0 ? 100 : rsiAvgGainRef.current / rsiAvgLossRef.current;
        rsiPts[i] = { time: seed[i].time, value: 100 - 100 / (1 + rs) };
      }
    }

    rsiLine.setData(rsiPts.filter(Boolean));

    const addGuide = (price) =>
      rsiLine.createPriceLine({
        price,
        color: "#374151",
        lineStyle: 2,
        lineWidth: 1,
        axisLabelVisible: true,
      });
    addGuide(30); addGuide(70);

    chart.timeScale().fitContent();
  };

  /* =============== Live data wiring =============== */
  useEffect(() => {
    const candlesOK = candleSeriesRef.current && ema12SeriesRef.current && ema26SeriesRef.current;
    const rsiOK = rsiSeriesRef.current;
    if (!candlesOK || !rsiOK) return;

    // How to apply each finished bar to all series
    const handleBar = (bar) => {
      const ds = dataRef.current;

      // 1) Candles
      candleSeriesRef.current.update(bar);
      ds.candles.push(bar);
      ds.lastTime = bar.time;
      ds.lastClose = bar.close;

      // 2) EMA12
      if (ema12Ref.current == null) {
        if (ds.candles.length >= 12) {
          const closes = ds.candles.slice(-12).map(b => b.close);
          ema12Ref.current = closes.reduce((a,b)=>a+b,0)/12;
          ema12SeriesRef.current.update({ time: bar.time, value: ema12Ref.current });
        }
      } else {
        ema12Ref.current = bar.close * (2/13) + ema12Ref.current * (11/13);
        ema12SeriesRef.current.update({ time: bar.time, value: ema12Ref.current });
      }

      // 3) EMA26
      if (ema26Ref.current == null) {
        if (ds.candles.length >= 26) {
          const closes = ds.candles.slice(-26).map(b => b.close);
          ema26Ref.current = closes.reduce((a,b)=>a+b,0)/26;
          ema26SeriesRef.current.update({ time: bar.time, value: ema26Ref.current });
        }
      } else {
        ema26Ref.current = bar.close * (2/27) + ema26Ref.current * (25/27);
        ema26SeriesRef.current.update({ time: bar.time, value: ema26Ref.current });
      }

      // 4) RSI(14)
      const prevClose = ds.candles.at(-2)?.close ?? bar.close;
      const ch = bar.close - prevClose;
      const up = Math.max(ch, 0);
      const down = Math.max(-ch, 0);

      if (!rsiReadyRef.current) {
        const closes = ds.candles.map(b => b.close);
        if (closes.length >= 15) {
          let gains = 0, losses = 0;
          for (let i = closes.length - 14; i < closes.length; i++) {
            const d = closes[i] - closes[i-1];
            gains += Math.max(d,0);
            losses += Math.max(-d,0);
          }
          rsiAvgGainRef.current = gains / 14;
          rsiAvgLossRef.current = losses / 14;
          rsiReadyRef.current = true;
        } else return;
      } else {
        rsiAvgGainRef.current = (rsiAvgGainRef.current * 13 + up) / 14;
        rsiAvgLossRef.current = (rsiAvgLossRef.current * 13 + down) / 14;
      }

      const rs = rsiAvgLossRef.current === 0 ? 100 : rsiAvgGainRef.current / rsiAvgLossRef.current;
      const rsiValue = 100 - 100 / (1 + rs);
      rsiSeriesRef.current.update({ time: bar.time, value: rsiValue });
    };

    // Build bars from ticks *or* accept bars directly
    const aggregator = createAggregator(TIMEFRAME_SEC, handleBar);

    // Choose live feed or simulation
    let cleanup = () => {};
    if (SIMULATION) {
      // Simulate one finished bar every ~2s
      const id = setInterval(() => {
        const ds = dataRef.current;
        const nextTime = ds.lastTime + TIMEFRAME_SEC;
        const open = ds.lastClose;
        const high = open + Math.random();
        const low = open - Math.random();
        const close = low + Math.random() * (high - low);
        aggregator.bar({ time: nextTime, open, high, low, close });
      }, 2000);
      cleanup = () => clearInterval(id);
    } else {
      const feed = createLiveFeed(
        { url: FEED_URL, symbol: FEED_SYMBOL, intervalSec: TIMEFRAME_SEC },
        {
          onOpen: () => console.log("WS open"),
          onError: (e) => console.error("WS error", e),
          onBar:  (bar)  => aggregator.bar(bar),   // if provider sends bars
          onTick: (tick) => aggregator.tick(tick)  // if provider sends ticks
        }
      );
      cleanup = () => { aggregator.flush(); feed.close(); };
    }

    return cleanup;
  }, []);

  /* =============== Layout =============== */
  return (
    <div
      style={{
        width: "100%",
        height: "100vh",
        background: "#0b0b14",
        display: "grid",
        gridTemplateRows: "minmax(360px,1fr) 200px",
        gap: 12,
        padding: 12,
      }}
    >
      {/* Top pane */}
      <ChartContainer onReady={onReadyTop} />

      {/* Bottom pane */}
      <ChartContainer onReady={onReadyBottom} />
    </div>
  );
}
