// src/components/overlays/SwingLiquidityOverlay.js
// Clean reset — TV-style swing liquidity bands (pivot highs/lows),
// extends forward until wick "fills" touch the level.
// - Draws on an absolute canvas inside the chart container
// - Respects --axis-gap so the x-axis is never covered
// - Throttles redraw on pan/zoom/resize
// - No external state: you pass bars (time in SECONDS)

import React, { useEffect, useRef } from "react";

/* ---------------------------- utils ---------------------------- */
function rafThrottle(fn) {
  let frame = null;
  return (...args) => {
    if (frame) return;
    frame = window.requestAnimationFrame(() => {
      frame = null;
      fn(...args);
    });
  };
}

function findPivots(bars, L = 15, R = 10) {
  // Simple swing high/low detection similar to ta.pivothigh/low
  // Returns [{ index, time, price, kind: 'H'|'L' }]
  const pivots = [];
  if (!bars || bars.length === 0) return pivots;
  const n = bars.length;

  for (let i = L; i < n - R; i++) {
    const hi = bars[i].high;
    let isHigh = true;
    for (let k = i - L; k <= i + R; k++) {
      if (bars[k].high > hi) {
        isHigh = false;
        break;
      }
    }
    if (isHigh) pivots.push({ index: i, time: bars[i].time, price: hi, kind: "H" });

    const lo = bars[i].low;
    let isLow = true;
    for (let k = i - L; k <= i + R; k++) {
      if (bars[k].low < lo) {
        isLow = false;
        break;
      }
    }
    if (isLow) pivots.push({ index: i, time: bars[i].time, price: lo, kind: "L" });
  }
  return pivots.sort((a, b) => a.index - b.index);
}

function buildBands(bars, pivots, { extendUntilFill = true } = {}) {
  // Convert pivots into forward-extending bands that stop when touched by wick
  // Returns [{ startIndex, startTime, level, kind, filledIndex|null }]
  const bands = [];
  if (!bars || !bars.length) return bands;
  const n = bars.length;

  for (const p of pivots) {
    const level = p.price;
    let filledIndex = null;

    if (extendUntilFill) {
      for (let i = p.index + 1; i < n; i++) {
        const h = bars[i].high;
        const l = bars[i].low;
        if (h >= level && l <= level) {
          filledIndex = i;
          break;
        }
      }
    }

    bands.push({
      startIndex: p.index,
      startTime: p.time,
      level,
      kind: p.kind,
      filledIndex,
    });
  }

  return bands;
}

/* ---------------------------- overlay ---------------------------- */
export default function SwingLiquidityOverlay({
  containerEl,
  chart,
  bars,
  opts = {},
}) {
  const canvasRef = useRef(null);
  const roRef = useRef(null);
  const unsubRef = useRef([]);
  const drawThrottledRef = useRef(null);

  // Create/destroy the absolute canvas under the same container as the chart
  useEffect(() => {
    if (!containerEl) return;

    const canvas = document.createElement("canvas");
    canvas.style.position = "absolute";
    canvas.style.pointerEvents = "none";
    // Leave room for the x-axis (configurable via CSS var)
    canvas.style.inset = "0 0 var(--axis-gap, 18px) 0";
    containerEl.appendChild(canvas);
    canvasRef.current = canvas;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = containerEl.clientWidth || 0;
      const h = containerEl.clientHeight || 0;
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      if (drawThrottledRef.current) drawThrottledRef.current();
    };

    const ro = new ResizeObserver(resize);
    ro.observe(containerEl);
    roRef.current = ro;

    return () => {
      if (roRef.current) roRef.current.disconnect();
      roRef.current = null;
      if (canvasRef.current && canvasRef.current.parentNode) {
        canvasRef.current.parentNode.removeChild(canvasRef.current);
      }
      canvasRef.current = null;
    };
  }, [containerEl]);

  // Main draw effect
  useEffect(() => {
    if (!chart || !canvasRef.current) return;

    const ctx = canvasRef.current.getContext("2d");
    const timeScale = chart.timeScale();

    const options = {
      left: 15,
      right: 10,
      extendUntilFill: true,
      maxOnScreen: 150,
      bandPx: 8,
      colorHigh: "rgba(170,36,48,0.22)",
      colorLow: "rgba(102,187,106,0.22)",
      lineHigh: "rgba(170,36,48,1.0)",
      lineLow: "rgba(102,187,106,1.0)",
      ...opts,
    };

    const pivots = findPivots(bars || [], options.left, options.right);
    const bands = buildBands(bars || [], pivots, {
      extendUntilFill: options.extendUntilFill,
    });

    // y-coordinate from price — prefer series if available; fallback to right price scale
    const priceToY = (p) => {
      try {
        // Try the right price scale if available (works without passing a series)
        const ps = chart.priceScale ? chart.priceScale("right") : null;
        if (ps && typeof ps.priceToCoordinate === "function") {
          const y = ps.priceToCoordinate(p);
          if (y != null) return y;
        }
      } catch {}
      return 0;
    };

    const timeToX = (t) => {
      const x = timeScale.timeToCoordinate(t);
      return x == null ? -1 : x;
    };

    const draw = () => {
      if (!canvasRef.current) return;

      const { width, height } = canvasRef.current;
      const dpr = window.devicePixelRatio || 1;

      // Clear and scale to device pixels
      ctx.save();
      ctx.clearRect(0, 0, width, height);
      ctx.scale(dpr, dpr);

      // Visible time window to reduce work
      const range = timeScale.getVisibleRange();
      let minT = -Infinity;
      let maxT = Infinity;
      if (range && range.from != null && range.to != null) {
        minT = range.from;
        maxT = range.to;
      }

      let drawn = 0;

      for (let i = 0; i < bands.length; i++) {
        if (drawn >= options.maxOnScreen) break;

        const b = bands[i];
        const x1 = timeToX(b.startTime);
        if (x1 < 0) continue; // off-screen

        // Skip if entire band ends left of view
        const bandEndTime = b.filledIndex != null ? bars[b.filledIndex]?.time : maxT;
        if (bandEndTime != null && bandEndTime < minT) continue;

        const levelY = priceToY(b.level);
        if (levelY == null) continue;

        // Decide end x: filled time or right edge of canvas
        let x2;
        if (b.filledIndex != null) {
          const t2 = bars[b.filledIndex]?.time;
          x2 = t2 != null ? timeToX(t2) : canvasRef.current.clientWidth;
        } else {
          x2 = canvasRef.current.clientWidth;
        }

        // Colors
        const fill = b.kind === "H" ? options.colorHigh : options.colorLow;
        const stroke = b.kind === "H" ? options.lineHigh : options.lineLow;

        // Draw band rectangle
        const yTop = Math.round(levelY - options.bandPx / 2);
        const yBot = Math.round(levelY + options.bandPx / 2);
        ctx.fillStyle = fill;
        ctx.fillRect(
          Math.round(x1),
          yTop,
          Math.max(1, Math.round(x2 - x1)),
          Math.max(1, yBot - yTop)
        );

        // Center line
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(Math.round(x1), Math.round(levelY));
        ctx.lineTo(Math.round(x2), Math.round(levelY));
        ctx.stroke();

        drawn++;
      }

      ctx.restore();
    };

    const drawThrottled = rafThrottle(draw);
    drawThrottledRef.current = drawThrottled;

    // Initial draw
    drawThrottled();

    // Redraw on view changes
    const onTimeRange = () => drawThrottled();
    const onLogicalRange = () => drawThrottled();
    const unsub = [
      () => timeScale.unsubscribeVisibleTimeRangeChange(onTimeRange),
      () => timeScale.unsubscribeVisibleLogicalRangeChange(onLogicalRange),
    ];

    timeScale.subscribeVisibleTimeRangeChange(onTimeRange);
    timeScale.subscribeVisibleLogicalRangeChange(onLogicalRange);

    unsubRef.current = unsub;

    return () => {
      unsubRef.current.forEach((fn) => {
        try {
          fn && fn();
        } catch {}
      });
      unsubRef.current = [];
    };
  }, [chart, canvasRef, JSON.stringify(opts), bars]);

  return null; // draws to its own canvas
}
