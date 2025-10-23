// src/components/overlays/FourShelvesOverlay.js
// Four Shelves Overlay — TWO shelves per timeframe:
//   Major (1h):   Blue (primary) + Yellow (secondary)
//   Micro (10m):  Blue (primary) + Yellow (secondary)
// Window-only rectangles (tStart→tEnd), inert (no fit/visibleRange)
// Rebuild cadence: micro on each 10m close, major on each 1h close
// Diagnostics: window.__DUALSHELVES.{why1hY,why10mY,why10mB}
// Labels: “1h B”, “1h Y”, “10m B”, “10m Y”
// UPDATE: Micro (10m) analysis uses **last 10 calendar days** of bars only.

export default function createFourShelvesOverlay({ chart, priceSeries, chartContainer, timeframe }) {
  if (!chart || !priceSeries || !chartContainer) {
    console.warn("[FourShelves] missing args");
    return { seed() {}, update() {}, destroy() {} };
  }

  /* ---------------- Visuals ---------------- */
  const Z = 20; // canvas zIndex
  const STROKE_W = 2;
  const FONT = "bold 12px system-ui, -apple-system, Segoe UI, Roboto, Arial";

  // 1h colors (darker)
  const COL_MAJOR_B_FILL = "rgba( 59,130,246,0.22)";
  const COL_MAJOR_B_STRO = "rgba( 59,130,246,0.95)";
  const COL_MAJOR_Y_FILL = "rgba(255,221,  0,0.24)";
  const COL_MAJOR_Y_STRO = "rgba(255,221,  0,0.95)";

  // 10m colors (lighter variants to distinguish)
  const COL_MICRO_B_FILL = "rgba( 59,130,246,0.16)";
  const COL_MICRO_B_STRO = "rgba( 59,130,246,0.80)";
  const COL_MICRO_Y_FILL = "rgba(255,237,  0,0.18)";
  const COL_MICRO_Y_STRO = "rgba(255,237,  0,0.90)";

  const DASH_MAJOR_Y = [6, 6]; // dashed
  const DASH_MICRO_Y = [3, 5]; // dotted-ish
  const DASH_MICRO_B = [5, 4]; // micro-blue dashed

  /* --------------- Parameters per timeframe --------------- */
  // Major (1h baseline) — unchanged
  const MAJOR = {
    spanMin: 16, spanMax: 24,             // hours
    tightBpsCap: 35,                       // ≤ 0.35%
    minTouches: 3, minDwell: 8, minRetests: 2,
    stickyTolSec: 2 * 3600,                // ±2h tolerance
    stickyOverlapMax: 0.50,                // ≤ 50% for sticky reuse
    fallbackOverlapMax: 0.65,              // last resort
    sameTfOverlapMax: 0.20,                // blue vs yellow (same TF)
  };

  // Micro (10m baseline) — relaxed so it shows on 10m view
  const MICRO = {
    spanMin: 10, spanMax: 24,             // 100–240 minutes (broader)
    tightBpsCap: 28,                       // ≤ 0.28%
    minTouches: 3, minDwell: 5, minRetests: 1,
    stickyTolSec: 20 * 60,                 // ±20m
    stickyOverlapMax: 0.20,
    fallbackOverlapMax: 0.35,
    sameTfOverlapMax: 0.20,
    minGapPct: 0.0010,                     // ≥ 0.10% price-gap when using mild-overlap fallback
  };

  // Micro history window (NEW): limit to last 10 days of source bars
  const MICRO_LOOKBACK_DAYS = 10;
  const SECONDS_PER_DAY = 86400;

  /* ---------------- State ---------------- */
  let barsAsc = [];        // asc [{time,open,high,low,close,volume}]
  let last10mBucket = null;
  let last1hBucket  = null;

  let majorBlue   = null, majorYellow = null;
  let microBlue   = null, microYellow = null;

  let prevMajorBlue = null;
  let prevMicroBlue = null;

  let why1hY = "";   // diagnostics
  let why10mB = "";
  let why10mY = "";

  let rafId = null;
  const ts = chart.timeScale();

  /* ---------------- Helpers ---------------- */
  const toSec = (t) => (t > 1e12 ? Math.floor(t/1000) : t);
  const xFor  = (tSec) => { const x = ts.timeToCoordinate(tSec); return Number.isFinite(x) ? x : null; };
  const yFor  = (p)    => { const y = priceSeries.priceToCoordinate(Number(p)); return Number.isFinite(y) ? y : null; };
  const floorTo = (t, sec) => Math.floor(t / sec) * sec;

  const overlapRatio = (a, b) => {
    const lo = Math.max(a.tStart, b.tStart);
    const hi = Math.min(a.tEnd,   b.tEnd);
    if (hi <= lo) return 0;
    const union = Math.max(a.tEnd, b.tEnd) - Math.min(a.tStart, b.tStart);
    return union <= 0 ? 0 : (hi - lo) / union;
  };

  function resampleTF(bars, bucketSec) {
    if (!bars?.length) return [];
    const out = [];
    let cur = null;
    for (const b of bars) {
      const t = toSec(b.time);
      const bucket = floorTo(t, bucketSec);
      if (!cur || bucket !== cur.time) {
        if (cur) out.push(cur);
        cur = { time: bucket, open: b.open, high: b.high, low: b.low, close: b.close, volume: Number(b.volume || 0) };
      } else {
        cur.high = Math.max(cur.high, b.high);
        cur.low  = Math.min(cur.low , b.low );
        cur.close = b.close;
        cur.volume = Number(cur.volume || 0) + Number(b.volume || 0);
      }
    }
    if (cur) out.push(cur);
    return out;
  }

  function slideCandidates(barsTF, spanMin, spanMax, tightBpsCap) {
    const n = barsTF.length, out = [];
    if (n < spanMin) return out;
    for (let span=spanMin; span<=spanMax; span++){
      for (let i=0; i+span<=n; i++){
        const j = i + span - 1;
        let lo = +Infinity, hi = -Infinity;
        for (let k=i; k<=j; k++){ if (barsTF[k].low < lo) lo=barsTF[k].low; if (barsTF[k].high > hi) hi=barsTF[k].high; }
        const mid = (lo + hi) / 2;
        const bps = ((hi - lo) / Math.max(1e-9, mid)) * 10000;
        if (bps > tightBpsCap) continue;
        out.push({
          iStart: i, iEnd: j,
          tStart: barsTF[i].time, tEnd: barsTF[j].time,
          pLo: lo, pHi: hi,
          bps, spanBars: span,
        });
      }
    }
    return out;
  }

  function annotateStats(barsTF, cand, cfg){
    const { iStart, iEnd, pLo, pHi } = cand;
    const spanBars = barsTF.slice(iStart, iEnd+1);
    const lastClose = barsTF.at(-1).close || spanBars.at(-1).close;
    const step = (5 / 10000) * lastClose; // 5 bps
    const expand = step;

    const nearBand = (side) => (
      side === "top"
        ? { lo: pHi - step, hi: pHi + step }
        : { lo: pLo - step, hi: pLo + step }
    );

    function touchesNear(side){
      const band = nearBand(side);
      let touches = 0;
      for (const b of spanBars){
        const wickHi = Math.max(b.open,b.close,b.high);
        const wickLo = Math.min(b.open,b.close,b.low);
        if (!(wickHi < band.lo || wickLo > band.hi)) touches++;
      }
      return touches;
    }

    function dwellNear(side){
      const band = nearBand(side);
      let dwell = 0;
      for (const b of spanBars){
        const bodyLo = Math.min(b.open,b.close);
        const bodyHi = Math.max(b.open,b.close);
        if (!(bodyHi < (band.lo - expand) || bodyLo > (band.hi + expand))) dwell++;
      }
      return dwell;
    }

    const tTop = touchesNear("top"), tBot = touchesNear("bot");
    const dTop = dwellNear("top"),   dBot = dwellNear("bot");
    const side = (tTop >= tBot) ? "top" : "bot";

    function retests(side){
      const band = nearBand(side);
      let count = 0, inTouch = false;
      const start = iEnd + 1;
      const end = Math.min(barsTF.length - 1, iEnd + (cfg.spanMax + 6));
      for (let i = start; i <= end; i++){
        const b = barsTF[i];
        const wHi = Math.max(b.open,b.close,b.high);
        const wLo = Math.min(b.open,b.close,b.low);
        const touch = !(wHi < band.lo || wLo > band.hi);
        if (touch && !inTouch){ count++; inTouch = true; }
        else if (!touch && inTouch){ inTouch = false; }
      }
      return count;
    }

    const touches = side === "top" ? tTop : tBot;
    const dwell   = side === "top" ? dTop : dBot;
    const rtests  = retests(side);

    return { ...cand, side, touches, dwell, retests: rtests };
  }

  function pickTwoZones(barsTF, cfg, diagPrefix){
    const cands = slideCandidates(barsTF, cfg.spanMin, cfg.spanMax, cfg.tightBpsCap);
    if (!cands.length) {
      if (diagPrefix === "10m") why10mB = "no_candidates";
      return { blue:null, yellow:null, all:[] };
    }
    const ann = cands.map(c => annotateStats(barsTF, c, cfg));
    const ok = ann.filter(z => z.touches >= cfg.minTouches && z.dwell >= cfg.minDwell && z.retests >= cfg.minRetests);
    if (!ok.length) {
      if (diagPrefix === "10m") why10mB = "floors_filtered_all";
      return { blue:null, yellow:null, all:[] };
    }

    const maxD = Math.max(...ok.map(z=>z.dwell),1);
    const maxT = Math.max(...ok.map(z=>z.touches),1);
    const maxR = Math.max(...ok.map(z=>z.retests),1);
    const maxDen = Math.max(...ok.map(z => z.touches / Math.max(1, z.spanBars)));

    ok.forEach(z => {
      const densN = (z.touches / Math.max(1,z.spanBars)) / (maxDen || 1);
      const volN  = z.dwell / maxD;
      const tchN  = z.touches / maxT;
      const rtsN  = z.retests / maxR;
      z.score = 0.35*densN + 0.30*volN + 0.20*tchN + 0.10*rtsN + 0.05*1;
    });

    ok.sort((a,b)=> b.score - a.score || b.spanBars - a.spanBars);
    const blue = ok[0];
    if (diagPrefix === "10m") why10mB = "ok";

    // default yellow with non-overlap
    let yellow = null;
    for (let k=1;k<ok.length;k++){
      const z = ok[k];
      if (overlapRatio(blue,z) <= cfg.sameTfOverlapMax){ yellow = z; break; }
    }
    if (!yellow && diagPrefix === "1h") { why1hY = "nonoverlap_none"; }
    if (!yellow && diagPrefix === "10m") { why10mY = "nonoverlap_none"; }

    return { blue, yellow, all: ok };
  }

  function stickyYellow(currentBlue, prevBlue, list, cfg, diagPrefix, midHint){
    // try sticky reuse
    if (prevBlue && currentBlue){
      const timeClose = (Math.abs(prevBlue.tStart - currentBlue.tStart) <= cfg.stickyTolSec) ||
                        (Math.abs(prevBlue.tEnd   - currentBlue.tEnd)   <= cfg.stickyTolSec);
      const ov = overlapRatio(currentBlue, prevBlue);
      if (timeClose && ov <= cfg.stickyOverlapMax) {
        const match = list.find(c =>
          Math.abs(c.tStart - prevBlue.tStart) <= cfg.stickyTolSec &&
          Math.abs(c.tEnd   - prevBlue.tEnd)   <= cfg.stickyTolSec
        );
        if (diagPrefix === "1h") why1hY = "sticky_reused";
        if (diagPrefix === "10m") why10mY = "sticky_reused";
        return match || prevBlue;
      }
    }

    // best non-overlap already attempted before calling sticky; if still none, allow mild overlap
    const mild = list.find(z => {
      if (z === currentBlue) return false;
      const ov = overlapRatio(currentBlue, z);
      if (ov > cfg.fallbackOverlapMax) return false;
      if (cfg.minGapPct && midHint){
        const mid = (z.pLo + z.pHi)/2;
        const midB= (currentBlue.pLo + currentBlue.pHi)/2;
        const gap = Math.abs(mid - midB) / Math.max(1e-9, midB);
        if (gap < cfg.minGapPct) return false; // too close — would sit on top
      }
      return true;
    });
    if (mild) {
      if (diagPrefix === "1h") why1hY = "mild_overlap_ok";
      if (diagPrefix === "10m") why10mY = "mild_overlap_ok";
      return mild;
    }

    if (diagPrefix === "1h") why1hY = "no_secondary";
    if (diagPrefix === "10m") why10mY = "no_secondary";
    return null;
  }

  /* ---------------- Rebuild per TF ---------------- */
  function rebuildMajor(){
    const bars1h = resampleTF(barsAsc, 3600);
    let {blue, yellow, all} = pickTwoZones(bars1h, MAJOR, "1h");
    majorBlue = blue || null;

    why1hY = yellow ? "nonoverlap_ok" : why1hY || "nonoverlap_none";
    if (!yellow && majorBlue) {
      const midB = (majorBlue.pLo + majorBlue.pHi)/2;
      yellow = stickyYellow(majorBlue, prevMajorBlue, all, MAJOR, "1h", midB);
    }
    majorYellow = yellow || null;
    prevMajorBlue = majorBlue ? { ...majorBlue } : prevMajorBlue;
  }

  // NEW: limit micro analysis window to last 10 days of source bars
  function microSourceSlice() {
    if (!barsAsc.length) return [];
    const lastT = barsAsc[barsAsc.length - 1].time;
    const cutoff = lastT - MICRO_LOOKBACK_DAYS * SECONDS_PER_DAY;
    // slice only recent bars (keep order)
    const i0 = barsAsc.findIndex(b => b.time >= cutoff);
    return i0 === -1 ? barsAsc.slice() : barsAsc.slice(i0);
  }

  function rebuildMicro(){
    const recent = microSourceSlice();                // ← only last 10 days
    const bars10m = resampleTF(recent, 600);
    let {blue, yellow, all} = pickTwoZones(bars10m, MICRO, "10m");
    microBlue = blue || null;

    if (!yellow && microBlue) {
      const midB = (microBlue.pLo + microBlue.pHi)/2;
      yellow = stickyYellow(microBlue, prevMicroBlue, all, MICRO, "10m", midB);
    }
    microYellow = yellow || null;
    prevMicroBlue = microBlue ? { ...microBlue } : prevMicroBlue;
  }

  /* ---------------- Canvas draw (window-only rectangles) ---------------- */
  function scheduleDraw(){ if (rafId!=null) return; rafId = requestAnimationFrame(()=>{ rafId=null; draw(); }); }

  function drawLabel(ctx, xR, yMid, tag) {
    ctx.save();
    const pad = 4, h = 16;
    ctx.font = FONT;
    const w = Math.ceil(ctx.measureText(tag).width) + pad*2;
    const x = Math.max(0, xR - w - 6);
    const y = Math.max(0, Math.round(yMid - h/2));
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = "rgba(11,15,23,0.9)";
    ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "rgba(31,42,68,0.9)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x+0.5, y+0.5, w-1, h-1);
    ctx.fillStyle = "#e5e7eb";
    ctx.fillText(tag, x+pad, y + h - 4);
    ctx.restore();
  }

  function draw(){
    const w = chartContainer.clientWidth  || 1;
    const h = chartContainer.clientHeight || 1;

    let cnv = chartContainer.querySelector("canvas.overlay-canvas.four-shelves");
    if(!cnv){
      cnv = document.createElement("canvas");
      cnv.className = "overlay-canvas four-shelves";
      Object.assign(cnv.style,{ position:"absolute", inset:0, pointerEvents:"none", zIndex:Z });
      chartContainer.appendChild(cnv);
    }
    if (!w || !h) return;
    cnv.width = w; cnv.height = h;

    const ctx = cnv.getContext("2d");
    ctx.clearRect(0,0,w,h);
    ctx.font = FONT;

    function rectFor(zone, fill, stroke, dash, label){
      if (!zone) return;
      const yTop = yFor(zone.pHi), yBot = yFor(zone.pLo);
      const xS   = xFor(zone.tStart), xE = xFor(zone.tEnd);
      if (yTop==null||yBot==null||xS==null||xE==null) return;
      const yMin = Math.min(yTop,yBot),  yMax = Math.max(yTop,yBot);
      const xL   = Math.min(xS,xE),      xR   = Math.max(xS,xE);
      const rectW = Math.max(1, xR-xL),  rectH = Math.max(2, yMax-yMin);

      ctx.globalAlpha = 1;
      ctx.fillStyle = fill;
      ctx.fillRect(xL, yMin, rectW, rectH);

      ctx.save();
      if (dash && dash.length) ctx.setLineDash(dash);
      ctx.lineWidth = STROKE_W;
      ctx.strokeStyle = stroke;
      ctx.strokeRect(xL + 0.5, yMin + 0.5, rectW - 1, rectH - 1);
      ctx.restore();

      if (label) {
        const yMid = (yMin + yMax)/2;
        drawLabel(ctx, xR, yMid, label);
      }
    }

    // Draw order: major first (blue then yellow), then micro on top
    rectFor(majorBlue,   COL_MAJOR_B_FILL, COL_MAJOR_B_STRO, null,         "1h B");
    rectFor(majorYellow, COL_MAJOR_Y_FILL, COL_MAJOR_Y_STRO, DASH_MAJOR_Y, "1h Y");
    rectFor(microBlue,   COL_MICRO_B_FILL, COL_MICRO_B_STRO, DASH_MICRO_B, "10m B");
    rectFor(microYellow, COL_MICRO_Y_FILL, COL_MICRO_Y_STRO, DASH_MICRO_Y, "10m Y");

    // expose diagnostics
    if (typeof window !== "undefined") {
      window.__DUALSHELVES = {
        zone1hB: majorBlue, zone1hY: majorYellow,
        zone10mB: microBlue, zone10mY: microYellow,
        why1hY, why10mB, why10mY,
      };
    }
  }

  /* ---------------- Subscriptions ---------------- */
  const onLogical = () => scheduleDraw();
  const onVisible = () => scheduleDraw();
  ts.subscribeVisibleLogicalRangeChange?.(onLogical);
  ts.subscribeVisibleTimeRangeChange?.(onVisible);
  window.addEventListener("resize", scheduleDraw);

  /* ---------------- API ---------------- */
  return {
    seed(rawBarsAsc){
      barsAsc = (rawBarsAsc||[]).map(b => ({ ...b, time: toSec(b.time) })).sort((a,b)=>a.time-b.time);

      const last = barsAsc.at(-1);
      last10mBucket = last ? floorTo(last.time, 600)  : null;
      last1hBucket  = last ? floorTo(last.time, 3600) : null;

      rebuildMajor();
      rebuildMicro();
      draw();
    },
    update(latest){
      if (!latest) return;
      const t = toSec(latest.time);
      const last = barsAsc.at(-1);
      if (!last || t > last.time) barsAsc.push({ ...latest, time: t });
      else if (t === last.time)   barsAsc[barsAsc.length-1] = { ...latest, time: t };
      else return;

      const b10 = floorTo(t, 600);
      const b60 = floorTo(t, 3600);
      if (b10 !== last10mBucket){
        last10mBucket = b10;
        rebuildMicro();
      }
      if (b60 !== last1hBucket){
        last1hBucket = b60;
        rebuildMajor();
      }
      draw();
    },
    destroy(){
      try { ts.unsubscribeVisibleLogicalRangeChange?.(onLogical); } catch {}
      try { ts.unsubscribeVisibleTimeRangeChange?.(onVisible); } catch {}
      window.removeEventListener("resize", scheduleDraw);
      const cnv = chartContainer.querySelector("canvas.overlay-canvas.four-shelves");
      if (cnv && cnv.parentNode === chartContainer) chartContainer.removeChild(cnv);
    },
  };
}
