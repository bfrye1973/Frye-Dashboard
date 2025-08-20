// src/indicators/sr/index.js
// Support / Resistance (single-file)
// - Pivot highs/lows -> SR lines
// - Break markers with volume confirmation
// - Overlay canvas sits above chart (z-index)

import { INDICATOR_KIND } from "../shared/indicatorTypes";

const SR_DEFAULTS = {
  leftBars: 15,
  rightBars: 15,
  supColor: "#233dee",
  resColor: "#ff0000",
  lineWidth: 3,
  band: 0,
  volumeThresh: 20, // osc = 100*(ema5-ema10)/ema10 must exceed this
};

function ema(arr, len) {
  const out = new Array(arr.length).fill(null);
  if (!arr.length || len < 1) return out;
  const k = 2 / (len + 1);
  let s = 0, n = 0;
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i] ?? 0;
    if (n < len) {
      s += v; n++;
      if (n === len) out[i] = s / len;
    } else {
      const prev = out[i - 1] ?? v;
      out[i] = v * k + prev * (1 - k);
    }
  }
  return out;
}

function isPivotHigh(c, i, L, R) {
  const hi = c[i].high;
  for (let k = i - L; k <= i + R; k++) {
    if (k < 0 || k >= c.length) return false;
    if (c[k].high > hi) return false;
  }
  return true;
}
function isPivotLow(c, i, L, R) {
  const lo = c[i].low;
  for (let k = i - L; k <= i + R; k++) {
    if (k < 0 || k >= c.length) return false;
    if (c[k].low < lo) return false;
  }
  return true;
}

function srCompute(candles, inputs) {
  const opts = { ...SR_DEFAULTS, ...(inputs || {}) };
  const { leftBars, rightBars, volumeThresh } = opts;
  const n = candles?.length ?? 0;
  if (!n) return { levels: [], markers: [] };

  // Find pivot highs/lows; activate level at pivotIndex + rightBars
  const pend = [];
  for (let i = leftBars; i < n - rightBars; i++) {
    if (isPivotHigh(candles, i, leftBars, rightBars)) pend.push({ type: "res", price: candles[i].high, actIdx: i + rightBars });
    if (isPivotLow(candles, i, leftBars, rightBars))  pend.push({ type: "sup", price: candles[i].low,  actIdx: i + rightBars });
  }

  const levels = [];
  for (const p of pend) {
    if (p.actIdx >= 0 && p.actIdx < n) {
      levels.push({ type: p.type, price: p.price, from: candles[p.actIdx].time, to: candles[n - 1].time });
    }
  }

  // Volume oscillator
  const vol = candles.map(c => c.volume ?? 0);
  const e5 = ema(vol, 5);
  const e10 = ema(vol, 10);
  const osc = e10.map((v, i) => (v ? 100 * ((e5[i] ?? 0) - v) / v : 0));

  // Build quick lookup of current SR at each bar (extend the last seen)
  let curSup = null, curRes = null;
  const atIdx = new Array(n).fill(null).map(() => ({ sup: null, res: null }));
  for (let i = 0; i < n; i++) {
    // if any level activates exactly at this time, update current
    const t = candles[i].time;
    for (const L of levels) {
      if (L.from === t) {
        if (L.type === "sup") curSup = L.price;
        else curRes = L.price;
      }
    }
    atIdx[i].sup = curSup;
    atIdx[i].res = curRes;
  }

  // Break markers with volume confirm
  const markers = [];
  for (let i = 1; i < n; i++) {
    const prev = candles[i - 1];
    const cur = candles[i];
    const sup = atIdx[i].sup;
    const res = atIdx[i].res;
    const vOsc = osc[i] ?? 0;

    // Cross over resistance (close crosses up), volume > thresh
    if (res != null && prev.close <= res && cur.close > res && vOsc > volumeThresh) {
      markers.push({
        time: cur.time,
        position: "belowBar",
        shape: "arrowUp",
        color: "#16a34a",
        text: "B",
        size: 0,
      });
    }

    // Cross under support (close crosses down), volume > thresh
    if (sup != null && prev.close >= sup && cur.close < sup && vOsc > volumeThresh) {
      markers.push({
        time: cur.time,
        position: "aboveBar",
        shape: "arrowDown",
        color: "#dc2626",
        text: "B",
        size: 0,
      });
    }
  }

  return { levels, markers, opts };
}

function srAttach(chartApi, seriesMap, result, inputs) {
  const opts = { ...SR_DEFAULTS, ...(inputs || {}) };
  const container = chartApi?._container;
  const priceSeries = chartApi?._priceSeries;
  if (!container || !priceSeries) return () => {};

  // Ensure overlays stack above chart
  if (!container.style.position) container.style.position = "relative";

  // Canvas overlay for lines/bands
  const canvas = document.createElement("canvas");
  canvas.style.position = "absolute";
  canvas.style.left = "0";
  canvas.style.top = "0";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.pointerEvents = "none";
  canvas.style.zIndex = "9";
  container.appendChild(canvas);
  const ctx = canvas.getContext("2d");

  const xOf = (t) => chartApi.timeScale().timeToCoordinate(t);
  const yOf = (p) => priceSeries.priceToCoordinate(p);

  // rAF coalescing
  let raf = 0;
  function scheduleDraw() {
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = 0; draw(); });
  }

  function resize() {
    const DPR = Math.min(window.devicePixelRatio || 1, 1.5); // cap for perf
    const w = container.clientWidth, h = container.clientHeight;
    const need = canvas.width !== Math.floor(w * DPR) || canvas.height !== Math.floor(h * DPR);
    if (need) {
      canvas.width = Math.floor(w * DPR);
      canvas.height = Math.floor(h * DPR);
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
  }

  function draw() {
    resize();
    const w = canvas.clientWidth, h = canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);

    // Tag for visibility
    ctx.fillStyle = "rgba(147,163,184,0.85)";
    ctx.font = "12px system-ui,-apple-system,Segoe UI,Roboto,Arial";
    ctx.fillText("SR v1", 10, 16);

    const levels = result?.levels || [];
    for (const L of levels) {
      const x1 = xOf(L.from), x2 = xOf(L.to), y = yOf(L.price);
      if (x1 == null || x2 == null || y == null) continue;

      ctx.strokeStyle = (L.type === "res") ? opts.resColor : opts.supColor;
      ctx.lineWidth = opts.lineWidth;
      ctx.beginPath();
      ctx.moveTo(x1, y);
      ctx.lineTo(x2, y);
      ctx.stroke();

      if (opts.band > 0) {
        const y2 = yOf(L.type === "res" ? L.price + opts.band : L.price - opts.band);
        if (y2 != null) {
          ctx.globalAlpha = 0.15;
          ctx.fillStyle = (L.type === "res") ? opts.resColor : opts.supColor;
          const yy = Math.min(y, y2), hh = Math.abs(y - y2);
          ctx.fillRect(Math.min(x1, x2), yy, Math.abs(x2 - x1), Math.max(1, hh));
          ctx.globalAlpha = 1;
        }
      }
    }
  }

  // Attach markers to the price series
  if (Array.isArray(result?.markers)) {
    try { priceSeries.setMarkers(result.markers); } catch {}
  }

  const ro = new ResizeObserver(scheduleDraw);
  ro.observe(container);
  const ts = chartApi.timeScale();
  const unsub1 = ts.subscribeVisibleTimeRangeChange(scheduleDraw);
  const unsub2 = ts.subscribeVisibleLogicalRangeChange?.(scheduleDraw) || (() => {});
  const unsub3 = priceSeries.priceScale().subscribeSizeChange?.(scheduleDraw) || (() => {});
  scheduleDraw();

  const cleanup = () => {
    try { ro.disconnect(); } catch {}
    try { unsub1 && ts.unsubscribeVisibleTimeRangeChange(scheduleDraw); } catch {}
    try { unsub2 && ts.unsubscribeVisibleLogicalRangeChange?.(scheduleDraw); } catch {}
    try { unsub3 && priceSeries.priceScale().unsubscribeSizeChange?.(scheduleDraw); } catch {}
    try { container.removeChild(canvas); } catch {}
    try { priceSeries.setMarkers([]); } catch {}
  };
  seriesMap.set("sr_canvas_cleanup", cleanup);
  return cleanup;
}

const SR = {
  id: "sr",
  label: "Support / Resistance",
  kind: INDICATOR_KIND.OVERLAY,
  defaults: SR_DEFAULTS,
  compute: srCompute,
  attach: srAttach,
};

export default SR;
