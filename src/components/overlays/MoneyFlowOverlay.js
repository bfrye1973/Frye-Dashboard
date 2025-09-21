// Lightweight overlay that draws LEFT + RIGHT money/volume profile
// and a yellow HVN rectangle across the chart price area.
//
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
      // devicePixelRatio for crisp lines
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      cnv.width = Math.max(1, Math.floor(w * dpr));
      cnv.height = Math.max(1, Math.floor(h * dpr));
      cnv.style.width = `${w}px`;
      cnv.style.height = `${h}px`;
      const ctx = cnv.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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
    const w = cnv.clientWidth;
    const h = cnv.clientHeight;

    // clear
    ctx.clearRect(0, 0, w, h);

    // if we don't have the math yet, just watermark so you know overlay is alive
    if (!computeMoneyFlowProfile || !candles?.length) {
      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = "#88a8c3";
      ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      ctx.textAlign = "left";
      ctx.fillText("Money Flow Overlay ready", 12, 18);
      ctx.restore();
      return;
    }

    // compute fixed-range profile on latest N bars
    const mfp = computeMoneyFlowProfile(candles, {
      lookback: 200,
      rows: 25,
      source: "Volume",        // change to 'Money Flow' to weight by price*vol
      sentiment: "Bar Polarity",
      highNodePct: 0.53,       // HVN threshold (as % of PoC)
      lowNodePct:  0.37,       // LVN threshold (unused visually here)
    });

    // geometry
    const marginSide = 8;
    const colW = Math.max(60, Math.round(w * 0.18)); // ~18% columns
    const rightXLeft = w - marginSide - colW;
    const leftXLeft  = marginSide;

    // background columns
    ctx.save();
    ctx.globalAlpha = 0.10;
    ctx.fillStyle = "#1a2536";
    ctx.fillRect(rightXLeft, 0, colW, h);      // right column
    ctx.fillRect(leftXLeft,  0, colW, h);      // left column
    ctx.restore();

    if (!mfp?.bins?.length) {
      // still draw a light label
      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = "#88a8c3";
      ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      ctx.textAlign = "center";
      ctx.fillText("No profile yet", rightXLeft + colW / 2, 16);
      ctx.restore();
      return;
    }

    // scale bars by max node
    const maxVal = Math.max(...mfp.bins.map(b => b.total), 1);
    const barMax = colW - 14; // inner padding

    // map price to y
    const pMin = mfp.bins[0].low;
    const pMax = mfp.bins[mfp.bins.length - 1].high;
    const yOf = (price) => {
      const t = (price - pMin) / Math.max(1e-9, (pMax - pMin));
      return h - Math.round(t * h);
    };

    // --- HVN yellow rectangle across the whole chart (bins above highThreshold)
    // Merge consecutive HVN bins into bands and paint each band.
    const threshold = mfp.percentile?.highThreshold ?? (maxVal * 0.53);
    let i = 0;
    while (i < mfp.bins.length) {
      if (mfp.bins[i].total >= threshold) {
        const start = i;
        while (i < mfp.bins.length && mfp.bins[i].total >= threshold) i++;
        const end = i - 1;

        const yTop = yOf(mfp.bins[start].high);
        const yBot = yOf(mfp.bins[end].low);
        const bandH = Math.max(2, yBot - yTop);

        ctx.save();
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = "rgba(255,215,0,1)"; // yellow
        // full-width band (underlay look over candles)
        ctx.fillRect(0, yTop, w, bandH);
        ctx.restore();
      } else {
        i++;
      }
    }

    // draw LEFT + RIGHT profiles (bars), using buy/sell tint when available
    const drawColumn = (xLeft) => {
      ctx.save();
      for (const b of mfp.bins) {
        const yTop = yOf(b.high);
        const yBot = yOf(b.low);
        const bh = Math.max(2, yBot - yTop - 2);
        const bw = Math.round((b.total / maxVal) * barMax);
        const x = xLeft + 7;

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
    };

    drawColumn(rightXLeft);
    drawColumn(leftXLeft);

    // PoC line
    if (mfp.pocIndex >= 0) {
      const pocY = yOf(mfp.bins[mfp.pocIndex].center);
      ctx.save();
      ctx.strokeStyle = "rgba(255,215,0,0.9)";
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(leftXLeft, pocY);
      ctx.lineTo(w - marginSide, pocY);
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
        pointerEvents: "none", // visual-only (chart still receives mouse)
        zIndex: 10,            // ensure it sits ABOVE chart canvases
      }}
    />
  );
}
