// src/indicators/srLux/overlay.js
// Lux-style Support/Resistance with Breaks (pivot bands + volume EMA filter)

import { LineStyle } from "lightweight-charts";

export function createLuxSrOverlay({
  chart,
  leftBars = 15,
  rightBars = 15,
  volumeThresh = 20,
  pivotLeftRight = 5,
  minSeparationPct = 0.25,
  maxLevels = 10,
  lookbackBars = 800,
  markersLookback = 300,
}) {
  if (!chart) return { setBars: () => {}, remove: () => {} };

  // IMPORTANT: series must be visible and have data for price lines / markers to show
  const host = chart.addLineSeries({
    priceLineVisible: false,
    visible: true,                 // <- was false; must be true
    lastValueVisible: false,
    crosshairMarkerVisible: false,
    lineWidth: 1,
    color: "rgba(0,0,0,0)",        // effectively invisible line
  });

  const resHandles = [];
  const supHandles = [];

  function isCandle(x) {
    return x && typeof x.time !== "undefined"
      && Number.isFinite(x.high) && Number.isFinite(x.low)
      && Number.isFinite(x.close) && Number.isFinite(x.open);
  }

  function ema(arr, len) {
    if (!Array.isArray(arr) || arr.length === 0) return [];
    if (len <= 1) return [...arr];
    const out = new Array(arr.length);
    const k = 2 / (len + 1);
    let prev = arr[0];
    out[0] = prev;
    for (let i = 1; i < arr.length; i++) {
      prev = arr[i] * k + prev * (1 - k);
      out[i] = prev;
    }
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

  function pushLevel(arr, level, pctTol, keep = 10, favor = "res") {
    const tol = Math.abs(level) * (pctTol / 100);
    const near = arr.find((v) => Math.abs(v - level) <= tol);
    if (!near) arr.push(level);
    arr.sort((a, b) => a - b);
    while (arr.length > keep) {
      if (favor === "res") arr.shift(); else arr.pop();
    }
  }

  function computeLuxSR(candles) {
    if (!Array.isArray(candles) || candles.length === 0 || !isCandle(candles[0])) {
      return { levels: { res: [], sup: [] }, markers: [] };
    }

    const n = candles.length;
    const scanStart = Math.max(0, n - lookbackBars);

    // 1) Lux pivots
    const r1 = [];
    const s1 = [];
    for (let i = scanStart; i < n; i++) {
      if (pivotHigh(candles, i, leftBars, rightBars)) r1.push(candles[i].high);
      if (pivotLow (candles, i, leftBars, rightBars)) s1.push(candles[i].low);
    }

    // 2) cluster to fewer levels
    const res = [], sup = [];
    const L = Math.max(1, Math.floor(pivotLeftRight));
    const sep = Math.max(0.01, Number(minSeparationPct));
    const maxLv = Math.max(1, Math.floor(maxLevels));
    for (let i = scanStart; i < n; i++) {
      if (pivotHigh(candles, i, L, L)) pushLevel(res, candles[i].high, sep, maxLv, "res");
      if (pivotLow (candles, i, L, L)) pushLevel(sup, candles[i].low,  sep, maxLv, "sup");
    }

    // 3) volume osc (EMA 5 vs 10)
    const vols = candles.map(c => Number(c.volume ?? 0));
    const e5  = ema(vols, 5);
    const e10 = ema(vols, 10);
    const osc = e10.map((v, i) => {
      const base = e10[i] ?? 1;
      return base === 0 ? 0 : 100 * ((e5[i] - base) / base);
    });

    // 4) break markers on recent window
    const recent = candles.slice(-Math.max(50, markersLookback));
    const markers = [];
    const lastRes = res.length ? res[res.length - 1] : null;
    const lastSup = sup.length ? sup[0] : null;

    for (let i = n - recent.length; i < n; i++) {
      const b = candles[i];
      const o = osc[i] ?? 0;

      const bullWick = (b.open - b.low) > (b.close - b.open);
      const bearWick = (b.high - b.open) > (b.open - b.close);

      if (lastSup != null) {
        if (b.close < lastSup && o > volumeThresh && !bearWick) {
          markers.push({ time: b.time, position: "aboveBar", color: "#ef4444", shape: "arrowDown", text: "B" });
        }
        if (b.close < lastSup && bearWick && o > volumeThresh) {
          markers.push({ time: b.time, position: "aboveBar", color: "#ef4444", shape: "arrowDown", text: "Bear Wick" });
        }
      }
      if (lastRes != null) {
        if (b.close > lastRes && o > volumeThresh && !bullWick) {
          markers.push({ time: b.time, position: "belowBar", color: "#10b981", shape: "arrowUp", text: "B" });
        }
        if (b.close > lastRes && bullWick && o > volumeThresh) {
          markers.push({ time: b.time, position: "belowBar", color: "#10b981", shape: "arrowUp", text: "Bull Wick" });
        }
      }
    }

    return { levels: { res, sup }, markers };
  }

  function clearLines() {
    try { resHandles.forEach(h => host.removePriceLine(h)); } catch {}
    try { supHandles.forEach(h => host.removePriceLine(h)); } catch {}
    resHandles.length = 0; supHandles.length = 0;
    try { host.setMarkers([]); } catch {}
  }

  function setBars(candles = []) {
    // feed host series minimal data so lines/markers have a timeline
    if (Array.isArray(candles) && candles.length) {
      const minimal = candles.map(c => ({ time: c.time, value: c.close }));
      try { host.setData(minimal); } catch {}
    }

    clearLines();

    const result = computeLuxSR(candles);

    // draw price lines
    (result.levels.res || []).forEach((level) => {
      if (!Number.isFinite(level)) return;
      const h = host.createPriceLine({
        price: level, color: "#ef4444", lineWidth: 2, lineStyle: LineStyle.Solid,
        axisLabelVisible: true, title: "R",
      });
      resHandles.push(h);
    });

    (result.levels.sup || []).forEach((level) => {
      if (!Number.isFinite(level)) return;
      const h = host.createPriceLine({
        price: level, color: "#3b82f6", lineWidth: 2, lineStyle: LineStyle.Solid,
        axisLabelVisible: true, title: "S",
      });
      supHandles.push(h);
    });

    // markers
    if (Array.isArray(result.markers) && result.markers.length) {
      try { host.setMarkers(result.markers); } catch {}
    }
  }

  function remove() {
    clearLines();
    try { chart.removeSeries(host); } catch {}
  }

  return { setBars, remove };
}
