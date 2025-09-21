// src/components/overlays/SwingLiquidityOverlay.js
// Draws short, solid horizontal segments for swing liquidity (pivots).
// - Red = swing-high liquidity (resistance), Green = swing-low liquidity (support)
// - Segments extend from confirmation time until filled (or last bar)
// - Uses tiny line series segments (2 points per level) so lines don't span the whole pane

import React, { useEffect, useRef } from "react";
import { LineStyle } from "lightweight-charts";
import { computeSwingLiquidity } from "../../indicators/swingLiquidity/compute";

const COLORS = {
  res: "#ef4444", // red
  sup: "#10b981", // green-ish
};
const STYLE = {
  mainWidth: 3,
  otherWidth: 2,
  emphasizeMostRecent: true,
};

export default function SwingLiquidityOverlay({
  chart,          // LightweightCharts chart instance
  candles,        // [{time,open,high,low,close,volume}]
  leftBars = 15,
  rightBars = 10,
  volPctGate = 0.65,     // keep swings where volume >= 65th percentile
  extendUntilFilled = true,
  hideFilled = false,
  lookbackBars = 800,
  maxOnScreen = 80,
}) {
  const hostRef = useRef(null);              // host series for markers (optional)
  const segmentsRef = useRef([]);            // line series per zone

  // Ensure host exists (for timeline stability if we want markers later)
  useEffect(() => {
    if (!chart) return;
    if (hostRef.current) return;
    hostRef.current = chart.addLineSeries({
      color: "rgba(0,0,0,0)",
      lineWidth: 1,
      visible: true,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    });
    return () => {
      try { chart.removeSeries(hostRef.current); } catch {}
      hostRef.current = null;
    };
  }, [chart]);

  // Draw segments whenever bars change
  useEffect(() => {
    if (!chart || !candles?.length) return;

    // Give host a minimal timeline (prevents some libs from dropping markers)
    try { hostRef.current?.setData(candles.map(c => ({ time: c.time, value: c.close }))); } catch {}

    // Compute zones
    const { zones } = computeSwingLiquidity(candles, {
      leftBars, rightBars, volPctGate,
      extendUntilFilled, hideFilled,
      lookbackBars, maxOnScreen,
    });

    // Cleanup old segments
    try { segmentsRef.current.forEach(s => chart.removeSeries(s)); } catch {}
    segmentsRef.current = [];

    if (!zones.length) return;

    // Emphasize the most recent unfilled zone (optional)
    let emphasizePrice = null;
    if (STYLE.emphasizeMostRecent) {
      const firstUnfilled = zones.find(z => !z.filled);
      if (firstUnfilled) emphasizePrice = firstUnfilled.price;
    }

    // Draw each zone as a short two-point line segment
    for (const z of zones) {
      const color = z.type === "res" ? COLORS.res : COLORS.sup;
      const isMain = emphasizePrice != null && Math.abs(z.price - emphasizePrice) < 1e-9;

      const seg = chart.addLineSeries({
        color,
        lineWidth: isMain ? STYLE.mainWidth : STYLE.otherWidth,
        lineStyle: LineStyle.Solid,
        lastValueVisible: false,
        priceLineVisible: false,
      });

      seg.setData([
        { time: z.fromTime, value: z.price },
        { time: z.toTime,   value: z.price },
      ]);

      segmentsRef.current.push(seg);
    }
  }, [chart, candles, leftBars, rightBars, volPctGate, extendUntilFilled, hideFilled, lookbackBars, maxOnScreen]);

  return null;
}
