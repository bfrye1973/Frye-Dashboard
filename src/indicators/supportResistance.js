// Overlay S/R lines + simple "break" markers using pivot highs/lows.
// id: "sr"  => include "sr" in enabledIndicators.

import { LineStyle } from "lightweight-charts";

const ID = "sr";

function isCandle(x) {
  return x && typeof x.time !== "undefined" && Number.isFinite(x.high) && Number.isFinite(x.low) && Number.isFinite(x.close);
}
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
function pushLevel(arr, level, pctTol, keep = 10, favor = "res") {
  const tol = Math.abs(level) * (pctTol / 100);
  const near = arr.find((v) => Math.abs(v - level) <= tol);
  if (!near) arr.push(level);
  arr.sort((a, b) => a - b);
  while (arr.length > keep) {
    if (favor === "res") arr.shift(); else arr.pop();
  }
}

export const supportResistance = {
  id: ID,
  label: "Support/Resistance + Breaks",
  kind: "overlay",

  inputs: {
    pivotLeftRight: 5,
    minSeparationPct: 0.25,
    maxLevels: 10,
    lookbackBars: 800,
    markersLookback: 300,
  },

  compute(candles, inputs = {}) {
    const {
      pivotLeftRight = 5,
      minSeparationPct = 0.25,
      maxLevels = 10,
      lookbackBars = 800,
      markersLookback = 300,
    } = inputs;

    const L     = Math.max(1, Math.floor(pivotLeftRight));
    const sep   = Math.max(0.01, Number(minSeparationPct));
    const maxLv = Math.max(1, Math.floor(maxLevels));
    const scan  = Math.max(50, Math.floor(lookbackBars));
    const mBack = Math.max(50, Math.floor(markersLookback));

    if (!Array.isArray(candles) || candles.length === 0 || !isCandle(candles[0])) {
      return { levels: { res: [], sup: [] }, markers: [] };
    }

    const n = candles.length;
    const start = Math.max(0, n - scan);
    const res = [], sup = [];

    for (let i = start; i < n; i++) {
      const b = candles[i];
      if (!isCandle(b)) continue;
      if (pivotHigh(candles, i, L)) pushLevel(res, b.high, sep, maxLv, "res");
      if (pivotLow (candles, i, L)) pushLevel(sup, b.low,  sep, maxLv, "sup");
    }

    const recent = candles.slice(-mBack);
    const lastRes = res.length ? res[res.length - 1] : null;
    const lastSup = sup.length ? sup[0] : null;
    const markers = [];

    for (let i = 0; i < recent.length; i++) {
      const b = recent[i];
      if (!isCandle(b)) continue;
      const t = b.time;
      // valid shapes: 'arrowUp' | 'arrowDown' | 'circle' | 'square'
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
    const priceSeries = chartApi?._priceSeries;
    if (!priceSeries || !result || !result.levels) return () => {};

    const resHandles = [];
    const supHandles = [];

    try {
      (result.levels.res || []).forEach((level) => {
        if (!Number.isFinite(level)) return;
        const h = priceSeries.createPriceLine({
          price: level, color: "#ef4444", lineWidth: 2, lineStyle: LineStyle.Solid,
          axisLabelVisible: true, title: "R",
        });
        resHandles.push(h);
      });

      (result.levels.sup || []).forEach((level) => {
        if (!Number.isFinite(level)) return;
        const h = priceSeries.createPriceLine({
          price: level, color: "#3b82f6", lineWidth: 2, lineStyle: LineStyle.Solid,
          axisLabelVisible: true, title: "S",
        });
        supHandles.push(h);
      });

      if (Array.isArray(result.markers) && result.markers.length) {
        try { priceSeries.setMarkers(result.markers); } catch {}
      }

      seriesMap.set(ID, priceSeries);
    } catch (e) {
      console.error("[sr] attach failed:", e);
    }

    return () => {
      try { resHandles.forEach((h) => priceSeries.removePriceLine(h)); } catch {}
      try { supHandles.forEach((h) => priceSeries.removePriceLine(h)); } catch {}
      try { priceSeries.setMarkers([]); } catch {}
    };
  },
};
