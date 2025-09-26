// src/components/overlays/SwingLiquidityOverlay.js
// v2.0 — TV-style Swing Liquidity (fat translucent bands, extend-until-filled)
// - Self-contained: renders its own wrapper+canvas (no chartContainer prop needed)
// - No layout shift; respects bottom axis gap via CSS inset
// - Bands stack with translucency, stop when price touches level (wick-based)
// - Cleanly cleans up on unmount and on redraw triggers

import React, { useEffect, useRef } from "react";

/* ----------------------------- math helpers ----------------------------- */

function percentile(values, p) {
  if (!values || values.length === 0) return 0;
  const a = [...values].sort((x, y) => x - y);
  const i = Math.min(a.length - 1, Math.max(0, Math.floor((p / 100) * a.length)));
  return a[i];
}

// Detect pivot highs/lows using left/right bars and a volume gate
function detectPivots(bars, { left = 15, right = 10, lookback = 800, volGatePct = 65 }) {
  const n = bars.length;
  const start = Math.max(0, n - lookback);
  const vols = bars.slice(start).map((b) => b.volume ?? 0);
  const volGate = percentile(vols, volGatePct);

  const pivots = [];
  for (let i = start + left; i < n - right; i++) {
    const b = bars[i];
    if (!b) continue;
    if ((b.volume ?? 0) < volGate) continue;

    let isHigh = true;
    let isLow = true;
    for (let k = i - left; k <= i + right; k++) {
      if (bars[k].high > b.high) isHigh = false;
      if (bars[k].low < b.low) isLow = false;
      if (!isHigh && !isLow) break;
    }
    if (isHigh) pivots.push({ kind: "resistance", idx: i, price: b.high });
    else if (isLow) pivots.push({ kind: "support", idx: i, price: b.low });
  }
  return pivots;
}

// Build liquidity bands that extend right until they’re “filled”
function buildBands(bars, pivots, { extendUntilFilled = true }) {
  const n = bars.length;
  const bands = [];
  for (const p of pivots) {
    const level = p.price;
    let endIdx = n - 1;
    if (extendUntilFilled) {
      for (let i = p.idx + 1; i < n; i++) {
        const b = bars[i];
        const touched =
          p.kind === "resistance" ? b.high >= level : b.low <= level; // wick-based
        if (touched) {
          endIdx = i;
          break;
        }
      }
    }
    bands.push({
      kind: p.kind, // 'support' | 'resistance'
      price: level,
      startIdx: p.idx,
      endIdx,
      filled: endIdx < n - 1,
    });
  }
  return bands;
}

/* -------------------------------- component ------------------------------ */

export default function SwingLiquidityOverlay({
  chart,
  candles = [],
  leftBars = 15,
  rightBars = 10,
  volPctGate = 0.65, // 0..1 → converted to percentile
  extendUntilFilled = true,
  hideFilled = false,
  lookbackBars = 800,
  maxOnScreen = 80,

  // visual
  bandPx = 8, // thickness (px)
  supportColor = "rgba(34,197,94,0.35)",    // green-500 @35%
  resistanceColor = "rgba(239,68,68,0.35)", // red-500   @35%
  edgeLine = true,
  edgeOpacity = 0.85,
}) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const roRef = useRef(null);
  const unsubRef = useRef(null);

  // Mount wrapper + canvas (self-contained, no external parent needed)
  useEffect(() => {
    if (!chart) return;

    // Create a wrapper that leaves room for the time axis
    const wrap = document.createElement("div");
    wrap.className = "overlay-leave-axis-gap";
    Object.assign(wrap.style, {
      position: "absolute",
      inset: "0 0 var(--axis-gap, 18px) 0",
      pointerEvents: "none",
      zIndex: 10,
    });

    // Canvas inside wrapper
    const canvas = document.createElement("canvas");
    Object.assign(canvas.style, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      pointerEvents: "none",
    });
    wrap.appendChild(canvas);

    // Attach to the same DOM node where this React component is rendered
    const host = wrapRef.current?.parentElement || document.body;
    host.appendChild(wrap);

    wrapRef.current = wrap;
    canvasRef.current = canvas;

    // Resize only the wrapper (prevents feedback loops)
    const ro = new ResizeObserver(() => {
      resizeCanvasTo(wrap, canvas);
      draw();
    });
    ro.observe(wrap);
    roRef.current = ro;

    // Redraw on visible time range changes (pan/zoom)
    const ts = chart.timeScale();
    const onVis = () => draw();
    ts.subscribeVisibleTimeRangeChange(onVis);
    unsubRef.current = () => {
      try {
        ts.unsubscribeVisibleTimeRangeChange(onVis);
      } catch {}
    };

    // Initial size & draw
    resizeCanvasTo(wrap, canvas);
    draw();

    return () => {
      try {
        unsubRef.current?.();
      } catch {}
      try {
        roRef.current?.disconnect();
      } catch {}
      if (wrap && wrap.parentElement) wrap.parentElement.removeChild(wrap);
      wrapRef.current = null;
      canvasRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chart]);

  // Redraw on data/prop changes
  useEffect(() => {
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
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
    if (!chart || !canvas || !Array.isArray(candles) || candles.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const ts = chart.timeScale();
    const ps = chart.priceScale("right");
    if (!ts || !ps || !ps.priceToCoordinate) return;

    // Compute pivots and bands
    const pivots = detectPivots(candles, {
      left: leftBars,
      right: rightBars,
      lookback: lookbackBars,
      volGatePct: Math.max(0, Math.min(100, volPctGate * 100)),
    });
    let bands = buildBands(candles, pivots, { extendUntilFilled });
    if (hideFilled) bands = bands.filter((b) => !b.filled);

    if (typeof maxOnScreen === "number" && maxOnScreen > 0 && bands.length > maxOnScreen) {
      bands = bands.slice(-maxOnScreen);
    }

    // Helpers → px coords
    const timeToX = (t) => ts.timeToCoordinate(t);
    const priceToY = (p) => ps.priceToCoordinate(p);

    for (const b of bands) {
      const startBar = candles[b.startIdx];
      const endBar = candles[b.endIdx] ?? candles[candles.length - 1];
      if (!startBar || !endBar) continue;

      const x1 = timeToX(startBar.time);
      let x2 = timeToX(endBar.time);
      if (x1 == null) continue;
      if (x2 == null) x2 = canvas.width - 1;

      const y = priceToY(b.price);
      if (y == null) continue;

      const half = Math.max(1, (bandPx * getDpr()) / 2);
      const yTop = Math.round(y - half);
      const w = Math.abs(x2 - x1);
      const h = Math.max(2 * getDpr(), Math.round(bandPx * getDpr()));

      ctx.save();
      ctx.beginPath();
      ctx.rect(Math.min(x1, x2), yTop, w, h);
      ctx.fillStyle = b.kind === "support" ? supportColor : resistanceColor;
      ctx.fill();

      if (edgeLine) {
        ctx.globalAlpha = edgeOpacity;
        ctx.beginPath();
        ctx.moveTo(Math.min(x1, x2), y);
        ctx.lineTo(Math.max(x1, x2), y);
        ctx.lineWidth = Math.max(1, 1 * getDpr());
        ctx.strokeStyle = b.kind === "support" ? "rgba(16,185,129,1)" : "rgba(248,113,113,1)";
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  // Host marker (invisible; used only to find where to mount wrapper)
  return <div ref={wrapRef} style={{ display: "none" }} />;
}

/* ------------------------------- utilities ------------------------------- */

function getDpr() {
  return typeof window !== "undefined" ? Math.max(1, window.devicePixelRatio || 1) : 1;
}

function resizeCanvasTo(wrapperEl, canvasEl) {
  if (!wrapperEl || !canvasEl) return;
  const rect = wrapperEl.getBoundingClientRect();
  const dpr = getDpr();
  // Set backing store size
  canvasEl.width = Math.max(1, Math.floor(rect.width * dpr));
  // The wrapper leaves the axis gap already; rect.height is safe to use
  canvasEl.height = Math.max(1, Math.floor(rect.height * dpr));
  const ctx = canvasEl.getContext("2d");
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // normalize for drawing in CSS pixels
}
