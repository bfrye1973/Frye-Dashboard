// src/components/overlays/SwingLiquidityOverlay.js
// Lightweight-Charts overlay that marks swing highs/lows with short lines & labels.
// Simplified port of “Swing Points & Liquidity – By Leviathan”.
// Works on any timeframe once priceSeries is passed in.

export default function SwingLiquidityOverlay({ chartContainer, priceSeries }) {
  if (!chartContainer || !priceSeries)
    return { seed() {}, update() {}, destroy() {} };

  /* ---------- basic canvas setup ---------- */
  const cs = getComputedStyle(chartContainer);
  if (cs.position === "static") chartContainer.style.position = "relative";

  const cnv = document.createElement("canvas");
  Object.assign(cnv.style, {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    zIndex: 10,
  });
  cnv.className = "overlay-canvas swing-liquidity";
  chartContainer.appendChild(cnv);
  const ctx = cnv.getContext("2d");

  const resize = () => {
    const rect = chartContainer.getBoundingClientRect();
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    cnv.width = rect.width * dpr;
    cnv.height = rect.height * dpr;
    cnv.style.width = rect.width + "px";
    cnv.style.height = rect.height + "px";
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
  };
  const ro = new ResizeObserver(resize);
  ro.observe(chartContainer);
  resize();

  /* ---------- helpers ---------- */
  const clear = () => {
    const rect = chartContainer.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
  };
  const yFor = (price) =>
    typeof priceSeries.priceToCoordinate === "function"
      ? priceSeries.priceToCoordinate(price)
      : null;

  // detect swing highs/lows in last N bars
  const isSwingHigh = (bars, i, left, right) => {
    const val = bars[i].high;
    for (let j = i - left; j < i + right; j++) {
      if (j === i || j < 0 || j >= bars.length) continue;
      if (bars[j].high > val) return false;
    }
    return true;
  };
  const isSwingLow = (bars, i, left, right) => {
    const val = bars[i].low;
    for (let j = i - left; j < i + right; j++) {
      if (j === i || j < 0 || j >= bars.length) continue;
      if (bars[j].low < val) return false;
    }
    return true;
  };

  /* ---------- draw ---------- */
  const drawSwings = (bars) => {
    clear();
    if (!bars?.length) return;
    const rect = chartContainer.getBoundingClientRect();
    const w = rect.width;
    const step = w / Math.max(1, bars.length);

    ctx.lineWidth = 1;
    ctx.font = "11px system-ui";
    ctx.textAlign = "center";

    for (let i = 15; i < bars.length - 15; i++) {
      const bar = bars[i];
      const x = step * i + step / 2;
      const yHigh = yFor(bar.high);
      const yLow = yFor(bar.low);
      if (isSwingHigh(bars, i, 10, 10) && yHigh != null) {
        ctx.strokeStyle = "#ff4d4f";
        ctx.beginPath();
        ctx.moveTo(x - 6, yHigh);
        ctx.lineTo(x + 6, yHigh);
        ctx.stroke();
        ctx.fillStyle = "#ff4d4f";
        ctx.fillText("H", x, yHigh - 6);
      }
      if (isSwingLow(bars, i, 10, 10) && yLow != null) {
        ctx.strokeStyle = "#22c55e";
        ctx.beginPath();
        ctx.moveTo(x - 6, yLow);
        ctx.lineTo(x + 6, yLow);
        ctx.stroke();
        ctx.fillStyle = "#22c55e";
        ctx.fillText("L", x, yLow + 12);
      }
    }
  };

  console.log("[SwingLiquidity] ATTACH");

  return {
    seed(bars) {
      console.log("[SwingLiquidity] SEED", bars?.length);
      resize();
      drawSwings(bars);
    },
    update(latest) {
      // update runs for every new candle
      resize();
      drawSwings(priceSeries._data || []); // use whatever bars the series holds
    },
    destroy() {
      console.log("[SwingLiquidity] DESTROY");
      try { ro.disconnect(); } catch {}
      try { cnv.remove(); } catch {}
    },
  };
}
