// src/components/overlays/SwingLiquidityOverlay.js
// v1.0 — TradingView-style Swing Liquidity bands (fat translucent rectangles)
// - Draws supply (red) / demand (green) bands from pivot highs/lows
// - Bands EXTEND right until FILLED (touch by wick or close)
// - Multiple overlapping bands allowed (stacked translucency)
// - Respects Row 6 axis gap (bottom inset), no layout shifts
//
// Usage (already in your RowChart):
// <SwingLiquidityOverlay
//   chart={chart}
//   candles={bars}
//   leftBars={15}
//   rightBars={10}
//   volPctGate={0.65}        // require pivot bar volume ≥ 65th percentile in lookback
//   extendUntilFilled={true} // stop band when price touches level
//   hideFilled={false}       // if true, remove filled bands from drawing
//   lookbackBars={800}       // compute pivots within this window
//   maxOnScreen={80}         // cap to avoid overdraw
// />
//
// Styling notes:
// - Colors match your TV screenshot vibe; tweak below if you need exact tones.
// - Band height is fixed pixel thickness so they visually pop regardless of zoom.

import React, { useEffect, useRef } from "react";

/* ------------------------- helpers: pivots & bands ------------------------- */

function percentile(values, p) {
  if (!values.length) return 0;
  const a = [...values].sort((x, y) => x - y);
  const idx = Math.min(a.length - 1, Math.max(0, Math.floor((p / 100) * a.length)));
  return a[idx];
}

// Detect pivot highs/lows using left/right bars
function detectPivots(bars, { left = 15, right = 10, lookback = 800, volGatePct = 65 }) {
  const n = bars.length;
  const start = Math.max(0, n - lookback);
  const vols = bars.slice(start, n).map(b => b.volume ?? 0);
  const volGate = percentile(vols, volGatePct);

  const pivots = [];
  for (let i = start + left; i < n - right; i++) {
    const b = bars[i];
    if (!b) continue;

    // volume gate
    if ((b.volume ?? 0) < volGate) continue;

    let isHigh = true;
    let isLow = true;
    for (let k = i - left; k <= i + right; k++) {
      if (bars[k].high > b.high) isHigh = false;
      if (bars[k].low < b.low) isLow = false;
      if (!isHigh && !isLow) break;
    }

    if (isHigh) {
      pivots.push({ kind: "resistance", idx: i, price: b.high });
    } else if (isLow) {
      pivots.push({ kind: "support", idx: i, price: b.low });
    }
  }
  return pivots;
}

// Build liquidity bands that extend right until "filled"
function buildBands(bars, pivots, { extendUntilFilled = true }) {
  const n = bars.length;
  const bands = [];

  for (const p of pivots) {
    const level = p.price;
    const startIdx = p.idx;
    let endIdx = n - 1; // by default extend to latest

    if (extendUntilFilled) {
      // FILLED when price touches the level by wick or close (choose wick-based for responsiveness)
      for (let i = p.idx + 1; i < n; i++) {
        const b = bars[i];
        const touched =
          p.kind === "resistance"
            ? b.high >= level // wick touch at/above resistance
            : b.low <= level; // wick touch at/below support
        if (touched) {
          endIdx = i;
          break;
        }
      }
    }

    bands.push({
      kind: p.kind,         // 'support' | 'resistance'
      price: level,         // price level
      startIdx,             // start bar index
      endIdx,               // inclusive end bar index (current or filled)
      filled: endIdx < n - 1,
    });
  }

  return bands;
}

/* ----------------------------- main component ----------------------------- */

export default function SwingLiquidityOverlay({
  chart,
  candles = [],
  leftBars = 15,
  rightBars = 10,
  volPctGate = 0.65,          // 0..1 → convert to percentile
  extendUntilFilled = true,
  hideFilled = false,
  lookbackBars = 800,
  maxOnScreen = 80,

  // Visual tuning
  bandPx = 8,                 // thickness of the band in pixels
  supportColor = "rgba(34,197,94,0.35)",   // green-500 @ ~35% opacity
  resistanceColor = "rgba(239,68,68,0.35)",// red-500   @ ~35% opacity
  edgeLine = true,            // optional thin edge line
  edgeOpacity = 0.85,
}) {
  const canvasRef = useRef(null);
  const roRef = useRef(null);

  // Create/attach a canvas that fills the chart host (leaves bottom axis gap)
  useEffect(() => {
    if (!chart) return;

    // Our component is rendered as a child of the chart container div,
    // so we can just create a canvas absolutely positioned to fill parent.
    const parent = canvasRef.current?.parentElement;
    const canvas = document.createElement("canvas");
    canvas.className = "overlay-leave-axis-gap";
    canvas.style.position = "absolute";
    canvas.style.inset = "0 0 var(--axis-gap, 18px) 0";
    canvas.style.pointerEvents = "none";
    canvas.style.zIndex = 10;

    (parent || document.body).appendChild(canvas);
    canvasRef.current = canvas;

    // Resize observer on parent only (prevents feedback loops)
    const ro = new ResizeObserver(() => {
      if (!canvas || !parent) return;
      canvas.width = parent.clientWidth;
      canvas.height = Math.max(0, parent.clientHeight - getAxisGapPx(parent));
      draw(); // redraw on resize
    });
    ro.observe(parent);
    roRef.current = ro;

    // Redraw on time-range changes (pan/zoom)
    const ts = chart.timeScale();
    const visHandler = () => draw();
    ts.subscribeVisibleTimeRangeChange(visHandler);

    // Initial size
    if (parent) {
      canvas.width = parent.clientWidth;
      canvas.height = Math.max(0, parent.clientHeight - getAxisGapPx(parent));
    }

    // Cleanup
    return () => {
      try { ts.unsubscribeVisibleTimeRangeChange(visHandler); } catch {}
      try { roRef.current?.disconnect(); } catch {}
      if (canvas && canvas.parentElement) {
        canvas.parentElement.removeChild(canvas);
      }
      canvasRef.current = null;
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chart]);

  // Recompute + redraw whenever candles change or props change
  useEffect(() => {
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    chart,
    candles,
    leftBars,
    rightBars,
    volPctGate,
    extendUntilFilled,
    hideFilled,
    lookbackBars,
    maxOnScreen,
    bandPx,
    supportColor,
    resistanceColor,
    edgeLine,
    edgeOpacity,
  ]);

  function draw() {
    const canvas = canvasRef.current;
    if (!canvas || !chart || !Array.isArray(candles) || candles.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const ts = chart.timeScale();
    const priceScale = chart.priceScale("right");

    // ---- compute pivots & bands
    const pivots = detectPivots(candles, {
      left: leftBars,
      right: rightBars,
      lookback: lookbackBars,
      volGatePct: Math.max(0, Math.min(100, volPctGate * 100)),
    });

    let bands = buildBands(candles, pivots, { extendUntilFilled });
    if (hideFilled) bands = bands.filter(b => !b.filled);

    // Optional cap to avoid overdraw
    if (typeof maxOnScreen === "number" && maxOnScreen > 0 && bands.length > maxOnScreen) {
      bands = bands.slice(-maxOnScreen);
    }

    // ---- coordinate helpers
    const timeToX = (tSec) => {
      const x = ts.timeToCoordinate(tSec);
      return x == null ? null : x;
    };
    const priceToY = (p) => {
      const y = priceScale.priceToCoordinate ? priceScale.priceToCoordinate(p) : null;
      return y == null ? null : y;
    };

    // ---- draw bands
    for (const b of bands) {
      const startT = candles[b.startIdx]?.time;
      const endT = candles[b.endIdx]?.time ?? candles[candles.length - 1]?.time;
      if (startT == null || endT == null) continue;

      const x1 = timeToX(startT);
      // If endT not on scale (e.g., latest), fall back to canvas width
      const x2 = timeToX(endT) ?? canvas.width - 1;
      if (x1 == null || x2 == null) continue;

      const y = priceToY(b.price);
      if (y == null) continue;

      const half = Math.max(1, bandPx / 2);
      const yTop = Math.round(y - half);
      const height = Math.max(2, Math.round(bandPx));

      ctx.save();
      ctx.beginPath();
      ctx.rect(Math.min(x1, x2), yTop, Math.abs(x2 - x1), height);
      ctx.fillStyle = b.kind === "support" ? supportColor : resistanceColor;
      ctx.fill();

      if (edgeLine) {
        ctx.globalAlpha = edgeOpacity;
        ctx.beginPath();
        ctx.moveTo(Math.min(x1, x2), y);
        ctx.lineTo(Math.max(x1, x2), y);
        ctx.lineWidth = 1;
        ctx.strokeStyle = b.kind === "support" ? "rgba(16,185,129,1)" : "rgba(248,113,113,1)";
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  return null; // nothing to render; we manage our own canvas node
}

/* ------------------------------- utilities -------------------------------- */

function getAxisGapPx(el) {
  // Read the CSS var if present; default 18
  try {
    const css = window.getComputedStyle(el);
    const raw = css.getPropertyValue("--axis-gap").trim();
    if (!raw) return 18;
    const n = parseFloat(raw);
    return Number.isFinite(n) ? n : 18;
  } catch {
    return 18;
  }
}
