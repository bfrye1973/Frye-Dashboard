// src/components/overlays/SwingLiquidityOverlay.js
// STEP 1 — Baseline (inert, guaranteed visible)
// - Draw the most-recent 2 swing highs + 2 swing lows as shaded bands
// - Bands run from the pivot bar → latest bar (left → right)
// - NO observers, NO DPR scaling, NO timeScale subscriptions, NO zoom/fit calls
// - Pure paint layer; won’t affect chart zoom/scale at all.

export default function createSwingLiquidityOverlay({ chart, priceSeries, chartContainer }) {
  if (!chart || !priceSeries || !chartContainer) {
    console.warn("[SwingLiquidity] missing args");
    return { seed() {}, update() {}, destroy() {} };
  }

  // Tunables (tiny)
  const LOOKBACK = 600;      // scan last N bars
  const L = 10, R = 10;      // pivot tightness
  const BAND_BPS = 8;        // half-band width (0.08% of last price)
  const FILL_ALPHA = 0.22;
  const STROKE_W = 2;
  const FONT = "11px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  const COL_SUP = "#ff4d4f";
  const COL_DEM = "#22c55e";

  // Simple state
  let bars = [];             // ascending [{time, open, high, low, close, volume}]
  let bands = [];            // [{ side:"SUP"|"DEM", pLo, pHi, tPivot }]

  // Helpers
  const toSec = (t) => (t > 1e12 ? Math.floor(t / 1000) : t);
  const xFor = (tSec) => {
    const x = chart.timeScale().timeToCoordinate(tSec);
    return Number.isFinite(x) ? x : null;
  };
  const yFor = (p) => {
    const y = priceSeries.priceToCoordinate(Number(p));
    return Number.isFinite(y) ? y : null;
  };

  // Pivot tests (high/low)
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

  // Build latest 2 highs + 2 lows → bands
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

    // Most-recent first; avoid near-duplicates
    highs.sort((a,b)=>b.t-a.t);
    lows.sort ((a,b)=>b.t-a.t);

    const take = (arr, side, max=2) => {
      const out = [];
      const used = [];
      for (const z of arr) {
        if (out.length >= max) break;
        if (used.some(u => Math.abs(u - z.p) <= half * 0.75)) continue;
        used.push(z.p);
        out.push({
          side,
          pLo: z.p - half,
          pHi: z.p + half,
          tPivot: z.t,
        });
      }
      return out;
    };

    bands = [
      ...take(highs, "SUP", 2),
      ...take(lows,  "DEM", 2),
    ];
  }

  // One-shot draw (inert)
  function draw() {
    // Size canvas ONCE using current container dims (no observers)
    const w = chartContainer.clientWidth || 1;
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

    const tLatest = toSec(bars.at(-1).time);
    const xEnd = xFor(tLatest);
    if (xEnd == null) return;

    for (const bd of bands) {
      const yTop = yFor(bd.pHi);
      const yBot = yFor(bd.pLo);
      const xPivot = xFor(bd.tPivot);
      if (yTop == null || yBot == null || xPivot == null) continue;

      const color = bd.side === "SUP" ? COL_SUP : COL_DEM;
      const yMin = Math.min(yTop, yBot);
      const yMax = Math.max(yTop, yBot);
      const rectW = Math.max(1, xEnd - xPivot);
      const rectH = Math.max(2, yMax - yMin);

      // band fill
      ctx.globalAlpha = FILL_ALPHA;
      ctx.fillStyle = color;
      ctx.fillRect(xPivot, yMin, rectW, rectH);

      // outline
      ctx.globalAlpha = 1;
      ctx.lineWidth = STROKE_W;
      ctx.strokeStyle = color;
      ctx.strokeRect(xPivot + 0.5, yMin + 0.5, rectW - 1, rectH - 1);
    }
  }

  // API (inert)
  return {
    seed(rawBarsAsc) {
      bars = (rawBarsAsc || [])
        .map(b => ({ ...b, time: toSec(b.time) }))
        .sort((a,b)=>a.time - b.time);
      rebuildBands();
      draw();
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
        // out-of-order → ignore
        return;
      }
      rebuildBands();
      draw();
    },
    destroy() {
      // keep it simple; canvas will be removed by RowChart cleanup
    },
  };
}
