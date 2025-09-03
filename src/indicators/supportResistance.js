// src/indicators/supportResistance.js
// Overlay S/R lines + simple "break" markers (B) using pivot highs/lows.
// id: "sr"  -> include "sr" in enabledIndicators to turn on.
//
// Expected candle shape: { time, open, high, low, close } (time in seconds)

import { LineStyle } from "lightweight-charts";

const ID = "sr"; // registry key

/* ----------------------------- helpers ----------------------------- */

function isCandle(x) {
  return (
    x &&
    typeof x.time !== "undefined" &&
    Number.isFinite(x.high) &&
    Number.isFinite(x.low) &&
    Number.isFinite(x.close)
  );
}

// pivot high/low at index i using L bars on both sides
function pivotHigh(bars, i, L) {
  if (i < L || i + L >= bars.length) return false;
  const x = bars[i].high;
  for (let k = i - L; k <= i + L; k++) if (k !== i && bars[k].high >= x) return false;
  return true;
}
function pivotLow(bars, i, L) {
  if (i < L || i + L >= bars.length) return false;
  const x = bars[i].low;
  for (let k = i - L; k <= i + L; k++) if (k !== i && bars[k].low <= x) return false;
  return true;
}

// push a level if no existing within pct tolerance; keep array sorted & bounded
function pushLevel(arr, level, pctTol, keep = 10, favor = "res") {
  const tol = Math.abs(level) * (pctTol / 100);
  const near = arr.find((v) => Math.abs(v - level) <= tol);
  if (!near) arr.push(level);
  arr.sort((a, b) => a - b);
  // bound list length (favor keeping newer extremes)
  while (arr.length > keep) {
    if (favor === "res") arr.shift();  // drop smallest first for resistance
    else arr.pop();                    // drop largest first for support
  }
}

/* --------------------------- indicator def -------------------------- */

export const supportResistance = {
  id: ID,
  label: "Support/Resistance + Breaks",
  kind: "overlay", // draw on price pane

  inputs: {
    pivotLeftRight: 5,       // pivot radius (L)
    minSeparationPct: 0.25,  // dedupe tolerance
    maxLevels: 10,           // max lines for each of res/sup
    lookbackBars: 800,       // pivot scan window
    markersLookback: 300     // how many recent bars to scan for breaks
  },

  compute(candles, inputs = {}) {
    const {
      pivotLeftRight = 5,
      minSeparationPct = 0.25,
      maxLevels = 10,
      lookbackBars = 800,
      markersLookback = 300,
    } = inputs;

    const L = Math.max(1, Math.floor(pivotLeftRight));
    const sep = Math.max(0.01, Number(minSeparationPct));
    const maxLv = Math.max(1, Math.floor(maxLevels));
    const scan = Math.max(50, Math.floor(lookbackBars));
    const mBack = Math.max(50, Math.floor(markersLookback));

    if (!Array.isArray(candles) || candles.length === 0 || !isCandle(candles[0])) {
      return { levels: { res: [], sup: [] }, markers: [] };
    }

    const n = candles.length;
    const start = Math.max(0, n - scan);

    const res = [];
    const sup = [];

    // build levels from pivots
    for (let i = start; i < n; i++) {
      const b = candles[i];
      if (!isCandle(b)) continue;
      if (pivotHigh(candles, i, L)) pushLevel(res, b.high, sep, maxLv, "res");
      if (pivotLow (candles, i, L)) pushLevel(sup, b.low,  sep, maxLv, "sup");
    }

    // break markers on the most recent sup/res (simple example)
    const recent = candles.slice(-mBack);
    const lastRes = res.length ? res[res.length - 1] : null; // highest retained
    const lastSup = sup.length ? sup[0] : null;              // lowest retained
    const markers = [];

    for (let i = 0; i < recent.length; i++) {
      const b = recent[i];
      if (!isCandle(b)) continue;
      const t = b.time; // unix seconds
      // valid shapes for lightweight-charts: 'arrowUp' | 'arrowDown' | 'circle' | 'square'
      if (lastRes != null && b.close > lastRes) {
        markers.push({ time: t, position: "aboveBar", color: "#ef4444", shape: "arrowUp", text: "B" });
      }
      if (lastSup != null && b.close < lastSup) {
        markers.push({ time: t, position: "belowBar", color: "#3b82f6", shape: "arrowDown", text: "B" });
      }
    }

    return { levels: { res, sup }, markers };
  },

  attach(chartApi, seriesMap, result) {
    // We only draw if the price pane exposed its series
    const priceSeries = chartApi?._priceSeries;
    if (!priceSeries || !result || !result.levels) {
      return () => {};
    }

    const resHandles = [];
    const supHandles = [];

    try {
      // draw resistance lines
      (result.levels.res || []).forEach((level) => {
        if (!Number.isFinite(level)) return;
        const h = priceSeries.createPriceLine({
          price: level,
          color: "#ef4444",
          lineWidth: 2,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: true,
          title: "R",
        });
        resHandles.push(h);
      });

      // draw support lines
      (result.levels.sup || []).forEach((level) => {
        if (!Number.isFinite(level)) return;
        const h = priceSeries.createPriceLine({
          price: level,
          color: "#3b82f6",
          lineWidth: 2,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: true,
          title: "S",
        });
        supHandles.push(h);
      });

      // markers (guard against invalid payload)
      if (Array.isArray(result.markers) && result.markers.length) {
        try { priceSeries.setMarkers(result.markers); } catch {}
      }

      // expose handle under key "sr" for discovery/legend
      seriesMap.set(ID, priceSeries);
    } catch (e) {
      console.error("[sr] attach failed:", e);
    }

    // cleanup removes every line created
    return () => {
      try {
        resHandles.forEach((h) => priceSeries.removePriceLine(h));
        supHandles.forEach((h) => priceSeries.removePriceLine(h));
      } catch {}
      try { priceSeries.setMarkers([]); } catch {}
    };
  },
};
