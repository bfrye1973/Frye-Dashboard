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
const HOURLY_URL   = process.env.REACT_APP_HOURLY_URL;   // /live/hourly  // <-- NEW
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
  // prefer blended momentum if present
  const momentum  = num(m.momentum_combo_pct ?? m.momentum_pct); // 0..100
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
/** squeeze is inverted (higher = tighter/worse) — used for 10m PSI */
function toneForSqueeze(v){ if (!Number.isFinite(v)) return "info"; if (v >= 85) return "danger"; if (v >= 65) return "warn"; if (v >= 35) return "warn"; return "ok"; }
/** 1h squeeze is Expansion% (higher = better) */
function toneForSqueeze1h(v){ if (!Number.isFinite(v)) return "info"; if (v >= 65) return "ok"; if (v >= 35) return "warn"; return "danger"; }
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

  // timeframe switch for the single row: "10m" | "1h" | "eod"
  const [tf, setTf] = React.useState("10m");

  // LIVE fetch (intraday + hourly + daily) — initial pull + 60s polling
  const [liveIntraday, setLiveIntraday] = React.useState(null);
  const [liveHourly,   setLiveHourly]   = React.useState(null);
  const [liveDaily,    setLiveDaily]    = React.useState(null);

  React.useEffect(() => {
    let stop = false;
    async function pull() {
      try {
        if (INTRADAY_URL) {
          const r = await fetch(`${INTRADAY_URL}?t=${Date.now()}`, { cache: "no-store" });
          const j = await r.json();
          if (!stop) setLiveIntraday(j);
        }
        if (HOURLY_URL) {
          const rH = await fetch(`${HOURLY_URL}?t=${Date.now()}`, { cache: "no-store" });
          const jH = await rH.json();
          if (!stop) setLiveHourly(jH);
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

  // choose latest
  const chosen = newer(liveIntraday, polled);
  const data  = chosen || {};
  const m10   = data?.metrics ?? {};
  const intr  = data?.intraday ?? {};

  const h     = liveHourly || {};
  const m1h   = h?.metrics ?? {};
  const hrblk = h?.hourly ?? {};

  const daily = liveDaily || {};

  // build the single-line metrics based on timeframe switch
  let title = "Intraday Scalp Lights (10m)";
  let breadth = num(m10.breadth_10m_pct ?? m10.breadth_pct);
  let momentum = num(m10.momentum_combo_pct ?? m10.momentum_pct);
  let squeeze = num(m10.squeeze_intraday_pct ?? m10.squeeze_pct);      // PSI or expansion per backend
  let liquidity = num(m10.liquidity_psi ?? m10.liquidity_pct);
  let volatility = num(m10.volatility_pct);
  let rising = num(intr?.sectorDirection10m?.risingPct);
  let riskon = num(intr?.riskOn10m?.riskOnPct);
  let overallScore = num(intr?.overall10m?.score);
  let overallState = intr?.overall10m?.state || null;
  let squeezeTone = toneForSqueeze;

  if (tf === "1h" && liveHourly) {
    title = "Hourly Valuation (1h)";
    breadth   = num(m1h.breadth_1h_pct);
    momentum  = num(m1h.momentum_combo_1h_pct ?? m1h.momentum_1h_pct);
    squeeze   = num(m1h.squeeze_1h_pct);               // Expansion% (higher = better)
    liquidity = num(m1h.liquidity_1h);
    volatility= num(m1h.volatility_1h_scaled ?? m1h.volatility_1h_pct);
    rising    = num(hrblk?.sectorDirection1h?.risingPct);
    riskon    = num(hrblk?.riskOn1h?.riskOnPct);
    overallScore = num(hrblk?.overall1h?.score);
    overallState = hrblk?.overall1h?.state || null;
    squeezeTone  = toneForSqueeze1h;                   // different tone for expansion
  }

  if (tf === "eod" && liveDaily) {
    title = "Daily Structure (EOD)";
    // If you decide to surface EOD lights in the single row, bind here to EOD fields.
    // For now we keep the right-side daily panel unchanged.
  }

  return (
    <section id="row-2" className="panel" style={{ padding: 10 }}>
      {/* Header */}
      <div className="panel-head" style={{ alignItems: "center" }}>
        <div className="panel-title">Market Meter — Stoplights</div>

        {/* timeframe switch: one row only */}
        <div style={{ marginLeft: 8, display: "flex", gap: 6 }}>
          {["10m","1h","eod"].map(k => (
            <button key={k}
              onClick={() => setTf(k)}
              className={`px-2 py-1 rounded-md text-sm ${tf===k ? "bg-yellow-500 text-black" : "bg-neutral-800 text-neutral-300"}`}>
              {k.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Legend buttons */}
        <div style={{ marginLeft: 8 }}>
          <button
            onClick={() => setLegendOpen("intraday")}
            className="px-2 py-1 rounded-md bg-neutral-900 text-neutral-200 border border-neutral-700 text-sm"
            style={{ marginRight: 6 }}
          >
            Intraday Legend
          </button>
          <button
            onClick={() => setLegendOpen("daily")}
            className="px-2 py-1 rounded-md bg-neutral-900 text-neutral-200 border border-neutral-700 text-sm"
          >
            Daily Legend
          </button>
        </div>

        <div className="spacer" />
        <LastUpdated ts={tsOf(tf==="1h" ? liveHourly : tf==="eod" ? liveDaily : liveIntraday)} />
      </div>

      {/* SINGLE ROW (lights) */}
      <div className="small" style={{ color: "#9ca3af", fontWeight: 800, marginTop: 6 }}>{title}</div>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <Stoplight label={`Overall (${tf})`} value={overallScore} toneOverride={toneForOverallState(overallState, overallScore)} />
        <Stoplight label="Breadth"          value={breadth}      toneOverride={toneForBreadth(breadth)} />
        <Stoplight label="Momentum"         value={momentum}     toneOverride={toneForMomentum(momentum)} />
        <Stoplight label="Squeeze"          value={squeeze}      toneOverride={squeezeTone(squeeze)} />
        <Stoplight label="Liquidity"        value={liquidity}    unit="PSI" clamp={false} toneOverride={toneForLiquidity(liquidity)} />
        <Stoplight label="Volatility"       value={volatility}   toneOverride={toneForVol(volatility)} />
        <Stoplight label={`Sector Dir (${tf})`} value={rising}   toneOverride={toneForPercent(rising)} />
        <Stoplight label={`Risk-On (${tf})`}   value={riskon}    toneOverride={toneForPercent(riskon)} />
      </div>

      {/* Legend modals (unchanged) */}
      {legendOpen && (
        <div
          role="dialog" aria-modal="true" onClick={() => setLegendOpen(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: "min(880px,92vw)", background: "#0b0b0c", border: "1px solid #2b2b2b", borderRadius: 12, padding: 16, boxShadow: "0 10px 30px rgba(0,0,0,0.35)" }}
          >
            {legendOpen === "intraday" && <MarketMeterIntradayLegend />}
            {legendOpen === "daily"    && <MarketMeterDailyLegend />}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
              <button
                onClick={() => setLegendOpen(null)}
                style={{ background: "#eab308", color: "#111827", border: "none", borderRadius: 8, padding: "8px 12px", fontWeight: 700, cursor: "pointer" }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
