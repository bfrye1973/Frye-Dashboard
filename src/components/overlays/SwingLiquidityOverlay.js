// src/components/overlays/SwingLiquidityOverlay.js
// Swing Liquidity (pivot highs/lows) — Lightweight-Charts overlay
// - Price-pane canvas overlay (absolute, z-index:10)
// - Uses chart.timeScale().timeToCoordinate(time) for X
// - Uses priceSeries.priceToCoordinate(price) for Y
// - DPR-aware resize; safe attach/seed/update/destroy lifecycle

export default function SwingLiquidityOverlay({ chart, priceSeries, chartContainer, timeframe }) {
  // ====== Guards ======
  if (!chart || !priceSeries || !chartContainer) {
    console.warn("[SwingLiquidity] missing { chart, priceSeries, chartContainer }");
    return { seed() {}, update() {}, destroy() {} };
  }

  // ====== Tunables (feel free to tweak) ======
  const LEFT = 10;           // bars left for pivot check
  const RIGHT = 10;          // bars right for pivot check
  const MAX_DRAW_BARS = 800; // lookback window for drawing
  const TICK = 6;            // half-length of small tick marks (px)
  const FONT = "11px system-ui, -apple-system, Segoe UI, Roboto, Arial";

  // Colors
  const COL_H = "#ff4d4f";   // swing high (red)
  const COL_L = "#22c55e";   // swing low (green");

  // ====== Canvas setup (absolute overlay) ======
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

  // DPR resize
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

  // ====== Data cache ======
  let barsCache = []; // [{time, open, high, low, close, volume}, ...] ascending by time

  // ====== Helpers ======
  const yFor = (price) => {
    const y = priceSeries.priceToCoordinate(Number(price));
    return Number.isFinite(y) ? y : null;
  };
  const xFor = (timeSec) => {
    const x = chart.timeScale().timeToCoordinate(timeSec);
    return Number.isFinite(x) ? x : null;
  };

  // pivot detection
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

  // find visible range (time -> x) for quick culling
  const getVisibleTimeBounds = () => {
    const ts = chart.timeScale();
    try {
      const logical = ts.getVisibleLogicalRange?.();
      if (!logical) return null;
      const leftTime = ts.coordinateToTime(ts.logicalToCoordinate(logical.from));
      const rightTime = ts.coordinateToTime(ts.logicalToCoordinate(logical.to));
      const l = typeof leftTime === "object" ? leftTime.timestamp ?? leftTime.time : leftTime;
      const r = typeof rightTime === "object" ? rightTime.timestamp ?? rightTime.time : rightTime;
      if (!Number.isFinite(l) || !Number.isFinite(r)) return null;
      return { l: l|0, r: r|0 };
    } catch {
      return null;
    }
  };

  // draw all swings in window
  const draw = () => {
    const rect = chartContainer.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    if (!barsCache?.length) return;

    // Choose bars to scan (last MAX_DRAW_BARS to stay light)
    const startIdx = Math.max(0, barsCache.length - MAX_DRAW_BARS);
    const scan = barsCache.slice(startIdx);

    // Optional: use visible time bounds to skip offscreen swings
    const vis = getVisibleTimeBounds();

    ctx.lineWidth = 1;
    ctx.font = FONT;
    ctx.textAlign = "center";

    for (let i = LEFT; i < scan.length - RIGHT; i++) {
      const b = scan[i];
      const time = b.time; // epoch seconds

      if (vis && (time < vis.l || time > vis.r)) continue; // skip offscreen by time

      // Compute coordinates
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

  // ====== Lifecycle ======
  console.log("[SwingLiquidity] ATTACH");

  return {
    seed(bars) {
      // Expect ascending time; coerce ms -> s if needed
      barsCache = (bars || []).map(b => ({
        ...b,
        time: b.time > 1e12 ? Math.floor(b.time / 1000) : b.time,
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
        // out-of-order; ignore
        return;
      }
      draw();
    },
    destroy() {
      try { ro.disconnect(); } catch {}
      window.removeEventListener("resize", onWinResize);
      try { cnv.remove(); } catch {}
      // console.log("[SwingLiquidity] DESTROY");
    },
  };
}
