// src/components/overlays/FourShelvesOverlay.js
// Four Shelves — full-width bands:
//   1h   : Blue (primary) + Yellow (secondary)  [Major]
//   10m  : Blue (primary) + Yellow (secondary)  [Micro]
// Inert (no fit/visibleRange). Cleans canvas on destroy().
//
// Micro changes:
// - Uses only RTH bars (13:30–20:00 UTC) from the last 10 days
// - Shelf height from price-by-time density (5 bps histogram over wicks)
//   Band = mode ± percentile envelope (25–75%), with optional snap to POC/round
//
// Diagnostics: window.__DUALSHELVES.{why1hY,why10mY,why10mB}
// Labels: “1h B”, “1h Y”, “10m B”, “10m Y”

export default function createFourShelvesOverlay({ chart, priceSeries, chartContainer, timeframe }) {
  if (!chart || !priceSeries || !chartContainer) {
    console.warn("[FourShelves] missing args");
    return { seed() {}, update() {}, destroy() {} };
  }

  /* ---------------- Visuals ---------------- */
  const Z = 20; // canvas zIndex
  const STROKE_W = 2;
  const FONT = "bold 12px system-ui, -apple-system, Segoe UI, Roboto, Arial";

  // 1h (major) colors
  const COL_MAJOR_B_FILL = "rgba( 59,130,246,0.22)";
  const COL_MAJOR_B_STRO = "rgba( 59,130,246,0.95)";
  const COL_MAJOR_Y_FILL = "rgba(255,221,  0,0.24)";
  const COL_MAJOR_Y_STRO = "rgba(255,221,  0,0.95)";

  // 10m (micro) colors
  const COL_MICRO_B_FILL = "rgba( 59,130,246,0.16)";
  const COL_MICRO_B_STRO = "rgba( 59,130,246,0.85)";
  const COL_MICRO_Y_FILL = "rgba(255,237,  0,0.20)";
  const COL_MICRO_Y_STRO = "rgba(255,237,  0,0.95)";

  const DASH_MAJOR_Y = [6, 6]; // dashed
  const DASH_MICRO_Y = [3, 5]; // dotted-ish
  const DASH_MICRO_B = [5, 4]; // micro-blue dashed

  const FULL_WIDTH = true;
  const SHOW_TICKS = true; // faint markers at tStart/tEnd

  /* --------------- Parameters per timeframe --------------- */
  // 1h (keep strict — this is the “perfect” one)
  const MAJOR = {
    spanMin: 16, spanMax: 24,             // hours
    tightBpsCap: 35,                       // ≤ 0.35%
    minTouches: 3, minDwell: 8, minRetests: 2,
    stickyTolSec: 2 * 3600,               // ±2h tolerance
    stickyOverlapMax: 0.50,               // sticky allowed up to 50% overlap
    fallbackOverlapMax: 0.65,             // mild overlap fallback
    sameTfOverlapMax: 0.20,               // 1h blue vs 1h yellow
  };

  // 10m (slightly relaxed so it shows consistently)
  const MICRO = {
    spanMin: 10, spanMax: 24,             // 100–240 min
    tightBpsCap: 28,                       // ≤ 0.28%
    minTouches: 3, minDwell: 5, minRetests: 1,
    stickyTolSec: 20 * 60,                // ±20m
    stickyOverlapMax: 0.20,
    fallbackOverlapMax: 0.35,
    sameTfOverlapMax: 0.20,               // 10m blue vs 10m yellow
    minGapPct: 0.0010,                    // ≥ 0.10% price gap for mild-overlap
  };

  // Micro analysis lookback: last 10 calendar days
  const MICRO_LOOKBACK_DAYS = 10;
  const SECONDS_PER_DAY = 86400;

  // Density config (micro)
  const DENSITY_BPS = 5;          // 5 bps bucket
  const P_LO_PCT = 0.25;          // percentile low
  const P_HI_PCT = 0.75;          // percentile high
  const SNAP_POC_THRESH = 0.0005; // 0.05% to snap to POC
  const SNAP_ROUND_THRESH = 0.0003; // 0.03% to snap round (.00/.50 etc.)
  const MIN_BAND_BUCKETS = 2;     // ensure at least this many buckets height

  /* ---------------- State ---------------- */
  let barsAsc = [];        // asc bars [{time,open,high,low,close,volume}]
  let last10mBucket = null;
  let last1hBucket  = null;

  let majorBlue   = null, majorYellow = null;
  let microBlue   = null, microYellow = null;

  let prevMajorBlue = null;
  let prevMicroBlue = null;

  // diagnostics
  let why1hY = "";
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

  // RTH (13:30–20:00 UTC) filter
  function isRTH_UTC(tSec) {
    const d = new Date(tSec * 1000);
    const h = d.getUTCHours();
    const m = d.getUTCMinutes();
    const mins = h * 60 + m;
    return mins >= (13*60 + 30) && mins < (20*60); // 13:30 ≤ t < 20:00 UTC
  }

  // Slice micro source bars: last 10 days AND RTH-only
  function microSourceSliceRTH() {
    if (!barsAsc.length) return [];
    const lastT = barsAsc[barsAsc.length - 1].time;
    const cutoff = lastT - MICRO_LOOKBACK_DAYS * SECONDS_PER_DAY;
    const recent = barsAsc.filter(b => b.time >= cutoff && isRTH_UTC(b.time));
    return recent.length ? recent : barsAsc.filter(b => isRTH_UTC(b.time)); // fallback: just RTH
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

  // annotate touches/dwell/retests on window for selection scoring
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
    // sticky reuse if close in time and overlap within limit
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

    // best non-overlap already tried; allow mild overlap with min price gap
    const mild = list.find(z => {
      if (z === currentBlue) return false;
      const ov = overlapRatio(currentBlue, z);
      if (ov > cfg.fallbackOverlapMax) return false;
      if (cfg.minGapPct && midHint){
        const mid = (z.pLo + z.pHi)/2;
        const midB= (currentBlue.pLo + currentBlue.pHi)/2;
        const gap = Math.abs(mid - midB) / Math.max(1e-9, midB);
        if (gap < cfg.minGapPct) return false;
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

  /* ---------- Micro density refinement (mode ± percentiles) ---------- */
  function refineBandDensity(barsTF, cand) {
    const { iStart, iEnd } = cand;
    const spanBars = barsTF.slice(iStart, iEnd+1);
    if (!spanBars.length) return { ...cand };

    // Reference price for step
    const ref = barsTF.at(-1).close || spanBars.at(-1).close;
    const step = (DENSITY_BPS / 10000) * Math.max(1e-9, ref);

    // Build histogram using wicks; include each bar's wick coverage in buckets
    let lo = +Infinity, hi = -Infinity;
    for (const b of spanBars){ if (b.low < lo) lo=b.low; if (b.high > hi) hi=b.high; }
    if (!(hi > lo)) return { ...cand };
    const nb = Math.max(1, Math.ceil((hi - lo) / step) + 2); // +2 guard
    const hist = new Array(nb).fill(0);
    const volw = new Array(nb).fill(0);

    for (const b of spanBars){
      const wLo = Math.min(b.open,b.close,b.low);
      const wHi = Math.max(b.open,b.close,b.high);
      let i0 = Math.max(0, Math.floor((wLo - lo) / step));
      let i1 = Math.min(nb - 1, Math.floor((wHi - lo) / step));
      for (let i=i0; i<=i1; i++){
        hist[i] += 1;
        volw[i] += Number(b.volume || 0);
      }
    }

    // mode index (most touches)
    let modeI = 0, best = -1;
    for (let i=0;i<nb;i++){ if (hist[i] > best){ best = hist[i]; modeI = i; } }
    const total = hist.reduce((a,b)=>a+b,0) || 1;

    // CDF to pick percentiles (25–75)
    const cdf = new Array(nb);
    let run = 0;
    for (let i=0;i<nb;i++){ run += hist[i]; cdf[i] = run / total; }

    function idxForPct(p){
      for (let i=0;i<nb;i++){ if (cdf[i] >= p) return i; }
      return nb - 1;
    }
    // choose indices but **center around mode** when possible
    let iLo = idxForPct(P_LO_PCT);
    let iHi = idxForPct(P_HI_PCT);
    if (iHi - iLo < MIN_BAND_BUCKETS) {
      // widen symmetrically about mode
      iLo = Math.max(0, modeI - Math.ceil(MIN_BAND_BUCKETS/2));
      iHi = Math.min(nb-1, iLo + MIN_BAND_BUCKETS);
    }

    // optional snap: POC by volume
    let pocI = 0, pocMax = -1;
    for (let i=0;i<nb;i++){ if (volw[i] > pocMax){ pocMax = volw[i]; pocI = i; } }

    const pMid = lo + modeI * step;
    const pocP = lo + pocI * step;

    let bandMid = pMid;
    if (Math.abs((pocP - pMid) / Math.max(1e-9, pMid)) <= SNAP_POC_THRESH) {
      bandMid = pocP;
    } else {
      // snap to .00/.50 if very close
      const roundLevels = [
        Math.round(bandMid),                        // .00
        Math.floor(bandMid) + 0.5                   // .50
      ];
      for (const lvl of roundLevels){
        if (Math.abs((lvl - bandMid) / Math.max(1e-9, bandMid)) <= SNAP_ROUND_THRESH) {
          bandMid = lvl; break;
        }
      }
    }

    // final band
    let pLo = lo + iLo * step;
    let pHi = lo + iHi * step;
    if (pHi - pLo < MIN_BAND_BUCKETS * step) {
      // enforce minimum band thickness
      const extra = (MIN_BAND_BUCKETS * step - (pHi - pLo)) / 2;
      pLo = Math.max(0, pLo - extra);
      pHi = pHi + extra;
    }

    // ensure band still within original window envelope (soft clamp)
    const wLo = Math.min(...spanBars.map(b=>b.low));
    const wHi = Math.max(...spanBars.map(b=>b.high));
    pLo = Math.max(wLo, pLo);
    pHi = Math.min(wHi, pHi);

    return { ...cand, pLo, pHi, pMid: bandMid };
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

  function rebuildMicro(){
    const recentRTH = microSourceSliceRTH();
    const bars10m = resampleTF(recentRTH, 600);

    // 1) pick windows with hi/lo logic (good for selection), then
    // 2) refine each chosen window to density band (mode ± percentiles)
    let {blue, yellow, all} = pickTwoZones(bars10m, MICRO, "10m");
    microBlue = blue ? refineBandDensity(bars10m, blue) : null;

    if (!yellow && microBlue) {
      const midB = (microBlue.pMid ?? (microBlue.pLo + microBlue.pHi)/2);
      yellow = stickyYellow(microBlue, prevMicroBlue, all, MICRO, "10m", midB);
    }
    microYellow = yellow ? refineBandDensity(bars10m, yellow) : null;

    prevMicroBlue = microBlue ? { ...microBlue } : prevMicroBlue;
  }

  /* ---------------- Canvas draw (FULL-WIDTH bands) ---------------- */
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

    const viewLeft  = 0;
    const viewRight = w;
    const viewW     = Math.max(1, viewRight - viewLeft);

    function bandFor(zone, fill, stroke, dash, label){
      if (!zone) return;
      const yTop = yFor(zone.pHi), yBot = yFor(zone.pLo);
      const xS   = xFor(zone.tStart), xE = xFor(zone.tEnd);
      if (yTop==null||yBot==null) return;
      const yMin = Math.min(yTop,yBot),  yMax = Math.max(yTop,yBot);
      const rectH = Math.max(2, yMax - yMin);

      // FULL WIDTH fill + border
      ctx.globalAlpha = 1;
      ctx.fillStyle = fill;
      ctx.fillRect(viewLeft, yMin, viewW, rectH);

      ctx.save();
      if (dash && dash.length) ctx.setLineDash(dash);
      ctx.lineWidth = STROKE_W;
      ctx.strokeStyle = stroke;
      ctx.strokeRect(viewLeft + 0.5, yMin + 0.5, viewW - 1, rectH - 1);
      ctx.restore();

      // optional ticks at the real window edges
      if (SHOW_TICKS && xS!=null && xE!=null){
        ctx.save();
        ctx.globalAlpha = 0.25;
        ctx.setLineDash([2,4]);
        ctx.strokeStyle = stroke;
        ctx.beginPath(); ctx.moveTo(xS, yMin); ctx.lineTo(xS, yMax); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(xE, yMin); ctx.lineTo(xE, yMax); ctx.stroke();
        ctx.restore();
      }

      if (label) {
        const yMid = (yMin + yMax)/2;
        drawLabel(ctx, viewRight, yMid, label);
      }
    }

    // Draw order: major (blue then yellow), then micro on top
    bandFor(majorBlue,   COL_MAJOR_B_FILL, COL_MAJOR_B_STRO, null,         "1h B");
    bandFor(majorYellow, COL_MAJOR_Y_FILL, COL_MAJOR_Y_STRO, DASH_MAJOR_Y, "1h Y");
    bandFor(microBlue,   COL_MICRO_B_FILL, COL_MICRO_B_STRO, DASH_MICRO_B, "10m B");
    bandFor(microYellow, COL_MICRO_Y_FILL, COL_MICRO_Y_STRO, DASH_MICRO_Y, "10m Y");

    // diagnostics
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
