// src/indicators/srLux/overlay.js
// Lux S/R (segments) — solid red resistance & blue support, short segments
// Latest active level thicker; “B” markers kept with EMA5/EMA10 volume filter

import { LineStyle } from "lightweight-charts";

const COLORS = {
  res: "#ef4444",  // red
  sup: "#3b82f6",  // blue
  bull: "#10b981",
  bear: "#ef4444",
};

const STYLE = {
  segmentBars: 220,     // length of each horizontal segment (bars)
  mainWidth: 3,         // latest level thickness
  otherWidth: 2,        // other levels thickness
  maxRes: 8,
  maxSup: 8,
  minSepPct: 0.25,      // min spacing between levels as % of price
};

export function createLuxSrOverlay({
  chart,
  leftBars = 15,
  rightBars = 15,
  volumeThresh = 20,
  pivotLeftRight = 5,
  minSeparationPct = STYLE.minSepPct,
  maxLevels = 10,
  lookbackBars = 800,
  markersLookback = 300,
  segmentBars = STYLE.segmentBars,
}) {
  if (!chart) return { setBars: () => {}, remove: () => {} };

  // Host for markers (needs data + visibility)
  const host = chart.addLineSeries({
    color: "rgba(0,0,0,0)",
    visible: true,
    lastValueVisible: false,
    crosshairMarkerVisible: false,
    priceLineVisible: false,
    lineWidth: 1,
  });

  // Horizontal segments = many tiny line series (2 points per level)
  let resSeries = [];
  let supSeries = [];

  const isCandle = (x) =>
    x && typeof x.time !== "undefined" &&
    Number.isFinite(x.open) && Number.isFinite(x.high) &&
    Number.isFinite(x.low) && Number.isFinite(x.close);

  function ema(arr, len) {
    if (!Array.isArray(arr) || arr.length === 0) return [];
    if (len <= 1) return [...arr];
    const out = new Array(arr.length);
    const k = 2 / (len + 1);
    let prev = arr[0];
    out[0] = prev;
    for (let i = 1; i < arr.length; i++) { prev = arr[i] * k + prev * (1 - k); out[i] = prev; }
    return out;
  }

  function pivotHigh(bars, i, L, R) {
    if (i < L || i + R >= bars.length) return false;
    const x = bars[i].high;
    for (let k = i - L; k <= i + R; k++) if (k !== i && bars[k].high >= x) return false;
    return true;
  }
  function pivotLow(bars, i, L, R) {
    if (i < L || i + R >= bars.length) return false;
    const x = bars[i].low;
    for (let k = i - L; k <= i + R; k++) if (k !== i && bars[k].low <= x) return false;
    return true;
  }

  function cluster(levels, ref, pctTol, keep) {
    const tolAbs = (p) => Math.abs(p) * (pctTol / 100);
    const sorted = [...levels].sort((a, b) => Math.abs(a - ref) - Math.abs(b - ref));
    const kept = [];
    for (const p of sorted) {
      if (!kept.some((k) => Math.abs(k - p) <= tolAbs(p))) kept.push(p);
      if (kept.length >= keep) break;
    }
    return kept;
  }

  function compute(candles) {
    const n = candles.length;
    const start = Math.max(0, n - lookbackBars);

    // Lux pivots
    const baseRes = [], baseSup = [];
    for (let i = start; i < n; i++) {
      if (pivotHigh(candles, i, leftBars, rightBars)) baseRes.push(candles[i].high);
      if (pivotLow (candles, i, leftBars, rightBars)) baseSup.push(candles[i].low);
    }
    // Secondary clustering
    const L = Math.max(1, Math.floor(pivotLeftRight));
    const moreRes = [], moreSup = [];
    for (let i = start; i < n; i++) {
      if (pivotHigh(candles, i, L, L)) moreRes.push(candles[i].high);
      if (pivotLow (candles, i, L, L)) moreSup.push(candles[i].low);
    }

    const lastClose = candles[n - 1]?.close ?? 0;
    const resAll = cluster(baseRes.concat(moreRes), lastClose, Math.max(minSeparationPct, 0.05), Math.max(1, maxLevels));
    const supAll = cluster(baseSup.concat(moreSup), lastClose, Math.max(minSeparationPct, 0.05), Math.max(1, maxLevels));

    const resForDraw = [...resAll].sort((a,b)=>b-a).slice(0, STYLE.maxRes);
    const supForDraw = [...supAll].sort((a,b)=>a-b).slice(0, STYLE.maxSup);

    // latest active levels (nearest above/below)
    const resAbove = resForDraw.filter(p => p >= lastClose).sort((a,b)=>a-b);
    const supBelow = supForDraw.filter(p => p <= lastClose).sort((a,b)=>b-a);
    const latestRes = resAbove[0] ?? resForDraw[0] ?? null;
    const latestSup = supBelow[0] ?? supForDraw[0] ?? null;

    // Volume osc for breaks
    const vols = candles.map(c => Number(c.volume ?? 0));
    const e5 = ema(vols, 5);
    const e10 = ema(vols, 10);
    const osc = e10.map((v, i) => {
      const base = e10[i] ?? 1;
      return base === 0 ? 0 : 100 * ((e5[i] - base) / base);
    });

    const markers = [];
    const m0 = Math.max(0, n - Math.max(50, markersLookback));
    for (let i = m0; i < n; i++) {
      const b = candles[i];
      const o = osc[i] ?? 0;
      const bullWick = (b.open - b.low) > (b.close - b.open);
      const bearWick = (b.high - b.open) > (b.open - b.close);
      if (latestSup != null && b.close < latestSup && o > volumeThresh) {
        markers.push({ time: b.time, position: "aboveBar", color: COLORS.bear, shape: "arrowDown", text: bullWick ? "Bear Wick" : "B" });
      }
      if (latestRes != null && b.close > latestRes && o > volumeThresh) {
        markers.push({ time: b.time, position: "belowBar", color: COLORS.bull, shape: "arrowUp", text: bearWick ? "Bull Wick" : "B" });
      }
    }

    return { resForDraw, supForDraw, latestRes, latestSup, markers };
  }

  function clearSegments() {
    try { resSeries.forEach(s => chart.removeSeries(s)); } catch {}
    try { supSeries.forEach(s => chart.removeSeries(s)); } catch {}
    resSeries = []; supSeries = [];
  }

  function setBars(candles = []) {
    if (Array.isArray(candles) && candles.length) {
      // host timeline (for markers)
      try { host.setData(candles.map(c => ({ time: c.time, value: c.close }))); } catch {}
    }

    clearSegments();
    try { host.setMarkers([]); } catch {}

    const n = candles.length;
    if (!n) return;

    const { resForDraw, supForDraw, latestRes, latestSup, markers } = compute(candles);

    // Draw short horizontal segments using mini line series (two points per level)
    const tEnd = candles[n - 1].time;
    const tStart = candles[Math.max(0, n - segmentBars)].time;

    const makeSeg = (price, color, isMain) => {
      const s = chart.addLineSeries({
        color,
        lineWidth: isMain ? STYLE.mainWidth : STYLE.otherWidth,
        lineStyle: LineStyle.Solid,
        lastValueVisible: false,
        priceLineVisible: false,
      });
      s.setData([
        { time: tStart, value: price },
        { time: tEnd,   value: price },
      ]);
      return s;
    };

    // Resistance (red)
    for (const p of resForDraw) {
      const main = latestRes != null && Math.abs(p - latestRes) < 1e-9;
      resSeries.push(makeSeg(p, COLORS.res, main));
    }
    // Support (blue)
    for (const p of supForDraw) {
      const main = latestSup != null && Math.abs(p - latestSup) < 1e-9;
      supSeries.push(makeSeg(p, COLORS.sup, main));
    }

    if (markers.length) {
      try { host.setMarkers(markers); } catch {}
    }
  }

  function remove() {
    clearSegments();
    try { host.setMarkers([]); } catch {}
    try { chart.removeSeries(host); } catch {}
  }

  return { setBars, remove };
}
