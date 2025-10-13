// src/components/overlays/SwingLiquidityOverlay.js
// Swing Liquidity — SAFE MODE (left-extended bands)
// Implements 1–5:
// 1) Bands extend RIGHT → LEFT (historical) from the pivot
// 2) Volume/anchor tag on the LEFT edge
// 3) Labels on the LEFT
// 4) Redraws on pan/zoom/resize (DPR-aware)
// 5) Simple historical render (no "broken" fade)
//
// Shows the most-recent 2 swing highs + 2 swing lows.

export default function createSwingLiquidityOverlay({ chart, priceSeries, chartContainer }) {
  if (!chart || !priceSeries || !chartContainer) {
    console.warn("[SwingLiquidity] missing args");
    return { seed() {}, update() {}, destroy() {} };
  }

  // ---------- Tunables ----------
  const LOOKBACK_BARS = 600;
  const L = 10, R = 10;       // pivot tightness
  const MAX_PER_SIDE = 2;     // 2 highs + 2 lows
  const BAND_BPS = 8;         // band half-width in bps (0.08%); total ~16 bps
  const FILL_ALPHA = 0.22;    // band opacity
  const STROKE_W = 2;         // outline thickness
  const TAG_W = 10;           // left-edge tag width
  const TAG_MIN_H = 4;        // min tag height (px)
  const FONT = "11px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  const COL_SUP = "#ff4d4f";  // supply (red)
  const COL_DEM = "#22c55e";  // demand (green)
  const COL_EDGE = "#0b0f17";

  // ---------- Canvas ----------
  const cnv = document.createElement("canvas");
  Object.assign(cnv.style, { position: "absolute", inset: 0, pointerEvents: "none", zIndex: 10 });
  cnv.className = "overlay-canvas swing-liquidity";
  chartContainer.appendChild(cnv);
  const ctx = cnv.getContext("2d");

  const resizeCanvas = () => {
    const r = chartContainer.getBoundingClientRect();
    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    cnv.width  = Math.max(1, Math.floor(r.width  * dpr));
    cnv.height = Math.max(1, Math.floor(r.height * dpr));
    cnv.style.width  = r.width + "px";
    cnv.style.height = r.height + "px";
    ctx.setTransform(1,0,0,1,0,0);
    ctx.scale(dpr, dpr);
  };
  const ro = new ResizeObserver(resizeCanvas);
  ro.observe(chartContainer);
  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();

  const ts = chart.timeScale();
  const onRange = () => draw();
  ts.subscribeVisibleLogicalRangeChange?.(onRange);
  ts.subscribeVisibleTimeRangeChange?.(onRange);

  // ---------- State ----------
  let barsAsc = []; // ascending [{time, open, high, low, close, volume}]
  let bands = [];   // [{side:"SUP"|"DEM", pLo, pHi, i0, t0, volSum}]

  const toSec = (t) => (t > 1e12 ? Math.floor(t/1000) : t);
  const xFor  = (tSec) => { const x = ts.timeToCoordinate(tSec); return Number.isFinite(x) ? x : null; };
  const yFor  = (p) => { const y = priceSeries.priceToCoordinate(Number(p)); return Number.isFinite(y) ? y : null; };

  const isSwingHigh = (arr, i, L, R) => {
    const v = arr[i].high;
    for (let j=i-L; j<=i+R; j++) { if (j===i || j<0 || j>=arr.length) continue; if (arr[j].high > v) return false; }
    return true;
  };
  const isSwingLow = (arr, i, L, R) => {
    const v = arr[i].low;
    for (let j=i-L; j<=i+R; j++) { if (j===i || j<0 || j>=arr.length) continue; if (arr[j].low < v) return false; }
    return true;
  };

  function rebuildBands() {
    bands = [];
    if (!barsAsc.length) return;

    const startIdx = Math.max(0, barsAsc.length - LOOKBACK_BARS);
    const scan = barsAsc.slice(startIdx);
    if (!scan.length) return;

    const lastP = scan.at(-1).close || 0;
    const halfBand = (BAND_BPS/10000) * (lastP || 1);

    const highs = [];
    const lows  = [];
    for (let i=L; i<scan.length-R; i++) {
      const g = startIdx + i;
      const b = scan[i];
      if (isSwingHigh(scan, i, L, R)) highs.push({ price:b.high, i0:g, t0:toSec(b.time) });
      if (isSwingLow (scan, i, L, R)) lows .push({ price:b.low,  i0:g, t0:toSec(b.time) });
    }
    // Most recent first
    highs.sort((a,b)=>b.i0-a.i0);
    lows.sort((a,b)=>b.i0-a.i0);

    const pick = (arr, side) => {
      const out = [];
      const used = [];
      for (const z of arr) {
        if (out.length >= MAX_PER_SIDE) break;
        // avoid near-duplicates (within ~half-band)
        if (used.some(u => Math.abs(u - z.price) <= halfBand*0.75)) continue;
        used.push(z.price);

        // accumulate simple volume from the left-extended region
        // (leftwards from pivot to the earliest bar)
        let volSum = 0;
        for (let k=0; k<=z.i0; k++) volSum += Number(barsAsc[k].volume||0);

        const pMid = z.price;
        out.push({
          side,
          pLo: pMid - halfBand,
          pHi: pMid + halfBand,
          i0: z.i0,
          t0: z.t0,
          volSum
        });
      }
      return out;
    };

    bands = [
      ...pick(highs, "SUP"),
      ...pick(lows,  "DEM"),
    ];
  }

  function onBar(latest) {
    const t = toSec(latest.time);
    const last = barsAsc.at(-1);
    if (!last || t > last.time) barsAsc.push({ ...latest, time:t });
    else if (t === last.time)   barsAsc[barsAsc.length-1] = { ...latest, time:t };
    else return;

    if (barsAsc.length % 5 === 0) rebuildBands();
  }

  function draw() {
    const r = chartContainer.getBoundingClientRect();
    ctx.clearRect(0,0,r.width,r.height);
    if (!bands.length) return;

    ctx.font = FONT;

    for (const bd of bands) {
      const yTop = yFor(bd.pHi), yBot = yFor(bd.pLo);
      if (yTop == null || yBot == null) continue;

      // Pivot X (right side of the band), and LEFT edge is the viewport's left
      const xPivot = xFor(barsAsc[Math.max(0, bd.i0)].time);
      if (xPivot == null) continue;

      const xLeft = 6; // small left padding, extends fully to the left

      const color = bd.side==="SUP" ? COL_SUP : COL_DEM;
      const yMin = Math.min(yTop, yBot), yMax = Math.max(yTop, yBot);
      const h = Math.max(2, yMax - yMin);

      // fill band (extend LEFT from pivot)
      ctx.globalAlpha = FILL_ALPHA;
      ctx.fillStyle = color;
      ctx.fillRect(xLeft, yMin, Math.max(1, xPivot - xLeft), h);

      // outline
      ctx.globalAlpha = 1;
      ctx.lineWidth = STROKE_W;
      ctx.strokeStyle = color;
      ctx.strokeRect(xLeft + 0.5, yMin + 0.5, Math.max(1, xPivot - xLeft) - 1, h - 1);

      // left-edge volume/anchor tag (height proportional to volSum)
      const volScaleH = Math.max(0.12 * r.height, 10); // simple proportional visual
      const tagH = Math.max(TAG_MIN_H, Math.min(h, Math.sqrt(bd.volSum) % volScaleH)); // bounded visual proxy
      const tagX = xLeft;
      const tagY = Math.max(2, Math.min(r.height - tagH - 2, yMin + (h - tagH)/2));
      ctx.fillStyle = color;
      ctx.fillRect(tagX, tagY, TAG_W, tagH);
      ctx.strokeStyle = COL_EDGE; ctx.lineWidth = 1;
      ctx.strokeRect(tagX + 0.5, tagY + 0.5, TAG_W - 1, tagH - 1);

      // LEFT label (price band)
      const lbl = `${fmt(bd.pLo)}–${fmt(bd.pHi)}`;
      ctx.fillStyle = color;
      ctx.fillText(lbl, xLeft + TAG_W + 6, yMin - 4);
    }
  }

  const fmt = (p) => (p >= 100 ? p.toFixed(2) : p >= 10 ? p.toFixed(3) : p.toFixed(4));

  // ---------- API ----------
  return {
    seed(bars) {
      barsAsc = (bars || []).map(b => ({ ...b, time: toSec(b.time) }));
      rebuildBands();
      draw();
    },
    update(latest) {
      if (!latest) return;
      onBar(latest);
      draw();
    },
    destroy() {
      try { ts.unsubscribeVisibleLogicalRangeChange?.(onRange); } catch {}
      try { ts.unsubscribeVisibleTimeRangeChange?.(onRange); } catch {}
      try { ro.disconnect(); } catch {}
      window.removeEventListener("resize", resizeCanvas);
      try { cnv.remove(); } catch {}
    },
  };
}
