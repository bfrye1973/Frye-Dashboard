// src/components/overlays/DualShelvesOverlay.js
// Liquidity Shelves (Dual 1h) — Primary Blue + Secondary Yellow (sticky)
// NO pivot shelves here (kept separate in Swing Liquidity).
// - 1h tuning (L/R=6), min touches ≥3
// - Band-height cap (0.35%), full-width zones
// - Wick-density scoring
// - Sticky Secondary: yellow inherits prior blue (±1h tolerance & small-overlap allowance)
// - Inert (no fit/visibleRange), hour-aware recompute
// - zIndex=20 and bold contrast so yellow is never hidden by Lux S/R

export default function createDualShelvesOverlay({ chart, priceSeries, chartContainer, timeframe }) {
  if (!chart || !priceSeries || !chartContainer) {
    console.warn("[DualShelves] missing args");
    return { seed() {}, update() {}, destroy() {} };
  }

  /* ---------------- Tunables ---------------- */
  const L = timeframe === "1h" ? 6 : 10;
  const R = timeframe === "1h" ? 6 : 10;

  const TEST_LOOKBACK_HOURS = 24 * 30; // ~30 days
  const BOX_MIN_HRS = 16;
  const BOX_MAX_HRS = 24;
  const BOX_BPS_LIMIT = timeframe === "1h" ? 35 : 55; // 0.35% cap on 1h

  const BUCKET_BPS = 5;  // 0.05%
  const MERGE_BPS  = 10; // merge ≤0.10%
  const MIN_TOUCHES_CLUSTER = 3;
  const DWELL_MIN_HOURS     = 8;
  const DWELL_BAND_EXPAND_BUCKETS = 1;
  const RETEST_LOOKAHEAD_HRS = 30;
  const RETEST_BUFFER_BPS    = 8;
  const RETEST_MIN_COUNT     = 2;

  // scoring
  const W_DENS = 0.35;  // touches/hour
  const W_VOL  = 0.30;  // dwell proxy
  const W_TCH  = 0.20;
  const W_RTS  = 0.10;
  const W_REC  = 0.05;

  // visuals
  const ALPHA_MIN = 0.30, ALPHA_MAX = 1.00;
  const STROKE_W = 2;
  const FONT = "bold 16px system-ui, -apple-system, Segoe UI, Roboto, Arial";

  const COL_P1_BOX = "#3b82f6";                // Blue
  const COL_P2_FILL = "rgba(255,255,0,0.35)";  // Yellow (stronger fill)
  const COL_P2_STROKE = "rgba(255,255,0,0.95)";
  const COL_P2_DASH = "rgba(255,255,0,0.85)";
  const COL_P1      = "#3b82f6";
  const TEST_ALPHA  = 0.16;

  const FULL_WIDTH_ZONES = true;
  const SHOW_BOX_TICKS   = true;

  /* ---------------- State ---------------- */
  let bars = [];            // asc [{time,open,high,low,close,volume}]
  let zoneP1 = null;        // {tStart,tEnd,pLo,pHi,...}
  let zoneP2 = null;        // sticky secondary
  let wickClusters = null;  // kept minimal for now
  let lastHourBucket = null;
  let prevPrimary = null;   // sticky memory

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

    // floors
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

    // scoring
    const scoreSide = (list) => {
      if (!list.length) return;
      const maxDwell = Math.max(...list.map(z=>z.dwell), 1);
      const maxT     = Math.max(...list.map(z=>z.touches), 1);
      const maxR     = Math.max(...list.map(z=>z.retests), 1);
      const maxDen   = Math.max(...list.map(z=>z.density), 1e-6);
      const recN = 1;
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

    return { top: pack(topZones), bottom: pack(botZones) };
  }

  function rebuildDualZones(){
    zoneP1 = null; zoneP2 = null; wickClusters = null;

    const b1h = resampleTo1h(bars);
    if (b1h.length < BOX_MIN_HRS) return;

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

    // B: sticky previous Primary if valid; else most-recent non-overlap
    const nonOverlap = (a,b) => (a.tEnd < b.tStart) || (b.tEnd < a.tStart);
    const overlapRatio = (a,b) => {
      const lo = Math.max(a.tStart, b.tStart);
      const hi = Math.min(a.tEnd,   b.tEnd);
      return hi <= lo ? 0 : (hi - lo) / Math.max(1, (Math.max(a.tEnd,b.tEnd) - Math.min(a.tStart,b.tStart)));
    };
    const asZone = (C) => C && ({
      tStart: C.tStart, tEnd: C.tEnd, pLo: C.pLo, pHi: C.pHi,
      score: C.score, touches: C.touches, dwell: C.dwell, retests: C.retests,
      spanHrs: C.spanHrs, bps: C.bps
    });

    let Bz = null;
    if (prevPrimary) {
      const tol = 3600; // +/-1h tolerance
      const matchPrev = scored.find(c =>
        Math.abs(c.tStart - prevPrimary.tStart) <= tol &&
        Math.abs(c.tEnd   - prevPrimary.tEnd)   <= tol
      );
      if (matchPrev && nonOverlap({tStart:A.tStart,tEnd:A.tEnd}, {tStart:matchPrev.tStart,tEnd:matchPrev.tEnd})) {
        Bz = asZone(matchPrev);
      }
      if (!Bz) {
        const smallOverlap = overlapRatio({tStart:A.tStart,tEnd:A.tEnd}, prevPrimary) < 0.30;
        if (smallOverlap) Bz = { ...prevPrimary };
      }
    }
    if (!Bz) {
      const remaining = scored.filter(c => nonOverlap({tStart:A.tStart,tEnd:A.tEnd},{tStart:c.tStart,tEnd:c.tEnd}));
      if (remaining.length){
        remaining.sort((a,b)=> a.tEnd - b.tEnd);
        const latestEnd = remaining.at(-1).tEnd;
        const near = remaining.filter(c => c.tEnd === latestEnd);
        const B = (near.length>1) ? near.sort((a,b)=> b.score - a.score || b.spanHrs - a.spanHrs)[0] : near[0];
        Bz = asZone(B);
      }
    }
    zoneP2 = Bz || null;

    prevPrimary = { ...zoneP1 };

    if (typeof window !== "undefined") {
      window.__DUALSHELVES = {
        zoneP1: zoneP1 ? { ...zoneP1 } : null,
        zoneP2: zoneP2 ? { ...zoneP2 } : null,
        prevPrimary: prevPrimary ? { ...prevPrimary } : null,
      };
    }
  }

  /* ---------------- Draw (zones only, full width) ---------------- */
  function doDraw(){
    const w = chartContainer.clientWidth  || 1;
    const h = chartContainer.clientHeight || 1;

    let cnv = chartContainer.querySelector("canvas.overlay-canvas.dual-shelves");
    if(!cnv){
      cnv = document.createElement("canvas");
      cnv.className = "overlay-canvas dual-shelves";
      Object.assign(cnv.style,{ position:"absolute", inset:0, pointerEvents:"none", zIndex:20 }); // zIndex ↑
      chartContainer.appendChild(cnv);
    }
    if (!w || !h) return;
    cnv.width = w; cnv.height = h;

    const ctx = cnv.getContext("2d");
    ctx.clearRect(0,0,w,h);
    ctx.font = FONT;

    const viewLeft  = 0;
    const viewRight = chartContainer.clientWidth || 1;
    const viewW     = Math.max(1, viewRight - viewLeft);

    // Secondary (Yellow)
    if (zoneP2){
      const yTop=yFor(zoneP2.pHi), yBot=yFor(zoneP2.pLo);
      if (yTop!=null && yBot!=null){
        const yMin=Math.min(yTop,yBot), yMax=Math.max(yTop,yBot);
        const rectH=Math.max(2,yMax-yMin);

        // fill
        ctx.globalAlpha = 1;
        ctx.fillStyle = COL_P2_FILL;
        ctx.fillRect(viewLeft, yMin, viewW, rectH);

        // dark under-outline for contrast
        ctx.save();
        ctx.lineWidth = STROKE_W + 2;
        ctx.strokeStyle = "rgba(0,0,0,0.35)";
        ctx.strokeRect(viewLeft + 0.5, yMin + 0.5, viewW - 1, rectH - 1);
        ctx.restore();

        // dashed yellow border on top
        ctx.save();
        ctx.setLineDash([6,6]);
        ctx.lineWidth = STROKE_W + 1;
        ctx.strokeStyle = COL_P2_STROKE;
        ctx.strokeRect(viewLeft + 0.5, yMin + 0.5, viewW - 1, rectH - 1);
        ctx.restore();

        if (SHOW_BOX_TICKS) {
          const xS = xFor(zoneP2.tStart), xE = xFor(zoneP2.tEnd);
          if (xS!=null && xE!=null){
            ctx.save();
            ctx.globalAlpha = 0.25;
            ctx.setLineDash([2,4]);
            ctx.strokeStyle = COL_P2_STROKE;
            ctx.beginPath(); ctx.moveTo(xS, yMin); ctx.lineTo(xS, yMax); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(xE, yMin); ctx.lineTo(xE, yMax); ctx.stroke();
            ctx.restore();
          }
        }
      }
    }

    // Primary (Blue)
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
      // remove canvas so toggle OFF hides immediately
      const cnv = chartContainer.querySelector("canvas.overlay-canvas.dual-shelves");
      if (cnv && cnv.parentNode === chartContainer) chartContainer.removeChild(cnv);
    },
  };
}
