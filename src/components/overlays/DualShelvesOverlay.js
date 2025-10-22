// src/components/overlays/FourShelvesOverlay.js
// Four Shelves Overlay — draws TWO shelves per timeframe:
//   Major (1h):   Blue (primary) + Yellow (secondary)
//   Micro (10m):  Blue (primary) + Yellow (secondary)
// Window-only rectangles (tStart→tEnd), non-overlap within each TF, inert (no fit/visibleRange)
// Recomputes: micro on each 10m close, major on each 1h close
// Fully removes canvas on destroy()

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
  const COL_MAJOR_B_FILL = "rgba( 59,130,246,0.22)"; // dark blue
  const COL_MAJOR_B_STRO = "rgba( 59,130,246,0.90)";
  const COL_MAJOR_Y_FILL = "rgba(255,221,  0,0.24)";
  const COL_MAJOR_Y_STRO = "rgba(255,221,  0,0.95)";

  // 10m colors (lighter variants to distinguish)
  const COL_MICRO_B_FILL = "rgba( 59,130,246,0.16)"; // light blue
  const COL_MICRO_B_STRO = "rgba( 59,130,246,0.70)";
  const COL_MICRO_Y_FILL = "rgba(255,237,  0,0.18)";
  const COL_MICRO_Y_STRO = "rgba(255,237,  0,0.85)";

  // border styles
  const DASH_MAJOR_Y = [6, 6]; // dashed
  const DASH_MICRO_Y = [3, 5]; // dotted-ish
  const DASH_MICRO_B = [5, 4]; // micro-blue dashed
  // major-blue is solid

  /* --------------- Parameters per timeframe --------------- */
  // Major (1h baseline)
  const MAJOR = {
    spanMin: 16, spanMax: 24,             // hours
    tightBpsCap: 35,                       // ≤ 0.35%
    minTouches: 3, minDwell: 8, minRetests: 2,
    stickyTolSec: 2 * 3600,               // ±2h tolerance for sticky matching
    stickyOverlapMax: 0.5,                // ≤ 50% overlap allowed for sticky
    fallbackOverlapMax: 0.65,             // ≤ 65% if we must fallback
    sameTfOverlapMax: 0.20,               // ≤ 20% between major blue & yellow
  };

  // Micro (10m baseline)
  const MICRO = {
    spanMin: 8, spanMax: 16,              // 80–160 minutes
    tightBpsCap: 25,                       // ≤ 0.25%
    minTouches: 4, minDwell: 6, minRetests: 2,
    stickyTolSec: 20 * 60,                // ±20m tolerance
    stickyOverlapMax: 0.20,               // stricter: ≤ 20%
    fallbackOverlapMax: 0.35,             // ≤ 35% fallback
    sameTfOverlapMax: 0.20,               // ≤ 20% between micro blue & yellow
  };

  /* ---------------- State ---------------- */
  let barsAsc = [];        // asc [{time,open,high,low,close,volume}]
  let last10mBucket = null;
  let last1hBucket  = null;

  // zones per TF (each: { tStart,tEnd,pLo,pHi,score,touches,dwell,retests,spanBars,bps })
  let majorBlue   = null;  // 1h primary
  let majorYellow = null;  // 1h secondary (sticky)
  let microBlue   = null;  // 10m primary
  let microYellow = null;  // 10m secondary (sticky)

  // sticky memory for each TF
  let prevMajorBlue = null;
  let prevMicroBlue = null;

  let rafId = null;
  const ts = chart.timeScale();

  /* ---------------- Helpers ---------------- */
  const toSec = (t) => (t > 1e12 ? Math.floor(t/1000) : t);
  const xFor  = (tSec) => { const x = ts.timeToCoordinate(tSec); return Number.isFinite(x) ? x : null; };
  const yFor  = (p)    => { const y = priceSeries.priceToCoordinate(Number(p)); return Number.isFinite(y) ? y : null; };

  // 10m & 1h bucketing
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

  // highest high / lowest low rolling window
  function hhll(arr, len) {
    const n = arr.length;
    const HH = new Array(n), LL = new Array(n);
    for (let i=0;i<n;i++){
      const i0 = Math.max(0, i - (len - 1));
      let hh = -Infinity, ll = Infinity;
      for (let j=i0;j<=i;j++){ const b = arr[j]; if (b.high > hh) hh=b.high; if (b.low < ll) ll=b.low; }
      HH[i] = hh; LL[i] = ll;
    }
    return {HH,LL};
  }

  // find candidate windows with tightness cap
  function slideCandidates(barsTF, spanMin, spanMax, tightBpsCap) {
    const n = barsTF.length, out = [];
    if (n < spanMin) return out;
    const {HH,LL} = hhll(barsTF, 1); // we’ll calc per-window below

    for (let span=spanMin; span<=spanMax; span++){
      for (let i=0; i+span<=n; i++){
        const j = i + span - 1;
        // compute lo/hi inside window
        let lo = +Infinity, hi = -Infinity;
        for (let k=i; k<=j; k++){ if (barsTF[k].low < lo) lo=barsTF[k].low; if (barsTF[k].high > hi) hi=barsTF[k].high; }
        const mid = (lo + hi) / 2;
        const bps = ((hi - lo) / Math.max(1e-9, mid)) * 10000;
        if (bps > tightBpsCap) continue;
        out.push({
          iStart: i, iEnd: j,
          tStart: barsTF[i].time, tEnd: barsTF[j].time,
          pLo: lo, pHi: hi,
          bps,
          spanBars: span,
        });
      }
    }
    return out;
  }

  // count touches (wick tips at edges) / dwell (body overlap near edges) / retests
  function annotateStats(barsTF, cand, cfg){
    const { iStart, iEnd, pLo, pHi } = cand;
    const spanBars = barsTF.slice(iStart, iEnd+1);
    // bucketize wicks near edge bands
    const lastClose = barsTF.at(-1).close || spanBars.at(-1).close;
    const step = (5 / 10000) * lastClose; // 5 bps bucket
    const expand = cfg.minDwell > 0 ? step : 0;

    const edgeBand = (price, side) => {
      // near the top/bottom band (within one bucket)
      return side === "top"
        ? { lo: pHi - step, hi: pHi + step }
        : { lo: pLo - step, hi: pLo + step };
    };

    function touchesNear(side){
      const band = edgeBand(0, side);
      let touches = 0;
      for (const b of spanBars){
        const wickHi = Math.max(b.open,b.close,b.high);
        const wickLo = Math.min(b.open,b.close,b.low);
        const touched = !(wickHi < band.lo || wickLo > band.hi);
        if (touched) touches++;
      }
      return touches;
    }

    function dwellNear(side){
      const band = edgeBand(0, side);
      let dwell = 0;
      for (const b of spanBars){
        const bodyLo = Math.min(b.open,b.close);
        const bodyHi = Math.max(b.open,b.close);
        const overlap = !(bodyHi < (band.lo - expand) || bodyLo > (band.hi + expand));
        if (overlap) dwell++;
      }
      return dwell;
    }

    // pick the dominant edge (top or bottom) for this box (where touches are higher)
    const tTop = touchesNear("top"), tBot = touchesNear("bot");
    const dTop = dwellNear("top"),   dBot = dwellNear("bot");
    const side = (tTop >= tBot) ? "top" : "bot";

    // forward retests after iEnd
    function retests(side){
      const band = edgeBand(0, side);
      let count = 0, inTouch = false;
      const start = iEnd + 1;
      const end = Math.min(barsTF.length - 1, iEnd + (cfg.retestLookahead || 24));
      for (let i = start; i <= end; i++){
        const b = barsTF[i];
        const wHi = Math.max(b.open,b.close,b.high);
        const wLo = Math.min(b.open,b.close,b.low);
        const touch = !(wHi < (band.lo) || wLo > (band.hi));
        if (touch && !inTouch){ count++; inTouch = true; }
        else if (!touch && inTouch){ inTouch = false; }
      }
      return count;
    }

    const touches = side === "top" ? tTop : tBot;
    const dwell   = side === "top" ? dTop : dBot;
    const rtests  = retests(side);

    return {
      ...cand, side, touches, dwell, retests: rtests
    };
  }

  // score & choose primary/secondary with non-overlap constraint
  function pickTwoZones(barsTF, cfg){
    const cands = slideCandidates(barsTF, cfg.spanMin, cfg.spanMax, cfg.tightBpsCap);
    if (!cands.length) return { blue:null, yellow:null, all:[] };

    const ann = cands.map(c => annotateStats(barsTF, c, { minDwell:cfg.minDwell, retestLookahead: cfg.spanMax + 6 }));
    // filter by floors
    const ok = ann.filter(z => z.touches >= cfg.minTouches && z.dwell >= cfg.minDwell && z.retests >= cfg.minRetests);
    if (!ok.length) return { blue:null, yellow:null, all:[] };

    // scoring (density + dwell + touches + retests)
    const maxD = Math.max(...ok.map(z=>z.dwell),1);
    const maxT = Math.max(...ok.map(z=>z.touches),1);
    const maxR = Math.max(...ok.map(z=>z.retests),1);
    const spanH = (barsTF[1]?.time || 0) - (barsTF[0]?.time || 0); // step sec
    ok.forEach(z => {
      const density = z.touches / Math.max(1, z.spanBars);
      const maxDen  = Math.max(...ok.map(m => m.touches / Math.max(1,m.spanBars)));
      const densN = maxDen ? (density / maxDen) : 0;
      const volN  = z.dwell / maxD;
      const tchN  = z.touches / maxT;
      const rtsN  = z.retests / maxR;
      z.score = 0.35*densN + 0.30*volN + 0.20*tchN + 0.10*rtsN + 0.05*1;
    });

    ok.sort((a,b)=> b.score - a.score || b.spanBars - a.spanBars);
    const blue = ok[0];

    // pick yellow with non-overlap
    let yellow = null;
    for (let k=1;k<ok.length;k++){
      const z = ok[k];
      if (overlapRatio(blue,z) <= cfg.sameTfOverlapMax){ yellow = z; break; }
    }
    return { blue, yellow, all: ok };
  }

  // sticky secondary reuse
  function stickyYellow(currentBlue, prevBlue, list, cfg){
    // try to reuse prevBlue if close in time and non-overlap within sticky constraints
    if (prevBlue && currentBlue){
      const timeClose = (Math.abs(prevBlue.tStart - currentBlue.tStart) <= cfg.stickyTolSec) ||
                        (Math.abs(prevBlue.tEnd   - currentBlue.tEnd)   <= cfg.stickyTolSec);
      const ov = overlapRatio(currentBlue, prevBlue);
      if (timeClose && ov <= cfg.stickyOverlapMax) {
        // ensure within same list time scale: find the matching window in list
        const match = list.find(c =>
          Math.abs(c.tStart - prevBlue.tStart) <= cfg.stickyTolSec &&
          Math.abs(c.tEnd   - prevBlue.tEnd)   <= cfg.stickyTolSec
        );
        if (match) return match;
        return prevBlue; // fallback use previous directly
      }
    }
    // otherwise choose best recent non-overlap or mild-overlap fallback
    const nonOverlap = list.find(z => overlapRatio(currentBlue, z) <= cfg.sameTfOverlapMax && z !== currentBlue);
    if (nonOverlap) return nonOverlap;

    // last resort: allow mild overlap ≤ fallbackOverlapMax
    return list.find(z => overlapRatio(currentBlue, z) <= cfg.fallbackOverlapMax && z !== currentBlue) || null;
  }

  /* ---------------- Rebuild per TF ---------------- */
  function rebuildMajor(){
    // resample to 1h
    const bars1h = resampleTF(barsAsc, 3600);
    const {blue, yellow, all} = pickTwoZones(bars1h, MAJOR);
    majorBlue = blue || null;
    majorYellow = stickyYellow(majorBlue, prevMajorBlue, all, MAJOR);
    prevMajorBlue = majorBlue ? { ...majorBlue } : prevMajorBlue;
  }

  function rebuildMicro(){
    // native 10m bars: derive 10m from seed (chart TF can vary; we compute from raw seed we received)
    const bars10m = resampleTF(barsAsc, 600);
    const {blue, yellow, all} = pickTwoZones(bars10m, MICRO);
    microBlue = blue || null;
    microYellow = stickyYellow(microBlue, prevMicroBlue, all, MICRO);
    prevMicroBlue = microBlue ? { ...microBlue } : prevMicroBlue;
  }

  /* ---------------- Canvas draw (window-only rectangles) ---------------- */
  function scheduleDraw(){ if (rafId!=null) return; rafId = requestAnimationFrame(()=>{ rafId=null; draw(); }); }

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

    function rectFor(zone, fill, stroke, dash){
      if (!zone) return;
      const yTop = yFor(zone.pHi), yBot = yFor(zone.pLo);
      const xS   = xFor(zone.tStart), xE = xFor(zone.tEnd);
      if (yTop==null||yBot==null||xS==null||xE==null) return;
      const yMin = Math.min(yTop,yBot),  yMax = Math.max(yTop,yBot);
      const xL   = Math.min(xS,xE),      xR   = Math.max(xS,xE);
      const rectW = Math.max(1, xR-xL),  rectH = Math.max(2, yMax-yMin);

      // fill
      ctx.globalAlpha = 1;
      ctx.fillStyle = fill;
      ctx.fillRect(xL, yMin, rectW, rectH);

      // border
      ctx.save();
      if (dash && dash.length) ctx.setLineDash(dash);
      ctx.lineWidth = STROKE_W;
      ctx.strokeStyle = stroke;
      ctx.strokeRect(xL + 0.5, yMin + 0.5, rectW - 1, rectH - 1);
      ctx.restore();
    }

    // Draw order: major first, then micro on top (micro is “finer”)
    // Major 1h: Blue (solid) + Yellow (dashed)
    rectFor(majorYellow, COL_MAJOR_Y_FILL, COL_MAJOR_Y_STRO, DASH_MAJOR_Y);
    rectFor(majorBlue,   COL_MAJOR_B_FILL, COL_MAJOR_B_STRO, null);

    // Micro 10m: Blue (dashed) + Yellow (dotted)
    rectFor(microYellow, COL_MICRO_Y_FILL, COL_MICRO_Y_STRO, DASH_MICRO_Y);
    rectFor(microBlue,   COL_MICRO_B_FILL, COL_MICRO_B_STRO, DASH_MICRO_B);
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

      // initialize buckets
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

      // recompute on bucket closures
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
