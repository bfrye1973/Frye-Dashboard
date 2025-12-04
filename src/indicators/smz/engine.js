// Smart-Money Zones — Engine v1.1
// Wick + Candle (10m/1h) → zones  |  4h controller → promotion/exhaustion/thrust  |  true gap magnets
// Window: last 10 trading days. Outputs { zones, gaps, alerts } for the dashboard.

const DEFAULTS = {
  bandPct10m: 0.0006,     // 0.06%
  bandPct1h:  0.0005,     // 0.05%
  minHits10m: 2,
  minHits1h:  2,          // tune to 3 if you want stricter 1h
  pinWickPct: 0.50,
  pinBodyPct: 0.35,
  absBodyPct: 0.35,
  absVolRatio: 1.20,
  volLen: 20,
  pvtLen: 5,
  sfpBars: 3,
  coolOffBars: 15,        // min bars between same-side zones on a TF
  epsilonPct: 0.0005,     // de-dupe if mid is within 0.05%
  maxZones: 200,
  drawLimit: 20,          // UI can draw latest 20
  minRectPx: 3
};

// ---------- helpers ----------
const rng   = b => b.high - b.low;
const body  = b => Math.abs(b.close - b.open);
const wTop  = b => b.high - Math.max(b.open, b.close);
const wBot  = b => Math.min(b.open, b.close) - b.low;
const pct   = (x, base) => (base !== 0 ? x / base : 0);

function smaVol(bars, i, len) {
  const from = Math.max(0, i - len + 1);
  let s = 0, n = 0;
  for (let k = from; k <= i; k++) { s += bars[k].volume || 0; n++; }
  return n > 0 ? s / n : 0;
}
function priorHigh(bars, i, look) {
  let h = -Infinity;
  for (let k = Math.max(0, i - look); k < i; k++) h = Math.max(h, bars[k].high);
  return h;
}
function priorLow(bars, i, look) {
  let l = +Infinity;
  for (let k = Math.max(0, i - look); k < i; k++) l = Math.min(l, bars[k].low);
  return l;
}
const priceBand = (price, pct) => price * pct;

// restrict to last ~10 trading days
function sliceLastDays(bars, days = 10) {
  if (!bars?.length) return [];
  const end = bars[bars.length - 1].time;
  const start = end - days * 24 * 60 * 60; // seconds
  // Bars are ascending UNIX seconds
  let from = 0;
  for (let i = bars.length - 1; i >= 0; i--) { if (bars[i].time < start) { from = i; break; } }
  return bars.slice(from);
}

// ---------- detectors ----------
function detectPinsAbsorptionSFP(bars, i, p) {
  const b = bars[i]; const r = rng(b); const vavg = smaVol(bars, i, p.volLen);

  const bullPin =
    r > 0 && pct(wBot(b), r) >= p.pinWickPct && pct(body(b), r) <= p.pinBodyPct &&
    (b.close >= b.open || b.close >= (b.low + 0.6 * r));

  const bearPin =
    r > 0 && pct(wTop(b), r) >= p.pinWickPct && pct(body(b), r) <= p.pinBodyPct &&
    (b.close <= b.open || b.close <= (b.low + 0.4 * r));

  const bullAbs =
    vavg > 0 && (b.volume / vavg) >= p.absVolRatio &&
    r > 0 && pct(body(b), r) <= p.absBodyPct &&
    wBot(b) >= wTop(b) && b.close >= (b.low + 0.5 * r);

  const bearAbs =
    vavg > 0 && (b.volume / vavg) >= p.absVolRatio &&
    r > 0 && pct(body(b), r) <= p.absBodyPct &&
    wTop(b) >= wBot(b) && b.close <= (b.low + 0.5 * r);

  // SFP
  const ph = priorHigh(bars, i, p.pvtLen);
  const pl = priorLow(bars, i, p.pvtLen);
  let sfpBull = false, sfpBear = false;

  if (b.low < pl) {
    for (let j = i + 1; j <= Math.min(i + p.sfpBars, bars.length - 1); j++) {
      if (bars[j].close >= pl) { sfpBull = true; break; }
    }
  }
  if (b.high > ph) {
    for (let j = i + 1; j <= Math.min(i + p.sfpBars, bars.length - 1); j++) {
      if (bars[j].close <= ph) { sfpBear = true; break; }
    }
  }
  return { bullPin, bearPin, bullAbs, bearAbs, sfpBull, sfpBear };
}

function countWickHits(bars, iCenter, center, bandPct, win) {
  const lo = center - priceBand(center, bandPct);
  const hi = center + priceBand(center, bandPct);
  let hitsOver = 0, hitsUnder = 0, bodiesInside = 0;
  for (let k = Math.max(0, iCenter - win + 1); k <= iCenter; k++) {
    const b = bars[k];
    if (b.low <= hi && b.high >= lo) {
      // wick touches
      if (b.high >= center) hitsOver++;
      if (b.low <= center)  hitsUnder++;
      // body inside?
      const bodyMin = Math.min(b.open, b.close);
      const bodyMax = Math.max(b.open, b.close);
      const bodyInside = !(bodyMax < lo || bodyMin > hi);
      if (bodyInside) bodiesInside++;
    }
  }
  return { hitsOver, hitsUnder, bodiesInside };
}

// event + cluster gate → zone
function formZonesOnTF(bars, tf, params) {
  const zones = [];
  let lastBull = -1, lastBear = -1;
  const bandPct = tf === "10m" ? params.bandPct10m : params.bandPct1h;
  const minHits = tf === "10m" ? params.minHits10m : params.minHits1h;

  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    const { bullPin, bearPin, bullAbs, bearAbs, sfpBull, sfpBear } = detectPinsAbsorptionSFP(bars, i, params);

    // absorption bands at current extremities
    const centerHigh = b.high;
    const centerLow  = b.low;
    const { hitsOver, hitsUnder, bodiesInside } = countWickHits(bars, i, centerHigh, bandPct, params.winClust);

    // bodies must mostly close outside band → require bodiesInside small proportion
    const bodyOutsideOK = bodiesInside <= Math.ceil(params.winClust * 0.3);

    // require cluster AND (event) to create zone
    const wantsBear = hitsOver >= minHits && bodyOutsideOK && (sfpBear || bearPin || bearAbs);
    const wantsBull = hitsUnder >= minHits && bodyOutsideOK && (sfpBull || bullPin || bullAbs);

    const coolOff = side => (side === "bull" ? lastBull : lastBear);
    const canCreate = (side) => (coolOff(side) < 0 || i - coolOff(side) >= params.coolOffBars);

    if (wantsBear && canCreate("bear")) {
      // zone bounds (distribution): ceiling = max wick top, floor = median body proxy (use mid of current for Step-A)
      const mid = (b.open + b.close) / 2;
      const ceil = b.high;
      const floor = Math.min(mid, ceil - 1e-8);
      // de-dupe by mid distance
      const midPrice = (ceil + floor) / 2;
      const dup = zones.slice(-50).some(z => z.side === "bear" && Math.abs(((z.top + z.bottom) / 2) - midPrice) <= midPrice * params.epsilonPct);
      if (!dup) {
        zones.push({
          id: `DIST_${tf}_${b.time}`,
          side: "bear",
          tf, time: b.time, index: i,
          top: ceil, bottom: floor,
          origin: sfpBear ? "SFP" : bearPin ? "PIN" : "ABS",
          status: "active", mtfConfirm: false,
          checks: {
            hrHits3: null,     // filled by controller
            m10Hits7: null,    // filled by controller
            wickSide: "bear",
            bodiesOutside: bodyOutsideOK,
            effortVsResult: bearAbs || bullAbs, // crude for Step-A
            sweep: sfpBear,
            thrust: false,     // Step-B via 4h
            trueGap: false,    // Step-B via 4h
            confirm4h: false,
            gapFilled: false
          },
          score: 0.0, touches: 0
        });
        lastBear = i;
      }
    }

    if (wantsBull && canCreate("bull")) {
      const mid = (b.open + b.close) / 2;
      const floor = b.low;
      const ceil = Math.max(mid, floor + 1e-8);
      const midPrice = (ceil + floor) / 2;
      const dup = zones.slice(-50).some(z => z.side === "bull" && Math.abs(((z.top + z.bottom) / 2) - midPrice) <= midPrice * params.epsilonPct);
      if (!dup) {
        zones.push({
          id: `ACCUM_${tf}_${b.time}`,
          side: "bull",
          tf, time: b.time, index: i,
          top: ceil, bottom: floor,
          origin: sfpBull ? "SFP" : bullPin ? "PIN" : "ABS",
          status: "active", mtfConfirm: false,
          checks: {
            hrHits3: null,
            m10Hits7: null,
            wickSide: "bull",
            bodiesOutside: bodyOutsideOK,
            effortVsResult: bullAbs || bearAbs,
            sweep: sfpBull,
            thrust: false,
            trueGap: false,
            confirm4h: false,
            gapFilled: false
          },
          score: 0.0, touches: 0
        });
        lastBull = i;
      }
    }
  }
  return zones;
}

// 4h: promotion/exhaustion + thrust/gaps
function controller4h(bars4h, zones, params) {
  const gaps = [];
  // scan for true gaps on 4h
  for (let i = 1; i < bars4h.length; i++) {
    const prev = bars4h[i - 1], cur = bars4h[i];
    if (cur.low > prev.high) {
      gaps.push({ id: `GAPUP_${cur.time}`, dir: "up", top: cur.low, bottom: prev.high, resolved: false });
    } else if (cur.high < prev.low) {
      gaps.push({ id: `GAPDN_${cur.time}`, dir: "down", top: prev.low, bottom: cur.high, resolved: false });
    }
  }

  // walk 4h bars to confirm zones
  for (const z of zones) {
    // promotion: 4h shows same band defended (bodies outside) ≥ 2 times
    let defenseHits = 0;
    for (let i = 0; i < bars4h.length; i++) {
      const b = bars4h[i];
      const bodyMin = Math.min(b.open, b.close);
      const bodyMax = Math.max(b.open, b.close);
      const bodyInside = !(bodyMax < z.bottom || bodyMin > z.top);
      if (!bodyInside) {
        // if wick touches but body outside counts as defense
        const wickTouch = (b.low <= z.top && b.high >= z.bottom);
        if (wickTouch) defenseHits++;
      }
    }
    if (defenseHits >= 2) {
      z.mtfConfirm = true;
      z.status = z.status === "active" ? "active" : z.status;
      z.checks.confirm4h = true;
    }

    // exhaustion: first 4h full-body close through the band
    for (let i = 0; i < bars4h.length; i++) {
      const b = bars4h[i];
      const bodyMin = Math.min(b.open, b.close);
      const bodyMax = Math.max(b.open, b.close);
      const bodyCrossDown = (z.side === "bear") ? (bodyMin < z.bottom) : false;
      const bodyCrossUp   = (z.side === "bull") ? (bodyMax > z.top)    : false;
      if (bodyCrossDown || bodyCrossUp) {
        z.status = "exhausted";
        break;
      }
    }

    // thrust detection near/after zone creation (use last few bars)
    let thrustFound = false;
    for (let i = Math.max(1, bars4h.length - 20); i < bars4h.length; i++) {
      const b = bars4h[i];
      const avgRange20 = averageRange(bars4h, Math.max(0, i - 19), i);
      const thrustRange = rng(b) >= 2 * avgRange20;
      const vavg = smaVol(bars4h, i, DEFAULTS.volLen);
      const thrustVol = vavg > 0 && (b.volume / vavg) >= 1.5;
      const closesAway =
        z.side === "bear" ? b.close < z.bottom : b.close > z.top;

      if (thrustRange && thrustVol && closesAway) {
        z.checks.thrust = true;
        thrustFound = true;
        // link nearest gap magnet in thrust direction
        const g = nearestGap(gaps, z, z.side === "bear" ? "down" : "up");
        if (g) z.gapId = g.id;
        break;
      }
    }
  }

  return { zones, gaps };
}

function averageRange(bars, from, to) {
  let s = 0, n = 0;
  for (let i = from; i <= to; i++) { s += (bars[i].high - bars[i].low); n++; }
  return n > 0 ? s / n : 0;
}
function nearestGap(gaps, zone, dir) {
  const mid = (zone.top + zone.bottom) / 2;
  let best = null, bestDist = Infinity;
  for (const g of gaps) {
    if (g.dir !== dir || g.resolved) continue;
    // distance from zone mid to gap nearest edge
    const edge = dir === "down" ? g.bottom : g.top;
    const d = Math.abs(edge - mid);
    if (d < bestDist) { best = g; bestDist = d; }
  }
  if (best) zone.checks.trueGap = true;
  return best;
}

// compute live score (0..1) from checklist booleans + structure
function scoreZone(z) {
  // structure (repetition) 30%, absorption 25%, manipulation/thrust 25%, gap/4h 20%
  const sRep = 0.30 * (bool01(z.checks.bodiesOutside) + 0.5 * (z.side ? 1 : 0));
  const sAbs = 0.25 * (bool01(z.checks.effortVsResult));
  const sMan = 0.25 * (bool01(z.checks.sweep) + bool01(z.checks.thrust)) / 2;
  const sGap = 0.20 * (bool01(z.checks.trueGap) + bool01(z.checks.confirm4h)) / 2;
  z.score = clamp01(sRep + sAbs + sMan + sGap);
  return z.score;
}
const bool01 = x => x ? 1 : 0;
const clamp01 = x => Math.max(0, Math.min(1, x));

// ---------- main ----------
export function computeSmartMoneyZones({ bars10m, bars1h, bars4h }, options = {}) {
  const p = { ...DEFAULTS, ...options };
  const b10 = sliceLastDays(bars10m, 10);
  const b1h = sliceLastDays(bars1h, 10);
  const b4h = sliceLastDays(bars4h, 10);
  if (!b10.length || !b1h.length || !b4h.length) return { zones: [], gaps: [], alerts: [] };

  // TF zones
  const z10 = formZonesOnTF(b10, "10m", p);
  const z1h = formZonesOnTF(b1h, "1h", p);

  // Map 1h repetition (≥3 hits) and 10m density (≥7 hits) into checks using recent visuals
  // (Step-A approximation: mark as true if zone exists on both TFs around same price)
  function tagRepetition(zonesA, zonesB) {
    for (const za of zonesA) {
      const midA = (za.top + za.bottom) / 2;
      const sibling = zonesB.find(zb => zb.side === za.side &&
        Math.abs(((zb.top + zb.bottom) / 2) - midA) <= midA * p.epsilonPct);
      if (sibling) {
        if (za.tf === "1h") za.checks.hrHits3 = true;
        if (za.tf === "10m") za.checks.m10Hits7 = true;
      }
    }
  }
  tagRepetition(z10, z1h);
  tagRepetition(z1h, z10);

  // 4h controller
  const merged = [...z10, ...z1h];
  const { zones, gaps } = controller4h(b4h, merged, p);

  // score + alerts (retest + rejection wick on latest bar)
  const alerts = [];
  for (const z of zones) {
    scoreZone(z);

    const source = z.tf === "10m" ? b10 : b1h;
    const last = source[source.length - 1];
    const withinBand = (last.low <= z.top && last.high >= z.bottom);
    const rejectionWick =
      (z.side === "bear" && wTop(last) / rng(last) >= p.pinWickPct) ||
      (z.side === "bull" && wBot(last) / rng(last) >= p.pinWickPct);

    if (z.status !== "exhausted" && withinBand && rejectionWick) {
      alerts.push({
        type: "ZONE_RETEST_REJECTION",
        zoneId: z.id,
        tf: z.tf,
        price: (z.side === "bear" ? z.top : z.bottom),
        score: z.score,
        checks: z.checks
      });
      z.touches += 1;
    }
  }

  // mark gaps resolved (entire void filled)
  for (const g of gaps) {
    const last = b1h[b1h.length - 1];
    const filled = g.dir === "down"
      ? last.low <= g.bottom
      : last.high >= g.top;
    if (filled) g.resolved = true;
    // optional alert
    if (filled) alerts.push({ type: "GAP_FILLED", gapId: g.id });
  }

  // cap
  zones.sort((a, b) => a.time - b.time);
  const capped = zones.slice(-p.maxZones);

  return { zones: capped, gaps, alerts, meta: { drawLimit: p.drawLimit, minRectPx: p.minRectPx } };
}
/**
 * Compute Accumulation / Distribution levels from intraday bars.
 *
 * Input:  bars = [{ time, open, high, low, close, volume }, ...]  (ascending time, e.g. 10m)
 * Output: array of levels:
 *   - { type: "distribution", price, strength }
 *   - { type: "accumulation", priceRange: [hi, lo], strength }
 */
export function computeAccDistLevelsFromBars(bars, opts = {}) {
  if (!Array.isArray(bars) || bars.length < 20) return [];

  const swingLookback = opts.swingLookback ?? 3;     // bars on each side for swing high/low
  const lookaheadBars = opts.lookaheadBars ?? 15;    // how far we look for reaction
  const minMovePct = opts.minMovePct ?? 0.006;       // ~0.6% move to count as reaction
  const clusterTolerance = opts.clusterTolerance ?? 1.0; // dollars to merge nearby levels

  const levels = [];

  // --- 1. Find swing highs/lows ---
  const isSwingHigh = (i) => {
    const h = bars[i].high;
    for (let k = 1; k <= swingLookback; k++) {
      if (i - k < 0 || i + k >= bars.length) return false;
      if (bars[i - k].high >= h || bars[i + k].high >= h) return false;
    }
    return true;
  };

  const isSwingLow = (i) => {
    const l = bars[i].low;
    for (let k = 1; k <= swingLookback; k++) {
      if (i - k < 0 || i + k >= bars.length) return false;
      if (bars[i - k].low <= l || bars[i + k].low <= l) return false;
    }
    return true;
  };

  // --- 2. For each swing, measure reaction + touches ---
  for (let i = swingLookback; i < bars.length - swingLookback; i++) {
    const b = bars[i];

    // --- Distribution candidate (swing high, price rejects down) ---
    if (isSwingHigh(i)) {
      const anchor = b.high;
      let maxDropPct = 0;
      let touchCount = 0;

      for (let j = i + 1; j < Math.min(bars.length, i + 1 + lookaheadBars); j++) {
        const bj = bars[j];

        const dropPct = (anchor - bj.low) / anchor;
        if (dropPct > maxDropPct) maxDropPct = dropPct;

        const mid = (bj.high + bj.low) / 2;
        if (Math.abs(mid - anchor) <= 0.4) touchCount++;
      }

      if (maxDropPct >= minMovePct && touchCount >= 2) {
        const strength = Math.round(
          40 * Math.min(maxDropPct / minMovePct, 2) +
            10 * Math.min(touchCount, 5)
        );
        levels.push({
          type: "distribution",
          price: anchor,
          strength: Math.min(strength, 100),
        });
      }
    }

    // --- Accumulation candidate (swing low, price rejects up) ---
    if (isSwingLow(i)) {
      const anchor = b.low;
      let maxRallyPct = 0;
      let touchCount = 0;

      for (let j = i + 1; j < Math.min(bars.length, i + 1 + lookaheadBars); j++) {
        const bj = bars[j];

        const rallyPct = (bj.high - anchor) / anchor;
        if (rallyPct > maxRallyPct) maxRallyPct = rallyPct;

        const mid = (bj.high + bj.low) / 2;
        if (Math.abs(mid - anchor) <= 0.4) touchCount++;
      }

      if (maxRallyPct >= minMovePct && touchCount >= 2) {
        const hi = anchor + 1;        // simple $1 band for now
        const lo = anchor;

        const strength = Math.round(
          40 * Math.min(maxRallyPct / minMovePct, 2) +
            10 * Math.min(touchCount, 5)
        );

        levels.push({
          type: "accumulation",
          priceRange: [hi, lo],
          strength: Math.min(strength, 100),
        });
      }
    }
  }

  // --- 3. Cluster nearby levels (merge within $1) ---
  levels.sort((a, b) => {
    const pa = a.price ?? ((a.priceRange[0] + a.priceRange[1]) / 2);
    const pb = b.price ?? ((b.priceRange[0] + b.priceRange[1]) / 2);
    return pa - pb;
  });

  const clustered = [];
  for (const lvl of levels) {
    const center =
      lvl.price ?? (lvl.priceRange[0] + lvl.priceRange[1]) / 2;

    const last = clustered[clustered.length - 1];
    if (!last) {
      clustered.push({ ...lvl, _center: center });
      continue;
    }

    if (Math.abs(center - last._center) <= clusterTolerance && lvl.type === last.type) {
      const s1 = last.strength ?? 0;
      const s2 = lvl.strength ?? 0;
      last.strength = Math.max(s1, s2);

      if (lvl.priceRange && last.priceRange) {
        last.priceRange = [
          Math.max(last.priceRange[0], lvl.priceRange[0]),
          Math.min(last.priceRange[1], lvl.priceRange[1]),
        ];
      } else if (typeof lvl.price === "number" && typeof last.price === "number") {
        last.price = (last.price + lvl.price) / 2;
      }

      last._center = (last._center + center) / 2;
    } else {
      clustered.push({ ...lvl, _center: center });
    }
  }

  return clustered.map((lvl) => {
    const { _center, ...rest } = lvl;
    return rest;
  });
}
