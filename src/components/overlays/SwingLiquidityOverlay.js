// src/components/overlays/SwingLiquidityOverlay.js
// Swing Liquidity (pivot highs/lows) — price-pane overlay aligned to chart.
// • X = chart.timeScale().timeToCoordinate(timeSec)
// • Y = priceSeries.priceToCoordinate(price)
// • Redraws on seed/update + pan/zoom + resize (DPR-aware)

export default function createSwingLiquidityOverlay({ chart, priceSeries, chartContainer }) {
  if (!chart || !priceSeries || !chartContainer) {
    console.warn("[SwingLiquidity] missing args");
    return { seed() {}, update() {}, destroy() {} };
  }

  // ---------- Tunables ----------
  const L = 10;                 // bars left of pivot
  const R = 10;                 // bars right of pivot
  const MAX_BARS = 800;         // draw last N bars
  const TICK = 6;               // half-length of tick mark
  const FONT = "11px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  const COL_H = "#ff4d4f";
  const COL_L = "#22c55e";

  // ---------- Canvas ----------
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

  // ---------- Data ----------
  let barsAsc = []; // [{time, open, high, low, close, volume}] ascending

  // ---------- Coordinate helpers ----------
  const xFor = (tSec) => {
    const x = chart.timeScale().timeToCoordinate(tSec);
    return Number.isFinite(x) ? x : null;
  };
  const yFor = (price) => {
    const y = priceSeries.priceToCoordinate(Number(price));
    return Number.isFinite(y) ? y : null;
  };

  // ---------- Pivots ----------
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

  // ---------- Draw ----------
  const draw = () => {
    const rect = chartContainer.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    if (!barsAsc.length) return;

    const start = Math.max(0, barsAsc.length - MAX_BARS);
    const scan = barsAsc.slice(start);

    ctx.lineWidth = 1;
    ctx.font = FONT;
    ctx.textAlign = "center";

    for (let i = L; i < scan.length - R; i++) {
      const b = scan[i];
      const tSec = b.time > 1e12 ? Math.floor(b.time / 1000) : b.time;

      const x = xFor(tSec);
      if (x == null) continue;

      if (isSwingHigh(scan, i, L, R)) {
        const y = yFor(b.high);
        if (y != null) {
          ctx.strokeStyle = COL_H;
          ctx.beginPath(); ctx.moveTo(x - TICK, y); ctx.lineTo(x + TICK, y); ctx.stroke();
          ctx.fillStyle = COL_H; ctx.fillText("H", x, y - 6);
        }
      }

      if (isSwingLow(scan, i, L, R)) {
        const y = yFor(b.low);
        if (y != null) {
          ctx.strokeStyle = COL_L;
          ctx.beginPath(); ctx.moveTo(x - TICK, y); ctx.lineTo(x + TICK, y); ctx.stroke();
          ctx.fillStyle = COL_L; ctx.fillText("L", x, y + 12);
        }
      }
    }
  };

  // ---------- Time-scale subscriptions for pan/zoom ----------
  const ts = chart.timeScale();
  const onLogicalRange = () => draw(); // pan/zoom/scroll
  const onVisibleTimeRange = () => draw(); // some builds use this event

  ts.subscribeVisibleLogicalRangeChange?.(onLogicalRange);
  ts.subscribeVisibleTimeRangeChange?.(onVisibleTimeRange);

  // ---------- API ----------
  return {
    seed(bars) {
      barsAsc = (bars || []).map(b => ({
        ...b, time: b.time > 1e12 ? Math.floor(b.time / 1000) : b.time,
      }));
      draw();
    },
    update(latest) {
      if (!latest) return;
      const t = latest.time > 1e12 ? Math.floor(latest.time / 1000) : latest.time;
      const last = barsAsc.at(-1);
      if (!last || t > last.time) barsAsc.push({ ...latest, time: t });
      else if (t === last.time)   barsAsc[barsAsc.length - 1] = { ...latest, time: t };
      else return; // out-of-order
      draw();
    },
    destroy() {
      try { ts.unsubscribeVisibleLogicalRangeChange?.(onLogicalRange); } catch {}
      try { ts.unsubscribeVisibleTimeRangeChange?.(onVisibleTimeRange); } catch {}
      try { ro.disconnect(); } catch {}
      window.removeEventListener("resize", onWinResize);
      try { cnv.remove(); } catch {}
    },
  };
}
