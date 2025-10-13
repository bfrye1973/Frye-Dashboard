// src/components/overlays/SwingLiquidityOverlay.js
// STEP 2 — Baseline bands + pan/zoom redraw (inert, LEFT-EXTENDED)
// - Draw latest 2 swing highs + 2 swing lows
// - Bands now run from LEFT EDGE → pivot time (so they cover all candles to the left)
// - Tracks pan/zoom via timeScale subscriptions (only redraw — never sets zoom)
// - NO ResizeObserver, NO DPR scaling, NO fitContent, NO setVisibleRange

export default function createSwingLiquidityOverlay({ chart, priceSeries, chartContainer }) {
  if (!chart || !priceSeries || !chartContainer) {
    console.warn("[SwingLiquidity] missing args");
    return { seed() {}, update() {}, destroy() {} };
  }

  // Tunables
  const LOOKBACK = 600;
  const L = 10, R = 10;
  const BAND_BPS = 8;        // half-band width (0.08% of last close)
  const FILL_ALPHA = 0.22;
  const STROKE_W = 2;
  const FONT = "11px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  const COL_SUP = "#ff4d4f";
  const COL_DEM = "#22c55e";

  // State
  let bars = [];           // ascending [{time, open, high, low, close, volume}]
  let bands = [];          // [{ side:"SUP"|"DEM", pLo, pHi, tPivot }]
  let rafId = null;        // rAF throttle for redraw
  const ts = chart.timeScale();

  // Helpers
  const toSec = (t) => (t > 1e12 ? Math.floor(t / 1000) : t);
  const xFor = (tSec) => {
    const x = ts.timeToCoordinate(tSec);
    return Number.isFinite(x) ? x : null;
  };
  const yFor = (p) => {
    const y = priceSeries.priceToCoordinate(Number(p));
    return Number.isFinite(y) ? y : null;
  };

  const isSwingHigh = (arr, i) => {
    const v = arr[i].high;
    for (let j = i - L; j <= i + R; j++) {
      if (j === i || j < 0 || j >= arr.length) continue;
      if (arr[j].high > v) return false;
    }
    return true;
  };
  const isSwingLow = (arr, i) => {
    const v = arr[i].low;
    for (let j = i - L; j <= i + R; j++) {
      if (j === i || j < 0 || j >= arr.length) continue;
      if (arr[j].low < v) return false;
    }
    return true;
  };

  function rebuildBands() {
    bands = [];
    if (!bars.length) return;

    const start = Math.max(0, bars.length - LOOKBACK);
    const scan = bars.slice(start);
    if (!scan.length) return;

    const lastClose = scan.at(-1).close || 0;
    const half = (BAND_BPS / 10000) * (lastClose || 1);

    const highs = [];
    const lows  = [];
    for (let i = L; i < scan.length - R; i++) {
      const g = start + i;
      const b = bars[g];
      if (isSwingHigh(bars, g)) highs.push({ p: b.high, t: toSec(b.time) });
      if (isSwingLow (bars, g)) lows .push({ p: b.low,  t: toSec(b.time) });
    }

    highs.sort((a,b)=>b.t-a.t);
    lows .sort((a,b)=>b.t-a.t);

    const take = (arr, side, max=2) => {
      const out = [];
      const used = [];
      for (const z of arr) {
        if (out.length >= max) break;
        if (used.some(u => Math.abs(u - z.p) <= half * 0.75)) continue;
        used.push(z.p);
        out.push({ side, pLo: z.p - half, pHi: z.p + half, tPivot: z.t });
      }
      return out;
    };

    bands = [
      ...take(highs, "SUP", 2),
      ...take(lows , "DEM", 2),
    ];
  }

  function doDraw() {
    // Size canvas each draw to match container (no observers, no DPR scaling)
    const w = chartContainer.clientWidth  || 1;
    const h = chartContainer.clientHeight || 1;

    let cnv = chartContainer.querySelector("canvas.overlay-canvas.swing-liquidity");
    if (!cnv) {
      cnv = document.createElement("canvas");
      cnv.className = "overlay-canvas swing-liquidity";
      Object.assign(cnv.style, {
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 10,
      });
      chartContainer.appendChild(cnv);
    }
    cnv.width = Math.max(1, w);
    cnv.height = Math.max(1, h);

    const ctx = cnv.getContext("2d");
    ctx.clearRect(0, 0, w, h);
    ctx.font = FONT;

    if (!bands.length || bars.length < 2) return;

    // LEFT edge of viewport/container
    const xLeftEdge = 0;

    for (const bd of bands) {
      const yTop = yFor(bd.pHi);
      const yBot = yFor(bd.pLo);
      const xPivot = xFor(bd.tPivot);
      if (yTop == null || yBot == null || xPivot == null) continue;

      const color = bd.side === "SUP" ? COL_SUP : COL_DEM;
      const yMin = Math.min(yTop, yBot);
      const yMax = Math.max(yTop, yBot);
      const rectX = Math.min(xLeftEdge, xPivot);           // ensure positive width even if pivot is left of 0
      const rectW = Math.max(1, Math.abs(xPivot - xLeftEdge));
      const rectH = Math.max(2, yMax - yMin);

      ctx.globalAlpha = FILL_ALPHA;
      ctx.fillStyle = color;
      ctx.fillRect(rectX, yMin, rectW, rectH);

      ctx.globalAlpha = 1;
      ctx.lineWidth = STROKE_W;
      ctx.strokeStyle = color;
      ctx.strokeRect(rectX + 0.5, yMin + 0.5, rectW - 1, rectH - 1);
    }
  }

  // rAF throttle so pan/zoom redraws don’t spam
  function scheduleDraw() {
    if (rafId != null) return;
    rafId = requestAnimationFrame(() => {
      rafId = null;
      doDraw();
    });
  }

  // Subscriptions (read-only redraw)
  const onLogical = () => scheduleDraw();
  const onVisible = () => scheduleDraw();

  ts.subscribeVisibleLogicalRangeChange?.(onLogical);
  ts.subscribeVisibleTimeRangeChange?.(onVisible);
  window.addEventListener("resize", scheduleDraw);

  // API
  return {
    seed(rawBarsAsc) {
      bars = (rawBarsAsc || [])
        .map(b => ({ ...b, time: toSec(b.time) }))
        .sort((a,b)=>a.time - b.time);
      rebuildBands();
      doDraw();
    },
    update(latest) {
      if (!latest) return;
      const t = toSec(latest.time);
      const last = bars.at(-1);
      if (!last || t > last.time) {
        bars.push({ ...latest, time: t });
      } else if (t === last.time) {
        bars[bars.length - 1] = { ...latest, time: t };
      } else {
        return; // out-of-order ignored
      }
      rebuildBands();
      doDraw();
    },
    destroy() {
      try { ts.unsubscribeVisibleLogicalRangeChange?.(onLogical); } catch {}
      try { ts.unsubscribeVisibleTimeRangeChange?.(onVisible); } catch {}
      window.removeEventListener("resize", scheduleDraw);
      // canvas removed by RowChart cleanup
    },
  };
}
