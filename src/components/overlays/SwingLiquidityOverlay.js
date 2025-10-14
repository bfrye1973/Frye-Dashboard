// src/components/overlays/SwingLiquidityOverlay.js
// Pivot Shelves + 1h Consolidation + Wick Clusters (Dwell + Retests + Scoring + Adaptive)
// Designed to reliably detect 1h shelves on TSLA via a two-pass box and adaptive relax.
// Inert: read-only pan/zoom redraw; NO zoom/fit calls; NO ResizeObserver/DPR.

export default function createSwingLiquidityOverlay({ chart, priceSeries, chartContainer }) {
  if (!chart || !priceSeries || !chartContainer) {
    console.warn("[SwingLiquidity] missing args");
    return { seed() {}, update() {}, destroy() {} };
  }

  /* ---------------- Tunables ---------------- */
  // Pivot shelves
  const LOOKBACK = 600;
  const L = 10, R = 10;
  const BAND_BPS = 8;                 // half-band width (0.08% of last close)
  const TOP_PER_SIDE = 3;             // Top-3 highs + Top-3 lows

  // Volume plates
  const FILL_ALPHA = 0.22;
  const STROKE_W = 2;
  const TAG_W = 12;
  const TAG_MIN_H = 4;
  const TEXT_PAD = 6;
  const FONT = "bold 16px system-ui, -apple-system, Segoe UI, Roboto, Arial";

  // 1-hour consolidation
  const TEST_LOOKBACK_HOURS = 24 * 30; // ~30 days
  const BOX_MIN_HRS = 16;
  const BOX_MAX_HRS = 24;
  const BOX_BPS_LIMIT_STRICT = 35;     // 0.35% (kept for SPY-like names if needed)
  const BOX_BPS_LIMIT_TSLA   = 55;     // 0.55% (first pass for TSLA-like names)
  const FALLBACK_TO_TIGHTEST = true;   // if strict pass fails, pick tightest regardless

  // Wick clustering + dwell + retests (primary pass)
  const BUCKET_BPS = 5;                // 0.05% bucket
  const MERGE_BPS  = 10;               // merge ≤ 0.10%
  const MIN_TOUCHES_CLUSTER = 3;
  const DWELL_MIN_HOURS     = 8;
  const DWELL_BAND_EXPAND_BUCKETS = 1; // widen cluster band ±1 bucket for dwell
  const RETEST_LOOKAHEAD_HRS = 30;     // forward scan
  const RETEST_BUFFER_BPS    = 8;
  const RETEST_MIN_COUNT     = 2;      // “major” threshold

  // Adaptive relax (if clusters missing): softer thresholds for TSLA-like names
  const RELAX_TOUCHES  = 2;
  const RELAX_DWELL_H  = 6;
  const RELAX_RETEST_H = 48;

  // Scoring weights (0..1 normalized per side)
  const W_VOL = 0.45;   // dwell proxy
  const W_TCH = 0.30;
  const W_RTS = 0.15;
  const W_REC = 0.10;

  // Cluster drawing
  const INNER_H_NORMAL   = 3;
  const INNER_H_PRIMARY  = 5;
  const ALPHA_MIN = 0.30, ALPHA_MAX = 1.00;

  // Colors
  const COL_SUP  = "#ff4d4f";     // pivot shelves (supply)
  const COL_DEM  = "#22c55e";     // pivot shelves (demand)
  const COL_EDGE = "#0b0f17";     // plate edge
  const COL_TEST = "#3b82f6";     // 1h box
  const COL_P1   = "#3b82f6";     // primary cluster line (electric blue)
  const COL_P2   = "rgba(56,189,248,0.6)"; // secondary cluster (dashed cyan)
  const TEST_ALPHA = 0.16;

  /* ---------------- State ---------------- */
  let bars = [];        // ascending [{time, open, high, low, close, volume}]
  let bands = [];       // pivot shelves [{side, pLo, pHi, tPivot, volSum}]
  let testBox = null;   // 1h consolidation {tStart, tEnd, pLo, pHi}
  // wickClusters: { top:{primary?, secondary?}, bottom:{primary?, secondary?} }
  let wickClusters = null;
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

  /* -------------- Pivot shelves (left-extended) -------------- */
  function rebuildBands() {
    bands = [];
    if (!bars.length) return;

    const start = Math.max(0, bars.length - LOOKBACK);
    const scan  = bars.slice(start);
    if (!scan.length) return;

    const lastClose = scan.at(-1).close || 0;
    const half = (BAND_BPS / 10000) * (lastClose || 1);

    const highs=[], lows=[];
    for (let g = start + L; g < bars.length - R; g++) {
      const b = bars[g];
      if (isSwingHigh(bars, g)) highs.push({ p: b.high, t: toSec(b.time) });
      if (isSwingLow (bars, g)) lows .push({ p: b.low , t: toSec(b.time) });
    }
    highs.sort((a,b)=>b.t-a.t);
    lows .sort((a,b)=>b.t-a.t);

    const take = (arr, side, max=TOP_PER_SIDE) => {
      const out=[], used=[];
      for (const z of arr) {
        if (out.length >= max) break;
        if (used.some(u => Math.abs(u - z.p) <= half*0.75)) continue;
        used.push(z.p);
        out.push({ side, pLo: z.p - half, pHi: z.p + half, tPivot: z.t, volSum: 0 });
      }
      return out;
    };

    bands = [...take(highs,"SUP",TOP_PER_SIDE), ...take(lows,"DEM",TOP_PER_SIDE)];

    // per-band volume (left edge → pivot time) for bars intersecting the band
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

  /* -------------- 1-hour resample & test band -------------- */
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

  // Utility: pick tightest window by span and bps limit (or "any" if limit=null)
  function pickBox(b1h, bpsLimit) {
    let best=null; const n=b1h.length;
    for (let span = BOX_MIN_HRS; span <= BOX_MAX_HRS; span++) {
      for (let i = 0; i + span <= n; i++) {
        const j = i + span - 1;
        let lo=+Infinity, hi=-Infinity;
        for (let k=i;k<=j;k++){ lo=Math.min(lo,b1h[k].low); hi=Math.max(hi,b1h[k].high); }
        const mid=(lo+hi)/2, bps=((hi-lo)/Math.max(1e-6,mid))*10000;
        if (bpsLimit != null && bps > bpsLimit) continue;
        if (!best || bps < best.bps) best = { iStart:i, iEnd:j, pLo:lo, pHi:hi, bps };
      }
    }
    return best;
  }

  function rebuildTestBox(){
    testBox = null;
    wickClusters = null;

    const b1h = resampleTo1h(bars);
    if (b1h.length < BOX_MIN_HRS) { window.__last1hBox=null; window.__lastWickClusters=null; return; }

    // Pass 1: TSLA-friendly (0.55%)
    let best = pickBox(b1h, BOX_BPS_LIMIT_TSLA);
    // Fallback: pick tightest regardless
    if (!best && FALLBACK_TO_TIGHTEST) best = pickBox(b1h, null);

    if (!best) { window.__last1hBox=null; window.__lastWickClusters=null; return; }

    testBox = { tStart:b1h[best.iStart].time, tEnd:b1h[best.iEnd].time, pLo:best.pLo, pHi:best.pHi };
    wickClusters = buildClustersWithStatsAdaptive(b1h, best); // dwell+retests+scoring (+ relax if needed)

    // Debug taps for quick verification
    window.__last1hBox = { ...testBox, spanHrs: best.iEnd - best.iStart + 1, bps: best.bps };
    window.__lastWickClusters = wickClusters;
  }

  /* -------------- Wick clusters WITH DWELL + RETESTS + SCORING + ADAPTIVE -------------- */
  function buildClustersWithStatsAdaptive(b1h, best) {
    // First try strict thresholds
    let res = buildClustersWithStats(b1h, best, {
      bucketBps: BUCKET_BPS, mergeBps: MERGE_BPS,
      minTouches: MIN_TOUCHES_CLUSTER, dwellMinH: DWELL_MIN_HOURS,
      retestLookaheadH: RETEST_LOOKAHEAD_HRS, retestBufBps: RETEST_BUFFER_BPS
    });

    const hasPrimary = (res?.top?.primary || res?.bottom?.primary);
    if (hasPrimary) return res;

    // If nothing meaningful, relax floors once
    return buildClustersWithStats(b1h, best, {
      bucketBps: BUCKET_BPS, mergeBps: MERGE_BPS,
      minTouches: RELAX_TOUCHES, dwellMinH: RELAX_DWELL_H,
      retestLookaheadH: RELAX_RETEST_H, retestBufBps: RETEST_BUFFER_BPS
    });
  }

  function buildClustersWithStats(b1h, best, cfg) {
    const { iStart, iEnd } = best;
    const spanBars = b1h.slice(iStart, iEnd + 1);
    if (!spanBars.length) return null;

    const lastClose = b1h.at(-1).close || spanBars.at(-1).close;
    const step = (cfg.bucketBps / 10000) * lastClose;
    const mergeStep = (cfg.mergeBps / 10000) * lastClose;

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

    // merge adjacent buckets
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

    let topZones = mergeMap(top).filter(z => z.touches >= cfg.minTouches);
    let botZones = mergeMap(bottom).filter(z => z.touches >= cfg.minTouches);

    // dwell near band ± expand
    const expand = DWELL_BAND_EXPAND_BUCKETS * step;
    const dwellFor = (loBand, hiBand) => {
      let dwell = 0;
      const lo = loBand - expand, hi = hiBand + expand;
      for (const b of spanBars) {
        const bodyLo = Math.min(b.open, b.close);
        const bodyHi = Math.max(b.open, b.close);
        if (bodyHi >= lo && bodyLo <= hi) dwell += 1;
      }
      return dwell;
    };
    for (const z of topZones) z.dwell = dwellFor(z.pLo, z.pHi);
    for (const z of botZones) z.dwell = dwellFor(z.pLo, z.pHi);

    topZones = topZones.filter(z => z.dwell >= cfg.dwellMinH);
    botZones = botZones.filter(z => z.dwell >= cfg.dwellMinH);

    // retests forward after end of box
    const retestFor = (loBand, hiBand) => {
      const buf = (cfg.retestBufBps / 10000) * lastClose;
      const lo = loBand - buf, hi = hiBand + buf;

      let count = 0;
      let inTouch = false;
      const startIdx = best.iEnd + 1;
      const endIdx   = Math.min(b1h.length - 1, best.iEnd + cfg.retestLookaheadH);

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

    // scoring per side
    const scoreSide = (list) => {
      if (!list.length) return;
      const maxD = Math.max(...list.map(z=>z.dwell), 1);
      const maxT = Math.max(...list.map(z=>z.touches), 1);
      const maxR = Math.max(...list.map(z=>z.retests), 1);
      const recN = 1; // same window for now
      for (const z of list) {
        const volN = z.dwell / maxD; // dwell as proxy for parked volume
        const tchN = z.touches / maxT;
        const rtsN = z.retests / maxR;
        z.score = W_VOL*volN + W_TCH*tchN + W_RTS*rtsN + W_REC*recN;
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

  /* ---------------- Draw (read-only) ---------------- */
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
    cnv.width = Math.max(1,w);
    cnv.height= Math.max(1,h);
    const ctx = cnv.getContext("2d");
    ctx.clearRect(0,0,w,h);
    ctx.font = FONT;

    const volMax = Math.max(1, ...bands.map(b=>b.volSum||0));
    const xLeft = 0; // extend pivot shelves fully left

    // 1) Pivot shelves + volume plates
    for (const bd of bands){
      const yTop=yFor(bd.pHi), yBot=yFor(bd.pLo), xPivot=xFor(bd.tPivot);
      if (yTop==null||yBot==null||xPivot==null) continue;

      const color = bd.side==="SUP" ? COL_SUP : COL_DEM;
      const yMin=Math.min(yTop,yBot), yMax=Math.max(yTop,yBot);
      const rectX=Math.min(xLeft,xPivot);
      const rectW=Math.max(1,Math.abs(xPivot-xLeft));
      const rectH=Math.max(2,yMax-yMin);

      ctx.globalAlpha=FILL_ALPHA; ctx.fillStyle=color;
      ctx.fillRect(rectX,yMin,rectW,rectH);
      ctx.globalAlpha=1; ctx.lineWidth=STROKE_W; ctx.strokeStyle=color;
      ctx.strokeRect(rectX+0.5,yMin+0.5,rectW-1,rectH-1);

      // tag + plate
      const frac = Math.max(0,(bd.volSum||0)/volMax);
      const tagH = Math.max(TAG_MIN_H, Math.floor(h*0.15*frac));
      const tagX = xPivot - TAG_W;
      const tagY = Math.max(2, Math.min(h-tagH-2, yMin + (rectH - tagH)/2));
      ctx.fillStyle = color; ctx.fillRect(tagX,tagY,TAG_W,tagH);
      ctx.lineWidth=1; ctx.strokeStyle=COL_EDGE; ctx.strokeRect(tagX+0.5,tagY+0.5,TAG_W-1,tagH-1);

      const txt = fmtVol(bd.volSum||0);
      const metrics = ctx.measureText(txt);
      const textW = Math.ceil(metrics.width), textH = 18;
      let plateX = tagX + TAG_W + TEXT_PAD, plateY = tagY + Math.max(0,(tagH - textH)/2);
      const plateW = textW + 2*6;
      if (plateX + plateW > (chartContainer.clientWidth||1) - 2) plateX = tagX - TEXT_PAD - plateW;

      ctx.globalAlpha = 0.85; ctx.fillStyle="#0b0f17";
      ctx.fillRect(plateX, plateY, plateW, textH);
      ctx.globalAlpha = 1; ctx.lineWidth=1; ctx.strokeStyle="#1f2a44";
      ctx.strokeRect(plateX+0.5, plateY+0.5, plateW-1, textH-1);

      const textX = plateX + 6, textY = plateY + textH - 4;
      ctx.fillStyle="#e5e7eb"; ctx.strokeStyle="#000"; ctx.lineWidth=2;
      ctx.strokeText(txt, textX, textY);
      ctx.fillText(txt, textX, textY);
    }

    // 2) 1h consolidation band + clusters
    if (testBox){
      const yTop=yFor(testBox.pHi), yBot=yFor(testBox.pLo);
      const xS=xFor(testBox.tStart), xE=xFor(testBox.tEnd);
      if (yTop!=null && yBot!=null && xS!=null && xE!=null){
        const yMin=Math.min(yTop,yBot), yMax=Math.max(yTop,yBot);
        const xLeftB=Math.min(xS,xE),  xRightB=Math.max(xS,xE);
        const rectH=Math.max(2,yMax-yMin);

        ctx.globalAlpha=TEST_ALPHA; ctx.fillStyle=COL_TEST;
        ctx.fillRect(xLeftB,yMin,Math.max(1,xRightB-xLeftB),rectH);
        ctx.globalAlpha=1; ctx.lineWidth=STROKE_W; ctx.strokeStyle=COL_TEST;
        ctx.strokeRect(xLeftB+0.5,yMin+0.5,Math.max(1,xRightB-xLeftB)-1,rectH-1);

        // clusters
        if (wickClusters) {
          const viewLeft  = 0;
          const viewRight = chartContainer.clientWidth || 1;
          const viewW     = Math.max(1, viewRight - viewLeft);

          const drawPrimary = (cl) => {
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

            // label (P1)
            const pct = Math.round((cl.score || 0) * 100);
            const label = `${cl.touches||0}T · ${cl.dwell||0}h` + (cl.retests?` · ${cl.retests}R`:"") + (pct?` · ${pct}%`:"") + "  (P1)";
            const m = ctx.measureText(label);
            const tW = Math.ceil(m.width), tH = 18;
            let px = viewRight - TEXT_PAD - (tW + 2*6);
            let py = yMid - tH/2;

            ctx.globalAlpha = 0.85; ctx.fillStyle = "#0b0f17";
            ctx.fillRect(px, py, tW + 2*6, tH);
            ctx.globalAlpha = 1; ctx.lineWidth=1; ctx.strokeStyle="#1f2a44";
            ctx.strokeRect(px+0.5, py+0.5, (tW + 2*6)-1, tH-1);

            const tx = px + 6, ty = py + tH - 4;
            ctx.fillStyle="#e5e7eb"; ctx.strokeStyle="#000"; ctx.lineWidth=2;
            ctx.strokeText(label, tx, ty);
            ctx.fillText(label, tx, ty);
          };

          const drawSecondary = (cl) => {
            if (!cl) return;
            const yLo = yFor(cl.pLo), yHi = yFor(cl.pHi);
            if (yLo == null || yHi == null) return;
            const yMid = (yLo + yHi) / 2;

            ctx.save();
            ctx.setLineDash([6,6]);
            ctx.lineWidth = 2;
            ctx.strokeStyle = COL_P2;
            ctx.beginPath();
            ctx.moveTo(viewLeft, yMid);
            ctx.lineTo(viewRight, yMid);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();

            // tiny plate: "P2 64%"
            const pct = Math.round((cl.score || 0) * 100);
            const tag = `P2 ${pct}%`;
            const m = ctx.measureText(tag);
            const tW = Math.ceil(m.width), tH = 16;
            let px = viewRight - TEXT_PAD - (tW + 2*6);
            let py = yMid - tH/2;

            ctx.globalAlpha = 0.85; ctx.fillStyle = "#0b0f17";
            ctx.fillRect(px, py, tW + 2*6, tH);
            ctx.globalAlpha = 1; ctx.lineWidth=1; ctx.strokeStyle="#1f2a44";
            ctx.strokeRect(px+0.5, py+0.5, (tW + 2*6)-1, tH-1);

            const tx = px + 6, ty = py + tH - 3;
            ctx.fillStyle="#e5e7eb"; ctx.strokeStyle="#000"; ctx.lineWidth=2;
            ctx.strokeText(tag, tx, ty);
            ctx.fillText(tag, tx, ty);
          };

          if (wickClusters.top) {
            drawSecondary(wickClusters.top.secondary);
            drawPrimary  (wickClusters.top.primary);
          }
          if (wickClusters.bottom) {
            drawSecondary(wickClusters.bottom.secondary);
            drawPrimary  (wickClusters.bottom.primary);
          }
        }
      }
    }
  }

  // rAF throttle (read-only redraw)
  function scheduleDraw(){
    if (rafId!=null) return;
    rafId = requestAnimationFrame(()=>{ rafId=null; doDraw(); });
  }

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
      rebuildTestBox();  // 1h band + clusters (adaptive)
      doDraw();
    },
    update(latest){
      if (!latest) return;
      const t=toSec(latest.time); const last=bars.at(-1);
      if (!last || t>last.time) bars.push({...latest,time:t});
      else if (t===last.time)   bars[bars.length-1] = {...latest,time:t};
      else return;

      rebuildBands();
      if (bars.length % 3 === 0) rebuildTestBox(); // light cadence
      doDraw();
    },
    destroy(){
      try { ts.unsubscribeVisibleLogicalRangeChange?.(onLogical); } catch {}
      try { ts.unsubscribeVisibleTimeRangeChange?.(onVisible); } catch {}
      window.removeEventListener("resize", scheduleDraw);
    },
  };
}
