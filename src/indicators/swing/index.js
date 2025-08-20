// src/indicators/swing/index.js
// Swing Points & Liquidity — BLOCKS ONLY (no lines)
// Demand (swing lows) = GREEN, Supply (swing highs) = RED
// Draws ABOVE the chart; viewport culling + HARD LIMIT: MAX 3 PER SIDE

import { INDICATOR_KIND } from "../shared/indicatorTypes";

// ======= TUNABLES =======
const MAX_ZONES_PER_SIDE = 3;     // ← change to 2 if you prefer
const MIN_PX_W = 24;              // drop skinny slivers
// ========================

const DEF = {
  leftBars: 15,
  rightBars: 10,
  showBoxes: true,
  showLabels: true,
  extendUntilFill: true,
  hideFilled: false,
  // Appearance (Liquidity palette)
  supFill: "rgba(102,187,106,0.35)", supStroke: "#66bb6a",  // demand
  resFill: "rgba(170,36,48,0.35)",   resStroke: "#aa2430",  // supply
  strokeWidth: 1,
  blockHeightPct: 0.002,
  labelColor: "rgba(230,236,245,0.9)",
  font: "12px system-ui,-apple-system,Segoe UI,Roboto,Arial",
};

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

function swingCompute(candles, inputs) {
  const o = { ...DEF, ...(inputs || {}) };
  const L = o.leftBars, R = o.rightBars;
  const n = candles?.length ?? 0;
  if (!n) return { zones: [], labels: [], opts: o };

  const zones = [];   // {type:'res'|'sup', price, fromIdx, toIdx, filled}
  const labels = [];

  for (let i = L; i < n - R; i++) {
    if (isPivotHigh(candles, i, L, R)) {
      const act = i + R;
      if (act < n) {
        zones.push({ type: "res", price: candles[i].high, fromIdx: act, toIdx: act, filled: false });
        if (o.showLabels) labels.push({ time: candles[i].time, type: "res", price: candles[i].high });
      }
    }
    if (isPivotLow(candles, i, L, R)) {
      const act = i + R;
      if (act < n) {
        zones.push({ type: "sup", price: candles[i].low,  fromIdx: act, toIdx: act, filled: false });
        if (o.showLabels) labels.push({ time: candles[i].time, type: "sup", price: candles[i].low });
      }
    }
  }

  // extend until fill (or stop early)
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

  const filtered = o.hideFilled ? zones.filter(z => !z.filled) : zones;
  const res = filtered.map(z => ({ ...z, fromTime: candles[z.fromIdx].time, toTime: candles[z.toIdx].time }));
  return { zones: res, labels, opts: o };
}

function swingAttach(chartApi, seriesMap, result, inputs) {
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
  canvas.style.zIndex = "9";
  container.appendChild(canvas);
  const ctx = canvas.getContext("2d");

  const ts = chartApi.timeScale();
  const xOf = (t) => ts.timeToCoordinate(t);
  const yOf = (p) => priceSeries.priceToCoordinate(p);

  function getVisibleTimeRange() {
    const r = ts.getVisibleRange ? ts.getVisibleRange() : null;
    if (r && r.from != null && r.to != null) return { from: r.from, to: r.to };
    const leftTime  = ts.coordinateToTime ? ts.coordinateToTime(0) : null;
    const rightTime = ts.coordinateToTime ? ts.coordinateToTime(canvas.clientWidth) : null;
    if (leftTime && rightTime) return { from: leftTime, to: rightTime };
    return null;
  }

  let raf = 0;
  function scheduleDraw() { if (!raf) raf = requestAnimationFrame(() => { raf = 0; draw(); }); }
  function resize() {
    const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = container.clientWidth, h = container.clientHeight;
    if (canvas.width !== Math.floor(w * DPR) || canvas.height !== Math.floor(h * DPR)) {
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
    ctx.fillText("SWING v3 (max 3/side)", 10, 16);

    const zones = result?.zones || [];
    if (!zones.length) return;

    const vr = getVisibleTimeRange();
    const tFrom = vr?.from ?? -Infinity;
    const tTo   = vr?.to   ??  Infinity;

    const visible = [];
    for (const Z of zones) {
      if (Z.toTime < tFrom || Z.fromTime > tTo) continue;
      const x1 = xOf(Z.fromTime), x2 = xOf(Z.toTime), y = yOf(Z.price);
      if (x1 == null || x2 == null || y == null) continue;
      const pxW = Math.abs(x2 - x1);
      if (pxW < MIN_PX_W) continue;
      visible.push({
        Z, x1: Math.min(x1, x2), x2: Math.max(x1, x2), y, pxW,
        strength: Math.max(1, (Z.toIdx ?? 0) - (Z.fromIdx ?? 0) + 1),
      });
    }
    if (!visible.length) return;

    // HARD LIMIT: keep strongest 3 supply and 3 demand on screen
    const supply = visible.filter(v => v.Z.type === "res").sort((a,b)=>b.strength - a.strength).slice(0, MAX_ZONES_PER_SIDE);
    const demand = visible.filter(v => v.Z.type === "sup").sort((a,b)=>b.strength - a.strength).slice(0, MAX_ZONES_PER_SIDE);
    const drawList = supply.concat(demand);

    for (const V of drawList) {
      const Z = V.Z;
      const baseHalf = Math.max(1e-6, Z.price * o.blockHeightPct);
      // height scales a little thinner when zoomed in (wider pxW)
      const scale = Math.max(0.6, Math.min(1.0, 120 / V.pxW));
      const half  = baseHalf * scale;

      const yTop = yOf(Z.type === "res" ? (Z.price + half) : (Z.price - half));
      const yBot = yOf(Z.type === "res" ? (Z.price - half) : (Z.price + half));
      if (yTop == null || yBot == null) continue;

      const xx = V.x1, ww = Math.max(1, V.pxW);
      const yy = Math.min(yTop, yBot), hh = Math.max(1, Math.abs(yTop - yBot));

      // opacity by strength within on-screen cohort
      const cohort = Z.type === "res" ? supply : demand;
      const localMax = cohort[0]?.strength || V.strength;
      const alpha = 0.22 + 0.13 * (V.strength / localMax); // 0.22–0.35

      ctx.globalAlpha = alpha;
      ctx.fillStyle   = (Z.type === "res") ? o.resFill : o.supFill;
      ctx.fillRect(xx, yy, ww, hh);

      ctx.globalAlpha = 1;
      ctx.lineWidth   = o.strokeWidth;
      ctx.strokeStyle = (Z.type === "res") ? o.resStroke : o.supStroke;
      ctx.strokeRect(xx + 0.5, yy + 0.5, ww - 1, hh - 1);

      if (o.showBoxes && ww > 48) {
        ctx.fillStyle = o.labelColor;
        ctx.font = o.font;
        const tag = (Z.type === "res" ? "SUPPLY" : "DEMAND") + "  " + Z.price.toFixed(2);
        ctx.fillText(tag, xx + 6, yy + Math.min(16, hh - 4));
      }
    }
  }

  // markers once
  if (Array.isArray(result?.labels) && o.showLabels) {
    const markers = result.labels.map((lb) => ({
      time: lb.time,
      position: lb.type === "res" ? "belowBar" : "aboveBar",
      color: lb.type === "res" ? o.resStroke : o.supStroke,
      shape: "circle",
      text: "",
      size: 0,
    }));
    try { priceSeries.setMarkers([...(priceSeries._markers || []), ...markers]); } catch {}
  }

  const ro = new ResizeObserver(scheduleDraw);
  ro.observe(container);

  const unsub1 = ts.subscribeVisibleTimeRangeChange(scheduleDraw);
  const unsub2 = ts.subscribeVisibleLogicalRangeChange
    ? ts.subscribeVisibleLogicalRangeChange(scheduleDraw) : null;

  const ps = priceSeries.priceScale();
  const subscribedSizeChange = ps && ps.subscribeSizeChange
    ? (ps.subscribeSizeChange(scheduleDraw), true) : false;

  scheduleDraw();

  const cleanup = () => {
    try { ro.disconnect(); } catch {}
    try { unsub1 && ts.unsubscribeVisibleTimeRangeChange(scheduleDraw); } catch {}
    try { unsub2 && ts.unsubscribeVisibleLogicalRangeChange && ts.unsubscribeVisibleLogicalRangeChange(scheduleDraw); } catch {}
    try { if (subscribedSizeChange && ps && ps.unsubscribeSizeChange) { ps.unsubscribeSizeChange(scheduleDraw); } } catch {}
    try { container.removeChild(canvas); } catch {}
  };

  seriesMap.set("swing_blocks_canvas_cleanup", cleanup);
  return cleanup;
}

const SWING = {
  id: "swing",
  label: "Swing Points & Liquidity (Blocks)",
  kind: INDICATOR_KIND.OVERLAY,
  defaults: DEF,
  compute: swingCompute,
  attach: swingAttach,
};

export default SWING;
