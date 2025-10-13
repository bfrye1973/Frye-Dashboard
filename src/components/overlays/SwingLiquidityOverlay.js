// src/components/overlays/SwingLiquidityOverlay.js
// STEP 3 — Baseline pivot bands + 1-hour TEST consolidation band (inert)
// - Keeps latest 2 swing highs + 2 swing lows (left-extended bands)
// - Adds ONE neutral 1h consolidation band (tightest 16–24h window in ~30 days)
// - Redraws on pan/zoom (read-only). No observers, no DPR scaling, no zoom changes.

export default function createSwingLiquidityOverlay({ chart, priceSeries, chartContainer }) {
  if (!chart || !priceSeries || !chartContainer) {
    console.warn("[SwingLiquidity] missing args");
    return { seed() {}, update() {}, destroy() {} };
  }

  /* ---------- Tunables ---------- */
  // Baseline pivots
  const LOOKBACK = 600;
  const L = 10, R = 10;
  const BAND_BPS = 8;            // half-band width (0.08% of last close)
  // 1h test window
  const TEST_LOOKBACK_HOURS = 24 * 30;   // ~30 days
  const BOX_MIN_HRS = 16;                // min 16 bars (1h)
  const BOX_MAX_HRS = 24;                // max 24 bars (1h)
  const BOX_BPS_LIMIT = 35;              // accept windows with total range <= 0.35% (loose for test)

  // Drawing
  const FILL_ALPHA = 0.22;
  const TEST_ALPHA = 0.16;
  const STROKE_W = 2;
  const FONT = "11px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  const COL_SUP = "#ff4d4f";
  const COL_DEM = "#22c55e";
  const COL_TEST = "#3b82f6";    // neutral test band (blue)

  /* ---------- State ---------- */
  let bars = [];                // ascending raw bars [{time, open, high, low, close, volume}]
  let bands = [];               // pivot bands [{ side:"SUP"|"DEM", pLo, pHi, tPivot }]
  let testBox = null;           // {tStart, tEnd, pLo, pHi} or null
  let rafId = null;
  const ts = chart.timeScale();

  /* ---------- Helpers ---------- */
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

  /* ---------- Baseline pivot bands (unchanged from Step-2) ---------- */
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

  /* ---------- 1-hour resample (read-only) ---------- */
  function resampleTo1h(barsAsc) {
    if (!barsAsc?.length) return [];
    const out = []; let cur = null;
    for (const b of barsAsc) {
      const t = toSec(b.time);
      const bucket = Math.floor(t / 3600) * 3600;
      if (!cur || bucket !== cur.time) {
        if (cur) out.push(cur);
        cur = { time: bucket, open: b.open, high: b.high, low: b.low, close: b.close, volume: Number(b.volume||0) };
      } else {
        cur.high   = Math.max(cur.high, b.high);
        cur.low    = Math.min(cur.low , b.low );
        cur.close  = b.close;
        cur.volume = Number(cur.volume||0) + Number(b.volume||0);
      }
    }
    if (cur) out.push(cur);
    return out.slice(-TEST_LOOKBACK_HOURS); // 1 bar = 1 hour
  }

  /* ---------- Find ONE tight 1-hour window (16–24h) ---------- */
  function rebuildTestBox() {
    testBox = null;
    const b1h = resampleTo1h(bars);
    if (b1h.length < BOX_MIN_HRS) return;

    // Slide window lengths from min..max, keep the tightest total range
    let best = null; // {iStart, iEnd, pLo, pHi, bps}
    const n = b1h.length;

    for (let span = BOX_MIN_HRS; span <= BOX_MAX_HRS; span++) {
      for (let i = 0; i + span <= n; i++) {
        const j = i + span - 1;
        let lo = +Infinity, hi = -Infinity;
        for (let k = i; k <= j; k++) { lo = Math.min(lo, b1h[k].low); hi = Math.max(hi, b1h[k].high); }
        const mid = (lo + hi) / 2;
        const bps = ((hi - lo) / Math.max(1e-6, mid)) * 10000;
        if (bps > BOX_BPS_LIMIT) continue; // too wide for a "test" box

        if (!best || bps < best.bps) {
          best = { iStart: i, iEnd: j, pLo: lo, pHi: hi, bps };
        }
      }
    }

    if (!best) return;
    testBox = {
      tStart: b1h[best.iStart].time,
      tEnd:   b1h[best.iEnd  ].time,
      pLo:    best.pLo,
      pHi:    best.pHi,
    };
  }

  /* ---------- Draw ---------- */
  function doDraw() {
    const w = chartContainer.clientWidth  || 1;
    const h = chartContainer.clientHeight || 1;

    let cnv = chartContainer.querySelector("canvas.overlay-canvas.swing-liquidity");
    if (!cnv) {
      cnv = document.createElement("canvas");
      cnv.className = "overlay-canvas swing-liquidity";
      Object.assign(cnv.style, { position: "absolute", inset: 0, pointerEvents: "none", zIndex: 10 });
      chartContainer.appendChild(cnv);
    }
    cnv.width = Math.max(1, w);
    cnv.height = Math.max(1, h);

    const ctx = cnv.getContext("2d");
    ctx.clearRect(0, 0, w, h);
    ctx.font = FONT;

    // 1) pivot bands (left edge → pivot)
    for (const bd of bands) {
      const yTop = yFor(bd.pHi), yBot = yFor(bd.pLo), xPivot = xFor(bd.tPivot);
      if (yTop == null || yBot == null || xPivot == null) continue;
      const color = bd.side === "SUP" ? COL_SUP : COL_DEM;
      const yMin = Math.min(yTop, yBot), yMax = Math.max(yTop, yBot);
      const rectX = 0, rectW = Math.max(1, xPivot - rectX), rectH = Math.max(2, yMax - yMin);
      ctx.globalAlpha = FILL_ALPHA; ctx.fillStyle = color; ctx.fillRect(rectX, yMin, rectW, rectH);
      ctx.globalAlpha = 1; ctx.lineWidth = STROKE_W; ctx.strokeStyle = color;
      ctx.strokeRect(rectX + 0.5, yMin + 0.5, rectW - 1, rectH - 1);
    }

    // 2) 1h test band (one neutral box)
    if (testBox) {
      const yTop = yFor(testBox.pHi), yBot = yFor(testBox.pLo);
      const xS = xFor(testBox.tStart), xE = xFor(testBox.tEnd);
      if (yTop != null && yBot != null && xS != null && xE != null) {
        const yMin = Math.min(yTop, yBot), yMax = Math.max(yTop, yBot);
        const rectH = Math.max(2, yMax - yMin);
        const xLeft = Math.min(xS, xE), xRight = Math.max(xS, xE);
        ctx.globalAlpha = TEST_ALPHA; ctx.fillStyle = COL_TEST;
        ctx.fillRect(xLeft, yMin, Math.max(1, xRight - xLeft), rectH);
        ctx.globalAlpha = 1; ctx.lineWidth = STROKE_W; ctx.strokeStyle = COL_TEST;
        ctx.strokeRect(xLeft + 0.5, yMin + 0.5, Math.max(1, xRight - xLeft) - 1, rectH - 1);
      }
    }
  }

  function scheduleDraw() {
    if (rafId != null) return;
    rafId = requestAnimationFrame(() => { rafId = null; doDraw(); });
  }

  // Pan/zoom redraw only (read-only)
  const onLogical = () => scheduleDraw();
  const onVisible = () => scheduleDraw();
  ts.subscribeVisibleLogicalRangeChange?.(onLogical);
  ts.subscribeVisibleTimeRangeChange?.(onVisible);
  window.addEventListener("resize", scheduleDraw);

  /* ---------- API ---------- */
  return {
    seed(rawBarsAsc) {
      bars = (rawBarsAsc||[]).map(b => ({ ...b, time: toSec(b.time) })).sort((a,b)=>a.time-b.time);
      rebuildBands();
      rebuildTestBox();   // add one neutral 1h box
      doDraw();
    },
    update(latest) {
      if (!latest) return;
      const t = toSec(latest.time);
      const last = bars.at(-1);
      if (!last || t > last.time) bars.push({ ...latest, time: t });
      else if (t === last.time)   bars[bars.length - 1] = { ...latest, time: t };
      else return;
      rebuildBands();
      // Rebuild 1h box occasionally (every 3 updates keeps cost low)
      if (bars.length % 3 === 0) rebuildTestBox();
      doDraw();
    },
    destroy() {
      try { ts.unsubscribeVisibleLogicalRangeChange?.(onLogical); } catch {}
      try { ts.unsubscribeVisibleTimeRangeChange?.(onVisible); } catch {}
      window.removeEventListener("resize", scheduleDraw);
      // canvas removed by RowChart
    },
  };
}
