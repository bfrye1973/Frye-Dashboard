// src/indicators/srLux/overlay.js
// Lux-style Support/Resistance with Breaks — TradingView look
// - Red resistance lines, Blue support lines
// - Latest active level emphasized (thick solid), older levels dashed
// - Break markers ("B", Bull/Bear Wick) with volume EMA(5/10) threshold

import { LineStyle } from "lightweight-charts";

// ---------- Appearance (TV-like) ----------
const COLORS = {
  res:   "#ef4444",                          // red
  sup:   "#3b82f6",                          // blue
  resDashed: "rgba(239,68,68,0.9)",
  supDashed: "rgba(59,130,246,0.9)",
  markerBull: "#10b981",
  markerBear: "#ef4444",
};
const STYLES = {
  mainWidth: 3,          // latest level (emphasized)
  otherWidth: 2,
  dashStyle: LineStyle.Dashed,
  mainStyle: LineStyle.Solid,
  maxRes: 8,             // cap number of resistance lines
  maxSup: 8,             // cap number of support lines
  minSeparationPct: 0.25 // minimum spacing between lines (as % of price)
};

export function createLuxSrOverlay({
  chart,
  leftBars = 15,
  rightBars = 15,
  volumeThresh = 20,      // osc > volumeThresh (EMA5 vs EMA10)
  pivotLeftRight = 5,     // secondary clustering
  minSeparationPct = STYLES.minSeparationPct,
  maxLevels = 10,         // pre-cluster cap before final TV styling
  lookbackBars = 800,
  markersLookback = 300,
}) {
  if (!chart) return { setBars: () => {}, remove: () => {} };

  // Host must be visible and have data for price lines / markers to render
  const host = chart.addLineSeries({
    priceLineVisible: false,
    visible: true,
    lastValueVisible: false,
    crosshairMarkerVisible: false,
    lineWidth: 1,
    color: "rgba(0,0,0,0)", // invisible line body
  });

  const resHandles = [];
  const supHandles = [];

  // ----------------- helpers -----------------
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

  // cluster: keep levels separated by pct tolerance, cap count, favor near current price
  function clusterLevels(levels, refPrice, pctTol, keep) {
    const tolAbs = (p) => Math.abs(p) * (pctTol / 100);
    const sorted = [...levels].sort((a, b) => Math.abs(a - refPrice) - Math.abs(b - refPrice));
    const kept = [];
    for (const lv of sorted) {
      const tooClose = kept.some((k) => Math.abs(k - lv) <= tolAbs(lv));
      if (!tooClose) kept.push(lv);
      if (kept.length >= keep) break;
    }
    // For display order: res high→low, sup low→high
    return kept;
  }

  function computeLuxSR(candles) {
    const n = candles.length;
    const start = Math.max(0, n - lookbackBars);

    // 1) Lux Pivots for base levels (left/right bars as given)
    const rawRes = [], rawSup = [];
    for (let i = start; i < n; i++) {
      if (pivotHigh(candles, i, leftBars, rightBars)) rawRes.push(candles[i].high);
      if (pivotLow (candles, i, leftBars, rightBars)) rawSup.push(candles[i].low);
    }

    // 2) Secondary clustering using pivotLeftRight spacing and minSeparationPct
    const L = Math.max(1, Math.floor(pivotLeftRight));
    const preRes = [], preSup = [];
    for (let i = start; i < n; i++) {
      if (pivotHigh(candles, i, L, L)) preRes.push(candles[i].high);
      if (pivotLow (candles, i, L, L)) preSup.push(candles[i].low);
    }

    // combine & cluster around last close
    const lastClose = candles[n - 1]?.close ?? 0;
    const res = clusterLevels(preRes.concat(rawRes), lastClose, Math.max(minSeparationPct, 0.05), Math.max(1, maxLevels));
    const sup = clusterLevels(preSup.concat(rawSup), lastClose, Math.max(minSeparationPct, 0.05), Math.max(1, maxLevels));

    // 3) choose latest/active levels for emphasis
    // latest resistance = nearest level ABOVE last close
    const resAbove = res.filter((p) => p >= lastClose).sort((a, b) => a - b);
    const latestRes = resAbove.length ? resAbove[0] : (res.length ? [...res].sort((a,b)=>b-a)[0] : null);

    // latest support = nearest level BELOW last close
    const supBelow = sup.filter((p) => p <= lastClose).sort((a, b) => b - a);
    const latestSup = supBelow.length ? supBelow[0] : (sup.length ? [...sup].sort((a,b)=>a-b)[0] : null);

    // 4) trim to TV-like counts for display
    const resForDraw = [...res].sort((a,b)=>b-a).slice(0, STYLES.maxRes);
    const supForDraw = [...sup].sort((a,b)=>a-b).slice(0, STYLES.maxSup);

    // 5) volume oscillator (EMA5 vs EMA10) for break markers
    const vols = candles.map(c => Number(c.volume ?? 0));
    const e5  = ema(vols, 5);
    const e10 = ema(vols, 10);
    const osc = e10.map((v, i) => {
      const base = e10[i] ?? 1;
      return base === 0 ? 0 : 100 * ((e5[i] - base) / base);
    });

    const markers = [];
    const recentIdx0 = Math.max(0, n - Math.max(50, markersLookback));
    for (let i = recentIdx0; i < n; i++) {
      const b = candles[i];
      const o = osc[i] ?? 0;
      const bullWick = (b.open - b.low) > (b.close - b.open);
      const bearWick = (b.high - b.open) > (b.open - b.close);

      if (latestSup != null) {
        if (b.close < latestSup && o > volumeThresh && !bearWick) {
          markers.push({ time: b.time, position: "aboveBar", color: COLORS.markerBear, shape: "arrowDown", text: "B" });
        } else if (b.close < latestSup && bearWick && o > volumeThresh) {
          markers.push({ time: b.time, position: "aboveBar", color: COLORS.markerBear, shape: "arrowDown", text: "Bear Wick" });
        }
      }
      if (latestRes != null) {
        if (b.close > latestRes && o > volumeThresh && !bullWick) {
          markers.push({ time: b.time, position: "belowBar", color: COLORS.markerBull, shape: "arrowUp", text: "B" });
        } else if (b.close > latestRes && bullWick && o > volumeThresh) {
          markers.push({ time: b.time, position: "belowBar", color: COLORS.markerBull, shape: "arrowUp", text: "Bull Wick" });
        }
      }
    }

    return { resForDraw, supForDraw, latestRes, latestSup, markers };
  }

  function clearAll() {
    try { resHandles.forEach(h => host.removePriceLine(h)); } catch {}
    try { supHandles.forEach(h => host.removePriceLine(h)); } catch {}
    resHandles.length = 0; supHandles.length = 0;
    try { host.setMarkers([]); } catch {}
  }

  function setBars(candles = []) {
    // host needs timeline data; use close values
    if (Array.isArray(candles) && candles.length) {
      const minimal = candles.map(c => ({ time: c.time, value: c.close }));
      try { host.setData(minimal); } catch {}
    }

    clearAll();

    const { resForDraw, supForDraw, latestRes, latestSup, markers } = computeLuxSR(candles);

    // draw RESISTANCE lines
    for (const level of resForDraw) {
      const isMain = latestRes != null && Math.abs(level - latestRes) < 1e-9;
      const h = host.createPriceLine({
        price: level,
        color: COLORS.res,
        lineWidth: isMain ? STYLES.mainWidth : STYLES.otherWidth,
        lineStyle: isMain ? STYLES.mainStyle : STYLES.dashStyle,
        axisLabelVisible: true,
        title: "R",
      });
      resHandles.push(h);
    }

    // draw SUPPORT lines
    for (const level of supForDraw) {
      const isMain = latestSup != null && Math.abs(level - latestSup) < 1e-9;
      const h = host.createPriceLine({
        price: level,
        color: COLORS.sup,
        lineWidth: isMain ? STYLES.mainWidth : STYLES.otherWidth,
        lineStyle: isMain ? STYLES.mainStyle : STYLES.dashStyle,
        axisLabelVisible: true,
        title: "S",
      });
      supHandles.push(h);
    }

    if (Array.isArray(markers) && markers.length) {
      try { host.setMarkers(markers); } catch {}
    }
  }

  function remove() {
    clearAll();
    try { chart.removeSeries(host); } catch {}
  }

  return { setBars, remove };
}
