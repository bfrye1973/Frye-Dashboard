// src/components/overlays/SwingLiquidityOverlay.js
// Swing Liquidity (pivot highs/lows) — Lightweight-Charts overlay (price pane)
// - Absolute canvas overlay (z-index:10), DPR-aware
// - Uses chart.timeScale().timeToCoordinate(time) for X
// - Uses priceSeries.priceToCoordinate(price) for Y
// - Draws H/L ticks + labels without culling by visible range (always visible)

export default function SwingLiquidityOverlay({ chart, priceSeries, chartContainer }) {
  // ---- Guards ----
  if (!chart || !priceSeries || !chartContainer) {
    return { seed() {}, update() {}, destroy() {} };
  }

  // ---- Tunables ----
  const LEFT = 10;                 // bars left for pivot check
  const RIGHT = 10;                // bars right for pivot check
  const MAX_DRAW_BARS = 800;       // limit lookback for speed
  const TICK = 6;                  // half-length of small tick marks (px)
  const FONT = "11px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  const COL_H = "#ff4d4f";         // swing high (red)
  const COL_L = "#22c55e";         // swing low (green)

  // ---- Canvas ----
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

  // DPR-aware sizing
  const resize = () => {
    const rect = chartContainer.getBoundingClientRect();
    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    cnv.width = Math.max(1, Math.floor(rect.width * dpr));
    cnv.height = Math.max(1, Math.floor(rect.height * dpr));
    cnv.style.width = rect.width + "px";
    cnv.style.height = rect.height + "px";
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
  };
  const ro = new ResizeObserver(resize);
  ro.observe(chartContainer);
  const onWinResize = () => resize();
  window.addEventListener("resize", onWinResize);
  resize();

  // ---- Data cache ----
  let barsCache = []; // ascending time [{ time, open, high, low, close, volume }]

  // ---- Helpers ----
  const yFor = (price) => {
    const y = priceSeries.priceToCoordinate(Number(price));
    return Number.isFinite(y) ? y : null;
  };
  const xFor = (timeSec) => {
    const x = chart.timeScale().timeToCoordinate(timeSec);
    return Number.isFinite(x) ? x : null;
  };

  const isSwingHigh = (arr, i, L, R) => {
    const v = arr[i].high;
    for (let j = i - L; j <= i + R; j++) {
      if (j === i || j < 0 || j >= arr.length) continue;
      if (arr[j].high > v) return false;
    }
    return true;
  };

  const isSwingLow = (arr, i, L, R) => {
    const v = arr[i].low;
    for (let j = i - L; j <= i + R; j++) {
      if (j === i || j < 0 || j >= arr.length) continue;
      if (arr[j].low < v) return false;
    }
    return true;
  };

  // ---- Draw ----
  const draw = () => {
    const rect = chartContainer.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    if (!barsCache?.length) return;

    // Limit to last N bars for speed
    const startIdx = Math.max(0, barsCache.length - MAX_DRAW_BARS);
    const scan = barsCache.slice(startIdx);

    ctx.lineWidth = 1;
    ctx.font = FONT;
    ctx.textAlign = "center";

    for (let i = LEFT; i < scan.length - RIGHT; i++) {
      const b = scan[i];
      const time = b.time; // epoch seconds

      // NOTE: visible-range culling DISABLED intentionally so marks show immediately.
      const x = xFor(time);
      if (!Number.isFinite(x)) continue;

      // High
      if (isSwingHigh(scan, i, LEFT, RIGHT)) {
        const y = yFor(b.high);
        if (y != null) {
          ctx.strokeStyle = COL_H;
          ctx.beginPath();
          ctx.moveTo(x - TICK, y);
          ctx.lineTo(x + TICK, y);
          ctx.stroke();

          ctx.fillStyle = COL_H;
          ctx.fillText("H", x, y - 6);
        }
      }

      // Low
      if (isSwingLow(scan, i, LEFT, RIGHT)) {
        const y = yFor(b.low);
        if (y != null) {
          ctx.strokeStyle = COL_L;
          ctx.beginPath();
          ctx.moveTo(x - TICK, y);
          ctx.lineTo(x + TICK, y);
          ctx.stroke();

          ctx.fillStyle = COL_L;
          ctx.fillText("L", x, y + 12);
        }
      }
    }
  };

  // ---- Lifecycle ----
  return {
    seed(bars) {
      barsCache = (bars || []).map(b => ({
        ...b,
        time: b.time > 1e12 ? Math.floor(b.time / 1000) : b.time, // ms->s if needed
      }));
      draw();
    },
    update(latest) {
      if (!latest) return;
      const t = latest.time > 1e12 ? Math.floor(latest.time / 1000) : latest.time;
      const last = barsCache[barsCache.length - 1];

      if (!last || t > last.time) {
        barsCache.push({ ...latest, time: t });
      } else if (t === last.time) {
        barsCache[barsCache.length - 1] = { ...latest, time: t };
      } else {
        return; // out-of-order
      }
      draw();
    },
    destroy() {
      try { ro.disconnect(); } catch {}
      window.removeEventListener("resize", onWinResize);
      try { cnv.remove(); } catch {}
    },
  };
}
