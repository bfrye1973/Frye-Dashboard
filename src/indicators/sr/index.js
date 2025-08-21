// src/indicators/sr/index.js
// Support / Resistance — HORIZONTAL BLOCKS (no lines)
// Palette: RES=RED, SUP=BLUE; overlay above chart;
// HARD LIMIT: MAX 3 PER SIDE + cull skinny/off-screen zones,
// with a SAFE FALLBACK to ensure at least one per side draws.

const MAX_ZONES_PER_SIDE = 3;   // change to 2 if you prefer
const MIN_PX_W = 12;            // lower so zoomed-in bars still show

const DEF = {
  leftBars: 15,
  rightBars: 15,
  extendUntilFill: true,
  hideFilled: false,

  // SR palette (fixed): red/blue
  resColor: "rgba(239,68,68,0.35)", resStroke: "#ef4444",
  supColor: "rgba(59,130,246,0.35)", supStroke: "#3b82f6",
  strokeWidth: 1,
  blockHeightPct: 0.002,        // ~0.2% of price for band thickness
  showLabelsInBlock: true,
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

function srCompute(candles, inputs) {
  const o = { ...DEF, ...(inputs || {}) };
  const L = o.leftBars, R = o.rightBars;
  const n = candles?.length ?? 0;
  if (!n) return { zones: [], opts: o };

  const zones = []; // {type:'res'|'sup', price, fromIdx, toIdx, filled}
  for (let i = L; i < n - R; i++) {
    if (isPivotHigh(candles, i, L, R)) {
      const act = i + R;
      if (act < n) zones.push({ type: "res", price: candles[i].high, fromIdx: act, toIdx: act, filled: false });
    }
    if (isPivotLow(candles, i, L, R)) {
      const act = i + R;
      if (act < n) zones.push({ type: "sup", price: candles[i].low, fromIdx: act, toIdx: act, filled: false });
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
  return { zones: res, opts: o };
}

function srAttach(chartApi, seriesMap, result, inputs) {
  const o = { ...DEF, ...(inputs || {}) };
  const container = chartApi?._container;
  const priceSeries = chartApi?._priceSeries;
  if (!container || !priceSeries) return () => {};

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
    const w = canvas.clientWidth;
    ctx.clearRect(0, 0, w, canvas.clientHeight);

    // tag
    ctx.fillStyle = "rgba(147,163,184,0.85)";
    ctx.font = o.font;
    ctx.fillText("SR BLOCKS v2 (max 3/side + fallback)", 10, 16);

    const zones = result?.zones || [];
    if (!zones.length) return;

    const leftT  = ts.coordinateToTime ? ts.coordinateToTime(0) : null;
    const rightT = ts.coordinateToTime ? ts.coordinateToTime(w) : null;
    const tFrom = leftT ?? -Infinity;
    const tTo   = rightT ??  Infinity;

    // filter on-screen & min width
    const visible = [];
    for (const Z of zones) {
      if (Z.toTime < tFrom || Z.fromTime > tTo) continue;
      const x1 = xOf(Z.fromTime), x2 = xOf(Z.toTime), y = yOf(Z.price);
      if (x1 == null || x2 == null || y == null) continue;
      const pxW = Math.abs(x2 - x1);
      visible.push({
        Z, x1: Math.min(x1, x2), x2: Math.max(x1, x2), y, pxW,
        strength: Math.max(1, (Z.toIdx ?? 0) - (Z.fromIdx ?? 0) + 1),
      });
    }
    if (!visible.length) return;

    // prefer wide blocks; but if none pass width, we'll keep strongest anyway
    const wide = visible.filter(v => v.pxW >= MIN_PX_W);
    let supply = wide.filter(v => v.Z.type === "res").sort((a,b)=>b.strength - a.strength).slice(0, MAX_ZONES_PER_SIDE);
    let demand = wide.filter(v => v.Z.type === "sup").sort((a,b)=>b.strength - a.strength).slice(0, MAX_ZONES_PER_SIDE);

    // Fallback: if nothing passes width, draw the strongest 1 per side so user always sees something
    if (supply.length === 0) {
      const allSup = visible.filter(v => v.Z.type === "res").sort((a,b)=>b.strength - a.strength);
      if (allSup[0]) supply = [allSup[0]];
    }
    if (demand.length === 0) {
      const allDem = visible.filter(v => v.Z.type === "sup").sort((a,b)=>b.strength - a.strength);
      if (allDem[0]) demand = [allDem[0]];
    }

    const drawList = supply.concat(demand);

    // draw blocks
    for (const V of drawList) {
      const Z = V.Z;
      const baseHalf = Math.max(1e-6, Z.price * o.blockHeightPct);
      const scale = Math.max(0.6, Math.min(1.0, 120 / V.pxW)); // thinner when zoomed in
      const half  = baseHalf * scale;

      const yTop = yOf(Z.type === "res" ? (Z.price + half) : (Z.price - half));
      const yBot = yOf(Z.type === "res" ? (Z.price - half) : (Z.price + half));
      if (yTop == null || yBot == null) continue;

      const xx = V.x1, ww = Math.max(1, V.pxW);
      const yy = Math.min(yTop, yBot), hh = Math.max(1, Math.abs(yTop - yBot));

      ctx.globalAlpha = 0.28;
      ctx.fillStyle = (Z.type === "res") ? o.resColor : o.supColor;
      ctx.fillRect(xx, yy, ww, hh);

      ctx.globalAlpha = 1;
      ctx.lineWidth = o.strokeWidth;
      ctx.strokeStyle = (Z.type === "res") ? o.resStroke : o.supStroke;
      ctx.strokeRect(xx + 0.5, yy + 0.5, ww - 1, hh - 1);

      if (o.showLabelsInBlock && ww > 48) {
        ctx.fillStyle = o.labelColor;
        ctx.font = o.font;
        const label = `${Z.type === "res" ? "RES" : "SUP"}  ${Z.price.toFixed(2)}  (${Math.max(1, Z.toIdx - Z.fromIdx + 1)} bars)`;
        ctx.fillText(label, xx + 6, yy + Math.min(16, hh - 4));
      }
    }
  }

  const ro = new ResizeObserver(scheduleDraw);
  ro.observe(container);
  const unsub1 = ts.subscribeVisibleTimeRangeChange(scheduleDraw);
  const unsub2 = ts.subscribeVisibleLogicalRangeChange
    ? ts.subscribeVisibleLogicalRangeChange(scheduleDraw) : null;

  const ps = priceSeries.priceScale();
  const subscribed = ps && ps.subscribeSizeChange ? (ps.subscribeSizeChange(scheduleDraw), true) : false;

  scheduleDraw();

  const cleanup = () => {
    try { ro.disconnect(); } catch {}
    try { unsub1 && ts.unsubscribeVisibleTimeRangeChange(scheduleDraw); } catch {}
    try { unsub2 && ts.unsubscribeVisibleLogicalRangeChange && ts.unsubscribeVisibleLogicalRangeChange(scheduleDraw); } catch {}
    try { if (subscribed && ps && ps.unsubscribeSizeChange) ps.unsubscribeSizeChange(scheduleDraw); } catch {}
    try { container.removeChild(canvas); } catch {}
  };
  seriesMap.set("sr_blocks_canvas_cleanup", cleanup);
  return cleanup;
}

const SR = {
  id: "sr",
  label: "Support / Resistance (Blocks)",
  kind: "OVERLAY",
  defaults: DEF,
  compute: srCompute,
  attach: srAttach,
};

export default SR;
