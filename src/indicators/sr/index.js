// src/indicators/sr/index.js
// Support / Resistance as HORIZONTAL BLOCKS (no lines)
// - Pivot highs/lows (left/right bars) -> zones
// - Extend forward (until fill or fixed)
// - Blocks drawn ABOVE chart (z-index)
// - Version tag: "SR BLOCKS v1"

import { INDICATOR_KIND } from "../shared/indicatorTypes";

// ---------- defaults ----------
const DEF = {
  leftBars: 15,
  rightBars: 15,
  extendUntilFill: true,     // keep extending until price touches the level
  hideFilled: false,         // remove zones once touched
  // block appearance
  resColor: "rgba(170,36,48,0.35)",  // resistance block fill (red-ish)
  supColor: "rgba(102,187,106,0.35)",// support block fill (green-ish)
  resStroke: "#aa2430",
  supStroke: "#66bb6a",
  strokeWidth: 1,
  blockHeightPct: 0.002,     // vertical thickness relative to price (e.g. 0.2% of price)
  // labels
  showLabelsInBlock: true,
  labelColor: "rgba(230,236,245,0.9)",
  font: "12px system-ui,-apple-system,Segoe UI,Roboto,Arial",
};

// ---------- helpers ----------
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

// ---------- compute pivots -> blocks ----------
function srCompute(candles, inputs) {
  const o = { ...DEF, ...(inputs || {}) };
  const L = o.leftBars, R = o.rightBars;
  const n = candles?.length ?? 0;
  if (!n) return { zones: [], opts: o };

  // Find swings; activate zone at pivotIndex + rightBars
  const zones = []; // {type:'res'|'sup', price, fromIdx, toIdx, filled}
  for (let i = L; i < n - R; i++) {
    if (isPivotHigh(candles, i, L, R)) {
      const act = i + R;
      if (act < n) zones.push({ type: "res", price: candles[i].high, fromIdx: act, toIdx: act, filled: false });
    }
    if (isPivotLow(candles, i, L, R)) {
      const act = i + R;
      if (act < n) zones.push({ type: "sup", price: candles[i].low,  fromIdx: act, toIdx: act, filled: false });
    }
  }

  // Extend zones forward; mark filled when candle crosses price
  for (const Z of zones) {
    for (let i = Z.fromIdx; i < n; i++) {
      const c = candles[i];
      const crossed = c.high >= Z.price && c.low <= Z.price;
      Z.toIdx = i;
      if (crossed) {
        Z.filled = true;
        if (!o.extendUntilFill) { Z.toIdx = Math.min(i + 4, n - 1); break; }
        if (o.hideFilled) break;
      }
    }
  }

  // Hide filled if requested
  const filtered = o.hideFilled ? zones.filter(z => !z.filled) : zones;

  // Turn idx -> time; precompute thickness in price space
  const res = filtered.map(z => ({
    ...z,
    fromTime: candles[z.fromIdx].time,
    toTime:   candles[z.toIdx].time,
  }));

  return { zones: res, opts: o };
}

// ---------- overlay: draw blocks only (no lines) ----------
function srAttach(chartApi, seriesMap, result, inputs) {
  const o = { ...DEF, ...(inputs || {}) };
  const container = chartApi?._container;
  const priceSeries = chartApi?._priceSeries;
  const candles = chartApi?._candles || [];
  if (!container || !priceSeries || !candles.length) return () => {};

  if (!container.style.position) container.style.position = "relative";

  const canvas = document.createElement("canvas");
  canvas.style.position = "absolute";
  canvas.style.left = "0";
  canvas.style.top = "0";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.pointerEvents = "none";
  canvas.style.zIndex = "9";           // draw above chart
  container.appendChild(canvas);
  const ctx = canvas.getContext("2d");

  const ts = chartApi.timeScale();
  const xOf = (t) => ts.timeToCoordinate(t);
  const yOf = (p) => priceSeries.priceToCoordinate(p);

  // rAF + DPR cap
  let raf = 0;
  function scheduleDraw() { if (!raf) raf = requestAnimationFrame(() => { raf = 0; draw(); }); }
  function resize() {
    const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
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

    // version tag
    ctx.fillStyle = "rgba(147,163,184,0.85)";
    ctx.font = o.font;
    ctx.fillText("SR BLOCKS v1", 10, 16);

    const zones = result?.zones || [];
    if (!zones.length) return;

    for (const Z of zones) {
      const x1 = xOf(Z.fromTime), x2 = xOf(Z.toTime), y = yOf(Z.price);
      if (x1 == null || x2 == null || y == null) continue;

      // vertical thickness in price space
      const half = Math.max(1e-6, Z.price * o.blockHeightPct);
      const yTop = yOf(Z.type === "res" ? (Z.price + half) : (Z.price - half));
      const yBot = yOf(Z.type === "res" ? (Z.price - half) : (Z.price + half));
      if (yTop == null || yBot == null) continue;

      // fill
      ctx.fillStyle = (Z.type === "res") ? o.resColor : o.supColor;
      const yy = Math.min(yTop, yBot);
      const hh = Math.max(1, Math.abs(yTop - yBot));
      const xx = Math.min(x1, x2);
      const ww = Math.max(1, Math.abs(x2 - x1));
      ctx.fillRect(xx, yy, ww, hh);

      // stroke
      ctx.lineWidth = o.strokeWidth;
      ctx.strokeStyle = (Z.type === "res") ? o.resStroke : o.supStroke;
      ctx.strokeRect(xx + 0.5, yy + 0.5, ww - 1, hh - 1);

      // optional label inside block
      if (o.showLabelsInBlock && ww > 36) {
        ctx.fillStyle = o.labelColor;
        ctx.font = o.font;
        const text = `${Z.type.toUpperCase()}  ${Z.price.toFixed(2)}  (${Math.max(1, Z.toIdx - Z.fromIdx + 1)} bars)`;
        ctx.fillText(text, xx + 6, yy + Math.min(16, hh - 4));
      }
    }
  }

  // subscribe to redraws
  const ro = new ResizeObserver(scheduleDraw);
  ro.observe(container);
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
  };
  seriesMap.set("sr_blocks_canvas_cleanup", cleanup);
  return cleanup;
}

// ---------- indicator ----------
const SR = {
  id: "sr",                         // same id as before; your App.js toggle still works
  label: "Support / Resistance (Blocks)",
  kind: INDICATOR_KIND.OVERLAY,
  defaults: DEF,
  compute: srCompute,
  attach: srAttach,
};

export default SR;
