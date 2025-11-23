// src/indicators/smz/smartMoneyEngine.js
// Smart Money Zones Engine v1.0
// Timeframes: 10m, 30m, 1h, 4h
// Input: { bars10m, bars30m, bars1h, bars4h }  (ascending OHLCV arrays)
// Output: { zones, gaps, alerts, meta }

const DEFAULTS = {
  // band width per TF (as fraction of price)
  bandPct10m: 0.0006,
  bandPct30m: 0.0005,
  bandPct1h:  0.0005,

  // minimum wick hits to call it “defended”
  minHits10m: 2,
  minHits30m: 2,
  minHits1h:  2,

  // pin / absorption thresholds
  pinWickPct: 0.50,
  pinBodyPct: 0.35,
  absBodyPct: 0.35,
  absVolRatio: 1.20,
  volLen: 20,
  pvtLen: 5,          // swing lookback
  sfpBars: 3,         // reclaim within ≤ bars

  // safety rails
  coolOffBars: 15,    // min bars between new zones (per side per TF)
  epsilonPct: 0.0005, // de-dupe if mid within 0.05%
  maxZones: 200,      // cap to keep things light
  drawLimit: 20,
  minRectPx: 3,
};

// ---------- small helpers ----------
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

function priorHigh(bars, i, lookback) {
  let h = -Infinity;
  for (let k = Math.max(0, i - lookback); k < i; k++) h = Math.max(h, bars[k].high);
  return h;
}
function priorLow(bars, i, lookback) {
  let l = +Infinity;
  for (let k = Math.max(0, i - lookback); k < i; k++) l = Math.min(l, bars[k].low);
  return l;
}

const priceBand = (price, pct) => price * pct;

function averageRange(bars, from, to) {
  let s = 0, n = 0;
  for (let i = from; i <= to; i++) { s += (bars[i].high - bars[i].low); n++; }
  return n > 0 ? s / n : 0;
}

const bool01  = x => x ? 1 : 0;
const clamp01 = x => Math.max(0, Math.min(1, x));

// ---------- wick cluster & events ----------
function countWickHits(bars, iCenter, center, bandPct, win) {
  const lo = center - priceBand(center, bandPct);
  const hi = center + priceBand(center, bandPct);
  let hitsOver = 0, hitsUnder = 0, bodiesInside = 0;
  for (let k = Math.max(0, iCenter - win + 1); k <= iCenter; k++) {
    const b = bars[k];
    if (b.low <= hi && b.high >= lo) {
      if (b.high >= center) hitsOver++;
      if (b.low  <= center) hitsUnder++;
      const bodyMin = Math.min(b.open, b.close);
      const bodyMax = Math.max(b.open, b.close);
      const inside = !(bodyMax < lo || bodyMin > hi);
      if (inside) bodiesInside++;
    }
  }
  return { hitsOver, hitsUnder, bodiesInside };
}

function detectPinAbsorbSFP(bars, i, p) {
  const b = bars[i];
  const r = rng(b);
  const vavg = smaVol(bars, i, p.volLen);

  const bullPin =
    r > 0 &&
    pct(wBot(b), r) >= p.pinWickPct &&
    pct(body(b), r) <= p.pinBodyPct &&
    (b.close >= b.open || b.close >= (b.low + 0.6 * r));

  const bearPin =
    r > 0 &&
    pct(wTop(b), r) >= p.pinWickPct &&
    pct(body(b), r) <= p.pinBodyPct &&
    (b.close <= b.open || b.close <= (b.low + 0.4 * r));

  const bullAbs =
    vavg > 0 &&
    (b.volume / vavg) >= p.absVolRatio &&
    r > 0 &&
    pct(body(b), r) <= p.absBodyPct &&
    wBot(b) >= wTop(b) &&
    b.close >= (b.low + 0.5 * r);

  const bearAbs =
    vavg > 0 &&
    (b.volume / vavg) >= p.absVolRatio &&
    r > 0 &&
    pct(body(b), r) <= p.absBodyPct &&
    wTop(b) >= wBot(b) &&
    b.close <= (b.low + 0.5 * r);

  // SFP swings
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

// ---------- per-TF zone formation ----------
function formZonesOnTF(bars, tf, params) {
  const zones = [];
  let lastBull = -1, lastBear = -1;

  const bandPct =
    tf === "10m" ? params.bandPct10m :
    tf === "30m" ? params.bandPct30m :
    params.bandPct1h;

  const minHits =
    tf === "10m" ? params.minHits10m :
    tf === "30m" ? params.minHits30m :
    params.minHits1h;

  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    const events = detectPinAbsorbSFP(bars, i, params);

    // cluster using current bar extremes
    const centerHigh = b.high;
    const centerLow  = b.low;
    const { hitsOver, hitsUnder, bodiesInside } =
      countWickHits(bars, i, centerHigh, bandPct, params.winClust);

    const bodyOutsideOK = bodiesInside <= Math.ceil(params.winClust * 0.3);

    const wantsBear =
      hitsOver >= minHits &&
      bodyOutsideOK &&
      (events.sfpBear || events.bearPin || events.bearAbs);

    const wantsBull =
      hitsUnder >= minHits &&
      bodyOutsideOK &&
      (events.sfpBull || events.bullPin || events.bullAbs);

    const coolOk = (side) => {
      const last = side === "bull" ? lastBull : lastBear;
      return last < 0 || i - last >= params.coolOffBars;
    };

    // dist zone
    if (wantsBear && coolOk("bear")) {
      const mid = (b.open + b.close) / 2;
      const ceil = b.high;
      const floor = Math.min(mid, ceil - 1e-8);
      const midPrice = (ceil + floor) / 2;

      const dup = zones.slice(-50).some(z =>
        z.side === "bear" &&
        Math.abs(((z.top + z.bottom) / 2) - midPrice) <= midPrice * params.epsilonPct
      );
      if (!dup) {
        zones.push({
          id: `DIST_${tf}_${b.time}`,
          side: "bear",
          tf,
          time: b.time,
          index: i,
          top: ceil,
          bottom: floor,
          origin: events.sfpBear ? "SFP" : events.bearPin ? "PIN" : "ABS",
          status: "active",
          mtfConfirm: false,
          checks: {
            hrHits3: null,
            m10Hits7: null, // will be filled by cross-TF pass
            wickSide: "bear",
            bodiesOutside: bodyOutsideOK,
            effortVsResult: events.bearAbs,
            sweep: events.sfpBear,
            thrust: false,
            trueGap: false,
            confirm4h: false,
            gapFilled: false,
          },
          score: 0,
          touches: 0,
        });
        lastBear = i;
      }
    }

    // accum zone
    if (wantsBull && coolOk("bull")) {
      const mid = (b.open + b.close) / 2;
      const floor = b.low;
      const ceil  = Math.max(mid, floor + 1e-8);
      const midPrice = (ceil + floor) / 2;

      const dup = zones.slice(-50).some(z =>
        z.side === "bull" &&
        Math.abs(((z.top + z.bottom) / 2) - midPrice) <= midPrice * params.epsilonPct
      );
      if (!dup) {
        zones.push({
          id: `ACCUM_${tf}_${b.time}`,
          side: "bull",
          tf,
          time: b.time,
          index: i,
          top: ceil,
          bottom: floor,
          origin: events.sfpBull ? "SFP" : events.bullPin ? "PIN" : "ABS",
          status: "active",
          mtfConfirm: false,
          checks: {
            hrHits3: null,
            m10Hits7: null,
            wickSide: "bull",
            bodiesOutside: bodyOutsideOK,
            effortVsResult: events.bullAbs,
            sweep: events.sfpBull,
            thrust: false,
            trueGap: false,
            confirm4h: false,
            gapFilled: false,
          },
          score: 0,
          touches: 0,
        });
        lastBull = i;
      }
    }
  }

  return zones;
}

// ---------- 4H: promotion / exhaustion / thrust / gaps ----------
function findTrueGaps4h(bars4h) {
  const gaps = [];
  for (let i = 1; i < bars4h.length; i++) {
    const prev = bars4h[i - 1];
    const cur = bars4h[i];
    if (cur.low > prev.high) {
      gaps.push({ id: `GAPUP_${cur.time}`, dir: "up", top: cur.low, bottom: prev.high, resolved: false });
    } else if (cur.high < prev.low) {
      gaps.push({ id: `GAPDN_${cur.time}`, dir: "down", top: prev.low, bottom: cur.high, resolved: false });
    }
  }
  return gaps;
}

function nearestGap(gaps, zone, dir) {
  const mid = (zone.top + zone.bottom) / 2;
  let best = null, bestDist = Infinity;
  for (const g of gaps) {
    if (g.dir !== dir || g.resolved) continue;
    const edge = dir === "down" ? g.bottom : g.top;
    const d = Math.abs(edge - mid);
    if (d < bestDist) { best = g; bestDist = d; }
  }
  if (best) zone.checks.trueGap = true;
  return best;
}

function apply4hController(bars4h, zones, params) {
  const gaps = findTrueGaps4h(bars4h);

  for (const z of zones) {
    // 4h promotion: band defended ≥ 2 times with bodies outside
    let defenders = 0;
    for (const b of bars4h) {
      const bodyMin = Math.min(b.open, b.close);
      const bodyMax = Math.max(b.open, b.close);
      const inside = !(bodyMax < z.bottom || bodyMin > z.top);
      if (!inside) {
        const wickTouch = (b.low <= z.top && b.high >= z.bottom);
        if (wickTouch) defenders++;
      }
    }
    if (defenders >= 2) {
      z.mtfConfirm = true;
      z.checks.confirm4h = true;
    }

    // exhaustion: first 4h full body close through band
    for (const b of bars4h) {
      const bodyMin = Math.min(b.open, b.close);
      const bodyMax = Math.max(b.open, b.close);
      const crossDown = (z.side === "bear") && (bodyMin < z.bottom);
      const crossUp   = (z.side === "bull") && (bodyMax > z.top);
      if (crossDown || crossUp) {
        z.status = "exhausted";
        break;
      }
    }

    // thrust detection (last ~20 4h bars)
    const n = bars4h.length;
    for (let i = Math.max(1, n - 20); i < n; i++) {
      const b = bars4h[i];
      const avgR = averageRange(bars4h, Math.max(0, i - 19), i);
      const thrustRange = rng(b) >= 2 * avgR;
      const vavg = smaVol(bars4h, i, DEFAULTS.volLen);
      const thrustVol = vavg > 0 && (b.volume / vavg) >= 1.5;
      const closesAway = z.side === "bear"
        ? b.close < z.bottom
        : b.close > z.top;

      if (thrustRange && thrustVol && closesAway) {
        z.checks.thrust = true;
        const g = nearestGap(gaps, z, z.side === "bear" ? "down" : "up");
        if (g) z.gapId = g.id;
        break;
      }
    }
  }

  return { zones, gaps };
}

// ---------- scoring ----------
function scoreZone(z) {
  // weights: structure 30%, absorption 25%, manipulation/thrust 25%, gap/4h 20%
  const sStructure = 0.30 * (bool01(z.checks.bodiesOutside) + bool01(z.checks.wickSide)) / 2;
  const sAbsorb    = 0.25 * bool01(z.checks.effortVsResult);
  const sManip     = 0.25 * (bool01(z.checks.sweep) + bool01(z.checks.thrust)) / 2;
  const sGap4h     = 0.20 * (bool01(z.checks.trueGap) + bool01(z.checks.confirm4h)) / 2;
  z.score = clamp01(sStructure + sAbsorb + sManip + sGap4h);
  return z.score;
}

// ---------- main exported function ----------
export function computeSmartMoneyZones({ bars10m, bars30m, bars1h, bars4h }, options = {}) {
  const p = { ...DEFAULTS, ...options };

  if (!Array.isArray(bars10m) || !bars10m.length ||
      !Array.isArray(bars30m) || !bars30m.length ||
      !Array.isArray(bars1h)  || !bars1h.length  ||
      !Array.isArray(bars4h)  || !bars4h.length) {
    return { zones: [], gaps: [], alerts: [], meta: { drawLimit: p.drawLimit, minRectPx: p.minRectPx } };
  }

  // Step 1: per-TF zones from 10m/30m/1h
  const z10 = formZonesOnTF(bars10m, "10m", p);
  const z30 = formZonesOnTF(bars30m, "30m", p);
  const z1h = formZonesOnTF(bars1h,  "1h",  p);

  // Step 2: cross-TF repetition tagging (10m+30m wicks, 1h hits)
  const zones = [...z10, ...z30, ...z1h];
  for (const z of zones) {
    // mark hrHits3 if ANY 1h zone aligns in price
    if (z.tf !== "1h") {
      const midZ = (z.top + z.bottom) / 2;
      const match1h = z1h.find(h =>
        h.side === z.side &&
        Math.abs(((h.top + h.bottom)/2) - midZ) <= midZ * p.epsilonPct
      );
      z.checks.hrHits3 = !!match1h;
    }
    // mark m10Hits7 if ANY 10m/30m cluster near 1h zone
    if (z.tf === "1h") {
      const midH = (z.top + z.bottom) / 2;
      const sibling = [...z10, ...z30].find(t =>
        t.side === z.side &&
        Math.abs(((t.top + t.bottom)/2) - midH) <= midH * p.epsilonPct
      );
      z.checks.m10Hits7 = !!sibling;
    }
  }

  // Step 3: 4h controller (promotion/thrust/gaps/exhaustion)
  const ctrl = apply4hController(bars4h, zones, p);

  // Step 4: scoring & simple alerts (latest bar retest → rejection)
  const alerts = [];
  for (const z of ctrl.zones) {
    scoreZone(z);

    const tfBars = z.tf === "10m" ? bars10m : z.tf === "30m" ? bars30m : bars1h;
    const last = tfBars[tfBars.length - 1];
    if (!last) continue;

    const withinBand = last.low <= z.top && last.high >= z.bottom;
    const rejection =
      (z.side === "bear" && rng(last) > 0 && pct(wTop(last), rng(last)) >= p.pinWickPct) ||
      (z.side === "bull" && rng(last) > 0 && pct(wBot(last), rng(last)) >= p.pinWickPct);

    if (z.status !== "exhausted" && withinBand && rejection) {
      alerts.push({
        type: "ZONE_RETEST_REJECTION",
        zoneId: z.id,
        tf: z.tf,
        price: z.side === "bear" ? z.top : z.bottom,
        score: z.score,
        checks: z.checks,
      });
      z.touches += 1;
    }
  }

  // Step 5: mark gaps resolved if filled (using 1h bars for now)
  for (const g of ctrl.gaps) {
    const last = bars1h[bars1h.length - 1];
    if (!last) continue;
    const filled = g.dir === "down"
      ? last.low <= g.bottom
      : last.high >= g.top;
    if (filled && !g.resolved) {
      g.resolved = true;
      alerts.push({ type: "GAP_FILLED", gapId: g.id });
    }
  }

  // cap zones for sanity
  ctrl.zones.sort((a, b) => a.time - b.time);
  const capped = ctrl.zones.slice(-p.maxZones);

  return {
    zones: capped,
    gaps: ctrl.gaps,
    alerts,
    meta: { drawLimit: p.drawLimit, minRectPx: p.minRectPx },
  };
}
