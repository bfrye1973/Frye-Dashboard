// src/indicators/supportResistance.js
import { LineStyle } from "lightweight-charts";

const ID = "sr";  // enable with "sr" in enabledIndicators

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
function pushLevel(arr, level, pctTol, kind, maxLevels) {
  const tol = level * (pctTol / 100);
  const hit = arr.find((v) => Math.abs(v - level) <= tol);
  if (!hit) arr.push(level);
  arr.sort((a,b)=> a-b);
  if (arr.length > maxLevels) {
    if (kind === "res") arr.shift(); else arr.pop();
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
      pivotLeftRight: L = 5,
      minSeparationPct = 0.25,
      maxLevels = 10,
      lookbackBars = 800,
      markersLookback = 300,
    } = inputs;

    const n = candles.length;
    if (!n) return { levels: { res: [], sup: [] }, markers: [] };

    const start = Math.max(0, n - lookbackBars);
    const res = [], sup = [];

    for (let i = start; i < n; i++) {
      if (pivotHigh(candles, i, L)) pushLevel(res, candles[i].high, minSeparationPct, "res", maxLevels);
      if (pivotLow (candles, i, L)) pushLevel(sup, candles[i].low,  minSeparationPct, "sup", maxLevels);
    }

    const recent = candles.slice(-markersLookback);
    const lastRes = res[res.length - 1];
    const lastSup = sup[0];
    const markers = [];

    for (let i = 0; i < recent.length; i++) {
      const b = recent[i];
      const t = b.time; // seconds expected
      if (lastRes != null && b.close > lastRes) {
        markers.push({ time: t, position: "aboveBar", color: "#ef4444", shape: "triangleUp", text: "B" });
      }
      if (lastSup != null && b.close < lastSup) {
        markers.push({ time: t, position: "belowBar", color: "#3b82f6", shape: "triangleDown", text: "B" });
      }
    }

    return { levels: { res, sup }, markers };
  },

  attach(chartApi, seriesMap, result) {
    const priceSeries = chartApi._priceSeries;
    if (!priceSeries) return () => {};

    const resHandles = [];
    const supHandles = [];

    result.levels.res.forEach((level) => {
      const h = priceSeries.createPriceLine({
        price: level, color: "#ef4444", lineWidth: 2,
        lineStyle: LineStyle.Solid, axisLabelVisible: true, title: "R",
      });
      resHandles.push(h);
    });
    result.levels.sup.forEach((level) => {
      const h = priceSeries.createPriceLine({
        price: level, color: "#3b82f6", lineWidth: 2,
        lineStyle: LineStyle.Solid, axisLabelVisible: true, title: "S",
      });
      supHandles.push(h);
    });

    try { priceSeries.setMarkers(result.markers); } catch {}

    // expose handle under key "sr" (optional, for discovery)
    seriesMap.set(ID, priceSeries);

    return () => {
      try {
        resHandles.forEach(h => priceSeries.removePriceLine(h));
        supHandles.forEach(h => priceSeries.removePriceLine(h));
      } catch {}
    };
  },
};
