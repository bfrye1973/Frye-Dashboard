// src/pages/rows/RowMarketOverview.jsx
// Market Meter — 10m / 1h / 4h / EOD stoplights with Lux PSI (tightness) aligned + 5m Pulse
// ✅ Adds MASTER Overall Score (1h+4h+EOD) to the RIGHT of EOD lights with a header.
// ✅ Adds Engine 6 Trade Permission (ALLOW/REDUCE/STAND_DOWN) using Engine 5 + Market Meter (authoritative rules)

import React from "react";
import { useDashboardPoll } from "../../lib/dashboardApiSafe";
import { LastUpdated } from "../../components/LastUpdated";
import PulseIcon10m from "../../components/meter/PulseIcon10m";
import {
  MarketMeterIntradayLegend,
  MarketMeterDailyLegend,
} from "../../components/MarketMeterLegend";

// ----------------- API endpoints -----------------
const INTRADAY_URL = process.env.REACT_APP_INTRADAY_URL; // /live/intraday
const HOURLY_URL = process.env.REACT_APP_HOURLY_URL; // /live/hourly
const H4_URL = process.env.REACT_APP_4H_URL; // /live/4h
const EOD_URL = process.env.REACT_APP_EOD_URL; // /live/eod

const SANDBOX_URL =
  process.env.REACT_APP_PULSE_URL ||
  process.env.REACT_APP_PILLS_URL ||
  process.env.REACT_APP_INTRADAY_SANDBOX_URL ||
  "";

// ✅ Core API base for Engine 6 + Engine 5 confluence
const CORE_API_BASE =
  process.env.REACT_APP_CORE_API_BASE ||
  process.env.REACT_APP_API_BASE ||
  ""; // can be "" (same-origin) if proxied

// ----------------- Utilities -----------------
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
};

const fmtIso = (ts) => {
  if (!ts) return "—";
  try {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return String(ts);
    return d.toLocaleString();
  } catch {
    return String(ts);
  }
};

const tsOf = (x) => (x && (x.updated_at || x.updated_at_utc || x.ts)) || null;

const weightedBlend = (items) => {
  // items: [{ v: number, w: number }]
  const valid = items.filter(
    (x) => Number.isFinite(x?.v) && Number.isFinite(x?.w) && x.w > 0
  );
  if (!valid.length) return NaN;
  const wSum = valid.reduce((a, x) => a + x.w, 0);
  if (wSum <= 0) return NaN;
  return valid.reduce((a, x) => a + x.v * (x.w / wSum), 0);
};

// ----------------- Tone helpers -----------------
const toneForPct = (v) =>
  !Number.isFinite(v) ? "info" : v >= 60 ? "OK" : v >= 45 ? "warn" : "danger";

const toneForBreadth = toneForPct;
const toneForMomentum = toneForPct;

const toneForLiquidity = (v) =>
  !Number.isFinite(v) ? "info" : v >= 60 ? "OK" : v >= 40 ? "warn" : "danger";

const toneForVol = (v) =>
  !Number.isFinite(v) ? "info" : v > 60 ? "danger" : v > 30 ? "warn" : "OK";

/**
 * Lux PSI tone (tightness, 0..100):
 *   psi >= 85 → danger (hard coil)
 *   15 <= psi < 85 → warn
 *   psi < 15 → OK (open)
 */
const toneForSqueezePsi = (psi) => {
  if (!Number.isFinite(psi)) return "info";
  if (psi >= 85) return "danger";
  if (psi >= 15) return "warn";
  return "OK";
};

const toneForOverallState = (state, score) => {
  const s = (state || "").toLowerCase();
  if (s === "bull") return "OK";
  if (s === "bear") return "danger";
  if (s === "neutral") return "warn";
  return toneForPct(score);
};

// MASTER color ranges (simple)
// Green: 70–100 (Go long & stay long)
// Yellow: 45–69 (Hold / manage / wait)
// Red: <45 (Start looking for shorts)
const toneForMaster = (v) =>
  !Number.isFinite(v) ? "info" : v >= 70 ? "OK" : v >= 45 ? "warn" : "danger";

// ✅ Engine 6 tones
const toneForEngine6 = (perm) => {
  const p = String(perm || "").toUpperCase();
  if (p === "ALLOW") return "OK";
  if (p === "REDUCE") return "warn";
  if (p === "STAND_DOWN") return "danger";
  return "info";
};

// ----------------- Stoplight -----------------
function Stoplight({
  label,
  value,
  unit = "%",
  tone = "info",
  size = 50,
  minWidth = 90,
}) {
  const v = Number.isFinite(value) ? value : NaN;
  const colors =
    {
      OK: { bg: "#22c55e", glow: "rgba(34,197,94,.45)" },
      warn: { bg: "#fbbf24", glow: "rgba(251,191,36,.45)" },
      danger: { bg: "#ef4444", glow: "rgba(239,68,68,.45)" },
      info: { bg: "#334155", glow: "rgba(51,65,85,.35)" },
    }[tone] || { bg: "#334155", glow: "rgba(51,65,85,.35)" };

  const valText = Number.isFinite(v) ? `${v.toFixed(1)}${unit}` : "—";

  return (
    <div style={{ textAlign: "center", minWidth }}>
      <div
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
          margin: "0 auto",
        }}
      >
        <div style={{ fontWeight: 800, color: "#0b1220" }}>{valText}</div>
      </div>
      <div
        style={{
          fontSize: 12.5,
          fontWeight: 700,
          color: "#e5e7eb",
          marginTop: 4,
        }}
      >
        {label}
      </div>
    </div>
  );
}

// ----------------- 5m DELTAS hook (/live/pills) -----------------
function useSandboxDeltas() {
  const [state, setState] = React.useState({
    dB: null,
    dM: null,
    riskOn: null,
    ts: null,
  });

  React.useEffect(() => {
    if (!SANDBOX_URL) return;

    let stop = false;

    async function pull() {
      try {
        const sep = SANDBOX_URL.includes("?") ? "&" : "?";
        const res = await fetch(`${SANDBOX_URL}${sep}t=${Date.now()}`, {
          cache: "no-store",
        });
        const j = await res.json();

        const sectors = j?.sectors || {};
        const values = Object.values(sectors);

        let avgD5m = null;
        let avgD10m = null;

        if (values.length > 0) {
          let sum5 = 0;
          let sum10 = 0;
          let count = 0;
          for (const s of values) {
            const d5 = Number(s?.d5m);
            const d10 = Number(s?.d10m);
            if (Number.isFinite(d5) || Number.isFinite(d10)) {
              sum5 += Number.isFinite(d5) ? d5 : 0;
              sum10 += Number.isFinite(d10) ? d10 : 0;
              count += 1;
            }
          }
          if (count > 0) {
            avgD5m = sum5 / count;
            avgD10m = sum10 / count;
          }
        }

        if (stop) return;

        setState({
          dB: avgD5m,
          dM: avgD10m,
          riskOn: null,
          ts:
            j?.stamp5 ||
            j?.deltasUpdatedAt ||
            j?.sectorsUpdatedAt ||
            j?.updated_at ||
            null,
        });
      } catch (err) {
        console.error("[RowMarketOverview] useSandboxDeltas error:", err);
        if (!stop) setState({ dB: null, dM: null, riskOn: null, ts: null });
      }
    }

    pull();
    const id = setInterval(pull, 30_000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, []);

  return state;
}

// ✅ Engine 6 fetch hook (uses Engine 5 confluence + your Market Meter values)
function useEngine6Permission({ symbol = "SPY", tf = "1h", market } = {}) {
  const [state, setState] = React.useState({
    ok: false,
    loading: true,
    err: null,
    data: null,
    ts: null,
  });

  React.useEffect(() => {
    let stop = false;

    async function pull() {
      try {
        // 1) Pull Engine 5 confluence score (assumed route exists from backend: confluenceScoreRouter)
        // If your confluence endpoint differs, we still won’t break the UI — we fail gracefully.
        const confluenceUrl = `${CORE_API_BASE}/api/v1/confluence-score?symbol=${encodeURIComponent(
          symbol
        )}&tf=${encodeURIComponent(tf)}&t=${Date.now()}`;

        let engine5 = { invalid: false, total: 0, reasonCodes: [] };
        try {
          const r1 = await fetch(confluenceUrl, { cache: "no-store" });
          const j1 = await r1.json();
          // accept multiple shapes
          engine5 = {
            invalid: !!(j1?.invalid ?? j1?.signals?.invalidated ?? j1?.engine5?.invalid),
            total: Number(
              j1?.total ??
                j1?.scores?.total ??
                j1?.engine5?.total ??
                j1?.score ??
                0
            ),
            reasonCodes: j1?.reasonCodes || j1?.reasons || [],
          };
        } catch {
          // keep default engine5 if endpoint is not available yet
        }

        // 2) Build Market Meter state from your already computed values
        // Contracting heuristic:
        // - If squeeze psi >= 85 => contracting (coil)
        // - else expanding/neutral
        const mm = market || {};
        const eodRisk = mm?.eodRisk ?? "MIXED";
        const payload = {
          symbol,
          tf,
          asOf: new Date().toISOString(),
          engine5,
          marketMeter: {
            eod: {
              risk: eodRisk,
              psi: mm?.eodPsi,
              state: mm?.eodState,
              bias: mm?.eodBias,
            },
            h4: { state: mm?.h4State, bias: mm?.h4Bias },
            h1: { state: mm?.h1State, bias: mm?.h1Bias },
            m10: { state: mm?.m10State, bias: mm?.m10Bias },
          },
          // 3) Zone context:
          // If upstream zone metadata exists in engine5 payload later, we’ll pass it in.
          // For now, we keep it tradable-safe:
          // - negotiated zones are primary execution zones
          // - withinZone is treated as true ONLY for permission display (execution still must confirm)
          zoneContext: {
            zoneType: "NEGOTIATED",
            zoneId: "",
            withinZone: true,
            flags: { degraded: false, liquidityFail: false, reactionFailed: false },
            meta: {},
          },
          intent: { action: "NEW_ENTRY" },
        };

        // 4) Call Engine 6
        const engine6Url = `${CORE_API_BASE}/api/v1/trade-permission?t=${Date.now()}`;
        const r2 = await fetch(engine6Url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const j2 = await r2.json();

        if (stop) return;

        setState({
          ok: !!j2?.ok,
          loading: false,
          err: j2?.ok ? null : j2?.error || "engine6_failed",
          data: j2,
          ts: new Date().toISOString(),
        });
      } catch (err) {
        if (stop) return;
        setState({
          ok: false,
          loading: false,
          err: err?.message || "engine6_failed",
          data: null,
          ts: new Date().toISOString(),
        });
      }
    }

    pull();
    const id = setInterval(pull, 15_000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [symbol, tf, market?.eodPsi, market?.eodRisk, market?.eodState, market?.h1State, market?.h4State]);

  return state;
}

/* ===================== Main Component ===================== */
export default function RowMarketOverview() {
  const { data: polled } = useDashboardPoll("dynamic");

  const [legendOpen, setLegendOpen] = React.useState(null);
  const [live10, setLive10] = React.useState(null);
  const [live1h, setLive1h] = React.useState(null);
  const [live4h, setLive4h] = React.useState(null);
  const [liveEOD, setLiveEOD] = React.useState(null);

  // Pull direct /live feeds
  React.useEffect(() => {
    let stop = false;

    async function pull() {
      try {
        if (INTRADAY_URL) {
          const r = await fetch(`${INTRADAY_URL}?t=${Date.now()}`, {
            cache: "no-store",
          });
          const j = await r.json();
          if (!stop) setLive10(j);
        }
        if (HOURLY_URL) {
          const r = await fetch(`${HOURLY_URL}?t=${Date.now()}`, {
            cache: "no-store",
          });
          const j = await r.json();
          if (!stop) setLive1h(j);
        }
        if (H4_URL) {
          const r = await fetch(`${H4_URL}?t=${Date.now()}`, {
            cache: "no-store",
          });
          const j = await r.json();
          if (!stop) setLive4h(j);
        }
        if (EOD_URL) {
          const r = await fetch(`${EOD_URL}?t=${Date.now()}`, {
            cache: "no-store",
          });
          const j = await r.json();
          if (!stop) setLiveEOD(j);
        }
      } catch {
        // ignore
      }
    }

    pull();
    const id = setInterval(pull, 15000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, []);

  const { dB: deltaB, dM: deltaM, ts: deltaTs } = useSandboxDeltas();

  // 10m
  const d10 = live10 || polled || {};
  const m10 = d10.metrics || {};
  const i10 = d10.intraday || {};
  const eng10 = (d10.engineLights && d10.engineLights["10m"]) || {};
  const ts10 =
    (d10.meta && d10.meta.last_full_run_utc) ||
    d10.updated_at ||
    d10.updated_at_utc ||
    null;

  const breadth10 = num(m10.breadth_10m_pct ?? m10.breadth_pct);
  const mom10 =
    num(m10.momentum_10m_pct) ||
    num(m10.momentum_combo_10m_pct) ||
    num(m10.momentum_pct);
  const psi10 = num(m10.squeeze_psi_10m_pct ?? m10.squeeze_psi ?? m10.psi);
  const sq10 = psi10;
  const liq10 = num(m10.liquidity_psi ?? m10.liquidity_10m ?? m10.liquidity_pct);
  const vol10 = num(m10.volatility_10m_pct ?? m10.volatility_pct);
  const rising10 = num(i10?.sectorDirection10m?.risingPct);
  let risk10 = num(m10.riskOn_10m_pct);
  if (!Number.isFinite(risk10)) risk10 = num(i10?.riskOn10m?.riskOnPct);
  let overall10 = num(i10?.overall10m?.score);
  if (!Number.isFinite(overall10)) overall10 = num(eng10.score);
  const state10 = i10?.overall10m?.state || eng10.state || "neutral";

  // 1h
  const d1h = live1h || {};
  const m1h = d1h.metrics || {};
  const h1 = d1h.hourly || {};
  const ts1h = d1h.updated_at || d1h.updated_at_utc || null;

  const breadth1 = num(m1h.breadth_1h_pct);
  const mom1 =
    num(m1h.momentum_1h_pct) ||
    num(m1h.momentum_combo_1h_pct) ||
    num(m1h.momentum_pct);
  const psi1 = num(m1h.squeeze_psi_1h_pct ?? m1h.squeeze_psi_1h ?? m1h.squeeze_psi);
  const sq1 = psi1;
  const liq1 = num(m1h.liquidity_1h);
  const vol1 = num(m1h.volatility_1h_scaled ?? m1h.volatility_1h_pct);
  const rising1 = num(h1?.sectorDirection1h?.risingPct);
  const risk1 = num(h1?.riskOn1h?.riskOnPct);
  const overall1 = num(h1?.overall1h?.score);
  const state1 = h1?.overall1h?.state || "neutral";

  // 4h
  const d4h = live4h || {};
  const m4h = d4h.metrics || {};
  const h4 = d4h.fourHour || {};
  const ts4h = d4h.updated_at || d4h.updated_at_utc || null;

  const breadth4 = num(m4h.breadth_4h_pct);
  const mom4 =
    num(m4h.momentum_4h_pct) ||
    num(m4h.momentum_combo_4h_pct) ||
    num(m4h.momentum_pct);
  const psi4 = num(
    m4h.squeeze_psi_4h_pct ??
      m4h.squeeze_psi_4h ??
      m4h.squeeze_psi ??
      m4h.squeeze_psi_4h
  );
  const sq4 = psi4;
  const liq4 = num(m4h.liquidity_4h);
  const vol4 = num(m4h.volatility_4h_scaled ?? m4h.volatility_4h_pct);
  const rising4 = num(h4?.sectorDirection4h?.risingPct ?? m4h.sector_dir_4h_pct);
  const risk4 = num(h4?.riskOn4h?.riskOnPct ?? m4h.riskOn_4h_pct);
  const overall4 = num(h4?.overall4h?.score ?? m4h.trend_strength_4h_pct);
  const state4 = h4?.overall4h?.state || "neutral";

  // EOD extraction
  const dd = liveEOD || {};
  const tsEod = dd.updated_at || dd.updated_at_utc || null;
  const dMetrics = dd.metrics || {};
  const daily = dd.daily || {};
  const overallEOD = daily?.overallEOD || {};
  const compsEOD = overallEOD?.components || {};

  const eodScore = num(overallEOD?.score) || num(dMetrics?.overall_eod_score) || NaN;
  const eodParticipation =
    num(compsEOD?.participation) || num(dMetrics?.participation_daily_pct) || NaN;
  const eodSqueezePsi = num(dMetrics?.daily_squeeze_pct ?? daily?.squeezePsi) || NaN;
  const eodVol = num(dMetrics?.volatility_pct ?? daily?.volatilityPct) || NaN;
  const eodLiq = num(dMetrics?.liquidity_pct ?? daily?.liquidityPct) || NaN;
  const eodRiskOn =
    num(dMetrics?.risk_on_daily_pct ?? daily?.riskOnPct ?? dd?.rotation?.riskOnPct) ||
    NaN;
  const eodState = overallEOD?.state || dMetrics?.overall_eod_state || daily?.state || "neutral";

  // MASTER = 1h + 4h + EOD (10m excluded)
  const masterScore = weightedBlend([
    { v: overall1, w: 0.20 },
    { v: overall4, w: 0.35 },
    { v: eodScore, w: 0.45 },
  ]);

  // ✅ MarketMeter mapping into Engine 6 input (authoritative gating)
  // Risk:
  // - if EOD riskOn < 45 => RISK_OFF
  // - else if 45..60 => MIXED
  // - else => RISK_ON
  const inferredEodRisk =
    !Number.isFinite(eodRiskOn)
      ? "MIXED"
      : eodRiskOn < 45
      ? "RISK_OFF"
      : eodRiskOn < 60
      ? "MIXED"
      : "RISK_ON";

  // Contracting state heuristic via PSI:
  // - psi >= 85 => CONTRACTING (coil)
  // - else => EXPANDING/NEUTRAL
  const tfStateFromPsi = (psi) =>
    Number.isFinite(psi) && psi >= 85 ? "CONTRACTING" : "EXPANDING";

  const engine6Market = {
    eodRisk: inferredEodRisk,
    eodPsi: eodSqueezePsi,
    eodState: tfStateFromPsi(eodSqueezePsi),
    eodBias: String(eodState || "neutral").toUpperCase() === "BULL" ? "BULL" : String(eodState || "neutral").toUpperCase() === "BEAR" ? "BEAR" : "NEUTRAL",
    h4State: tfStateFromPsi(psi4),
    h4Bias: String(state4 || "neutral").toUpperCase() === "BULL" ? "BULL" : String(state4 || "neutral").toUpperCase() === "BEAR" ? "BEAR" : "NEUTRAL",
    h1State: tfStateFromPsi(psi1),
    h1Bias: String(state1 || "neutral").toUpperCase() === "BULL" ? "BULL" : String(state1 || "neutral").toUpperCase() === "BEAR" ? "BEAR" : "NEUTRAL",
    m10State: tfStateFromPsi(psi10),
    m10Bias: String(state10 || "neutral").toUpperCase() === "BULL" ? "BULL" : String(state10 || "neutral").toUpperCase() === "BEAR" ? "BEAR" : "NEUTRAL",
  };

  const engine6 = useEngine6Permission({ symbol: "SPY", tf: "1h", market: engine6Market });

  const stripBox = { display: "flex", flexDirection: "column", gap: 6, minWidth: 820 };
  const lineBox = {
    display: "flex",
    gap: 12,
    alignItems: "center",
    whiteSpace: "nowrap",
    overflowX: "auto",
    paddingBottom: 2,
  };

  // ✅ Engine 6 UI mini panel (simple, no new components)
  const e6 = engine6?.data || null;
  const e6Perm = e6?.permission || "—";
  const e6Tone = toneForEngine6(e6Perm);
  const e6Size = e6?.sizeMultiplier;
  const e6Types = Array.isArray(e6?.allowedTradeTypes) ? e6.allowedTradeTypes.join(", ") : "";
  const e6Reasons = Array.isArray(e6?.reasonCodes) ? e6.reasonCodes.join(" • ") : "";

  const permColors =
    {
      OK: { bg: "#22c55e", glow: "rgba(34,197,94,.45)" },
      warn: { bg: "#fbbf24", glow: "rgba(251,191,36,.45)" },
      danger: { bg: "#ef4444", glow: "rgba(239,68,68,.45)" },
      info: { bg: "#334155", glow: "rgba(51,65,85,.35)" },
    }[e6Tone] || { bg: "#334155", glow: "rgba(51,65,85,.35)" };

  return (
    <section id="row-2" className="panel" style={{ padding: 10 }}>
      <div className="panel-head" style={{ alignItems: "center" }}>
        <div className="panel-title">Market Meter — Stoplights</div>

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
        <LastUpdated ts={tsOf(d10 || d1h || d4h || dd || polled)} />
      </div>

      <div
        style={{
          display: "flex",
          gap: 28,
          alignItems: "flex-start",
          flexWrap: "wrap",
          marginTop: 8,
        }}
      >
        {/* 10m */}
        <div style={stripBox}>
          <div className="small" style={{ color: "#e5e7eb", fontWeight: 800 }}>
            10m — Intraday Scalp
          </div>

          <div style={lineBox}>
            <Stoplight label="Overall" value={overall10} tone={toneForOverallState(state10, overall10)} />
            <Stoplight label="Breadth" value={breadth10} tone={toneForBreadth(breadth10)} />
            <Stoplight label="Momentum" value={mom10} tone={toneForMomentum(mom10)} />
            <Stoplight label="Squeeze" value={sq10} tone={toneForSqueezePsi(psi10)} />
            <Stoplight label="Liquidity" value={liq10} unit
