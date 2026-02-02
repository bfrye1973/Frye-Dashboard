// services/core/jobs/updateSmzShelves.js
// Smart Money Shelves Job — writes smz-shelves.json
//
// FIX TARGET (LOCKED FOR THIS STEP):
// ✅ Stop the "everything becomes 89" bug.
// - Keep raw strengths from scanner + conversions.
// - Only clamp into the shelf band (60–89). NO rescale/remap.
// - Persistence stores maxStrengthSeenRaw (not forced to 89).
//
// Other LOCKED rules preserved:
// - institutional_min = 85 (85–100 suppress shelves by overlap filter)
// - shelves persist 48 hours; revisit resets timer; stronger overlap replaces
// - manual shelves included and override autos
// - convert structures < 85 into shelves (non-manual, non-NEG)
// - cluster collapse + global cap + no-touch winner pass
//
// NOTE: This job DOES NOT change how shelves are detected by the scanner.
// It only fixes scoring/persistence so the output isn't stuck at 89.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { computeShelves } from "../logic/smzShelvesScanner.js";
import { getBarsFromPolygonDeep } from "../../../api/providers/polygonBarsDeep.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTFILE = path.resolve(__dirname, "../data/smz-shelves.json");
const MANUAL_FILE = path.resolve(__dirname, "../data/smz-manual-shelves.json");
const LEVELS_FILE = path.resolve(__dirname, "../data/smz-levels.json");

const SYMBOL = "SPY";
const BAND_POINTS = 40;

const DAYS_15M = 180;
const DAYS_30M = 180;
const DAYS_1H = 180;

// Shelf band semantics (fixed)
const SHELF_MIN = 60;
const SHELF_MAX = 89;

// Institutional threshold (suppresses shelves)
const INSTITUTIONAL_MIN = 85;

// Persistence
const SHELF_PERSIST_HOURS = 48;

const SHELF_CLUSTER_OVERLAP = 0.55;
const SHELF_CLUSTER_GAP_PTS = 0.60;
const MAX_SHELVES_TOTAL = 8;

const isoNow = () => new Date().toISOString();
const round2 = (x) => Math.round(Number(x) * 100) / 100;

function clampInt(x, lo, hi) {
  const n = Math.round(Number(x));
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

function normalizeBars(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((b) => {
      const tms = Number(b.t ?? b.time ?? 0);
      const t = tms > 1e12 ? Math.floor(tms / 1000) : tms;
      return {
        time: t,
        open: Number(b.o ?? b.open ?? 0),
        high: Number(b.h ?? b.high ?? 0),
        low: Number(b.l ?? b.low ?? 0),
        close: Number(b.c ?? b.close ?? 0),
        volume: Number(b.v ?? b.volume ?? 0),
      };
    })
    .filter(
      (b) =>
        Number.isFinite(b.time) &&
        Number.isFinite(b.high) &&
        Number.isFinite(b.low) &&
        Number.isFinite(b.close)
    )
    .sort((a, b) => a.time - b.time);
}

function lastFiniteClose(bars) {
  if (!Array.isArray(bars)) return null;
  for (let i = bars.length - 1; i >= 0; i--) {
    const c = bars[i]?.close;
    if (Number.isFinite(c)) return c;
  }
  return null;
}

function normalizeType(t) {
  const x = String(t ?? "").toLowerCase();
  if (x === "accumulation" || x === "acc") return "accumulation";
  if (x === "distribution" || x === "dist") return "distribution";
  return null;
}

function normalizeRange(pr) {
  if (!Array.isArray(pr) || pr.length !== 2) return null;
  const a = Number(pr[0]);
  const b = Number(pr[1]);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  const hi = round2(Math.max(a, b));
  const lo = round2(Math.min(a, b));
  if (!(hi > lo)) return null;
  const width = hi - lo;
  const mid = (hi + lo) / 2;
  return { hi, lo, width, mid };
}

function withinBand(r, price) {
  if (!r || !Number.isFinite(price)) return false;
  return r.hi >= price - BAND_POINTS && r.lo <= price + BAND_POINTS;
}

function rangesOverlap(aHi, aLo, bHi, bLo) {
  return !(aHi < bLo || aLo > bHi);
}

function overlapRatio(aHi, aLo, bHi, bLo) {
  const lo = Math.max(aLo, bLo);
  const hi = Math.min(aHi, bHi);
  const inter = hi - lo;
  if (inter <= 0) return 0;
  const denom = Math.min(aHi - aLo, bHi - bLo);
  return denom > 0 ? inter / denom : 0;
}

function rangeGapPts(aHi, aLo, bHi, bLo) {
  if (rangesOverlap(aHi, aLo, bHi, bLo)) return 0;
  if (aHi < bLo) return bLo - aHi;
  if (bHi < aLo) return aLo - bHi;
  return 0;
}

function hoursSince(ts) {
  const t = Date.parse(ts || "");
  if (!Number.isFinite(t)) return Infinity;
  return (Date.now() - t) / (3600 * 1000);
}

function priceInside(price, r) {
  return Number.isFinite(price) && price >= r.lo && price <= r.hi;
}

// --- Load prev shelves for persistence ---
function loadPrevShelves() {
  if (!fs.existsSync(OUTFILE)) return [];
  try {
    const raw = fs.readFileSync(OUTFILE, "utf8");
    const json = JSON.parse(raw);
    return Array.isArray(json?.levels) ? json.levels : [];
  } catch {
    return [];
  }
}

// --- Manual shelves ---
function loadManualShelves(nowIso) {
  if (!fs.existsSync(MANUAL_FILE)) return [];
  try {
    const raw = fs.readFileSync(MANUAL_FILE, "utf8");
    const json = JSON.parse(raw);
    const arr = Array.isArray(json?.levels) ? json.levels : [];

    return arr
      .map((s) => {
        const type = normalizeType(s?.type);
        if (!type) return null;

        const r = normalizeRange(
          Array.isArray(s?.manualRange) && s.manualRange.length === 2 ? s.manualRange : s.priceRange
        );
        if (!r) return null;

        const rawScore = Number.isFinite(Number(s?.scoreOverride))
          ? Number(s.scoreOverride)
          : Number(s?.strength ?? 75);

        const strengthRaw = Number.isFinite(rawScore) ? rawScore : 75;
        const strength = clampInt(strengthRaw, SHELF_MIN, SHELF_MAX);

        return {
          type,
          priceRange: [r.hi, r.lo],
          strength_raw: round2(strengthRaw),
          strength, // clamped only
          rangeSource: "manual",
          locked: true,
          comment: typeof s?.comment === "string" ? s.comment : null,
          firstSeenUtc: nowIso,
          lastSeenUtc: nowIso,
          maxStrengthSeenRaw: round2(strengthRaw),
        };
      })
      .filter(Boolean)
      .filter((s) => String(s.status ?? "active").toLowerCase() !== "inactive");
  } catch {
    return [];
  }
}

// --- Convert structures <85 into shelves (non-manual, non-NEG) ---
function convertStructuresToShelves(nowIso) {
  if (!fs.existsSync(LEVELS_FILE)) return [];
  try {
    const raw = fs.readFileSync(LEVELS_FILE, "utf8");
    const json = JSON.parse(raw);
    const arr = Array.isArray(json?.structures_sticky) ? json.structures_sticky : [];

    const out = [];

    for (const z of arr) {
      const id = String(z?.details?.id ?? z?.structureKey ?? "");
      if (id.includes("|NEG|")) continue;
      if (id.startsWith("MANUAL|")) continue;

      const sRaw = Number(z?.strength ?? NaN);
      if (!Number.isFinite(sRaw)) continue;
      if (sRaw >= INSTITUTIONAL_MIN) continue; // 85+ stays institutional

      const r = normalizeRange(z?.priceRange);
      if (!r) continue;

      // Keep their exitSide mapping if present; default accumulation
      const facts = z?.details?.facts ?? {};
      const exitSide = facts?.exitSide1h ?? null;
      const type =
        exitSide === "below" ? "distribution" :
        exitSide === "above" ? "accumulation" :
        "accumulation";

      const strengthRaw = round2(sRaw);
      const strength = clampInt(strengthRaw, SHELF_MIN, SHELF_MAX);

      out.push({
        type,
        priceRange: [r.hi, r.lo],
        strength_raw: strengthRaw,
        strength,
        rangeSource: "converted_structure",
        comment: `Converted from structure (${strengthRaw})`,
        firstSeenUtc: nowIso,
        lastSeenUtc: nowIso,
        maxStrengthSeenRaw: strengthRaw,
      });
    }

    return out;
  } catch {
    return [];
  }
}

// --- Institutionals suppress shelves (>=85 only) ---
function loadInstitutionalRangesForSuppression() {
  if (!fs.existsSync(LEVELS_FILE)) return [];
  try {
    const raw = fs.readFileSync(LEVELS_FILE, "utf8");
    const json = JSON.parse(raw);
    const arr = Array.isArray(json?.structures_sticky) ? json.structures_sticky : [];

    return arr
      .filter((z) => {
        const id = String(z?.details?.id ?? z?.structureKey ?? "");
        if (id.includes("|NEG|")) return false;
        const s = Number(z?.strength ?? NaN);
        return Number.isFinite(s) && s >= INSTITUTIONAL_MIN;
      })
      .map((z) => normalizeRange(z?.priceRange))
      .filter(Boolean)
      .map((r) => ({ hi: r.hi, lo: r.lo }));
  } catch {
    return [];
  }
}

// --- Remove autos overlapping manual same type ---
function removeAutosOverlappingManualSameType(autoLevels, manualLevels) {
  if (!Array.isArray(autoLevels) || !autoLevels.length) return [];
  if (!Array.isArray(manualLevels) || !manualLevels.length) return autoLevels;

  return autoLevels.filter((a) => {
    const at = normalizeType(a?.type);
    if (!at) return false;

    const ar = normalizeRange(a?.priceRange);
    if (!ar) return false;

    const overlapsSameTypeManual = manualLevels.some((m) => {
      const mt = normalizeType(m?.type);
      if (!mt || mt !== at) return false;

      const mr = normalizeRange(m?.priceRange);
      if (!mr) return false;

      return rangesOverlap(ar.hi, ar.lo, mr.hi, mr.lo);
    });

    return !overlapsSameTypeManual;
  });
}

// --- Cluster/cap/no-touch (same as before) ---
function shelfOverlapRatio(a, b) {
  const ar = normalizeRange(a?.priceRange);
  const br = normalizeRange(b?.priceRange);
  if (!ar || !br) return 0;
  const interLo = Math.max(ar.lo, br.lo);
  const interHi = Math.min(ar.hi, br.hi);
  const inter = interHi - interLo;
  if (inter <= 0) return 0;
  const denom = Math.min(ar.width, br.width);
  return denom > 0 ? inter / denom : 0;
}

function shelfBelongsToCluster(s, rep) {
  const sr = normalizeRange(s?.priceRange);
  const rr = normalizeRange(rep?.priceRange);
  if (!sr || !rr) return false;

  const ov = shelfOverlapRatio(s, rep);
  if (ov >= SHELF_CLUSTER_OVERLAP) return true;

  const gap = rangeGapPts(sr.hi, sr.lo, rr.hi, rr.lo);
  if (gap <= SHELF_CLUSTER_GAP_PTS) return true;

  return false;
}

function isManualShelf(s) {
  return s?.rangeSource === "manual" || s?.locked === true;
}

function pickBestOfType(items, type) {
  const list = (items || [])
    .filter((x) => normalizeType(x?.type) === type)
    .slice()
    .sort((a, b) => {
      const ma = isManualShelf(a) ? 1 : 0;
      const mb = isManualShelf(b) ? 1 : 0;
      if (mb !== ma) return mb - ma;

      const sb = Number(b?.strength ?? 0) - Number(a?.strength ?? 0);
      if (sb !== 0) return sb;

      const aw = normalizeRange(a?.priceRange)?.width ?? Infinity;
      const bw = normalizeRange(b?.priceRange)?.width ?? Infinity;
      return aw - bw;
    });

  return list[0] ?? null;
}

function collapseShelvesByCluster(levels) {
  const list = Array.isArray(levels) ? levels.slice() : [];
  if (!list.length) return [];

  list.sort((a, b) => Number(b?.strength ?? 0) - Number(a?.strength ?? 0));

  const clusters = [];

  for (const s of list) {
    const sr = normalizeRange(s?.priceRange);
    const st = normalizeType(s?.type);
    if (!sr || !st) continue;

    let placed = false;

    for (const c of clusters) {
      if (shelfBelongsToCluster(s, c.rep)) {
        c.members.push(s);

        // choose best rep (manual wins, else stronger wins)
        const rep = c.rep;
        const repManual = isManualShelf(rep) ? 1 : 0;
        const sManual = isManualShelf(s) ? 1 : 0;

        if (sManual > repManual) c.rep = s;
        else if (sManual === repManual) {
          const ss = Number(s?.strength ?? 0);
          const rs = Number(rep?.strength ?? 0);
          if (ss > rs) c.rep = s;
        }

        placed = true;
        break;
      }
    }

    if (!placed) clusters.push({ rep: s, members: [s] });
  }

  const out = [];
  for (const c of clusters) {
    const bestAcc = pickBestOfType(c.members, "accumulation");
    const bestDist = pickBestOfType(c.members, "distribution");
    if (bestAcc) out.push(bestAcc);
    if (bestDist) out.push(bestDist);
  }

  out.sort((a, b) => Number(b?.strength ?? 0) - Number(a?.strength ?? 0));
  return out;
}

function applyGlobalCap(levels, maxTotal = MAX_SHELVES_TOTAL) {
  const list = Array.isArray(levels) ? levels.slice() : [];
  return list
    .slice()
    .sort((a, b) => Number(b?.strength ?? 0) - Number(a?.strength ?? 0))
    .slice(0, maxTotal);
}

function applyNoTouchWinnerPass(levels) {
  const list = Array.isArray(levels) ? levels.slice() : [];
  if (!list.length) return [];

  list.sort((a, b) => Number(b?.strength ?? 0) - Number(a?.strength ?? 0));

  const kept = [];
  for (const s of list) {
    const sr = normalizeRange(s?.priceRange);
    if (!sr) continue;

    const touchesExisting = kept.some((k) => {
      const kr = normalizeRange(k?.priceRange);
      if (!kr) return false;
      return rangesOverlap(sr.hi, sr.lo, kr.hi, kr.lo);
    });

    if (!touchesExisting) kept.push(s);
  }
  return kept;
}

// --- Persistence merge: keep 48h; revisit resets; stronger replaces ---
function mergeWithMemory(current, prev, currentPrice, nowIso) {
  const out = [];

  // keep prev not expired and in band; revisit resets timer
  for (const p of prev || []) {
    const r = normalizeRange(p?.priceRange);
    if (!r) continue;
    if (!withinBand(r, currentPrice)) continue;

    if (hoursSince(p?.lastSeenUtc) > SHELF_PERSIST_HOURS) continue;

    const maxRaw = Number(p?.maxStrengthSeenRaw ?? p?.strength_raw ?? p?.strength ?? 0);

    const updated = {
      ...p,
      maxStrengthSeenRaw: round2(maxRaw),
    };

    if (priceInside(currentPrice, r)) updated.lastSeenUtc = nowIso;
    out.push(updated);
  }

  // merge new detections
  for (const n of current || []) {
    const rn = normalizeRange(n?.priceRange);
    if (!rn) continue;
    if (!withinBand(rn, currentPrice)) continue;

    let merged = false;

    for (let i = 0; i < out.length; i++) {
      const o = out[i];
      const ro = normalizeRange(o?.priceRange);
      if (!ro) continue;

      if (normalizeType(o?.type) !== normalizeType(n?.type)) continue;
      if (!rangesOverlap(rn.hi, rn.lo, ro.hi, ro.lo)) continue;

      const oldMaxRaw = Number(o?.maxStrengthSeenRaw ?? o?.strength_raw ?? o?.strength ?? 0);
      const newRaw = Number(n?.strength_raw ?? n?.strength ?? 0);

      if (Number.isFinite(newRaw) && newRaw > oldMaxRaw) {
        out[i] = {
          ...o,
          ...n,
          lastSeenUtc: nowIso,
          maxStrengthSeenRaw: round2(newRaw),
          strength_raw: round2(newRaw),
          strength: clampInt(newRaw, SHELF_MIN, SHELF_MAX),
        };
      } else {
        out[i] = {
          ...o,
          lastSeenUtc: nowIso,
          maxStrengthSeenRaw: round2(oldMaxRaw),
          strength: clampInt(oldMaxRaw, SHELF_MIN, SHELF_MAX),
        };
      }

      merged = true;
      break;
    }

    if (!merged) {
      const newRaw = Number(n?.strength_raw ?? n?.strength ?? 0);
      out.push({
        ...n,
        lastSeenUtc: nowIso,
        maxStrengthSeenRaw: round2(newRaw),
        strength_raw: round2(newRaw),
        strength: clampInt(newRaw, SHELF_MIN, SHELF_MAX),
      });
    }
  }

  return out;
}

async function main() {
  try {
    const nowIso = isoNow();

    const [bars15mRaw, bars30mRaw, bars1hRaw] = await Promise.all([
      getBarsFromPolygonDeep(SYMBOL, "15m", DAYS_15M),
      getBarsFromPolygonDeep(SYMBOL, "30m", DAYS_30M),
      getBarsFromPolygonDeep(SYMBOL, "1h", DAYS_1H),
    ]);

    const bars15m = normalizeBars(bars15mRaw || []);
    const bars30m = normalizeBars(bars30mRaw || []);
    const bars1h = normalizeBars(bars1hRaw || []);

    const currentPriceAnchor = lastFiniteClose(bars30m) ?? lastFiniteClose(bars1h);
    if (!Number.isFinite(currentPriceAnchor)) {
      console.warn("[SHELVES] No finite close found; skipping run safely.");
      return;
    }

    // prev
    const prevShelves = loadPrevShelves();

    // manual shelves
    const manualAll = loadManualShelves(nowIso);
    const manualInBand = manualAll.filter((s) => withinBand(normalizeRange(s.priceRange), currentPriceAnchor));

    // converted structures <85
    const convertedAll = convertStructuresToShelves(nowIso);
    const convertedInBand = convertedAll.filter((s) => withinBand(normalizeRange(s.priceRange), currentPriceAnchor));

    // auto shelves from scanner (keep raw; clamp only)
    const raw = computeShelves({ bars10m: bars15m, bars30m, bars1h, bandPoints: BAND_POINTS }) || [];
    const rawInBand = raw.filter((s) => withinBand(normalizeRange(s?.priceRange), currentPriceAnchor));

    const autoNoOverlap = removeAutosOverlappingManualSameType(rawInBand, manualInBand);

    const autoMapped = autoNoOverlap
      .map((s) => {
        const type = normalizeType(s?.type);
        if (!type) return null;
        const r = normalizeRange(s?.priceRange);
        if (!r) return null;

        const rawStrength = Number(s?.strength ?? NaN);
        const strengthRaw = Number.isFinite(rawStrength) ? round2(rawStrength) : 75;

        return {
          type,
          priceRange: [r.hi, r.lo],
          strength_raw: strengthRaw,
          strength: clampInt(strengthRaw, SHELF_MIN, SHELF_MAX),
          rangeSource: "auto",
          comment: s?.comment ?? null,
          firstSeenUtc: nowIso,
          lastSeenUtc: nowIso,
          maxStrengthSeenRaw: strengthRaw,
        };
      })
      .filter(Boolean);

    // merge current shelves
    const currentShelves = [...manualInBand, ...convertedInBand, ...autoMapped];

    // persistence merge
    const withMemory = mergeWithMemory(currentShelves, prevShelves, currentPriceAnchor, nowIso);

    // suppress shelves inside institutionals (>=85)
    const instRanges = loadInstitutionalRangesForSuppression();
    const suppressed = withMemory.filter((s) => {
      const r = normalizeRange(s?.priceRange);
      if (!r) return false;
      const overlapsInst = instRanges.some((z) => overlapRatio(r.hi, r.lo, z.hi, z.lo) >= 0.25);
      return !overlapsInst;
    });

    // cluster + cap + no-touch
    const collapsed = collapseShelvesByCluster(suppressed);
    const capped = applyGlobalCap(collapsed, MAX_SHELVES_TOTAL);
    const finalLevels = applyNoTouchWinnerPass(capped);

    const payload = {
      ok: true,
      meta: {
        generated_at_utc: nowIso,
        symbol: SYMBOL,
        band_points: BAND_POINTS,
        current_price_anchor: round2(currentPriceAnchor),
        institutional_min: INSTITUTIONAL_MIN,
        shelf_persist_hours: SHELF_PERSIST_HOURS,
        converted_structures_in_band: convertedInBand.length,
        manual_in_band: manualInBand.length,
        auto_in_band: autoMapped.length,
      },
      levels: finalLevels,
    };

    fs.mkdirSync(path.dirname(OUTFILE), { recursive: true });
    fs.writeFileSync(OUTFILE, JSON.stringify(payload, null, 2), "utf8");

    console.log("[SHELVES] Saved shelves:", finalLevels.length);
  } catch (e) {
    console.error("[SHELVES] FAILED:", e);
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default main;
