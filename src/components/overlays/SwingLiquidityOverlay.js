// SAFE v0.3 — always-visible debug edition
// - Thick, bright bands
// - High z-index so it sits ABOVE the chart (but pointer-events: none)
// - Extra guards + console logs so we know what's happening

import React, { useEffect, useRef } from "react";

function rafThrottle(fn) {
  let frame = null;
  return (...args) => {
    if (frame) return;
    frame = window.requestAnimationFrame(() => {
      frame = null;
      try { fn(...args); } catch (e) {}
    });
  };
}

function findPivots(bars, L = 10, R = 5) {
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

export default function SwingLiquidityOverlay({ containerEl, chart, bars, opts = {} }) {
  const canvasRef = useRef(null);
  const roRef = useRef(null);
  const drawRef = useRef(() => {});

  // Create canvas with high z-index and leave bottom axis gap
  useEffect(() => {
    if (!containerEl) return;
    const el = document.createElement("canvas");
    el.style.position = "absolute";
    el.style.pointerEvents = "none";
    el.style.inset = "0 0 var(--axis-gap,18px) 0";
    el.style.zIndex = "999"; // make sure it's on top
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

  useEffect(() => {
    if (!chart || !canvasRef.current || !Array.isArray(bars) || bars.length === 0) return;

    const ctx = canvasRef.current.getContext("2d");
    const timeScale = chart.timeScale && chart.timeScale();
    if (!ctx || !timeScale || typeof timeScale.timeToCoordinate !== "function") return;

    const options = {
      left: 10,
      right: 5,
      extendUntilFill: true,
      maxOnScreen: 250,
      bandPx: 14, // thicker so you can’t miss it
      colorHigh: "rgba(255, 59, 48, 0.45)",   // bright red
      colorLow:  "rgba(52, 199, 89, 0.45)",   // bright green
      lineHigh:  "rgba(255, 82, 82, 1.0)",
      lineLow:   "rgba(48, 209, 88, 1.0)",
      ...opts
    };

    const pivots = findPivots(bars, options.left, options.right);
    const bands  = buildBands(bars, pivots, options.extendUntilFill);

    // Debug print so we know we’re running
    try {
      console.debug("[SwingOverlay v0.3] bars:", bars.length, "pivots:", pivots.length, "bands:", bands.length);
    } catch {}

    // Helpers
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

        ctx.setTransform(1,0,0,1,0,0);
        ctx.clearRect(0, 0, width, height);
        ctx.scale(dpr, dpr);

        // Always draw a yellow dot at top-left so we know canvas is visible
        ctx.fillStyle = "rgba(250,204,21,0.95)";
        ctx.beginPath(); ctx.arc(10, 10, 3, 0, Math.PI * 2); ctx.fill();

        // Visible time range (safe)
        let minT = -Infinity, maxT = Infinity;
        try {
          const vr = timeScale.getVisibleRange && timeScale.getVisibleRange();
          if (vr && vr.from != null && vr.to != null) { minT = vr.from; maxT = vr.to; }
        } catch {}

        let drawn = 0;
        for (let i = 0; i < bands.length; i++) {
          if (drawn >= options.maxOnScreen) break;
          const b = bands[i];

          let x1 = timeToX(b.startTime);
          if (x1 < 0) continue; // off-screen
          const endTime = b.filledIndex != null ? bars[b.filledIndex]?.time : maxT;
          if (endTime != null && endTime < minT) continue;
          let x2 = b.filledIndex != null ? timeToX(endTime) : (cnv.clientWidth || width);

          const y = priceToY(b.level);

          const fill = b.kind === "H" ? options.colorHigh : options.colorLow;
          const stroke = b.kind === "H" ? options.lineHigh : options.lineLow;

          const yTop = Math.round(y - options.bandPx / 2);
          const yBot = Math.round(y + options.bandPx / 2);

          ctx.fillStyle = fill;
          ctx.fillRect(Math.round(x1), yTop, Math.max(1, Math.round(x2 - x1)), Math.max(1, yBot - yTop));

          ctx.strokeStyle = stroke;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(Math.round(x1), Math.round(y));
          ctx.lineTo(Math.round(x2), Math.round(y));
          ctx.stroke();

          drawn++;
        }

        // If nothing drawn, leave a hint
        if (drawn === 0) {
          ctx.fillStyle = "rgba(156,163,175,0.95)";
          ctx.font = "12px system-ui, sans-serif";
          ctx.fillText("Swing: no bands in view", 20, 14);
        }
      } catch {}
    };

    const throttled = rafThrottle(draw);
    drawRef.current = throttled;

    throttled(); // initial
    const onTime = () => throttled();
    const onLogical = () => throttled();
    try { timeScale.subscribeVisibleTimeRangeChange(onTime); } catch {}
    try { timeScale.subscribeVisibleLogicalRangeChange(onLogical); } catch {}

    return () => {
      try { timeScale.unsubscribeVisibleTimeRangeChange(onTime); } catch {}
      try { timeScale.unsubscribeVisibleLogicalRangeChange(onLogical); } catch {}
    };
  }, [chart, Array.isArray(bars) ? bars.length : 0, JSON.stringify(opts)]);

  return null;
}
