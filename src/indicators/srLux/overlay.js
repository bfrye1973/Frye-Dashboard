// src/indicators/srLux/overlay.js
// Lux-style Support/Resistance with Breaks (pivot bands + volume EMA filter)
// - Draws price lines for S/R levels
// - Adds "B" break markers (up/down) when level breaks with volume confirmation
// - Uses an internal (hidden) line series to host price lines & markers

import { LineStyle } from "lightweight-charts";

export function createLuxSrOverlay({
  chart,
  // defaults mirror your Pine inputs
  leftBars = 15,
  rightBars = 15,
  volumeThresh = 20,      // osc > volumeThresh
  pivotLeftRight = 5,     // for line-level clustering (see below)
  minSeparationPct = 0.25,
  maxLevels = 10,
  lookbackBars = 800,
  markersLookback = 300,
}) {
  if (!chart) return { setBars: () => {}, remove: () => {} };

  // We host price lines & markers on a hidden line series that shares the main scale
  const host = chart.addLineSeries({
    priceLineVisible: false,
    visible: false,
    lastValueVisible: false,
    crosshairMarkerVisible: false,
  });

  const resHandles = [];
  const supHandles = [];

  function isCandle(x) {
    return x && typeof x.time !== "undefined"
      && Number.isFinite(x.high) && Number.isFinite(x.low)
      && Number.isFinite(x.close) && Number.isFinite(x.open);
  }

  // ---- helpers (EMA, pivots, clustering like the Pine script intent) ----
  function ema(arr, len) {
    const out = [];
    if (arr.length === 0 || len <= 1) return out;
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

    // 1) base S/R from leftBars/rightBars (Lux Pivots)
    const r1 = [];
    const s1 = [];
    for (let i = scanStart; i < n; i++) {
      if (pivotHigh(candles, i, leftBars, rightBars)) r1.push(candles[i].high);
      if (pivotLow (candles, i, leftBars, rightBars)) s1.push(candles[i].low);
    }

    // 2) cluster to fewer “levels” (pushLevel like your other SR)
    const res = [], sup = [];
    const L = Math.max(1, Math.floor(pivotLeftRight));
    const sep = Math.max(0.01, Number(minSeparationPct));
    const maxLv = Math.max(1, Math.floor(maxLevels));
    for (let i = scanStart; i < n; i++) {
      if (pivotHigh(candles, i, L, L)) pushLevel(res, candles[i].high, sep, maxLv, "res");
      if (pivotLow (candles, i, L, L)) pushLevel(sup, candles[i].low,  sep, maxLv, "sup");
    }

    // 3) volume oscillator (EMA5 vs EMA10 on volume)
    const vols = candles.map(c => Number(c.volume ?? 0));
    const e5  = ema(vols, 5);
    const e10 = ema(vols, 10);
    const osc = e10.map((v, i) => {
      const d = e5[i] - (e10[i] ?? 0);
      const base = (e10[i] ?? 1);
      return base === 0 ? 0 : 100 * (d / base);
    });

    // 4) break markers (last markersLookback bars)
    const recent = candles.slice(-Math.max(50, markersLookback));
    const markers = [];
    // The most recent “active” levels we compare breaks against
    const lastRes = res.length ? res[res.length - 1] : null;
    const lastSup = sup.length ? sup[0] : null;

    for (let i = n - recent.length; i < n; i++) {
      const b = candles[i];
      const o = osc[i] ?? 0;
      // Bull/Bear wick conditions (approx)
      const bullWick = (b.open - b.low) > (b.close - b.open);
      const bearWick = (b.high - b.open) > (b.open - b.close);

      if (lastSup != null) {
        // crossunder(close, lowUsePivot) with osc > threshold
        if (b.close < lastSup && o > volumeThresh && !bearWick) {
          markers.push({ time: b.time, position: "aboveBar", color: "#ef4444", shape: "arrowDown", text: "B" });
        }
        if (b.close < lastSup && bearWick && o > volumeThresh) {
          markers.push({ time: b.time, position: "aboveBar", color: "#ef4444", shape: "arrowDown", text: "Bear Wick" });
        }
      }
      if (lastRes != null) {
        // crossover(close, highUsePivot) with osc > threshold
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
    clearLines();

    const result = computeLuxSR(candles);
    // draw price lines
    (result.levels.res || []).forEach((level) => {
      if (!Number.isFinite(level)) return;
      const h = host.createPriceLine({
        price: level,
        color: "#ef4444",
        lineWidth: 2,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: "R",
      });
      resHandles.push(h);
    });

    (result.levels.sup || []).forEach((level) => {
      if (!Number.isFinite(level)) return;
      const h = host.createPriceLine({
        price: level,
        color: "#3b82f6",
        lineWidth: 2,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: "S",
      });
      supHandles.push(h);
    });

    // markers (B / Bull Wick / Bear Wick)
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
