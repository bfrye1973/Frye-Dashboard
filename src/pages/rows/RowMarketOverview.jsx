// src/pages/rows/RowMarketOverview.jsx
import React from "react";
import { useDashboardPoll } from "../../lib/dashboardApiSafe";
import { LastUpdated } from "../../components/LastUpdated";
import {
  MarketMeterIntradayLegend,
  MarketMeterDailyLegend,
} from "../../components/MarketMeterLegend";

// Proxied Render endpoints (set in .env.local)
const INTRADAY_URL = process.env.REACT_APP_INTRADAY_URL; // /live/intraday
const EOD_URL      = process.env.REACT_APP_EOD_URL;      // /live/eod

// Read-only sandbox URL for 5m deltas
const SANDBOX_URL  = process.env.REACT_APP_INTRADAY_SANDBOX_URL || "";

// Optional backend API base for replay (unchanged)
const API =
  (typeof window !== "undefined" && (window.__API_BASE__ || "")) ||
  process.env.REACT_APP_API_URL ||
  "";

/* ------------------------------ utils ------------------------------ */
const clamp01 = (n) => Math.max(0, Math.min(100, Number(n)));
const clamp   = (n, lo, hi) => Math.max(lo, Math.min(hi, Number(n)));
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
};
function fmtIso(ts) {
  try { return new Date(ts).toLocaleString(); } catch { return ts; }
}
const isStale = (ts, maxMs = 12 * 60 * 1000) => {
  if (!ts) return true;
  const t = new Date(ts).getTime();
  return !Number.isFinite(t) || Date.now() - t > maxMs;
};

function tsOf(x){ return x?.updated_at || x?.ts || null; }
function newer(a, b) {
  const ta = tsOf(a), tb = tsOf(b);
  if (!ta) return b;
  if (!tb) return a;
  return new Date(ta).getTime() >= new Date(tb).getTime() ? a : b;
}

/** map Liquidity PSI (0..120) → percent 0..100 for scoring */
function mapPsiToPct(psi) {
  if (!Number.isFinite(psi)) return NaN;
  return clamp((psi / 120) * 100, 0, 100);
}

/** overall intraday score (0..100) combining 10m lights (fallback if backend overall10m is missing) */
function overallIntradayScore(m, intraday) {
  if (!m) return NaN;
  const breadth   = num(m.breadth_pct);                        // 0..100
  const momentum  = num(m.momentum_pct);                       // 0..100
  const squeezeOk = Number.isFinite(m.squeeze_intraday_pct ?? m.squeeze_pct)
    ? clamp(100 - (m.squeeze_intraday_pct ?? m.squeeze_pct), 0, 100)  // lower squeeze → better
    : NaN;
  const volOk     = Number.isFinite(m.volatility_pct)
    ? clamp(100 - m.volatility_pct, 0, 100)                    // lower vol → better
    : NaN;
  const liqPct    = mapPsiToPct(num(m.liquidity_psi ?? m.liquidity_pct));
  const sectorDir = num(intraday?.sectorDirection10m?.risingPct);
  const riskOn    = num(intraday?.riskOn10m?.riskOnPct);

  // Weights (sum ≈ 1). Lead with Breadth & Momentum; mid with Squeeze/Vol/Liq; light influence from Sector/RiskOn.
  const w = { breadth:.22, momentum:.22, squeezeOk:.18, volOk:.14, liqPct:.14, sectorDir:.05, riskOn:.05 };
  const parts = [
    { v: breadth,   w: w.breadth },
    { v: momentum,  w: w.momentum },
    { v: squeezeOk, w: w.squeezeOk },
    { v: volOk,     w: w.volOk },
    { v: liqPct,    w: w.liqPct },
    { v: sectorDir, w: w.sectorDir },
    { v: riskOn,    w: w.riskOn },
  ].filter(p => Number.isFinite(p.v));
  if (!parts.length) return NaN;
  const totalW = parts.reduce((s,p)=>s+p.w,0);
  const score  = parts.reduce((s,p)=>s + p.v*p.w, 0) / (totalW || 1);
  return clamp(score, 0, 100);
}

/** tone helpers for Market Meter (finalized thresholds) */
function toneForBreadth(v){ if (!Number.isFinite(v)) return "info"; if (v >= 65) return "ok"; if (v >= 35) return "warn"; return "danger"; }
function toneForMomentum(v){ if (!Number.isFinite(v)) return "info"; if (v >= 65) return "ok"; if (v >= 35) return "warn"; return "danger"; }
/** squeeze is inverted (higher = tighter/worse) */
function toneForSqueeze(v){ if (!Number.isFinite(v)) return "info"; if (v >= 85) return "danger"; if (v >= 65) return "warn"; if (v >= 35) return "warn"; return "ok"; }
function toneForLiquidity(v){ if (!Number.isFinite(v)) return "info"; if (v >= 60) return "ok"; if (v >= 40) return "warn"; return "danger"; }
/** volatility: higher = rougher/worse */
function toneForVol(v){ if (!Number.isFinite(v)) return "info"; if (v > 60) return "danger"; if (v > 30) return "warn"; return "ok"; }
function toneForPercent(v){ if (!Number.isFinite(v)) return "info"; if (v >= 60) return "ok"; if (v >= 45) return "warn"; return "danger"; }
/** daily trend (emaSlope around 0) */
function toneForDailyTrend(slope){ if (!Number.isFinite(slope)) return "info"; if (slope > 5) return "ok"; if (slope >= -5) return "warn"; return "danger"; }
/** daily squeeze Lux (inverted) */
function toneForLuxDaily(v){ if (!Number.isFinite(v)) return "info"; if (v >= 85) return "danger"; if (v >= 80) return "warn"; return "ok"; }
/** regimes from band strings */
function toneForVolBand(band){ return band === "high" ? "danger" : band === "elevated" ? "warn" : band ? "ok" : "info"; }
function toneForLiqBand(band){ return band === "good" ? "ok" : band === "normal" ? "warn" : band ? "danger" : "info"; }

/** Overall tone: prefer backend state if present; else use score thresholds */
function toneForOverallState(state, score){
  const s = (state || "").toLowerCase();
  if (s === "bull")    return "ok";
  if (s === "bear")    return "danger";
  if (s === "neutral") return "warn";
  return toneForPercent(score);
}

/* ---------------------------- Stoplight ---------------------------- */
/**
 * clamp: if true, clamp to [0,100] (use for %).
 * For PSI or raw indices, set clamp={false} and provide unit="PSI" (or "").
 */
function Stoplight({
  label,
  value,
  baseline,
  size = 54,
  unit = "%",
  subtitle,
  toneOverride,
  extraBelow,
  clamp = true,
}) {
  const rawV = Number.isFinite(value) ? Number(value) : NaN;
  const v = clamp ? (Number.isFinite(rawV) ? clamp01(rawV) : NaN) : rawV;

  const rawB = Number.isFinite(baseline) ? Number(baseline) : NaN;
  const delta = Number.isFinite(v) && Number.isFinite(rawB) ? v - rawB : NaN;
  const tone  = toneOverride || "info";
  const colors = {
    ok:     { bg: "#22c55e", glow: "rgba(34,197,94,.45)" },
    warn:   { bg: "#fbbf24", glow: "rgba(251,191,36,.45)" },
    danger: { bg: "#ef4444", glow: "rgba(239,68,68,.45)" },
    info:   { bg: "#334155", glow: "rgba(51,65,85,.35)" },
  }[tone];

  const arrow =
    !Number.isFinite(delta) ? "→" :
    Math.abs(delta) < 0.5   ? "→" :
    delta > 0               ? "↑" : "↓";

  const deltaColor =
    !Number.isFinite(delta) ? "#94a3b8" :
    delta > 0               ? "#22c55e" :
    delta < 0               ? "#ef4444" : "#94a3b8";

  const valueText = Number.isFinite(v)
    ? `${v.toFixed(1)}${unit && unit !== "%" ? ` ${unit}` : unit === "%" ? "%" : ""}`
    : "—";

  const deltaText = Number.isFinite(delta)
    ? `${delta.toFixed(1)}${unit && unit !== "%" ? ` ${unit}` : unit === "%" ? "%" : ""}`
    : (unit === "%" ? "0.0%" : "0.0");

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, minWidth: size + 36 }}>
      <div
        title={`${label}: ${valueText}`}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: colors.bg,
          boxShadow: `0 0 12px ${colors.glow}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "4px solid #0c1320",
        }}
      >
        <div style={{ fontWeight: 800, fontSize: size >= 100 ? 20 : 16, color: "#0b1220" }}>
          {valueText}
        </div>
      </div>
      <div className="small" style={{ color: "#e5e7eb", fontWeight: 700, fontSize: 15, textAlign: "center" }}>{label}</div>
      {subtitle && <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 600, textAlign: "center" }}>{subtitle}</div>}
      <div style={{ color: deltaColor, fontSize: 13, fontWeight: 600 }}>
        {arrow} {deltaText}
      </div>
      {/* Extra line under the baseline delta (we use this to show 5m Δ pills) */}
      {extraBelow || null}
    </div>
  );
}

/* -------------------------- Baselines ------------------------- */
const dayKey = () => new Date().toISOString().slice(0, 10);
function useDailyBaseline(key, current) {
  const [b, setB] = React.useState(null);
  React.useEffect(() => {
    const k = `meter_baseline_${dayKey()}_${key}`;
    const s = localStorage.getItem(k);
    if (s === null && Number.isFinite(current)) { localStorage.setItem(k, String(current)); setB(current); }
    else if (s !== null) { const n = Number(s); setB(Number.isFinite(n) ? n : null); }
  }, [key]);
  React.useEffect(() => {
    if (!Number.isFinite(current)) return;
    const k = `meter_baseline_${dayKey()}_${key}`;
    if (localStorage.getItem(k) === null) { localStorage.setItem(k, String(current)); setB(current); }
  }, [key, current]);
  return b;
}

/* -------------------------- 5m Δ (sandbox) -------------------------- */
function useSandboxDeltas() {
  const [deltaMkt, setDeltaMkt] = React.useState({ dB: null, dM: null, riskOn: null });
  const [deltasUpdatedAt, setDUA] = React.useState(null);
  React.useEffect(() => {
    let stop = false;
    async function load() {
      if (!SANDBOX_URL) return;
      try {
        const u = SANDBOX_URL.includes("?")
          ? `${SANDBOX_URL}&t=${Date.now()}`
          : `${SANDBOX_URL}?t=${Date.now()}`;
        const r = await fetch(u, { cache: "no-store" });
        const j = await r.json();
        if (stop) return;
        setDeltaMkt({
          dB: Number(j?.deltas?.market?.dBreadthPct ?? null),
          dM: Number(j?.deltas?.market?.dMomentumPct ?? null),
          riskOn: Number(j?.deltas?.market?.riskOnPct ?? null),
        });
        setDUA(j?.deltasUpdatedAt || null);
      } catch {
        if (!stop) { setDeltaMkt({ dB: null, dM: null, riskOn: null }); setDUA(null); }
      }
    }
    load();
    const t = setInterval(load, 60_000);
    return () => { stop = true; clearInterval(t); };
  }, []);
  return { deltaMkt, deltasUpdatedAt, stale: isStale(deltasUpdatedAt) };
}

function DeltaTag({ label, value, stale }) {
  if (!Number.isFinite(value)) return null;
  const c = value >= 1 ? "#22c55e" : value <= -1 ? "#ef4444" : "#9ca3af";
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: 11,
        lineHeight: "14px",
        padding: "2px 6px",
        borderRadius: 6,
        marginTop: 4,
        marginRight: 6,
        background: "#0b1220",
        color: stale ? "#9ca3af" : c,
        border: `1px solid ${c}33`,
        fontWeight: 700,
      }}
      title={`${label}: ${value > 0 ? "+" : ""}${value.toFixed(2)}`}
    >
      {label}: <span style={{ color: stale ? "#9ca3af" : c }}>
        {value > 0 ? "+" : ""}{value.toFixed(2)}
      </span>
    </span>
  );
}

/* ------------------------------ Replay UI ----------------------------- */
function ReplayControls({ on, setOn, granularity, setGranularity, ts, setTs, options, loading }) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setOn(!on)}
        className={`px-3 py-1 rounded-full border text-sm ${on ? "border-yellow-400 text-yellow-300 bg-neutral-800" : "border-neutral-700 text-neutral-300 bg-neutral-900 hover:border-neutral-500"}`}
      >
        {on ? "Replay: ON" : "Replay: OFF"}
      </button>
      <select
        value={granularity}
        onChange={(e) => setGranularity(e.target.value)}
        disabled={!on}
        className="px-2 py-1 rounded-md border border-neutral-700 bg-neutral-900 text-neutral-200 text-sm"
      >
        <option value="10min">10m</option>
        <option value="1h">1h</option>
        <option value="1d">1d</option>
      </select>
      <select
        value={ts || ""}
        onChange={(e) => setTs(e.target.value)}
        disabled={!on || loading || options.length === 0}
        className="min-w-[220px] px-2 py-1 rounded-md border border-neutral-700 bg-neutral-900 text-neutral-200 text-sm"
      >
        {loading && <option value="">Loading…</option>}
        {!loading && options.length === 0 && <option value="">No snapshots</option>}
        {!loading && options.length > 0 && (
          <>
            <option value="">Select time…</option>
            {options.map((o) => (
              <option key={o.ts} value={o.ts}>{fmtIso(o.ts)}</option>
            ))}
          </>
        )}
      </select>
    </div>
  );
}

/* ========================== Main Row component ========================== */
export default function RowMarketOverview() {
  const { data: polled } = useDashboardPoll("dynamic");

  // Legend state (two independent modals)
  const [legendOpen, setLegendOpen] = React.useState(null); // "intraday" | "daily" | null

  // LIVE fetch (intraday + daily) — initial pull + 60s polling
  const [liveIntraday, setLiveIntraday] = React.useState(null);
  const [liveDaily, setLiveDaily] = React.useState(null);

  React.useEffect(() => {
    let stop = false;
    async function pull() {
      try {
        if (INTRADAY_URL) {
          const r = await fetch(`${INTRADAY_URL}?t=${Date.now()}`, { cache: "no-store" });
          const j = await r.json();
          if (!stop) setLiveIntraday(j);
        }
        if (EOD_URL) {
          const r2 = await fetch(`${EOD_URL}?t=${Date.now()}`, { cache: "no-store" });
          const j2 = await r2.json();
          if (!stop) setLiveDaily(j2);
        }
      } catch {}
    }
    pull();
    const id = setInterval(pull, 60_000);
    return () => { stop = true; clearInterval(id); };
  }, []);

  // Replay
  const [on, setOn] = React.useState(false);
  const [granularity, setGranularity] = React.useState("10min");
  const [tsSel, setTsSel] = React.useState("");
  const [indexOptions, setIndexOptions] = React.useState([]);
  const [loadingIdx, setLoadingIdx] = React.useState(false);
  const [snap, setSnap] = React.useState(null);
  const [loadingSnap, setLoadingSnap] = React.useState(false);
  const granParam = granularity === "10min" ? "10min" : (granularity === "1h" ? "hourly" : "eod");

  React.useEffect(() => {
    if (!on) { setIndexOptions([]); return; }
    (async () => {
      try {
        setLoadingIdx(true);
        const r = await fetch(`${API}/api/replay/index?granularity=${granParam}&t=${Date.now()}`, { cache: "no-store" });
        const j = await r.json();
        const items = Array.isArray(j?.items) ? j.items : [];
        setIndexOptions(items);
        if (items.length && !tsSel) setTsSel(items[0].ts);
      } finally { setLoadingIdx(false); }
    })();
  }, [on, granParam]);

  React.useEffect(() => {
    if (!on || !tsSel) { setSnap(null); return; }
    (async () => {
      try {
        setLoadingSnap(true);
        const r = await fetch(`${API}/api/replay/at?granularity=${granParam}&ts=${encodeURIComponent(tsSel)}&t=${Date.now()}`, { cache: "no-store" });
        const j = await r.json();
        setSnap(j);
      } catch { setSnap(null); }
      finally { setLoadingSnap(false); }
    })();
  }, [on, tsSel, granParam]);

  // choose data: replay → newer(live vs polled)
  const chosen = on && snap && snap.ok !== false ? snap : newer(liveIntraday, polled);
  const data  = chosen || {};
  const daily = liveDaily || {};

  /* Prefer intraday.* from the LIVE payload even if polled wins */
  const intradayLive = liveIntraday?.intraday;
  const intradayAny  = data?.intraday;
  const intraday     = intradayLive || intradayAny || null;

  /* -------------------- INTRADAY LEFT (metrics + intraday) -------------------- */
  const { deltaMkt, deltasUpdatedAt, stale } = useSandboxDeltas();

  const m   = data?.metrics ?? {};
  const ts  = data?.updated_at ?? data?.ts ?? null;

  const breadth      = num(m.breadth_pct);
  const momentum     = num(m.momentum_pct);
  const squeezeIntra = num(m.squeeze_intraday_pct ?? m.squeeze_pct); // alias-safe
  const liquidity    = num(m.liquidity_psi        ?? m.liquidity_pct); // PSI, alias-safe
  const volatility   = num(m.volatility_pct);

  const sectorDirCount = intraday?.sectorDirection10m?.risingCount ?? null;
  const sectorDirPct   = num(intraday?.sectorDirection10m?.risingPct);
  const riskOn10m      = num(intraday?.riskOn10m?.riskOnPct);

  // Overall (10m): prefer backend value if present; else fallback to client compute
  const overallFromBackend = intraday?.overall10m || null; // {state, score}
  const overallState = overallFromBackend?.state || null;
  const overallScoreBk = num(overallFromBackend?.score);
  const overall10mComputed = overallIntradayScore(m, intraday);
  const overall10mVal = Number.isFinite(overallScoreBk) ? overallScoreBk : overall10mComputed;

  // baselines for intraday (persist for the day)
  const bOverall   = useDailyBaseline("overall10m", overall10mVal);
  const bBreadth   = useDailyBaseline("breadth", breadth);
  const bMomentum  = useDailyBaseline("momentum", momentum);
  const bSqueezeIn = useDailyBaseline("squeezeIntraday", squeezeIntra);
  const bLiquidity = useDailyBaseline("liquidity", liquidity);
  const bVol       = useDailyBaseline("volatility", volatility);

  /* -------------------- DAILY RIGHT (trendDaily + daily metrics) --------------- */
  const td = daily?.trendDaily || {};

  const tdSlope   = num(td?.trend?.emaSlope);                 // composite slope around 0
  const tdTrend   = td?.trend?.state || null;                 // "up" | "flat" | "down" (subtitle)
  const tdTrendVal= Number.isFinite(num(tdSlope)) ? (tdSlope > 5 ? 75 : tdSlope < -5 ? 25 : 50) : NaN;

  const tdPartPct = num(td?.participation?.pctAboveMA);
  const tdVolPct  = num(td?.volatilityRegime?.atrPct);
  const tdVolBand = td?.volatilityRegime?.band || null;       // "calm"|"elevated"|"high"

  const tdLiqPsi  = num(td?.liquidityRegime?.psi);
  const tdLiqBand = td?.liquidityRegime?.band || null;        // "good"|"normal"|"light"|"thin"

  const tdRiskOn  = num(td?.rotation?.riskOnPct);             // optional when wired
  const tdSdyDaily= Number.isFinite(num(daily?.metrics?.squeeze_daily_pct))
                    ? num(daily.metrics.squeeze_daily_pct)
                    : (Number.isFinite(num(data?.gauges?.squeezeDaily?.pct)) ? num(data.gauges.squeezeDaily.pct) : NaN);

  const tdUpdatedAt = daily?.updated_at || null;

  return (
    <section id="row-2" className="panel" style={{ padding: 10 }} key={ts || "live"}>
      {/* Legend modal */}
      {legendOpen && (
        <div
          role="dialog" aria-modal="true" onClick={() => setLegendOpen(null)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(880px,92vw)", background: "#0b0b0c", border: "1px solid #2b2b2b",
              borderRadius: 12, padding: 16, boxShadow: "0 10px 30px rgba(0,0,0,0.35)"
            }}
          >
            {legendOpen === "intraday" && <MarketMeterIntradayLegend />}
            {legendOpen === "daily"    && <MarketMeterDailyLegend />}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
              <button
                onClick={() => setLegendOpen(null)}
                style={{ background: "#eab308", color: "#111827", border: "none",
                  borderRadius: 8, padding: "8px 12px", fontWeight: 700, cursor: "pointer" }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="panel-head" style={{ alignItems: "center" }}>
        <div className="panel-title">Market Meter — Stoplights</div>

        {/* Legend buttons */}
        <button
          onClick={() => setLegendOpen("intraday")}
          style={{ marginLeft: 8, background: "#0b0b0b", color: "#e5e7eb",
            border: "1px solid #2b2b2b", borderRadius: 8, padding: "6px 10px", fontWeight: 600 }}
        >
          Intraday Legend
        </button>
        <button
          onClick={() => setLegendOpen("daily")}
          style={{ marginLeft: 6, background: "#0b0b0b", color: "#e5e7eb",
            border: "1px solid #2b2b2b", borderRadius: 8, padding: "6px 10px", fontWeight: 600 }}
        >
          Daily Legend
        </button>

        <div className="spacer" />
        <LastUpdated ts={ts} />

        {/* Replay controls (unchanged) */}
        <ReplayControls
          on={on} setOn={setOn}
          granularity={granularity} setGranularity={setGranularity}
          ts={tsSel} setTs={setTsSel}
          options={indexOptions} loading={loadingIdx}
        />
      </div>

      {/* Two labeled halves */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 18, marginTop: 8, flexWrap: "wrap" }}>
        {/* LEFT: Intraday Scalp Lights */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div className="small" style={{ color: "#9ca3af", fontWeight: 800 }}>Intraday Scalp Lights</div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            {/* Overall (10m) first */}
            <Stoplight
              label="Overall (10m)"
              value={overall10mVal}
              baseline={bOverall}
              toneOverride={toneForOverallState(overallState, overall10mVal)}
            />
            <Stoplight
              label="Breadth"
              value={breadth}
              baseline={bBreadth}
              toneOverride={toneForBreadth(breadth)}
              extraBelow={<DeltaTag label="Δ5m" value={deltaMkt.dB} stale={stale} />}
            />
            <Stoplight
              label="Momentum"
              value={momentum}
              baseline={bMomentum}
              toneOverride={toneForMomentum(momentum)}
              extraBelow={<DeltaTag label="Δ5m" value={deltaMkt.dM} stale={stale} />}
            />
            <Stoplight label="Intraday Squeeze"   value={squeezeIntra} baseline={bSqueezeIn} toneOverride={toneForSqueeze(squeezeIntra)} />
            {/* Liquidity = PSI (no clamp to 100) */}
            <Stoplight label="Liquidity"          value={liquidity}    baseline={bLiquidity} unit="PSI" clamp={false} toneOverride={toneForLiquidity(liquidity)} />
            <Stoplight label="Volatility"         value={volatility}   baseline={bVol}       toneOverride={toneForVol(volatility)} />
            <Stoplight
              label="Sector Direction (10m)"
              value={sectorDirPct} baseline={sectorDirPct}
              subtitle={Number.isFinite(sectorDirCount) ? `${sectorDirCount}/11 rising` : undefined}
              toneOverride={toneForPercent(sectorDirPct)}
            />
            <Stoplight label="Risk On (10m)"      value={riskOn10m}    baseline={riskOn10m} toneOverride={toneForPercent(riskOn10m)} />
          </div>
          {/* Staleness indicator */}
          {SANDBOX_URL && (
            <div className="text-xs" style={{ color: "#9ca3af", marginTop: 4 }}>
              Δ5m updated {deltasUpdatedAt ? fmtIso(deltasUpdatedAt) : "—"} {stale ? "• STALE" : ""}
            </div>
          )}
        </div>

        {/* RIGHT: Overall Market Trend Daily */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div className="small" style={{ color: "#9ca3af", fontWeight: 800 }}>Overall Market Trend Daily</div>
          <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "flex-end" }}>
            <Stoplight label="Daily Trend"        value={tdTrendVal} baseline={tdTrendVal} subtitle={tdTrend || undefined} toneOverride={toneForDailyTrend(tdSlope)} />
            <Stoplight label="Participation"      value={tdPartPct}  baseline={tdPartPct}  toneOverride={toneForPercent(tdPartPct)} />
            <Stoplight label="Daily Squeeze"      value={tdSdyDaily} baseline={tdSdyDaily} toneOverride={toneForLuxDaily(tdSdyDaily)} />
            <Stoplight label="Volatility Regime"  value={tdVolPct}   baseline={tdVolPct}   toneOverride={toneForVolBand(tdVolBand)} />
            {/* Liquidity regime prints PSI number but colors by band */}
            <Stoplight label="Liquidity Regime"   value={tdLiqPsi}   baseline={tdLiqPsi}   unit="PSI" clamp={false} toneOverride={toneForLiqBand(tdLiqBand)} />
            <Stoplight label="Risk On (Daily)"    value={tdRiskOn}   baseline={tdRiskOn}   toneOverride={toneForPercent(tdRiskOn)} />
          </div>
          {tdUpdatedAt && (
            <div className="text-xs" style={{ color: "#9ca3af", textAlign: "right" }}>
              Daily updated {fmtIso(tdUpdatedAt)}
            </div>
          )}
        </div>
      </div>

      <div className="text-xs text-neutral-500" style={{ marginTop: 4 }}>
        {on ? (ts ? `Snapshot: ${fmtIso(ts)}` : "Replay ready") : (ts ? `Updated ${fmtIso(ts)}` : "")}
      </div>
    </section>
  );
}
