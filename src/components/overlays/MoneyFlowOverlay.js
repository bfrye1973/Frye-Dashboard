// src/components/overlays/MoneyFlowOverlay.js
// Money Flow Profile Overlay (factory module)
// - Draws LEFT + RIGHT profiles + HVN bands + PoC line
// - Renders on its own <canvas> absolutely positioned over the chart
// - Public API: { update(candles), destroy() }

import { computeMoneyFlowProfile } from "../../lib/indicators/moneyFlowProfile";

export default function MoneyFlowOverlay({ chartContainer }) {
  if (!chartContainer) return { update() {}, destroy() {} };

  // Ensure container can host absolute overlays
  const cs = getComputedStyle(chartContainer);
  if (cs.position === "static") chartContainer.style.position = "relative";

  // Create canvas
  const cnv = document.createElement("canvas");
  Object.assign(cnv.style, {
    position: "absolute",
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    pointerEvents: "none",
    zIndex: 9999,
  });
  chartContainer.appendChild(cnv);

  // Resize handling
  const syncSize = () => {
    const w = chartContainer.clientWidth || 300;
    const h = chartContainer.clientHeight || 200;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    cnv.width = Math.max(1, Math.floor(w * dpr));
    cnv.height = Math.max(1, Math.floor(h * dpr));
    cnv.style.width = `${w}px`;
    cnv.style.height = `${h}px`;
    const ctx = cnv.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  const ro = new ResizeObserver(syncSize);
  ro.observe(chartContainer);
  syncSize();

  // ---- drawing ----
  function draw(candles) {
    const ctx = cnv.getContext("2d");
    const w = cnv.clientWidth;
    const h = cnv.clientHeight;

    // clear
    ctx.clearRect(0, 0, w, h);

    // watermark if helper missing / no data
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

    // Build profile on the latest N bars (tweakable)
    const mfp = computeMoneyFlowProfile(candles, {
      lookback: 200,          // how many recent bars to include
      rows: 25,               // vertical bins
      source: "Volume",       // 'Volume' or 'Money Flow' (price*vol)
      sentiment: "Bar Polarity", // splits buy/sell if available
      highNodePct: 0.53,      // HVN threshold (as % of PoC)
      lowNodePct: 0.37,       // LVN threshold (not used visually here)
    });

    // geometry
    const marginSide = 8;
    const colW = Math.max(60, Math.round(w * 0.18)); // left/right column width (~18%)
    const rightXLeft = w - marginSide - colW;
    const leftXLeft  = marginSide;

    // background columns
    ctx.save();
    ctx.globalAlpha = 0.10;
    ctx.fillStyle = "#1a2536";
    ctx.fillRect(rightXLeft, 0, colW, h); // right column
    ctx.fillRect(leftXLeft,  0, colW, h); // left column
    ctx.restore();

    if (!mfp?.bins?.length) {
      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = "#88a8c3";
      ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      ctx.textAlign = "center";
      ctx.fillText("No profile yet", rightXLeft + colW / 2, 16);
      ctx.restore();
      return;
    }

    // map price → y
    const pMin = mfp.bins[0].low;
    const pMax = mfp.bins[mfp.bins.length - 1].high;
    const yOf = (price) => {
      const t = (price - pMin) / Math.max(1e-9, (pMax - pMin));
      return h - Math.round(t * h);
    };

    // HVN bands (yellow) across full width
    const maxVal = Math.max(...mfp.bins.map(b => b.total), 1);
    const hvnThreshold = mfp.percentile?.highThreshold ?? (maxVal * 0.53);
    let i = 0;
    while (i < mfp.bins.length) {
      if (mfp.bins[i].total >= hvnThreshold) {
        const start = i;
        while (i < mfp.bins.length && mfp.bins[i].total >= hvnThreshold) i++;
        const end = i - 1;

        const yTop = yOf(mfp.bins[start].high);
        const yBot = yOf(mfp.bins[end].low);
        const bandH = Math.max(2, yBot - yTop);

        ctx.save();
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = "rgba(255,215,0,1)";
        ctx.fillRect(0, yTop, w, bandH);
        ctx.restore();
      } else {
        i++;
      }
    }

    // Left & right profile bars
    const barMax = colW - 14; // inner padding
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

          ctx.globalAlpha = 0.85;
          ctx.fillStyle = "rgba(0,180,120,0.55)";
          ctx.fillRect(x, yTop, buyW, bh);

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

  // public API
  return {
    update(candles) {
      syncSize();
      draw(candles);
    },
    destroy() {
      try { ro.disconnect(); } catch {}
      try { cnv.remove(); } catch {}
    },
  };
}
