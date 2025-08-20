// src/indicators/sr/index.js
import { INDICATOR_KIND } from "../shared/indicatorTypes";

// ---- Compute: simple pivot lines (left/right bars), no volume filters yet ----
function isPivotHigh(candles, i, L, R) {
  const hi = candles[i].high;
  for (let k = i - L; k <= i + R; k++) {
    if (k < 0 || k >= candles.length) return false;
    if (candles[k].high > hi) return false;
  }
  return true;
}
function isPivotLow(candles, i, L, R) {
  const lo = candles[i].low;
  for (let k = i - L; k <= i + R; k++) {
    if (k < 0 || k >= candles.length) return false;
    if (candles[k].low < lo) return false;
  }
  return true;
}

function srCompute(candles, inputs) {
  const { leftBars = 15, rightBars = 15 } = inputs || {};
  const n = candles?.length ?? 0;
  if (!n) return { levels: [] };

  const pending = []; // {type:'res'|'sup', price, actIdx}
  for (let i = leftBars; i < n - rightBars; i++) {
    if (isPivotHigh(candles, i, leftBars, rightBars)) {
      pending.push({ type: "res", price: candles[i].high, actIdx: i + rightBars });
    }
    if (isPivotLow(candles, i, leftBars, rightBars)) {
      pending.push({ type: "sup", price: candles[i].low, actIdx: i + rightBars });
    }
  }

  // extend forward to latest bar
  const levels = [];
  for (const p of pending) {
    if (p.actIdx >= 0 && p.actIdx < n) {
      levels.push({ type: p.type, price: p.price, from: candles[p.actIdx].time, to: candles[n - 1].time });
    }
  }
  return { levels };
}

// ---- Overlay: draw lines as bands on TOP of chart + add SR v1 tag ----
function srAttach(chartApi, seriesMap, result, inputs) {
  const { supColor = "#233dee", resColor = "#ff0000", lineWidth = 3, band = 0 } = inputs || {};
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
  canvas.style.zIndex = "9"; // ⬅️ keep overlay above chart
  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;
  container.appendChild(canvas);
  const ctx = canvas.getContext("2d");

  const xOfTime = (t) => chartApi.timeScale().timeToCoordinate(t);
  const yOfPrice = (p) => priceSeries.priceToCoordinate(p);

  function draw() {
    const w = container.clientWidth, h = container.clientHeight;
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    ctx.clearRect(0, 0, w, h);

    // tag so we know SR is rendering on top
    ctx.fillStyle = "rgba(147,163,184,0.85)";
    ctx.font = "12px system-ui,-apple-system,Segoe UI,Roboto,Arial";
    ctx.fillText("SR v1", 10, 16);

    const levels = result?.levels || [];
    for (const L of levels) {
      const x1 = xOfTime(L.from);
      const x2 = xOfTime(L.to);
      const y  = yOfPrice(L.price);
      if (x1 == null || x2 == null || y == null) continue;

      ctx.strokeStyle = (L.type === "res") ? resColor : supColor;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      ctx.moveTo(x1, y);
      ctx.lineTo(x2, y);
      ctx.stroke();

      // optional thin band
      if (band > 0) {
        const y2 = yOfPrice(L.type === "res" ? L.price + band : L.price - band);
        if (y2 != null) {
          ctx.globalAlpha = 0.15;
          ctx.fillStyle = (L.type === "res") ? resColor : supColor;
          const yy = Math.min(y, y2), hh = Math.abs(y - y2);
          ctx.fillRect(Math.min(x1, x2), yy, Math.abs(x2 - x1), Math.max(1, hh));
          ctx.globalAlpha = 1;
        }
      }
    }
  }

  const ro = new ResizeObserver(draw);
  ro.observe(container);
  const ts = chartApi.timeScale();
  const unsub1 = ts.subscribeVisibleTimeRangeChange(draw);
  const unsub2 = ts.subscribeVisibleLogicalRangeChange?.(draw) || (() => {});
  const unsub3 = priceSeries.priceScale().subscribeSizeChange?.(draw) || (() => {});
  draw();

  const cleanup = () => {
    try { ro.disconnect(); } catch {}
    try { unsub1 && ts.unsubscribeVisibleTimeRangeChange(draw); } catch {}
    try { unsub2 && ts.unsubscribeVisibleLogicalRangeChange?.(draw); } catch {}
    try { unsub3 && priceSeries.priceScale().unsubscribeSizeChange?.(draw); } catch {}
    try { container.removeChild(canvas); } catch {}
  };
  seriesMap.set("sr_canvas_cleanup", cleanup);
  return cleanup;
}

const SR = {
  id: "sr",                     // <-- use 'sr' for the toggle
  label: "Support / Resistance",
  kind: INDICATOR_KIND.OVERLAY,
  defaults: { leftBars: 15, rightBars: 15, supColor: "#233dee", resColor: "#ff0000", lineWidth: 3, band: 0 },
  compute: srCompute,
  attach: srAttach,
};

const srIndicators = [SR];
export default srIndicators;

