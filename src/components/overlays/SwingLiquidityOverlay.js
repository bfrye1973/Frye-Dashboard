// src/components/overlays/SwingLiquidityOverlay.js
// Swing Liquidity — Dual 1h (Primary Blue + Secondary Yellow) + Pivot Shelves
// v2.1: 1h tuning (L/R=6), min touches ≥3, band-height cap (0.35%),
//       full-width shelves, wick-density scoring, and “sticky Secondary”
//       (yellow inherits the previous blue when still valid).
// Inert (no fit/visibleRange); hour-aware recompute.

export default function createSwingLiquidityOverlay({ chart, priceSeries, chartContainer, timeframe }) {
  if (!chart || !priceSeries || !chartContainer) {
    console.warn("[SwingLiquidity] missing args");
    return { seed() {}, update() {}, destroy() {} };
  }

  /* ---------------- Tunables ---------------- */
  // Adaptive swing windows
  const L = timeframe === "1h" ? 6 : 10;
  const R = timeframe === "1h" ? 6 : 10;

  // Pivot shelves
  const LOOKBACK = 600;
  const BAND_BPS_BASE = 8;     // default half-band ~0.08%
  const MAX_BAND_BPS   = 35;   // cap total height ≤0.35% (keeps zones thin)

  // Volume plates
  const FILL_ALPHA = 0.22;
  const STROKE_W = 2;
  const TAG_W = 12;
  const TAG_MIN_H = 4;
  const TEXT_PAD = 6;
  const FONT = "bold 16px system-ui, -apple-system, Segoe UI, Roboto, Arial";

  // 1h scan
  const TEST_LOOKBACK_HOURS = 24 * 30; // ~30 days
  const BOX_MIN_HRS = 16;
  const BOX_MAX_HRS = 24;
  const BOX_BPS_LIMIT = timeframe === "1h" ? 35 : 55; // 0.35% for 1h; looser on intraday

  // Clusters (1h)
  const BUCKET_BPS = 5;     // 0.05%
  const MERGE_BPS  = 10;    // merge ≤0.10%
  const MIN_TOUCHES_CLUSTER = 3;
  const DWELL_MIN_HOURS     = 8;
  const DWELL_BAND_EXPAND_BUCKETS = 1;
  const RETEST_LOOKAHEAD_HRS = 30;
  const RETEST_BUFFER_BPS    = 8;
  const RETEST_MIN_COUNT     = 2;

  // Scoring weights (0..1; with wick-density)
  const W_DENS = 0.35;  // touches per hour (wick density)
  const W_VOL  = 0.30;  // dwell proxy
  const W_TCH  = 0.20;
  const W_RTS  = 0.10;
  const W_REC  = 0.05;

  // Visuals
  const INNER_H_NORMAL   = 3;
  const INNER_H_PRIMARY  = 5;
  const ALPHA_MIN = 0.30, ALPHA_MAX = 1.00;

  // Colors
  const COL_SUP  = "#ff4d4f";      // pivot shelves (supply)
  const COL_DEM  = "#22c55e";      // pivot shelves (demand)
  const COL_EDGE = "#0b0f17";      // plate edge
  const COL_P1_BOX = "#3b82f6";    // Primary (blue)
  const COL_P1     = "#3b82f6";    // Primary cluster line
  const COL_P2_BOX_FILL   = "rgba(255,255,0,0.25)";   // Secondary (yellow) fill
  const COL_P2_BOX_STROKE = "rgba(255,255,0,0.9)";
  const COL_P2_DASH       = "rgba(255,255,0,0.8)";
  const TEST_ALPHA = 0.16;

  // Draw switches
  const FULL_WIDTH_SHELVES = true;   // full-width blue/yellow and pivots
  const FULL_WIDTH_PIVOTS  = true;   // ON per request
  const SHOW_BOX_TICKS     = true;   // faint ticks at actual box edges

  /* ---------------- State ---------------- */
  let bars = [];          // asc [{time,open,high,low,close,volume}] (seconds)
  let bands = [];         // pivot shelves
  let zoneP1 = null;      // Primary 1h box
  let zoneP2 = null;      // Secondary 1h box
  let wickClusters = null;// { top:{primary?,secondary?}, bottom:{...} }
  let lastHourBucket = null;
  // remembers the last Primary zone so Secondary can “take its place” next recompute
  let prevPrimary = null;

  let rafId = null;
  const ts = chart.timeScale();

  /* ---------------- Helpers ---------------- */
  const toSec = (t) => (t > 1e12 ? Math.floor(t/1000) : t);
  const xFor  = (tSec) => { const x = ts.timeToCoordinate(tSec); return Number.isFinite(x) ? x : null; };
  const yFor  = (p)   => { const y = priceSeries.priceToCoordinate(Number(p)); return Number.isFinite(y) ? y : null; };

  const isSwingHigh = (arr, i) => {
    const v=arr[i].high; for(let j=i-L;j<=i+R;j++){ if(j===i||j<0||j>=arr.length) continue; if(arr[j].high>v) return false; } return true;
  };
  const isSwingLow  = (arr, i) => {
    const v=arr[i].low ; for(let j=i-L;j<=i+R;j++){ if(j===i||j<0||j>=arr.length) continue; if(arr[j].low <v) return false; } return true;
  };

  function fmtVol(v) {
    if (v >= 1e9) return (v/1e9).toFixed(2)+"B";
    if (v >= 1e6) return (v/1e6).toFixed(2)+"M";
    if (v >= 1e3) return (v/1e3).toFixed(2)+"K";
    return String(Math.round(v));
  }

  /* ---------------- Pivot shelves (full-width, capped height) ---------------- */
  function rebuildBands() {
    bands = [];
    if (!bars.length) return;

    const start = Math.max(0, bars.length - LOOKBACK);
    const scan  = bars.slice(start);
    if (!scan.length) return;

    const lastClose = scan.at(-1).close || 0;
    const halfDefault = (BAND_BPS_BASE / 10000) * (lastClose || 1);
    const maxHalf     = (MAX_BAND_BPS  / 10000) * (lastClose || 1) / 2; // cap half-height

    const highs=[], lows=[];
    for (let g = start + L; g < bars.length - R; g++) {
      const b = bars[g];
      if (isSwingHigh(bars, g)) highs.push({ p: b.high, t: toSec(b.time) });
      if (isSwingLow (bars, g)) lows .push({ p: b.low , t: toSec(b.time) });
    }
    highs.sort((a,b)=>b.t-a.t);
    lows .sort((a,b)=>b.t-a.t);

    const take = (arr, side, max=3) => {
      const out=[], used=[];
      for (const z of arr) {
        if (out.length >= max) break;
        if (used.some(u => Math.abs(u - z.p) <= halfDefault*0.75)) continue;
        used.push(z.p);
        const half = Math.min(halfDefault, maxHalf);
        out.push({ side, pLo: z.p - half, pHi: z.p + half, tPivot: z.t, volSum: 0 });
      }
      return out;
    };

    bands = [...take(highs,"SUP",3), ...take(lows,"DEM",3)];

    // per-band volume (all history → pivot)
    if (bands.length) {
      const tMin = toSec(bars[0].time);
      for (const bd of bands) {
        let v = 0;
        for (let i=0;i<bars.length;i++){
          const bt = toSec(bars[i].time);
          if (bt < tMin || bt > bd.tPivot) continue;
          const lo = bars[i].low, hi = bars[i].high;
          if (hi >= bd.pLo && lo <= bd.pHi) v += Number(bars[i].volume||0);
        }
        bd.volSum = v;
      }
    }
  }

  /* ---------------- 1h resample & candidates ---------------- */
  function resampleTo1h(barsAsc){
    if(!barsAsc?.length) return [];
    const out=[]; let cur=null;
    for(const b of barsAsc){
      const t=toSec(b.time), bucket=Math.floor(t/3600)*3600;
      if(!cur || bucket!==cur.time){
        if(cur) out.push(cur);
        cur = { time:bucket, open:b.open, high:b.high, low:b.low, close:b.close, volume:Number(b.volume||0) };
      }else{
        cur.high=Math.max(cur.high,b.high);
        cur.low =Math.min(cur.low ,b.low );
        cur.close=b.close;
        cur.volume=Number(cur.volume||0)+Number(b.volume||0);
      }
    }
    if(cur) out.push(cur);
    return out.slice(-TEST_LOOKBACK_HOURS);
  }

  function slideBoxes(b1h, bpsLimit) {
    const n=b1h.length, out=[];
    for (let span=BOX_MIN_HRS; span<=BOX_MAX_HRS; span++){
      for (let i=0; i+span<=n; i++){
        const j=i+span-1;
        let lo=+Infinity, hi=-Infinity;
        for (let k=i;k<=j;k++){ lo=Math.min(lo,b1h[k].low); hi=Math.max(hi,b1h[k].high); }
        const mid=(lo+hi)/2, bps=((hi-lo)/Math.max(1e-6,mid))*10000;
        if (bpsLimit!=null && bps>bpsLimit) continue;
        out.push({ iStart:i, iEnd:j, pLo:lo, pHi:hi, bps, spanHrs: span, tStart:b1h[i].time, tEnd:b1h[j].time });
      }
    }
    return out;
  }

  function buildClustersWithStats(b1h, best) {
    const { iStart, iEnd } = best;
    const spanBars = b1h.slice(iStart, iEnd + 1);
    if (!spanBars.length) return null;

    const lastClose = b1h.at(-1).close || spanBars.at(-1).close;
    const step = (BUCKET_BPS / 10000) * lastClose;
    const mergeStep = (MERGE_BPS / 10000) * lastClose;

    const top = new Map(), bottom = new Map();
    const keyOf = (price) => Math.floor(price / step) * step;

    // bucket wick tips
    for (const b of spanBars) {
      if (b.high > Math.max(b.open, b.close)) {
        const key = keyOf(b.high); const o = top.get(key) || { touches:0 };
        o.touches += 1; top.set(key,o);
      }
      if (b.low < Math.min(b.open, b.close)) {
        const key = keyOf(b.low);  const o = bottom.get(key) || { touches:0 };
        o.touches += 1; bottom.set(key,o);
      }
    }

    const mergeMap = (m) => {
      const keys = Array.from(m.keys()).sort((a,b)=>a-b);
      const out=[]; let cur=null;
      for(const k of keys){
        const t = m.get(k).touches;
        if(!cur){ cur={ pLo:k, pHi:k+step, touches:t }; continue; }
        if(k - cur.pHi <= mergeStep){ cur.pHi += step; cur.touches += t; }
        else { out.push(cur); cur={ pLo:k, pHi:k+step, touches:t }; }
      }
      if(cur) out.push(cur);
      return out;
    };

    let topZones = mergeMap(top);
    let botZones = mergeMap(bottom);

    // dwell near band ± expand
    const expand = DWELL_BAND_EXPAND_BUCKETS * step;
    const dwellFor = (loBand, hiBand) => {
      let dwell = 0;
      const lo = loBand - expand, hi = hiBand + expand;
      for (const b of spanBars) {
        const bodyLo = Math.min(b.open, b.close);
        const bodyHi = Math.max(b.open, b.close);
        if (bodyHi >= lo && bodyLo <= hi) dwell += 1; // 1h per bar
      }
      return dwell;
    };
    for (const z of topZones) z.dwell = dwellFor(z.pLo, z.pHi);
    for (const z of botZones) z.dwell = dwellFor(z.pLo, z.pHi);

    // floors (min touches & dwell)
    topZones = topZones.filter(z => z.touches >= MIN_TOUCHES_CLUSTER && z.dwell >= DWELL_MIN_HOURS);
    botZones = botZones.filter(z => z.touches >= MIN_TOUCHES_CLUSTER && z.dwell >= DWELL_MIN_HOURS);

    // retests forward
    const retestFor = (loBand, hiBand) => {
      const buf = (RETEST_BUFFER_BPS / 10000) * lastClose;
      const lo = loBand - buf, hi = hiBand + buf;

      let count = 0, inTouch = false;
      const startIdx = best.iEnd + 1;
      const endIdx   = Math.min(b1h.length - 1, best.iEnd + RETEST_LOOKAHEAD_HRS);

      for (let i = startIdx; i <= endIdx; i++) {
        const b = b1h[i];
        const wickLo = Math.min(b.open, b.close, b.low);
        const wickHi = Math.max(b.open, b.close, b.high);
        const touch = wickHi >= lo && wickLo <= hi;
        if (touch && !inTouch) { count += 1; inTouch = true; }
        else if (!touch && inTouch) { inTouch = false; }
      }
      return count;
    };
    for (const z of topZones) z.retests = retestFor(z.pLo, z.pHi);
    for (const z of botZones) z.retests = retestFor(z.pLo, z.pHi);

    // wick-density (touches per hour)
    const spanH = Math.max(1, best.iEnd - best.iStart + 1);
    for (const z of topZones) z.density = z.touches / spanH;
    for (const z of botZones) z.density = z.touches / spanH;

    // scoring (normalized within side)
    const scoreSide = (list) => {
      if (!list.length) return;
      const maxDwell = Math.max(...list.map(z=>z.dwell), 1);
      const maxT     = Math.max(...list.map(z=>z.touches), 1);
      const maxR     = Math.max(...list.map(z=>z.retests), 1);
      const maxDen   = Math.max(...list.map(z=>z.density), 1e-6);
      const recN = 1; // same window
      for (const z of list) {
        const densN = z.density / maxDen;
        const volN  = z.dwell   / maxDwell;
        const tchN  = z.touches / maxT;
        const rtsN  = z.retests / maxR;
        z.score = W_DENS*densN + W_VOL*volN + W_TCH*tchN + W_RTS*rtsN + W_REC*recN;
      }
      list.sort((a,b)=>b.score - a.score);
    };
    scoreSide(topZones);
    scoreSide(botZones);

    const pack = (arr) => {
      if (!arr.length) return { primary:null, secondary:null };
      return { primary:arr[0] || null, secondary:arr[1] || null };
    };

    return {
      top: pack(topZones),
      bottom: pack(botZones),
    };
  }

  function rebuildDualZones(){
    zoneP1 = null; zoneP2 = null; wickClusters = null;

    const b1h = resampleTo1h(bars);
    if (b1h.length < BOX_MIN_HRS) return;

    // candidates with 1h cap
    const candidates = slideBoxes(b1h, BOX_BPS_LIMIT);
    if (!candidates.length) return;

    const scored = [];
    for (const c of candidates) {
      const clusters = buildClustersWithStats(b1h, c);
      const topP = clusters?.top?.primary, botP = clusters?.bottom?.primary;
      const p = topP && botP ? (topP.score >= botP.score ? topP : botP) : (topP || botP || null);
      if (!p) continue;
      scored.push({ ...c, score: p.score, touches: p.touches, dwell: p.dwell, retests: p.retests, density: p.density, clusters });
    }
    if (!scored.length) return;

    // A: strongest (blue)
    scored.sort((a,b)=> b.score - a.score || b.spanHrs - a.spanHrs);
    const A = scored[0];
    zoneP1 = { tStart:A.tStart, tEnd:A.tEnd, pLo:A.pLo, pHi:A.pHi, score:A.score, touches:A.touches, dwell:A.dwell, retests:A.retests, spanHrs:A.spanHrs, bps:A.bps };
    wickClusters = A.clusters;

    // ---- B: “Sticky” Secondary = previous Primary if still valid & non-overlapping; else fallback ----
    const nonOverlap = (a,b) => (a.tEnd < b.tStart) || (b.tEnd < a.tStart);

    // helper: convert a scored candidate into zone shape
    const asZone = (C) => C && {
      tStart: C.tStart, tEnd: C.tEnd, pLo: C.pLo, pHi: C.pHi,
      score: C.score, touches: C.touches, dwell: C.dwell, retests: C.retests,
      spanHrs: C.spanHrs, bps: C.bps
    };

    let Bz = null;
    if (prevPrimary) {
      const tol = 0; // exact same 1h window; change to 3600 for +/-1h tolerance
      const matchPrev = scored.find(c =>
        Math.abs(c.tStart - prevPrimary.tStart) <= tol &&
        Math.abs(c.tEnd   - prevPrimary.tEnd)   <= tol
      );
      if (matchPrev && nonOverlap({tStart:A.tStart,tEnd:A.tEnd}, {tStart:matchPrev.tStart,tEnd:matchPrev.tEnd})) {
        Bz = asZone(matchPrev);
      }
    }

    if (!Bz) {
      const remaining = scored.filter(c => nonOverlap({tStart:A.tStart,tEnd:A.tEnd},{tStart:c.tStart,tEnd:c.tEnd}));
      if (remaining.length){
        remaining.sort((a,b)=> a.tEnd - b.tEnd); // ascending
        const latestEnd = remaining.at(-1).tEnd;
        const near = remaining.filter(c => c.tEnd === latestEnd);
        const B = (near.length>1) ? near.sort((a,b)=> b.score - a.score || b.spanHrs - a.spanHrs)[0] : near[0];
        Bz = asZone(B);
      }
    }
    zoneP2 = Bz || null;

    // Update sticky memory for next cycle
    prevPrimary = { ...zoneP1 };
  }

  /* ---------------- Draw (paint-only, full-width) ---------------- */
  function doDraw(){
    const w = chartContainer.clientWidth  || 1;
    const h = chartContainer.clientHeight || 1;

    let cnv = chartContainer.querySelector("canvas.overlay-canvas.swing-liquidity");
    if(!cnv){
      cnv = document.createElement("canvas");
      cnv.className = "overlay-canvas swing-liquidity";
      Object.assign(cnv.style,{ position:"absolute", inset:0, pointerEvents:"none", zIndex:10 });
      chartContainer.appendChild(cnv);
    }
    if (!w || !h) return;
    cnv.width = w; cnv.height = h;

    const ctx = cnv.getContext("2d");
    ctx.clearRect(0,0,w,h);
    ctx.font = FONT;

    const volMax = Math.max(1, ...bands.map(b=>b.volSum||0));

    const viewLeft  = 0;
    const viewRight = chartContainer.clientWidth || 1;
    const viewW     = Math.max(1, viewRight - viewLeft);

    // (1) Pivot shelves — full width
    for (const bd of bands){
      const yTop=yFor(bd.pHi), yBot=yFor(bd.pLo);
      const xPivot=xFor(bd.tPivot);
      if (yTop==null||yBot==null||xPivot==null) continue;

      const color = bd.side==="SUP" ? COL_SUP : COL_DEM;
      const yMin=Math.min(yTop,yBot), yMax=Math.max(yTop,yBot);
      const rectH=Math.max(2,yMax-yMin);

      const rectX = FULL_WIDTH_PIVOTS ? viewLeft : Math.min(0, xPivot);
      const rectW = FULL_WIDTH_PIVOTS ? viewW : Math.max(1, Math.abs(xPivot - 0));

      ctx.globalAlpha=FILL_ALPHA; ctx.fillStyle=color;
      ctx.fillRect(rectX,yMin,rectW,rectH);
      ctx.globalAlpha=1; ctx.lineWidth=STROKE_W; ctx.strokeStyle=color;
      ctx.strokeRect(rectX+0.5,yMin+0.5,rectW-1,rectH-1);

      // tag + plate at pivot
      const tagFrac = Math.max(0,(bd.volSum||0)/volMax);
      const tagH = Math.max(TAG_MIN_H, Math.floor(h*0.15*tagFrac));
      const tagX = xPivot - TAG_W;
      const tagY = Math.max(2, Math.min(h-tagH-2, yMin + (rectH - tagH)/2));
      ctx.fillStyle = color; ctx.fillRect(tagX,tagY,TAG_W,tagH);
      ctx.lineWidth=1; ctx.strokeStyle=COL_EDGE; ctx.strokeRect(tagX+0.5,tagY+0.5,TAG_W-1,tagH-1);

      const txt = fmtVol(bd.volSum||0);
      const m = ctx.measureText(txt);
      const plateW = Math.ceil(m.width) + 12;
      let plateX = tagX + TAG_W + TEXT_PAD, plateY = tagY + Math.max(0,(tagH - 18)/2);
      if (plateX + plateW > viewRight - 2) plateX = tagX - TEXT_PAD - plateW;

      ctx.globalAlpha=0.85; ctx.fillStyle="#0b0f17";
      ctx.fillRect(plateX, plateY, plateW, 18);
      ctx.globalAlpha=1; ctx.lineWidth=1; ctx.strokeStyle="#1f2a44";
      ctx.strokeRect(plateX+0.5, plateY+0.5, plateW-1, 17);

      const tx = plateX + 6, ty = plateY + 14;
      ctx.fillStyle="#e5e7eb"; ctx.strokeStyle="#000"; ctx.lineWidth=2;
      ctx.strokeText(txt, tx, ty); ctx.fillText(txt, tx, ty);
    }

    // (2) Secondary 1h (Yellow) — full width
    if (zoneP2){
      const yTop=yFor(zoneP2.pHi), yBot=yFor(zoneP2.pLo);
      if (yTop!=null && yBot!=null){
        const yMin=Math.min(yTop,yBot), yMax=Math.max(yTop,yBot);
        const rectH=Math.max(2,yMax-yMin);

        ctx.globalAlpha = 1;
        ctx.fillStyle = COL_P2_BOX_FILL;
        ctx.fillRect(viewLeft, yMin, viewW, rectH);

        ctx.save();
        ctx.setLineDash([6,6]);
        ctx.lineWidth = STROKE_W;
        ctx.strokeStyle = COL_P2_BOX_STROKE;
        ctx.strokeRect(viewLeft+0.5, yMin+0.5, viewW-1, rectH-1);
        ctx.restore();

        if (SHOW_BOX_TICKS) {
          const xS = xFor(zoneP2.tStart), xE = xFor(zoneP2.tEnd);
          if (xS!=null && xE!=null){
            ctx.save();
            ctx.globalAlpha = 0.25;
            ctx.setLineDash([2,4]);
            ctx.strokeStyle = COL_P2_BOX_STROKE;
            ctx.beginPath(); ctx.moveTo(xS, yMin); ctx.lineTo(xS, yMax); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(xE, yMin); ctx.lineTo(xE, yMax); ctx.stroke();
            ctx.restore();
          }
        }
      }
    }

    // (3) Primary 1h (Blue) + clusters
    if (zoneP1){
      const yTop=yFor(zoneP1.pHi), yBot=yFor(zoneP1.pLo);
      if (yTop!=null && yBot!=null){
        const yMin=Math.min(yTop,yBot), yMax=Math.max(yTop,yBot);
        const rectH=Math.max(2,yMax-yMin);

        ctx.globalAlpha=TEST_ALPHA; ctx.fillStyle=COL_P1_BOX;
        ctx.fillRect(viewLeft, yMin, viewW, rectH);
        ctx.globalAlpha=1; ctx.lineWidth=STROKE_W; ctx.strokeStyle=COL_P1_BOX;
        ctx.strokeRect(viewLeft+0.5,yMin+0.5,viewW-1,rectH-1);

        if (SHOW_BOX_TICKS) {
          const xS = xFor(zoneP1.tStart), xE = xFor(zoneP1.tEnd);
          if (xS!=null && xE!=null){
            ctx.save();
            ctx.globalAlpha = 0.25;
            ctx.setLineDash([2,4]);
            ctx.strokeStyle = COL_P1_BOX;
            ctx.beginPath(); ctx.moveTo(xS, yMin); ctx.lineTo(xS, yMax); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(xE, yMin); ctx.lineTo(xE, yMax); ctx.stroke();
            ctx.restore();
          }
        }

        if (wickClusters) {
          const drawP = (cl) => {
            if (!cl) return;
            const yLo = yFor(cl.pLo), yHi = yFor(cl.pHi);
            if (yLo == null || yHi == null) return;
            const yMid = (yLo + yHi) / 2;
            const alpha = Math.max(ALPHA_MIN, Math.min(ALPHA_MAX, (cl.score || 0) * 1.2));
            const lineH = (cl.retests || 0) >= RETEST_MIN_COUNT ? INNER_H_PRIMARY : INNER_H_NORMAL;

            // glow
            ctx.globalAlpha = alpha * 0.35;
            ctx.fillStyle = COL_P1;
            ctx.fillRect(viewLeft, yMid - (lineH+4)/2, viewW, (lineH+4));

            // main line
            ctx.globalAlpha = alpha;
            ctx.fillStyle = COL_P1;
            ctx.fillRect(viewLeft, yMid - lineH/2, viewW, lineH);
            ctx.globalAlpha = 1;
          };

          const drawS = (cl) => {
            if (!cl) return;
            const yLo = yFor(cl.pLo), yHi = yFor(cl.pHi);
            if (yLo == null || yHi == null) return;
            const yMid = (yLo + yHi) / 2;
            ctx.save();
            ctx.setLineDash([6,6]);
            ctx.lineWidth = 2;
            ctx.strokeStyle = COL_P2_DASH;
            ctx.beginPath(); ctx.moveTo(viewLeft, yMid); ctx.lineTo(viewRight, yMid); ctx.stroke();
            ctx.restore();
          };

          if (wickClusters.top) {
            drawS(wickClusters.top.secondary);
            drawP(wickClusters.top.primary);
          }
          if (wickClusters.bottom) {
            drawS(wickClusters.bottom.secondary);
            drawP(wickClusters.bottom.primary);
          }
        }
      }
    }
  }

  // rAF throttle
  function scheduleDraw(){ if (rafId!=null) return; rafId = requestAnimationFrame(()=>{ rafId=null; doDraw(); }); }

  const onLogical = () => scheduleDraw();
  const onVisible = () => scheduleDraw();
  ts.subscribeVisibleLogicalRangeChange?.(onLogical);
  ts.subscribeVisibleTimeRangeChange?.(onVisible);
  window.addEventListener("resize", scheduleDraw);

  /* ---------------- API ---------------- */
  return {
    seed(rawBarsAsc){
      bars = (rawBarsAsc||[]).map(b=>({...b, time:toSec(b.time)})).sort((a,b)=>a.time-b.time);
      rebuildBands();

      const last = bars.at(-1);
      lastHourBucket = last ? Math.floor(toSec(last.time)/3600) : null;
      rebuildDualZones();

      doDraw();
    },
    update(latest){
      if (!latest) return;
      const t=toSec(latest.time); const last=bars.at(-1);
      if (!last || t>last.time) bars.push({...latest,time:t});
      else if (t===last.time)   bars[bars.length-1] = {...latest,time:t};
      else return;

      rebuildBands();

      const bucket = Math.floor(t/3600);
      if (bucket !== lastHourBucket) {
        lastHourBucket = bucket;
        rebuildDualZones();
      }
      doDraw();
    },
    destroy(){
      try { ts.unsubscribeVisibleLogicalRangeChange?.(onLogical); } catch {}
      try { ts.unsubscribeVisibleTimeRangeChange?.(onVisible); } catch {}
      window.removeEventListener("resize", scheduleDraw);
    },
  };
}
