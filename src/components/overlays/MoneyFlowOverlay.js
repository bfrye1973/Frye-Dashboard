// src/components/overlays/MoneyFlowOverlay.js
import React, { useEffect, useRef } from "react";
// If you already have the math in: src/lib/indicators/moneyFlowProfile.js
// you can import it. If not, this overlay will still show a placeholder.
let computeMoneyFlowProfile = null;
try {
  // optional import (won't break if not present yet)
  // eslint-disable-next-line global-require
  computeMoneyFlowProfile = require("../../lib/indicators/moneyFlowProfile.js")
    .computeMoneyFlowProfile;
} catch (_) { /* optional */ }

/**
 * MoneyFlowOverlay
 * Lightweight canvas overlay that sits on top of the chart container.
 * - Draws a simple right-hand profile based on MFP bins if `candles` provided
 * - Otherwise shows a small "overlay ready" watermark so we know it loaded
 *
 * Props:
 * - chartContainer: the DOM node used by Lightweight Charts (required)
 * - candles: optional array [{time, open, high, low, close, volume}, ...]
 */
export default function MoneyFlowOverlay({ chartContainer, candles }) {
  const canvasRef = useRef(null);
  const roRef = useRef(null);

  // Render helper
  function drawPlaceholder(ctx, w, h) {
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "#8aa0c3";
    ctx.textAlign = "center";
    ctx.fillText("Money Flow Overlay ready", w - 130, 18);
    ctx.restore();
  }

  function drawProfile(ctx, w, h, mfp) {
    ctx.clearRect(0, 0, w, h);

    if (!mfp || !mfp.bins || !mfp.bins.length) {
      drawPlaceholder(ctx, w, h);
      return;
    }

    // Right-side column for the bars
    const marginRight = 8;     // little padding from the right border
    const colWidth = Math.max(60, Math.round(w * 0.18)); // ~right 18% of chart
    const xRight = w - marginRight;

    // Find max to scale width
    const maxVal = mfp.bins.reduce((m, b) => Math.max(m, b.total || 0), 1);

    // We’ll stack bins evenly top->bottom (visual + simple).
    // (Price-aligned drawing is possible when we wire price->y transforms.)
    const N = mfp.bins.length;
    const gap = 2;
    const bandH = Math.max(3, Math.floor((h - (N - 1) * gap) / N));

    let y = 0;
    for (let i = 0; i < N; i++) {
      const b = mfp.bins[i];

      const pct = Math.min(1, (b.total || 0) / maxVal);
      const barWidth = Math.max(2, Math.floor(colWidth * pct));

      // Color bias (simple): green if buy >= sell, else red
      const green = "rgba(0, 200, 120, .55)";
      const red = "rgba(220, 50, 60, .55)";
      const fill = (b.buy || 0) >= (b.sell || 0) ? green : red;

      ctx.fillStyle = fill;
      // Draw from the right edge towards left
      ctx.fillRect(xRight - barWidth, y, barWidth, bandH);

      y += bandH + gap;
      if (y > h) break;
    }

    // PoC marker (thin line at max bin)
    if (mfp.pocIndex >= 0 && mfp.pocIndex < N) {
      const pocY = mfp.pocIndex * (bandH + gap) + Math.floor(bandH / 2);
      ctx.strokeStyle = "rgba(255,255,255,.45)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(xRight - colWidth, pocY);
      ctx.lineTo(xRight, pocY);
      ctx.stroke();
    }
  }

  useEffect(() => {
    if (!chartContainer) return;

    const canvas = document.createElement("canvas");
    canvas.style.position = "absolute";
    canvas.style.pointerEvents = "none";
    canvas.style.left = "0";
    canvas.style.top = "0";
    canvasRef.current = canvas;

    // Ensure the parent allows absolutely positioned children
    const prevPos = chartContainer.style.position;
    if (!prevPos || prevPos === "" || prevPos === "static") {
      chartContainer.style.position = "relative";
    }
    chartContainer.appendChild(canvas);

    function resizeAndDraw() {
      if (!canvasRef.current) return;
      const w = Math.max(10, chartContainer.clientWidth || 0);
      const h = Math.max(10, chartContainer.clientHeight || 0);
      // handle HiDPI
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      canvasRef.current.width = Math.floor(w * dpr);
      canvasRef.current.height = Math.floor(h * dpr);
      canvasRef.current.style.width = `${w}px`;
      canvasRef.current.style.height = `${h}px`;

      const ctx = canvasRef.current.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Compute MFP if we have the math + candles
      if (computeMoneyFlowProfile && Array.isArray(candles) && candles.length) {
        const mfp = computeMoneyFlowProfile(candles, {
          lookback: 200,
          rows: 30,
          source: "Volume",
          sentiment: "Bar Polarity",
        });
        drawProfile(ctx, w, h, mfp);
      } else {
        drawPlaceholder(ctx, w, h);
      }
    }

    // Resize observer to keep overlay sized with the chart
    const ro = new ResizeObserver(resizeAndDraw);
    ro.observe(chartContainer);
    roRef.current = ro;

    // Initial draw
    resizeAndDraw();

    return () => {
      try { roRef.current && roRef.current.disconnect(); } catch {}
      try { canvasRef.current && canvasRef.current.remove(); } catch {}
      if (prevPos === "" || prevPos === "static") {
        try { chartContainer.style.position = prevPos; } catch {}
      }
    };
  }, [chartContainer, candles]);

  // Nothing to render into React tree — we attach a canvas to the container
  return null;
}
