// Lightweight overlay that draws a right-side money-flow/volume profile
// Requires: src/lib/indicators/moneyFlowProfile.js
import React, { useEffect, useRef } from "react";

// soft import so the page still renders even if the file is missing
let computeMoneyFlowProfile = null;
try {
  ({ computeMoneyFlowProfile } =
    require("../../lib/indicators/moneyFlowProfile.js"));
} catch (e) {
  // leave null; we'll draw a small watermark so you know the overlay mounted
}

export default function MoneyFlowOverlay({ chartContainer, candles }) {
  const canvasRef = useRef(null);

  // keep canvas size in sync with the chart container
  useEffect(() => {
    if (!chartContainer || !canvasRef.current) return;
    const cnv = canvasRef.current;

    const syncSize = () => {
      if (!chartContainer) return;
      const w = chartContainer.clientWidth || 300;
      const h = chartContainer.clientHeight || 200;
      cnv.width = Math.max(1, w);
      cnv.height = Math.max(1, h);
      draw();
    };

    const ro = new ResizeObserver(syncSize);
    ro.observe(chartContainer);
    syncSize();

    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartContainer]);

  // redraw when candles change
  useEffect(() => {
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candles]);

  function draw() {
    const cnv = canvasRef.current;
    if (!cnv) return;
    const ctx = cnv.getContext("2d");
    const w = cnv.width;
    const h = cnv.height;

    // clear
    ctx.clearRect(0, 0, w, h);

    // if we don't have the math yet, just watermark so you know overlay is alive
    if (!computeMoneyFlowProfile || !candles?.length) {
      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = "#88a8c3";
      ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      ctx.textAlign = "center";
      ctx.fillText("Money Flow Overlay ready", w - 120, 16);
      ctx.restore();
      return;
    }

    // compute fixed-range profile on latest N bars
    const mfp = computeMoneyFlowProfile(candles, {
      lookback: 200,
      rows: 25,
      source: "Volume",        // change to 'Money Flow' if you prefer price*vol
      sentiment: "Bar Polarity",
    });

    // right-side column for profile
    const marginRight = 8;
    const colW = Math.max(60, Math.round(w * 0.18)); // ~right 18% of chart
    const xLeft = w - marginRight - colW;

    // background column
    ctx.save();
    ctx.globalAlpha = 0.10;
    ctx.fillStyle = "#1a2536";
    ctx.fillRect(xLeft, 0, colW, h);
    ctx.restore();

    if (!mfp?.bins?.length) {
      // still draw a light label
      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = "#88a8c3";
      ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      ctx.textAlign = "center";
      ctx.fillText("No profile yet", xLeft + colW / 2, 16);
      ctx.restore();
      return;
    }

    // scale bars by max node
    const maxVal = Math.max(...mfp.bins.map(b => b.total), 1);
    const barMax = colW - 14; // leave inner padding

    // map price to y
    const pMin = mfp.bins[0].low;
    const pMax = mfp.bins[mfp.bins.length - 1].high;
    const yOf = (price) => {
      const t = (price - pMin) / Math.max(1e-9, (pMax - pMin));
      return h - Math.round(t * h);
    };

    // draw each bin as a horizontal bar; tint buy/sell split if available
    ctx.save();
    for (const b of mfp.bins) {
      const yTop = yOf(b.high);
      const yBot = yOf(b.low);
      const bh = Math.max(2, yBot - yTop - 2);
      const bw = Math.round((b.total / maxVal) * barMax);

      const x = xLeft + 7;

      // split bar (buy / sell) if we have sentiment
      if (b.buy || b.sell) {
        const total = Math.max(1e-9, b.buy + b.sell);
        const buyW = Math.round((b.buy / total) * bw);
        const sellW = bw - buyW;

        // buy (green-ish)
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = "rgba(0,180,120,0.55)";
        ctx.fillRect(x, yTop, buyW, bh);

        // sell (red-ish)
        ctx.fillStyle = "rgba(220,80,80,0.55)";
        ctx.fillRect(x + buyW, yTop, sellW, bh);
      } else {
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = "rgba(120,160,220,0.55)";
        ctx.fillRect(x, yTop, bw, bh);
      }
    }
    ctx.restore();

    // PoC line
    if (mfp.pocIndex >= 0) {
      const pocY = yOf(mfp.bins[mfp.pocIndex].center);
      ctx.save();
      ctx.strokeStyle = "rgba(255,215,0,0.9)";
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(xLeft, pocY);
      ctx.lineTo(w - marginRight, pocY);
      ctx.stroke();
      ctx.restore();
    }
  }

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none", // visual-only
      }}
    />
  );
}
