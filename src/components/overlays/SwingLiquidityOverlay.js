// src/components/overlays/SwingLiquidityOverlay.js
// Swing Liquidity — Focus Mode (Major Zones)
// -------------------------------------------------------------
// What it does
// - Buckets price into small bps bands over a lookback window
// - Aggregates: bottom-wick touches (support), top-wick touches (supply),
//   dwell (time-in-range via body overlap), and volume while parked
// - Merges adjacent buckets to form zones -> scores them
// - Keeps Top-K per side (support/supply), draws shaded bands that
//   EXTEND to the right until broken (break on close beyond zone)
// - Right-edge volume tag is proportional to TRUE cumulative volume
// - Redraws on seed/update, pan/zoom, and DPR resize
//
// Alignment
// - X: chart.timeScale().timeToCoordinate(timeSec)
// - Y: priceSeries.priceToCoordinate(price)
//
// -------------------------------------------------------------

export default function createSwingLiquidityOverlay({ chart, priceSeries, chartContainer }) {
  if (!chart || !priceSeries || !chartContainer) {
    console.warn("[SwingLiquidity] missing args");
    return { seed() {}, update() {}, destroy() {} };
  }

  // ===================== Tunables =====================
  const LOOKBACK_BARS   = 700;      // bars to analyze for zones
  const BUCKET_BPS      = 8;        // bucket width in basis points (0.08%)
  const MERGE_BPS       = 12;       // merge buckets into zones if within this many bps
  const MAX_ZONES_PER_SIDE = 3;     // Top-K support + Top-K supply
  const WINDOW_PCT      = 2.5;      // +/- % window around last price to keep zones (except global #1 by vol)
  const L = 10, R = 10;             // pivot tightness used for "retests" clustering
  const MIN_TOUCHES     = 4;        // minimum wick touches to consider a major zone
  const MIN_RETESTS     = 2;        // minimum retest clusters
  const Z_ALPHA_ACTIVE  = 0.22;     // fill opacity for active zones
  const Z_ALPHA_BROKEN  = 0.10;     // fill opacity for broken zones
  const Z_STROKE        = 2;        // outline thickness
  const TAG_W           = 12;       // right-edge tag width
  const TAG_GAP         = 6;        // gap from right edge
  const TAG_MIN_H       = 4;        // min tag height (px)
  const FONT            = "11px system-ui, -apple-system, Segoe UI, Roboto, Arial";

  // Score weights (sum ~1.0)
  const W_VOL = 0.55, W_REC = 0.25, W_PROX = 0.20, W_CONF = 0.05;

  // Colors
  const COL_SUP = "#ff4d4f"; // supply (red)
  const COL_DEM = "#22c55e"; // demand (green)
  const COL_EDGE = "#0b0f17";

  // ================== Canvas & wiring ==================
  const cnv = document.createElement("canvas");
  Object.assign(cnv.style, { position:"absolute", inset:0, pointerEvents:"none", zIndex:10 });
  cnv.className = "overlay-canvas swing-liquidity";
  chartContainer.appendChild(cnv);
  const ctx = cnv.getContext("2d");

  const resizeCanvas = () => {
    const r = chartContainer.getBoundingClientRect();
    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    cnv.width  = Math.max(1, Math.floor(r.width * dpr));
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

  // ====================== State ========================
  let barsAsc = [];       // [{time, open, high, low, close, volume}] ascending
  let zones = [];         // [{side:"SUP"|"DEM", pLo, pHi, priceMid, t0, i0, touches, retests, dwell, vol, active, brokenT, score}]
  let volMaxForScale = 1; // for tag height scaling

  const toSec = (t) => (t > 1e12 ? Math.floor(t/1000) : t);
  const xFor = (tSec) => {
    const x = ts.timeToCoordinate(tSec);
    return Number.isFinite(x) ? x : null;
  };
  const yFor = (price) => {
    const y = priceSeries.priceToCoordinate(Number(price));
    return Number.isFinite(y) ? y : null;
  };

  // ================= Bucket & Zone Build ================
  function buildZones() {
    zones = [];
    if (!barsAsc.length) return;

    const last = barsAsc.at(-1);
    const lastP = last?.close ?? 0;
    if (!lastP) return;

    // adaptive bucket size in PRICE units
    const step = (BUCKET_BPS / 10000) * lastP;
    const mergeStep = (MERGE_BPS / 10000) * lastP;

    const startIdx = Math.max(0, barsAsc.length - LOOKBACK_BARS);
    const scan = barsAsc.slice(startIdx);

    // Bucket shape: key -> accumulator
    // supportBuckets keyed by floor(low/step)*step
    // supplyBuckets keyed by floor(high/step)*step
    const sup = new Map(); // supply (top wicks)
    const dem = new Map(); // demand (bottom wicks)

    // Helpers to add to a map
    const add = (map, key, fn) => {
      const b = map.get(key) || { touches:0, dwell:0, vol:0, iFirst:-1, tFirst:0, hits:[] };
      fn(b);
      map.set(key,b);
    };

    // Count "retests" clusters by tracking gaps
    const registerTouch = (bucket, barIdx, tSec) => {
      bucket.touches++;
      bucket.hits.push({ i: barIdx, t: tSec });
      if (bucket.iFirst < 0) { bucket.iFirst = barIdx; bucket.tFirst = tSec; }
    };

    // Pass 1: fill buckets
    for (let i=0; i<scan.length; i++) {
      const b = scan[i];
      const tSec = toSec(b.time);
      const lowKey  = Math.floor(b.low  / step) * step;
      const highKey = Math.floor(b.high / step) * step;
      // bottom-wick touch (demand)
      if (b.low <= Math.min(b.open, b.close)) {
        add(dem, lowKey, (bk) => registerTouch(bk, startIdx + i, tSec));
      }
      // top-wick touch (supply)
      if (b.high >= Math.max(b.open, b.close)) {
        add(sup, highKey, (bk) => registerTouch(bk, startIdx + i, tSec));
      }
      // dwell & volume → attribute to body overlap buckets
      const bodyLo = Math.min(b.open, b.close);
      const bodyHi = Math.max(b.open, b.close);
      if (Number.isFinite(bodyLo) && Number.isFinite(bodyHi)) {
        // iterate buckets overlapped by the body band
        const kLo = Math.floor(bodyLo/step)*step;
        const kHi = Math.floor(bodyHi/step)*step;
        for (let key = kLo; key <= kHi; key += step) {
          add(dem, key, (bk) => { bk.dwell += 1; bk.vol += Number(b.volume||0); });
          add(sup, key, (bk) => { bk.dwell += 1; bk.vol += Number(b.volume||0); });
        }
      }
    }

    // Merge adjacent buckets into zones (support / demand first)
    const mergeMapToZones = (map, side) => {
      const keys = Array.from(map.keys()).sort((a,b)=>a-b);
      const out = [];
      let cur = null;
      for (const k of keys) {
        const bk = map.get(k);
        if (!cur) {
          cur = { side, pLo: k, pHi: k+step, touches: bk.touches, dwell: bk.dwell, vol: bk.vol,
                  iFirst: bk.iFirst, tFirst: bk.tFirst, hits: bk.hits.slice() };
          continue;
        }
        if (k - cur.pHi <= mergeStep) {
          // merge
          cur.pHi = k + step;
          cur.touches += bk.touches;
          cur.dwell   += bk.dwell;
          cur.vol     += bk.vol;
          if (bk.iFirst >= 0 && (cur.iFirst < 0 || bk.iFirst < cur.iFirst)) {
            cur.iFirst = bk.iFirst; cur.tFirst = bk.tFirst;
          }
          cur.hits.push(...bk.hits);
        } else {
          out.push(cur); cur = { side, pLo: k, pHi: k+step, touches: bk.touches, dwell: bk.dwell, vol: bk.vol,
                                 iFirst: bk.iFirst, tFirst: bk.tFirst, hits: bk.hits.slice() };
        }
      }
      if (cur) out.push(cur);
      return out;
    };

    let demand = mergeMapToZones(dem, "DEM");
    let supply = mergeMapToZones(sup, "SUP");

    // Compute retest clusters for each zone
    const countRetests = (z) => {
      if (!z.hits.length) return 0;
      z.hits.sort((a,b)=>a.i - b.i);
      const MIN_GAP = Math.max(3, R); // ensure distinct touches separated at least R bars
      let clusters = 1, lastI = z.hits[0].i;
      for (let h=1; h<z.hits.length; h++) {
        if (z.hits[h].i - lastI >= MIN_GAP) { clusters++; lastI = z.hits[h].i; }
      }
      return clusters;
    };

    for (const z of demand) z.retests = countRetests(z);
    for (const z of supply) z.retests = countRetests(z);

    // Filter tight shelves + basic mins
    const maxWidth = mergeStep; // ~12 bps wide
    const keepTight = (z) => (z.pHi - z.pLo) <= maxWidth && z.touches >= MIN_TOUCHES && z.retests >= MIN_RETESTS;
    demand = demand.filter(keepTight);
    supply = supply.filter(keepTight);

    // Score zones
    const scoreZones = (list) => {
      if (!list.length) return;
      // normalization
      const maxVol = Math.max(...list.map(z=>z.vol), 1);
      const maxDwl = Math.max(...list.map(z=>z.dwell), 1);
      const lastIdx = barsAsc.length - 1;
      const priceNow = lastP;

      for (const z of list) {
        z.priceMid = (z.pLo + z.pHi)/2;
        const volNorm = z.vol / maxVol;
        const recency = 1 - Math.max(0, (lastIdx - (z.iFirst >=0 ? z.iFirst : lastIdx)) / LOOKBACK_BARS);
        const proxRaw = Math.abs(z.priceMid - priceNow) / priceNow; // %
        const prox = 1 - Math.min(proxRaw / (WINDOW_PCT/100), 1);    // 1 near price, 0 far
        const confluence = roundConfluence(z.priceMid);              // 0..1 rough

        z.score = W_VOL*volNorm + W_REC*recency + W_PROX*prox + W_CONF*confluence;
      }
    };

    // crude round-number confluence (near .00 / .50)
    const roundConfluence = (p) => {
      const frac = Math.abs(p - Math.round(p));
      const near00 = 1 - Math.min(frac/0.25, 1);
      const near50 = 1 - Math.min(Math.abs((p*2) - Math.round(p*2))/0.5, 1);
      return Math.max(near00, near50) * 0.6; // weight sub-component a bit
    };

    scoreZones(demand);
    scoreZones(supply);

    // Window filter (± WINDOW_PCT) but keep global #1 by vol per side as exception
    const withinWindow = (z) => Math.abs(z.priceMid - lastP)/lastP <= (WINDOW_PCT/100);
    const topVolDemand = demand.slice().sort((a,b)=>b.vol-a.vol)[0];
    const topVolSupply = supply.slice().sort((a,b)=>b.vol-a.vol)[0];

    demand = demand.filter(z => withinWindow(z) || z === topVolDemand);
    supply = supply.filter(z => withinWindow(z) || z === topVolSupply);

    // Rank by score and keep Top-K per side
    demand.sort((a,b)=>b.score-a.score);
    supply.sort((a,b)=>b.score-a.score);
    demand = demand.slice(0, MAX_ZONES_PER_SIDE);
    supply = supply.slice(0, MAX_ZONES_PER_SIDE);

    // Determine active/broken status by walking bars after zone formation
    const markActive = (list) => {
      for (const z of list) {
        z.active = true; z.brokenT = undefined;
        // All bars after its first index
        for (let k=(z.iFirst>=0?z.iFirst+1:startIdx); k<barsAsc.length; k++) {
          const br = barsAsc[k];
          const pLo = z.pLo, pHi = z.pHi;
          if (z.side === "DEM" && br.close < pLo) { z.active=false; z.brokenT=toSec(br.time); break; }
          if (z.side === "SUP" && br.close > pHi) { z.active=false; z.brokenT=toSec(br.time); break; }
        }
      }
    };
    markActive(demand);
    markActive(supply);

    // Final: compose, set vol scale
    zones = [...demand, ...supply];
    volMaxForScale = Math.max(1, ...zones.filter(z=>z.active).map(z=>z.vol));
  }

  // ================ Incremental update =================
  function onBar(latest) {
    // push or replace in barsAsc
    const t = toSec(latest.time);
    const last = barsAsc.at(-1);
    if (!last || t > last.time) barsAsc.push({ ...latest, time: t });
    else if (t === last.time)   barsAsc[barsAsc.length-1] = { ...latest, time: t };
    else return;

    // Rebuild zones occasionally or when new bar closes bucket
    // (cheaper: rebuild every 5 bars)
    if (barsAsc.length % 5 === 0) buildZones();
  }

  // ====================== Draw =========================
  function draw() {
    const r = chartContainer.getBoundingClientRect();
    ctx.clearRect(0,0,r.width,r.height);
    if (!zones.length) return;

    ctx.font = FONT;
    for (const z of zones) {
      const yTop = yFor(z.pHi);
      const yBot = yFor(z.pLo);
      if (yTop == null || yBot == null) continue;

      const x0 = xFor(toSec(barsAsc[Math.max(0, z.iFirst)].time));
      if (x0 == null) continue;

      const xRight = r.width - TAG_GAP;
      const xEnd = z.active ? xRight : (xFor(z.brokenT) ?? xRight);

      const color = z.side === "SUP" ? COL_SUP : COL_DEM;
      const alpha = z.active ? Z_ALPHA_ACTIVE : Z_ALPHA_BROKEN;
      const yMin = Math.min(yTop, yBot), yMax = Math.max(yTop, yBot);
      const h = Math.max(2, yMax - yMin);

      // fill band
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.fillRect(x0, yMin, Math.max(1, xEnd - x0), h);

      // outline
      ctx.globalAlpha = 1;
      ctx.lineWidth = Z_STROKE;
      ctx.strokeStyle = color;
      ctx.strokeRect(x0 + 0.5, yMin + 0.5, Math.max(1, xEnd - x0) - 1, h - 1);

      // label (price band)
      const lbl = `${fmtPrice(z.pLo)}–${fmtPrice(z.pHi)}`;
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.9;
      ctx.fillText(lbl, x0 + 6, yMin - 4);

      // right-edge volume tag for ACTIVE zones
      if (z.active) {
        const frac = Math.max(0, z.vol / Math.max(1, volMaxForScale));
        const tagH = Math.max(TAG_MIN_H, Math.floor(r.height * 0.15 * frac));
        const tagX = r.width - TAG_GAP - TAG_W;
        const tagY = Math.max(2, Math.min(r.height - tagH - 2, (yMin + yMax)/2 - tagH/2));
        ctx.fillStyle = color;
        ctx.fillRect(tagX, tagY, TAG_W, tagH);
        ctx.strokeStyle = COL_EDGE; ctx.lineWidth = 1;
        ctx.strokeRect(tagX + 0.5, tagY + 0.5, TAG_W - 1, tagH - 1);
      }
    }
    ctx.globalAlpha = 1;
  }

  // ===================== Formatting ====================
  function fmtPrice(p) {
    // simple auto-decimals based on magnitude
    if (p >= 100) return p.toFixed(2);
    if (p >= 10)  return p.toFixed(3);
    return p.toFixed(4);
  }

  // ======================= API =========================
  return {
    seed(bars) {
      barsAsc = (bars || []).map(b => ({ ...b, time: toSec(b.time) }));
      buildZones();
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
