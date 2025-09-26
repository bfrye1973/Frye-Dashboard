// src/components/overlays/SwingLiquidityOverlay.js
// SAFE v0 — cannot crash the page. If anything goes wrong it quietly no-ops.
// - Draws pivot bands on an absolute canvas
// - Guards every external call; catches draw errors
// - Respects --axis-gap (x-axis stays visible)

import React, { useEffect, useRef } from "react";

function rafThrottle(fn) {
  let frame = null;
  return (...args) => {
    if (frame) return;
    frame = window.requestAnimationFrame(() => {
      frame = null;
      try { fn(...args); } catch (e) { /* swallow draw errors */ }
    });
  };
}

// Simple pivot finder (like TV’s pivot high/low), safe for short arrays.
function findPivots(bars, L = 15, R = 10) {
  const out = [];
  if (!Array.isArray(bars) || bars.length < L + R + 1) return out;
  const n = bars.length;
  for (let i = L; i < n - R; i++) {
    const hi = bars[i].high, lo = bars[i].low;
    let isH = true, isL = true;
    for (let k = i - L; k <= i + R; k++) {
      if (bars[k].high > hi) isH = false;
      if (bars[k].low  < lo) isL = false;
      if (!isH && !isL) break;
    }
    if (isH) out.push({ index: i, time: bars[i].time, price: hi, kind: "H" });
    if (isL) out.push({ index: i, time: bars[i].time, price:  lo, kind: "L" });
  }
  return out;
}

function buildBands(bars, pivots, extendUntilFill = true) {
  const bands = [];
  if (!Array.isArray(bars) || bars.length === 0) return bands;
  for (const p of pivots) {
    let filledIndex = null;
    if (extendUntilFill) {
      for (let i = p.index + 1; i < bars.length; i++) {
        const h = bars[i].high, l = bars[i].low;
        if (h >= p.price && l <= p.price) { filledIndex = i; break; }
      }
    }
    bands.push({ startIndex: p.index, startTime: p.time, level: p.price, kind: p.kind, filledIndex });
  }
  return bands;
}

export default function SwingLiquidityOverlay({
  containerEl,
  chart,
  bars,
  opts = {}
}) {
  const canvasRef = useRef(null);
  const roRef = useRef(null);
  const drawRef = useRef(() => {});

  // Create canvas (with axis gap) and observe parent size.
  useEffect(() => {
    if (!containerEl) return;
    const el = document.createElement("canvas");
    el.style.position = "absolute";
    el.style.pointerEvents = "none";
    el.style.inset = "0 0 var(--axis-gap,18px) 0";
    containerEl.appendChild(el);
    canvasRef.current = el;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = containerEl.clientWidth || 0;
      const h = containerEl.clientHeight || 0;
      el.width = Math.max(1, Math.floor(w * dpr));
      el.height = Math.max(1, Math.floor(h * dpr));
      el.style.width = w + "px";
      el.style.height = h + "px";
      drawRef.current && drawRef.current();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(containerEl);
    roRef.current = ro;

    return () => {
      try { roRef.current && roRef.current.disconnect(); } catch {}
      roRef.current = null;
      if (canvasRef.current && canvasRef.current.parentNode) {
        canvasRef.current.parentNode.removeChild(canvasRef.current);
      }
      canvasRef.current = null;
    };
  }, [containerEl]);

  // Main draw
  useEffect(() => {
    // Hard guards: if any dependency missing, do nothing.
    if (!chart || !canvasRef.current || !Array.isArray(bars) || bars.length === 0) return;

    const ctx = canvasRef.current.getContext("2d");
    const timeScale = chart.timeScale && chart.timeScale();
    if (!ctx || !timeScale || typeof timeScale.timeToCoordinate !== "function") return;

    const options = {
      left: 15,
      right: 10,
      extendUntilFill: true,
      maxOnScreen: 150,
      bandPx: 8,
      colorHigh: "rgba(170,36,48,0.22)",
      colorLow:  "rgba(102,187,106,0.22)",
      lineHigh:  "rgba(170,36,48,1.0)",
      lineLow:   "rgba(102,187,106,1.0)",
      ...opts
    };

    const pivots = findPivots(bars, options.left, options.right);
    const bands  = buildBands(bars, pivots, options.extendUntilFill);

    // y from price: prefer right price scale; fall back to 0 safely.
    const priceToY = (p) => {
      try {
        const ps = chart.priceScale && chart.priceScale("right");
        if (ps && typeof ps.priceToCoordinate === "function") {
          const y = ps.priceToCoordinate(p);
          if (y != null) return y;
        }
      } catch {}
      return 0;
    };
    const timeToX = (t) => {
      try {
        const x = timeScale.timeToCoordinate(t);
        return x == null ? -1 : x;
      } catch { return -1; }
    };

    const draw = () => {
      try {
        const cnv = canvasRef.current;
        if (!cnv) return;
        const { width, height } = cnv;
        const dpr = window.devicePixelRatio || 1;
        ctx.setTransform(1,0,0,1,0,0); // reset
        ctx.clearRect(0, 0, width, height);
        ctx.scale(dpr, dpr);

        // Visible range (safe)
        let minT = -Infinity, maxT = Infinity;
        try {
          const vr = timeScale.getVisibleRange && timeScale.getVisibleRange();
          if (vr && vr.from != null && vr.to != null) { minT = vr.from; maxT = vr.to; }
        } catch {}

        let drawn = 0;
        for (let i = 0; i < bands.length; i++) {
          if (drawn >= options.maxOnScreen) break;
          const b = bands[i];

          const x1 = timeToX(b.startTime);
          if (x1 < 0) continue;

          const endTime = b.filledIndex != null ? bars[b.filledIndex]?.time : maxT;
          if (endTime != null && endTime < minT) continue;

          const y = priceToY(b.level);
          const x2 = b.filledIndex != null ? timeToX(endTime) : (cnv.clientWidth || width);

          const fill = b.kind === "H" ? options.colorHigh : options.colorLow;
          const stroke = b.kind === "H" ? options.lineHigh : options.lineLow;

          const yTop = Math.round(y - options.bandPx / 2);
          const yBot = Math.round(y + options.bandPx / 2);

          ctx.fillStyle = fill;
          ctx.fillRect(Math.round(x1), yTop, Math.max(1, Math.round(x2 - x1)), Math.max(1, yBot - yTop));

          ctx.strokeStyle = stroke;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(Math.round(x1), Math.round(y));
          ctx.lineTo(Math.round(x2), Math.round(y));
          ctx.stroke();

          drawn++;
        }
      } catch {
        // swallow any unexpected draw error
      }
    };

    const throttled = rafThrottle(draw);
    drawRef.current = throttled;

    // initial + subscribe
    throttled();
    const onTime = () => throttled();
    const onLogical = () => throttled();

    try { timeScale.subscribeVisibleTimeRangeChange(onTime); } catch {}
    try { timeScale.subscribeVisibleLogicalRangeChange(onLogical); } catch {}

    return () => {
      try { timeScale.unsubscribeVisibleTimeRangeChange(onTime); } catch {}
      try { timeScale.unsubscribeVisibleLogicalRangeChange(onLogical); } catch {}
    };
  }, [chart, JSON.stringify(opts), Array.isArray(bars) ? bars.length : 0]);

  return null;
}
