// src/components/overlays/SwingLiquidityOverlay.js
// 1h Consolidation Liquidity (Major Shelves)
// - Internally resamples to 1-hour bars
// - Detects consolidation boxes (tight range for N hours)
// - Measures bottom/top-wick touches, dwell, and volume inside each box
// - Scores and draws Top-1 demand + Top-1 supply
// - Band spans the consolidation interval (left→right), volume tag at RIGHT edge
// - Redraws on pan/zoom/resize; DPR-aware; bounded and fast

export default function createSwingLiquidityOverlay({ chart, priceSeries, chartContainer }) {
  if (!chart || !priceSeries || !chartContainer) {
    console.warn("[SwingLiquidity] missing args");
    return { seed() {}, update() {}, destroy() {} };
  }

  // ================= Tunables (safe defaults) =================
  const LOOKBACK_HOURS   = 24 * 30;      // ~30 trading days in hours (cap)
  const BOX_MIN_HRS      = 16;           // consolidation min hours
  const BOX_MAX_HRS      = 24;           // consolidation max hours (upper bound per box)
  const BOX_BPS          = 25;           // box total range threshold in bps (0.25%)
  const BUCKET_BPS       = 5;            // wick bucket width (0.05%)
  const MERGE_BPS        = 10;           // merge adjacent buckets inside box (0.10%)
  const MIN_TOUCHES      = 5;            // minimum wick touches at an edge
  const MIN_RETESTS      = 2;            // distinct wick clusters (gap ≥ 2 bars)
  const MIN_DWELL_HRS    = 8;            // bars whose body sat inside the box
  const TOP_K_PER_SIDE   = 1;            // show top 1 per side (clean)
  // score weights (sum~1)
  const W_VOL = 0.45, W_TCH = 0.30, W_RTS = 0.15, W_REC = 0.10;

  // Drawing
  const FILL_ALPHA       = 0.22;
  const STROKE_W         = 2;
  const TAG_W            = 12;
  const TAG_MIN_H        = 4;
  const FONT             = "11px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  const COL_SUP          = "#ff4d4f";  // supply
  const COL_DEM          = "#22c55e";  // demand
  const COL_EDGE         = "#0b0f17";

  // ================= Canvas setup =================
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
    ctx.setTransform(1, 0, 0, 1, 0, 0);
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

  // ================= State =================
  let bars1h = [];  // 1h bars [{time, open, high, low, close, volume}]
  let zones  = [];  // shelves drawn: [{side:"SUP"|"DEM", tStart, tEnd, pLo, pHi, vol, touches, retests, score}]
  let volMaxForScale = 1;

  // ================= Utilities =================
  const toSec = (t) => (t > 1e12 ? Math.floor(t/1000) : t);

  // resample incoming bars to 1h, aligned to bucket start (time % 3600 == 0)
  function resampleTo1h(barsAscAnyTf) {
    if (!barsAscAnyTf?.length) return [];
    const out = [];
    let cur = null;
    for (const b of barsAscAnyTf) {
      const t = toSec(b.time);
      const bucket = Math.floor(t / 3600) * 3600;
      if (!cur || bucket !== cur.time) {
        if (cur) out.push(cur);
        cur = { time: bucket, open: b.open, high: b.high, low: b.low, close: b.close, volume: Number(b.volume||0) };
      } else {
        cur.high   = Math.max(cur.high, b.high);
        cur.low    = Math.min(cur.low,  b.low);
        cur.close  = b.close;
        cur.volume = Number(cur.volume||0) + Number(b.volume||0);
      }
    }
    if (cur) out.push(cur);
    // clamp lookback
    const maxBars = LOOKBACK_HOURS; // 1h bars → hours
    return out.slice(-maxBars);
  }

  function quant(val, step) {
    return Math.floor(val / step) * step;
  }

  // find consolidated boxes with streaming min/max and span control
  function detectBoxes(b1h) {
    const boxes = []; // {iStart, iEnd, pLo, pHi}
    if (b1h.length < BOX_MIN_HRS) return boxes;

    let iStart = 0;
    let pLo = b1h[0].low, pHi = b1h[0].high;

    const within = (lo, hi, mid) => {
      const range = hi - lo;
      const bps = (range / Math.max(1e-6, mid)) * 10000;
      return bps <= BOX_BPS;
    };

    for (let i = 1; i < b1h.length; i++) {
      pLo = Math.min(pLo, b1h[i].low);
      pHi = Math.max(pHi, b1h[i].high);

      const mid = (pLo + pHi) / 2;
      const span = i - iStart + 1;

      // if span too wide or range too big → close previous if valid
      if (!within(pLo, pHi, mid) || span > BOX_MAX_HRS) {
        if (span-1 >= BOX_MIN_HRS) {
          // finalize previous [iStart, i-1]
          const jEnd = i - 1;
          const lo = Math.min(...b1h.slice(iStart, jEnd+1).map(x=>x.low));
          const hi = Math.max(...b1h.slice(iStart, jEnd+1).map(x=>x.high));
          boxes.push({ iStart, iEnd: jEnd, pLo: lo, pHi: hi });
        }
        // start new box at current bar
        iStart = i;
        pLo = b1h[i].low; pHi = b1h[i].high;
      }
    }

    // close tail
    const finalSpan = b1h.length - iStart;
    if (finalSpan >= BOX_MIN_HRS) {
      const lo = Math.min(...b1h.slice(iStart).map(x=>x.low));
      const hi = Math.max(...b1h.slice(iStart).map(x=>x.high));
      boxes.push({ iStart, iEnd: b1h.length - 1, pLo: lo, pHi: hi });
    }
    return boxes;
  }

  // measure touches/dwell/volume inside a box and produce demand/supply candidates
  function measureBoxCandidates(b1h, box) {
    const { iStart, iEnd, pLo, pHi } = box;
    const seg = b1h.slice(iStart, iEnd + 1);
    if (!seg.length) return [];

    const lastClose = b1h.at(-1).close || seg.at(-1).close;
    const step = (BUCKET_BPS / 10000) * lastClose;
    const mergeStep = (MERGE_BPS / 10000) * lastClose;

    // Buckets at edges (bottom for demand, top for supply)
    const dem = new Map();
    const sup = new Map();

    const add = (map, key, fn) => {
      const o = map.get(key) || { touches:0, dwell:0, vol:0, hits:[] };
      fn(o); map.set(key, o);
    };

    // per-bar : wick touches & dwell
    for (let k = 0; k < seg.length; k++) {
      const b = seg[k];
      const lowKey  = quant(b.low,  step);
      const highKey = quant(b.high, step);

      // bottom wick = low below body
      if (b.low <= Math.min(b.open, b.close)) {
        add(dem, lowKey,  (o)=>{ o.touches++; o.hits.push(k); });
      }
      // top wick = high above body
      if (b.high >= Math.max(b.open, b.close)) {
        add(sup, highKey, (o)=>{ o.touches++; o.hits.push(k); });
      }

      // dwell & volume to body-overlap buckets near edges
      const bodyLo = Math.min(b.open, b.close);
      const bodyHi = Math.max(b.open, b.close);
      // Only count dwell near each edge band ± step
      if (bodyLo <= pLo + 2*step) {
        const kLo = quant(Math.min(bodyLo, pLo + 2*step), step);
        add(dem, kLo, (o)=>{ o.dwell++; o.vol += Number(b.volume||0); });
      }
      if (bodyHi >= pHi - 2*step) {
        const kHi = quant(Math.max(bodyHi, pHi - 2*step), step);
        add(sup, kHi, (o)=>{ o.dwell++; o.vol += Number(b.volume||0); });
      }
    }

    const mergeMap = (map, side) => {
      const keys = Array.from(map.keys()).sort((a,b)=>a-b);
      const out = [];
      let cur = null;
      for (const k of keys) {
        const bk = map.get(k);
        if (!cur) { cur = { side, keyLo:k, keyHi:k+step, touches:bk.touches, dwell:bk.dwell, vol:bk.vol, hits:bk.hits.slice() }; continue; }
        if (k - cur.keyHi <= mergeStep) {
          cur.keyHi += step; cur.touches += bk.touches; cur.dwell += bk.dwell; cur.vol += bk.vol; cur.hits.push(...bk.hits);
        } else { out.push(cur); cur = { side, keyLo:k, keyHi:k+step, touches:bk.touches, dwell:bk.dwell, vol:bk.vol, hits:bk.hits.slice() }; }
      }
      if (cur) out.push(cur);
      return out;
    };

    let demand = mergeMap(dem, "DEM");
    let supply = mergeMap(sup, "SUP");

    // retest clusters (gap ≥ 2 bars)
    const countRetests = (arr) => {
      if (!arr?.length) return 0;
      arr.sort((a,b)=>a-b);
      let clusters = 1; let last = arr[0];
      for (let i=1; i<arr.length; i++) if (arr[i] - last >= 2) { clusters++; last = arr[i]; }
      return clusters;
    };
    for (const z of demand) z.retests = countRetests(z.hits);
    for (const z of supply) z.retests = countRetests(z.hits);

    const filterKeep = (z) => z.touches >= MIN_TOUCHES && z.retests >= MIN_RETESTS && z.dwell >= MIN_DWELL_HRS;
    demand = demand.filter(filterKeep);
    supply = supply.filter(filterKeep);

    // score (per box) then pick top-1 per side from this box
    const scoreList = (list) => {
      if (!list.length) return;
      const maxVol = Math.max(...list.map(z=>z.vol), 1);
      for (const z of list) {
        const volN = z.vol / maxVol;
        const tchN = z.touches / Math.max(1, Math.max(...list.map(x=>x.touches)));
        const rtsN = z.retests / Math.max(1, Math.max(...list.map(x=>x.retests)));
        const recN = 1; // within-box ranking gives little benefit; keep simple
        z.score = W_VOL*volN + W_TCH*tchN + W_RTS*rtsN + W_REC*recN;
      }
      list.sort((a,b)=>b.score-a.score);
      return list[0]; // best in this box
    };

    const pickDem = scoreList(demand);
    const pickSup = scoreList(supply);
    const results = [];

    if (pickDem) {
      results.push({
        side: "DEM",
        pLo: pickDem.keyLo, pHi: pickDem.keyHi,
        tStart: b1h[iStart].time, tEnd: b1h[iEnd].time,
        touches: pickDem.touches, retests: pickDem.retests, vol: pickDem.vol, score: pickDem.score,
      });
    }
    if (pickSup) {
      results.push({
        side: "SUP",
        pLo: pickSup.keyLo, pHi: pickSup.keyHi,
        tStart: b1h[iStart].time, tEnd: b1h[iEnd].time,
        touches: pickSup.touches, retests: pickSup.retests, vol: pickSup.vol, score: pickSup.score,
      });
    }
    return results;
  }

  // build zones from 1h bars (bounded and fast)
  function buildZones1h() {
    zones = [];
    if (!bars1h.length) return;

    const boxes = detectBoxes(bars1h);
    if (!boxes.length) return;

    // Evaluate each box → candidates, keep top by score per side across all boxes
    let demAll = [], supAll = [];
    for (const box of boxes) {
      // enforce box span limit
      const span = box.iEnd - box.iStart + 1;
      if (span < BOX_MIN_HRS || span > BOX_MAX_HRS) continue;

      const picks = measureBoxCandidates(bars1h, box);
      for (const z of picks || []) {
        if (z.side === "DEM") demAll.push(z);
        else supAll.push(z);
      }
    }

    // Global ranking & Top-K per side
    const rankKeep = (arr) => {
      arr.sort((a,b)=>b.score-a.score);
      return arr.slice(0, TOP_K_PER_SIDE);
    };
    demAll = rankKeep(demAll);
    supAll = rankKeep(supAll);

    zones = [...demAll, ...supAll];

    // scale for tag height
    volMaxForScale = Math.max(1, ...zones.map(z=>z.vol));
  }

  // ================= Draw =================
  function draw() {
    const r = chartContainer.getBoundingClientRect();
    ctx.clearRect(0,0,r.width,r.height);
    if (!zones.length) return;

    ctx.font = FONT;
    for (const z of zones) {
      const yTop = priceSeries.priceToCoordinate(z.pHi);
      const yBot = priceSeries.priceToCoordinate(z.pLo);
      if (yTop == null || yBot == null) continue;

      const xStart = ts.timeToCoordinate(z.tStart);
      const xEnd   = ts.timeToCoordinate(z.tEnd); // RIGHT edge (pivot/exit)
      if (xStart == null || xEnd == null) continue;

      const color = z.side === "SUP" ? COL_SUP : COL_DEM;
      const yMin = Math.min(yTop, yBot), yMax = Math.max(yTop, yBot);
      const h = Math.max(2, yMax - yMin);

      // band fill + outline
      ctx.globalAlpha = FILL_ALPHA;
      ctx.fillStyle = color;
      ctx.fillRect(xStart, yMin, Math.max(1, xEnd - xStart), h);

      ctx.globalAlpha = 1;
      ctx.lineWidth = STROKE_W;
      ctx.strokeStyle = color;
      ctx.strokeRect(xStart + 0.5, yMin + 0.5, Math.max(1, xEnd - xStart) - 1, h - 1);

      // RIGHT-edge volume tag (true-size proportional to z.vol)
      const frac = Math.max(0, z.vol / volMaxForScale);
      const tagH = Math.max(TAG_MIN_H, Math.floor(r.height * 0.15 * frac));
      const tagX = Math.max(0, xEnd - TAG_W);
      const tagY = Math.max(2, Math.min(r.height - tagH - 2, (yMin + yMax)/2 - tagH/2));
      ctx.fillStyle = color;
      ctx.fillRect(tagX, tagY, TAG_W, tagH);
      ctx.strokeStyle = COL_EDGE; ctx.lineWidth = 1;
      ctx.strokeRect(tagX + 0.5, tagY + 0.5, TAG_W - 1, tagH - 1);

      // right-edge price label
      const lbl = `${fmt(z.pLo)}–${fmt(z.pHi)}`;
      ctx.fillStyle = color;
      ctx.fillText(lbl, xEnd + 6, yMin - 4);
    }
  }

  const fmt = (p) => (p >= 100 ? p.toFixed(2) : p >= 10 ? p.toFixed(3) : p.toFixed(4));

  // ================= API =================
  return {
    seed(barsAnyTf) {
      // resample to 1h (bounded)
      const asc = (barsAnyTf || []).map(b => ({ ...b, time: toSec(b.time) })).sort((a,b)=>a.time-b.time);
      bars1h = resampleTo1h(asc);
      buildZones1h();
      draw();
    },
    update(latest) {
      if (!latest) return;
      // resample incremental
      const t = toSec(latest.time);
      const bucket = Math.floor(t / 3600) * 3600;
      const last = bars1h.at(-1);
      if (!last || bucket > last.time) {
        // new 1h bar
        bars1h.push({ time: bucket, open: latest.open, high: latest.high, low: latest.low, close: latest.close, volume: Number(latest.volume||0) });
        if (bars1h.length > LOOKBACK_HOURS) bars1h = bars1h.slice(-LOOKBACK_HOURS);
        // Rebuild every few new hours
        if (bars1h.length % 4 === 0) buildZones1h();
      } else if (bucket === last.time) {
        // update in-flight 1h
        last.high   = Math.max(last.high, latest.high);
        last.low    = Math.min(last.low,  latest.low);
        last.close  = latest.close;
        last.volume = Number(last.volume||0) + Number(latest.volume||0);
      }
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
