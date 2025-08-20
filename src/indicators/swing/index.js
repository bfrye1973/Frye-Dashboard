// src/indicators/swing/index.js
// Swing Points & Liquidity — BLOCKS ONLY (no lines)
// - Pivot highs/lows with left/right bars
// - Extend until fill (or stop early) with optional hideFilled
// - Demand (swing lows) = GREEN block, Supply (swing highs) = RED block
// - Draws ABOVE chart (z-index); version tag "SWING v2"

import { INDICATOR_KIND } from "../shared/indicatorTypes";

// Defaults (override via indicatorSettings.swing if desired)
const DEF = {
  leftBars: 15,            // swingSizeL
  rightBars: 10,           // swingSizeR
  showBoxes: true,         // blocks only (we don’t draw lines here)
  showLabels: true,        // small circles at swing point (via markers)
  extendUntilFill: true,   // extend forward until price fills the zone
  hideFilled: false,       // remove zone once filled
  // Appearance (Liquidity palette)
  supFill: "rgba(102,187,106,0.35)", // GREEN demand zone fill
  supStroke: "#66bb6a",
  resFill: "rgba(170,36,48,0.35)",   // RED supply zone fill
  resStroke: "#aa2430",
  strokeWidth: 1,
  blockHeightPct: 0.002,   // vertical thickness ≈ 0.2% of price
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

// ---------- compute pivots -> zones ----------
function swingCompute(candles, inputs) {
  const o = { ...DEF, ...(inputs || {}) };
  const L = o.leftBars, R = o.rightBars;
  const n = candles?.length ?? 0;
  if (!n) return { zones: [], labels: [], opts: o };

  const zones = [];  // {type:'res'|'sup', price, fromIdx, toIdx, filled}
  const labels = []; // {time, type, price}

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
        zones.push({ type: "sup", price: candles[i].low, fromIdx: act, toIdx: act, filled: false });
        if (o.showLabels) labels.push({ time: candles[i].time, type: "sup", price: candles[i].low });
      }
    }
  }

  // Extend zones forward; mark filled when price touches
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

  // map idx → time for drawing
  const res = filtered.map(z => ({
    ...z,
    fromTime: candles[z.fromIdx].time,
    toTime:   candles[z.toIdx].time,
  }));

  return { zones: res, labels, opts: o };
}

// ---------- overlay (blocks only; z-index + rAF + DPR cap) ----------
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

    // version tag for visibility
    ctx.fillStyle = "rgba(147,163,184,0.85)";
    ctx.font = o.font;
    ctx.fillText("SWING v2", 10, 16);

    const zones = result?.zones || [];
    for (const Z of zones) {
      const x1 = xOf(Z.fromTime), x2 = xOf(Z.toTime), y = yOf(Z.price);
      if (x1 == null || x2 == null || y == null) continue;

      const half = Math.max(1e-6, Z.price * o.blockHeightPct);
      const yTop = yOf(Z.type === "res" ? (Z.price + half) : (Z.price - half));
      const yBot = yOf(Z.type === "res" ? (Z.price - half) : (Z.price + half));
      if (yTop == null || yBot == null) continue;

      const xx = Math.min(x1, x2), ww = Math.max(1, Math.abs(x2 - x1));
      const yy = Math.min(yTop, yBot), hh = Math.max(1, Math.abs(yTop - yBot));

      // fill
      ctx.fillStyle = (Z.type === "res") ? o.resFill : o.supFill; // RED supply, GREEN demand
      ctx.fillRect(xx, yy, ww, hh);

      // stroke
      ctx.lineWidth = o.strokeWidth;
      ctx.strokeStyle = (Z.type === "res") ? o.resStroke : o.supStroke;
      ctx.strokeRect(xx + 0.5, yy + 0.5, ww - 1, hh - 1);

      // optional label inside block
      if (o.showBoxes && ww > 36) {
        ctx.fillStyle = o.labelColor;
        ctx.font = o.font;
        const label = `${Z.type === "res" ? "SUPPLY" : "DEMAND"}  ${Z.price.toFixed(2)}`;
        ctx.fillText(label, xx + 6, yy + Math.min(16, hh - 4));
      }
    }
  }

  // (Optional) marker dots at swing points — only once
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
  const unsub2 = ts.subscribeVisibleLogicalRangeChange?.(scheduleDraw) || (() => {});
  const unsub3 = priceSeries.priceScale().subscribeSizeChange?.(scheduleDraw) || (() => {});
  scheduleDraw();

  const cleanup = () => {
    try { ro.disconnect(); } catch {}
    try { unsub1 && ts.unsubscribeVisibleTimeRangeChange(scheduleDraw); } catch {}
    try { unsub2 && ts.unsubscribeVisibleLogicalRangeChange?.(scheduleDraw); } catch {}
    try { unsub3 && priceSeries.priceScale().unsubscribeSizeChange?.(scheduleDraw) || (() => {}) ; } catch {}
    try { container.removeChild(canvas); } catch {}
  };
  seriesMap.set("swing_blocks_canvas_cleanup", cleanup);
  return cleanup;
}

// ---------- indicator ----------
const SWING = {
  id: "swing",
  label: "Swing Points & Liquidity (Blocks)",
  kind: INDICATOR_KIND.OVERLAY,
  defaults: DEF,
  compute: swingCompute,
  attach: swingAttach,
};

export default SWING;
