// src/components/overlays/SwingLiquidityOverlay.js
// Swing Liquidity — Focus Mode (adaptive)
// - Finds major supply/demand shelves (tight, retested, vol-backed)
// - Ranks and shows Top-K per side
// - If nothing passes, auto-relaxes thresholds so you still see zones
// - Bands extend until broken; right-edge tag is true cumulative volume
// - DPR aware, redraws on pan/zoom and live bars

export default function createSwingLiquidityOverlay({ chart, priceSeries, chartContainer }) {
  if (!chart || !priceSeries || !chartContainer) {
    console.warn("[SwingLiquidity] missing args");
    return { seed() {}, update() {}, destroy() {} };
  }

  // ===== Friendly defaults (looser than strict mode) =====
  const CFG = {
    LOOKBACK_BARS: 700,
    BUCKET_BPS: 8,         // 0.08%
    MERGE_BPS: 15,         // merge shelves within 0.15%
    MAX_ZONES_PER_SIDE: 3, // Top-K supply & demand
    WINDOW_PCT: 5,         // +/- window around current price (5%)
    L: 10, R: 10,          // pivot tightness used for retest clustering
    MIN_TOUCHES: 3,        // looser to ensure visibility
    MIN_RETESTS: 1,
    // Drawing
    Z_ALPHA_ACTIVE: 0.22,
    Z_ALPHA_BROKEN: 0.10,
    Z_STROKE: 2,
    TAG_W: 12,
    TAG_GAP: 6,
    TAG_MIN_H: 4,
    FONT: "11px system-ui, -apple-system, Segoe UI, Roboto, Arial",
    // Score weights
    W_VOL: 0.55, W_REC: 0.25, W_PROX: 0.20, W_CONF: 0.05,
  };

  // ===== Adaptive fallback (auto-relax once if 0 zones) =====
  const RELAX = {
    WINDOW_PCT: 8,
    BUCKET_BPS: 10,
    MERGE_BPS: 20,
    MIN_TOUCHES: 2,
    MIN_RETESTS: 0,
  };

  const COL_SUP = "#ff4d4f"; // supply/red
  const COL_DEM = "#22c55e"; // demand/green
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
    cnv.width = Math.max(1, Math.floor(r.width * dpr));
    cnv.height = Math.max(1, Math.floor(r.height * dpr));
    cnv.style.width = r.width + "px";
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

  // ---------- State ----------
  let barsAsc = []; // [{time, open, high, low, close, volume}] ascending
  let zones = [];  // computed shelves
  let volMaxForScale = 1;

  const toSec = (t) => (t > 1e12 ? Math.floor(t / 1000) : t);
  const xFor = (tSec) => {
    const x = ts.timeToCoordinate(tSec);
    return Number.isFinite(x) ? x : null;
  };
  const yFor = (p) => {
    const y = priceSeries.priceToCoordinate(Number(p));
    return Number.isFinite(y) ? y : null;
  };

  // ========== Core builder (with config) ==========
  function buildZonesWithConfig(c) {
    zones = [];
    if (!barsAsc.length) return;

    const last = barsAsc.at(-1);
    const lastP = last?.close ?? 0;
    if (!lastP) return;

    const step = (c.BUCKET_BPS / 10000) * lastP;
    const mergeStep = (c.MERGE_BPS / 10000) * lastP;

    const startIdx = Math.max(0, barsAsc.length - c.LOOKBACK_BARS);
    const scan = barsAsc.slice(startIdx);

    const sup = new Map(); // supply (top wicks)
    const dem = new Map(); // demand (bottom wicks)
    const add = (map, key, fn) => { const b = map.get(key) || { touches:0, dwell:0, vol:0, iFirst:-1, tFirst:0, hits:[] }; fn(b); map.set(key,b); };
    const touch = (bucket, i, t) => { bucket.touches++; bucket.hits.push({i,t}); if (bucket.iFirst<0){bucket.iFirst=i; bucket.tFirst=t;} };

    for (let i=0; i<scan.length; i++) {
      const b = scan[i], tSec = toSec(b.time), gi = startIdx + i;
      const lowKey  = Math.floor(b.low  / step) * step;
      const highKey = Math.floor(b.high / step) * step;

      // demand: bottom wick touch
      if (b.low <= Math.min(b.open, b.close)) add(dem, lowKey,  (bk)=>touch(bk, gi, tSec));
      // supply: top wick touch
      if (b.high >= Math.max(b.open, b.close)) add(sup, highKey, (bk)=>touch(bk, gi, tSec));

      // dwell & volume to body-overlap buckets
      const lo = Math.min(b.open, b.close), hi = Math.max(b.open, b.close);
      if (Number.isFinite(lo) && Number.isFinite(hi)) {
        const kLo = Math.floor(lo/step)*step, kHi = Math.floor(hi/step)*step;
        for (let k=kLo; k<=kHi; k+=step) {
          add(dem, k, (bk)=>{ bk.dwell+=1; bk.vol+=Number(b.volume||0); });
          add(sup, k, (bk)=>{ bk.dwell+=1; bk.vol+=Number(b.volume||0); });
        }
      }
    }

    // merge into zones
    const mergeMap = (map, side) => {
      const keys = Array.from(map.keys()).sort((a,b)=>a-b);
      const out=[]; let cur=null;
      for (const k of keys) {
        const bk = map.get(k);
        if (!cur) { cur = { side, pLo:k, pHi:k+step, touches:bk.touches, dwell:bk.dwell, vol:bk.vol, iFirst:bk.iFirst, tFirst:bk.tFirst, hits:bk.hits.slice() }; continue; }
        if (k - cur.pHi <= mergeStep) {
          cur.pHi = k+step; cur.touches+=bk.touches; cur.dwell+=bk.dwell; cur.vol+=bk.vol;
          if (bk.iFirst>=0 && (cur.iFirst<0 || bk.iFirst<cur.iFirst)) { cur.iFirst=bk.iFirst; cur.tFirst=bk.tFirst; }
          cur.hits.push(...bk.hits);
        } else { out.push(cur); cur = { side, pLo:k, pHi:k+step, touches:bk.touches, dwell:bk.dwell, vol:bk.vol, iFirst:bk.iFirst, tFirst:bk.tFirst, hits:bk.hits.slice() }; }
      }
      if (cur) out.push(cur);
      return out;
    };

    let demand = mergeMap(dem, "DEM");
    let supply = mergeMap(sup, "SUP");

    // retests (clustered hits separated by >= R bars)
    const countRetests = (z) => {
      if (!z.hits.length) return 0;
      z.hits.sort((a,b)=>a.i-b.i);
      const MIN_GAP = Math.max(3, c.R);
      let cnt=1, last=z.hits[0].i;
      for (let h=1; h<z.hits.length; h++) if (z.hits[h].i - last >= MIN_GAP) { cnt++; last = z.hits[h].i; }
      return cnt;
    };
    for (const z of demand) z.retests = countRetests(z);
    for (const z of supply) z.retests = countRetests(z);

    // tight & mins
    const maxWidth = mergeStep;
    const keep = (z) => (z.pHi - z.pLo) <= maxWidth && z.touches >= c.MIN_TOUCHES && z.retests >= c.MIN_RETESTS;
    demand = demand.filter(keep);
    supply = supply.filter(keep);

    // score
    const roundConfluence = (p) => {
      const frac = Math.abs(p - Math.round(p));
      const near00 = 1 - Math.min(frac/0.25, 1);
      const near50 = 1 - Math.min(Math.abs((p*2) - Math.round(p*2))/0.5, 1);
      return Math.max(near00, near50) * 0.6;
    };
    const scoreZones = (list) => {
      if (!list.length) return;
      const maxVol = Math.max(...list.map(z=>z.vol), 1);
      const lastIdx = barsAsc.length - 1;
      for (const z of list) {
        z.priceMid = (z.pLo + z.pHi)/2;
        const volNorm = z.vol / maxVol;
        const recency = 1 - Math.max(0,(lastIdx - (z.iFirst>=0?z.iFirst:lastIdx)) / c.LOOKBACK_BARS);
        const proxRaw = Math.abs(z.priceMid - lastP) / lastP; // %
        const prox = 1 - Math.min(proxRaw / (c.WINDOW_PCT/100), 1);
        const conf = roundConfluence(z.priceMid);
        z.score = CFG.W_VOL*volNorm + CFG.W_REC*recency + CFG.W_PROX*prox + CFG.W_CONF*conf;
      }
    };
    scoreZones(demand); scoreZones(supply);

    // window filter (+ keep top vol exception)
    const within = (z) => Math.abs(z.priceMid - lastP)/lastP <= (c.WINDOW_PCT/100);
    const topVolDem = demand.slice().sort((a,b)=>b.vol-a.vol)[0];
    const topVolSup = supply.slice().sort((a,b)=>b.vol-a.vol)[0];
    demand = demand.filter(z => within(z) || z === topVolDem);
    supply = supply.filter(z => within(z) || z === topVolSup);

    // rank + top-K
    demand.sort((a,b)=>b.score-a.score);
    supply.sort((a,b)=>b.score-a.score);
    demand = demand.slice(0, c.MAX_ZONES_PER_SIDE);
    supply = supply.slice(0, c.MAX_ZONES_PER_SIDE);

    // active/broken
    const markActive = (list) => {
      for (const z of list) {
        z.active = true; z.brokenT = undefined;
        for (let k=(z.iFirst>=0?z.iFirst+1:startIdx); k<barsAsc.length; k++) {
          const br = barsAsc[k];
          if (z.side==="DEM" && br.close < z.pLo) { z.active=false; z.brokenT=toSec(br.time); break; }
          if (z.side==="SUP" && br.close > z.pHi) { z.active=false; z.brokenT=toSec(br.time); break; }
        }
      }
    };
    markActive(demand); markActive(supply);

    zones = [...demand, ...supply];
    volMaxForScale = Math.max(1, ...zones.filter(z=>z.active).map(z=>z.vol));
  }

  // Auto-build with CFG; if nothing, relax once
  function buildZonesAdaptive() {
    buildZonesWithConfig(CFG);
    if (!zones.length) {
      const relaxed = { ...CFG, ...RELAX };
      buildZonesWithConfig(relaxed);
    }
  }

  // ---------- Incremental update ----------
  function onBar(latest) {
    const t = toSec(latest.time);
    const last = barsAsc.at(-1);
    if (!last || t > last.time) barsAsc.push({ ...latest, time:t });
    else if (t === last.time)   barsAsc[barsAsc.length-1] = { ...latest, time:t };
    else return;
    if (barsAsc.length % 5 === 0) buildZonesAdaptive();
  }

  // ---------- Draw ----------
  function draw() {
    const r = chartContainer.getBoundingClientRect();
    ctx.clearRect(0,0,r.width,r.height);
    if (!zones.length) return;

    ctx.font = CFG.FONT;
    for (const z of zones) {
      const yTop = yFor(z.pHi), yBot = yFor(z.pLo);
      if (yTop == null || yBot == null) continue;

      const x0 = xFor(barsAsc[Math.max(0, z.iFirst)].time);
      if (x0 == null) continue;

      const xRight = r.width - CFG.TAG_GAP;
      const xEnd = z.active ? xRight : (xFor(z.brokenT) ?? xRight);

      const color = z.side==="SUP" ? COL_SUP : COL_DEM;
      const alpha = z.active ? CFG.Z_ALPHA_ACTIVE : CFG.Z_ALPHA_BROKEN;

      const yMin = Math.min(yTop, yBot), yMax = Math.max(yTop, yBot);
      const h = Math.max(2, yMax - yMin);

      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.fillRect(x0, yMin, Math.max(1, xEnd - x0), h);

      ctx.globalAlpha = 1;
      ctx.lineWidth = CFG.Z_STROKE;
      ctx.strokeStyle = color;
      ctx.strokeRect(x0 + 0.5, yMin + 0.5, Math.max(1, xEnd - x0) - 1, h - 1);

      const lbl = `${fmtPrice(z.pLo)}–${fmtPrice(z.pHi)}`;
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.9;
      ctx.fillText(lbl, x0 + 6, yMin - 4);

      if (z.active) {
        const frac = Math.max(0, z.vol / Math.max(1, volMaxForScale));
        const tagH = Math.max(CFG.TAG_MIN_H, Math.floor(r.height * 0.15 * frac));
        const tagX = r.width - CFG.TAG_GAP - CFG.TAG_W;
        const tagY = Math.max(2, Math.min(r.height - tagH - 2, (yMin + yMax)/2 - tagH/2));
        ctx.fillStyle = color;
        ctx.fillRect(tagX, tagY, CFG.TAG_W, tagH);
        ctx.strokeStyle = COL_EDGE; ctx.lineWidth = 1;
        ctx.strokeRect(tagX + 0.5, tagY + 0.5, CFG.TAG_W - 1, tagH - 1);
      }
    }
    ctx.globalAlpha = 1;
  }

  function fmtPrice(p) {
    if (p >= 100) return p.toFixed(2);
    if (p >= 10)  return p.toFixed(3);
    return p.toFixed(4);
  }

  // ---------- API ----------
  return {
    seed(bars) {
      barsAsc = (bars || []).map(b => ({ ...b, time: toSec(b.time) }));
      buildZonesAdaptive();
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
