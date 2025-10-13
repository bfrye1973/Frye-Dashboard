// src/components/overlays/SwingLiquidityOverlay.js
// Swing Liquidity (pivot highs/lows) — Lightweight-Charts price-pane overlay.
// Alignment comes from the chart’s OWN scales:
//   X: chart.timeScale().timeToCoordinate(timeSeconds)
//   Y: priceSeries.priceToCoordinate(price)
// Canvas is DPR-aware and sits above the chart (z-index: 10).

export default function createSwingLiquidityOverlay({ chart, priceSeries, chartContainer }) {
  // ---- Guards --------------------------------------------------------
  if (!chart || !priceSeries || !chartContainer) {
    console.warn("[SwingLiquidity] missing required args");
    return { seed() {}, update() {}, destroy() {} };
  }

  // ---- Config (tune freely) -----------------------------------------
  const L = 10;                   // bars LEFT of pivot
  const R = 10;                   // bars RIGHT of pivot
  const MAX_BARS = 800;           // draw last N bars for speed
  const TICK = 6;                 // half-length of the H/L tick (px)
  const FONT = "11px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  const COL_H = "#ff4d4f";        // red  (swing high)
  const COL_L = "#22c55e";        // green (swing low)

  // ---- Canvas --------------------------------------------------------
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
    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    cnv.width  = Math.max(1, Math.floor(rect.width  * dpr));
    cnv.height = Math.max(1, Math.floor(rect.height * dpr));
    cnv.style.width  = rect.width + "px";
    cnv.style.height = rect.height + "px";
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
  };

  const ro = new ResizeObserver(resize);
  ro.observe(chartContainer);
  const onWinResize = () => resize();
  window.addEventListener("resize", onWinResize);
  resize();

  // ---- Data cache ----------------------------------------------------
  let barsAsc = []; // ascending time [{ time, open, high, low, close, volume }]

  // ---- Coordinate helpers (the KEY to alignment) --------------------
  const xFor = (timeSec) => {
    const x = chart.timeScale().timeToCoordinate(timeSec);
    return Number.isFinite(x) ? x : null;
  };
  const yFor = (price) => {
    const y = priceSeries.priceToCoordinate(Number(price));
    return Number.isFinite(y) ? y : null;
  };

  // ---- Pivot tests ---------------------------------------------------
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

  // ---- Draw ----------------------------------------------------------
  const draw = () => {
    const rect = chartContainer.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    if (!barsAsc.length) return;

    // draw the last N bars for perf
    const start = Math.max(0, barsAsc.length - MAX_BARS);
    const scan = barsAsc.slice(start);

    ctx.lineWidth = 1;
    ctx.font = FONT;
    ctx.textAlign = "center";

    for (let i = L; i < scan.length - R; i++) {
      const b = scan[i];
      const timeSec = b.time > 1e12 ? Math.floor(b.time / 1000) : b.time;

      const x = xFor(timeSec);
      if (x == null) continue;

      // High
      if (isSwingHigh(scan, i, L, R)) {
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
      if (isSwingLow(scan, i, L, R)) {
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

  // ---- Lifecycle -----------------------------------------------------
  return {
    seed(bars) {
      barsAsc = (bars || []).map(b => ({
        ...b,
        time: b.time > 1e12 ? Math.floor(b.time / 1000) : b.time, // ms→s if needed
      }));
      draw();
    },
    update(latest) {
      if (!latest) return;
      const t = latest.time > 1e12 ? Math.floor(latest.time / 1000) : latest.time;
      const last = barsAsc.at(-1);

      if (!last || t > last.time) {
        barsAsc.push({ ...latest, time: t });
      } else if (t === last.time) {
        barsAsc[barsAsc.length - 1] = { ...latest, time: t };
      } else {
        // out-of-order; ignore
        return;
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
