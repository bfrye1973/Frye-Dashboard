// src/components/overlays/SwingLiquidityOverlay.js
// FIX: proper cleanup so toggle OFF removes all lines/markers

import React, { useEffect, useRef } from "react";
import { LineStyle } from "lightweight-charts";
import { computeSwingLiquidity } from "../../indicators/swingLiquidity/compute";

const COLORS = { res: "#ef4444", sup: "#10b981" };
const STYLE  = { mainWidth: 3, otherWidth: 2, emphasizeMostRecent: true };

export default function SwingLiquidityOverlay({
  chart,
  candles,
  leftBars = 15,
  rightBars = 10,
  volPctGate = 0.65,
  extendUntilFilled = true,
  hideFilled = false,
  lookbackBars = 800,
  maxOnScreen = 80,
}) {
  const hostRef = useRef(null);      // timeline/markers host
  const segsRef = useRef([]);        // array of line series
  const chartRef = useRef(chart);

  // Helper: remove every series we created
  const clearAll = () => {
    try { segsRef.current.forEach(s => chartRef.current?.removeSeries(s)); } catch {}
    segsRef.current = [];
    try { hostRef.current?.setMarkers([]); } catch {}
  };

  // Mount host & ensure it’s removed on unmount
  useEffect(() => {
    chartRef.current = chart;
    if (!chart || hostRef.current) return;

    hostRef.current = chart.addLineSeries({
      color: "rgba(0,0,0,0)",
      lineWidth: 1,
      visible: true,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    });

    return () => {
      // full cleanup on unmount
      clearAll();
      try { chart?.removeSeries(hostRef.current); } catch {}
      hostRef.current = null;
    };
  }, [chart]);

  // Draw segments; also clean them up when deps change OR on unmount
  useEffect(() => {
    if (!chart || !candles?.length || !hostRef.current) return;

    // Keep host timeline stable
    try { hostRef.current.setData(candles.map(c => ({ time: c.time, value: c.close }))); } catch {}

    // Compute zones
    const { zones } = computeSwingLiquidity(candles, {
      leftBars, rightBars, volPctGate,
      extendUntilFilled, hideFilled,
      lookbackBars, maxOnScreen,
    });

    // Remove previous segments before drawing new
    clearAll();

    if (!zones.length) return;

    let emphasizePrice = null;
    if (STYLE.emphasizeMostRecent) {
      const u = zones.find(z => !z.filled);
      if (u) emphasizePrice = u.price;
    }

    for (const z of zones) {
      const isMain = emphasizePrice != null && Math.abs(z.price - emphasizePrice) < 1e-9;
      const s = chart.addLineSeries({
        color: z.type === "res" ? COLORS.res : COLORS.sup,
        lineWidth: isMain ? STYLE.mainWidth : STYLE.otherWidth,
        lineStyle: LineStyle.Solid,
        lastValueVisible: false,
        priceLineVisible: false,
      });
      s.setData([
        { time: z.fromTime, value: z.price },
        { time: z.toTime,   value: z.price },
      ]);
      segsRef.current.push(s);
    }

    // cleanup when any dependency changes OR component unmounts
    return () => {
      clearAll();
    };
  }, [
    chart, candles,
    leftBars, rightBars, volPctGate,
    extendUntilFilled, hideFilled,
    lookbackBars, maxOnScreen,
  ]);

  return null;
}
