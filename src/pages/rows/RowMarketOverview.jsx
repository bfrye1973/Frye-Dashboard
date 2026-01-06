// src/pages/rows/RowMarketOverview.jsx
// Market Meter — 10m / 1h / 4h / EOD stoplights with Lux PSI (tightness) aligned + 5m Pulse
// ✅ EOD FIX: Use daily.overallEOD + metrics fallbacks so Overall/Participation never disappear.

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

// ----------------- Stoplight -----------------
function Stoplight({ label, value, unit = "%", tone = "info", size = 50, minWidth = 90 }) {
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
      <div style={{ fontSize: 12.5, fontWeight: 700, color: "#e5e7eb", marginTop: 4 }}>
        {label}
      </div>
    </div>
  );
}

// ----------------- 5m DELTAS hook (/live/pills) -----------------
function useSandboxDeltas() {
  const [state, setState] = React.useState({ dB: null, dM: null, riskOn: null, ts: null });

  React.useEffect(() => {
    if (!SANDBOX_URL) return;

    let stop = false;

    async function pull() {
      try {
        const sep = SANDBOX_URL.includes("?") ? "&" : "?";
        const res = await fetch(`${SANDBOX_URL}${sep}t=${Date.now()}`, { cache: "no-store" });
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
          ts: j?.stamp5 || j?.deltasUpdatedAt || j?.sectorsUpdatedAt || j?.updated_at || null,
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
          const r = await fetch(`${INTRADAY_URL}?t=${Date.now()}`, { cache: "no-store" });
          const j = await r.json();
          if (!stop) setLive10(j);
        }
        if (HOURLY_URL) {
          const r = await fetch(`${HOURLY_URL}?t=${Date.now()}`, { cache: "no-store" });
          const j = await r.json();
          if (!stop) setLive1h(j);
        }
        if (H4_URL) {
          const r = await fetch(`${H4_URL}?t=${Date.now()}`, { cache: "no-store" });
          const j = await r.json();
          if (!stop) setLive4h(j);
        }
        if (EOD_URL) {
          const r = await fetch(`${EOD_URL}?t=${Date.now()}`, { cache: "no-store" });
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

  const { ts: deltaTs } = useSandboxDeltas();

  // 10m
  const d10 = live10 || polled || {};
  const m10 = d10.metrics || {};
  const i10 = d10.intraday || {};
  const eng10 = (d10.engineLights && d10.engineLights["10m"]) || {};
  const ts10 = (d10.meta && d10.meta.last_full_run_utc) || d10.updated_at || d10.updated_at_utc || null;

  const breadth10 = num(m10.breadth_10m_pct ?? m10.breadth_pct);
  const mom10 = num(m10.momentum_10m_pct) || num(m10.momentum_combo_10m_pct) || num(m10.momentum_pct);
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
  const mom1 = num(m1h.momentum_1h_pct) || num(m1h.momentum_combo_1h_pct) || num(m1h.momentum_pct);
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
  const mom4 = num(m4h.momentum_4h_pct) || num(m4h.momentum_combo_4h_pct) || num(m4h.momentum_pct);
  const psi4 = num(m4h.squeeze_psi_4h_pct ?? m4h.squeeze_psi_4h ?? m4h.squeeze_psi ?? m4h.squeeze_psi_4h);
  const sq4 = psi4;
  const liq4 = num(m4h.liquidity_4h);
  const vol4 = num(m4h.volatility_4h_scaled ?? m4h.volatility_4h_pct);
  const rising4 = num(h4?.sectorDirection4h?.risingPct ?? m4h.sector_dir_4h_pct);
  const risk4 = num(h4?.riskOn4h?.riskOnPct ?? m4h.riskOn_4h_pct);
  const overall4 = num(h4?.overall4h?.score ?? m4h.trend_strength_4h_pct);
  const state4 = h4?.overall4h?.state || "neutral";

  // ✅ EOD FIXED extraction (new contract + fallbacks)
  const dd = liveEOD || {};
  const tsEod = dd.updated_at || dd.updated_at_utc || null;
  const dMetrics = dd.metrics || {};
  const daily = dd.daily || {};
  const overallEOD = daily?.overallEOD || {};
  const compsEOD = overallEOD?.components || {};

  // Use overall score as "Daily Trend" gauge (always exists in new system)
  const eodScore =
    num(overallEOD?.score) ||
    num(dMetrics?.overall_eod_score) ||
    num(dMetrics?.overall_score) ||
    NaN;

  // Participation: pull from components or metrics
  const eodParticipation =
    num(compsEOD?.participation) ||
    num(dMetrics?.participation_pct) ||
    num(dMetrics?.participation_eod_pct) ||
    NaN;

  // Daily squeeze PSI (tightness)
  const eodSqueezePsi =
    num(dMetrics?.daily_squeeze_pct ?? dMetrics?.squeeze_daily_pct ?? dMetrics?.squeezePct) ||
    NaN;

  // Vol / Liq regimes (if trendDaily exists use it; else fallback to metrics)
  const td = dd.trendDaily || {};
  const tdVolReg = td?.volatilityRegime || {};
  const tdLiqReg = td?.liquidityRegime || {};

  const eodVol =
    num(tdVolReg?.atrPct) ||
    num(dMetrics?.volatility_pct) ||
    NaN;

  const eodVolBand = tdVolReg?.band || null;

  const eodLiq =
    num(tdLiqReg?.psi) ||
    num(dMetrics?.liquidity_pct) ||
    NaN;

  const eodLiqBand = tdLiqReg?.band || null;

  const eodRiskOn =
    num(daily?.riskOnPct) ||
    num(dMetrics?.risk_on_daily_pct) ||
    num(dd?.rotation?.riskOnPct) ||
    NaN;

  const eodState =
    (overallEOD?.state || dMetrics?.overall_eod_state || daily?.state || "neutral");

  // Layout
  const stripBox = { display: "flex", flexDirection: "column", gap: 6, minWidth: 820 };
  const lineBox = { display: "flex", gap: 12, alignItems: "center", whiteSpace: "nowrap", overflowX: "auto", paddingBottom: 2 };

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

      <div style={{ display: "flex", gap: 28, alignItems: "flex-start", flexWrap: "wrap", marginTop: 8 }}>
        {/* 10m */}
        <div style={stripBox}>
          <div className="small" style={{ color: "#e5e7eb", fontWeight: 800 }}>10m — Intraday Scalp</div>
          <div style={lineBox}>
            <Stoplight label="Overall" value={overall10} tone={toneForOverallState(state10, overall10)} />
            <Stoplight label="Breadth" value={breadth10} tone={toneForBreadth(breadth10)} />
            <Stoplight label="Momentum" value={mom10} tone={toneForMomentum(mom10)} />
            <Stoplight label="Squeeze" value={sq10} tone={toneForSqueezePsi(psi10)} />
            <Stoplight label="Liquidity" value={liq10} unit="%" tone={toneForLiquidity(liq10)} />
            <Stoplight label="Volatility" value={vol10} tone={toneForVol(vol10)} />
            <Stoplight label="Sector Dir" value={rising10} tone={toneForPct(rising10)} />
            <Stoplight label="Risk-On" value={risk10} tone={toneForPct(risk10)} />
          </div>
          <div style={{ color: "#9ca3af", fontSize: 12, marginTop: 4 }}>
            Last 10-min: <strong>{fmtIso(ts10)}</strong> &nbsp;|&nbsp; Δ5m updated: <strong>{fmtIso(deltaTs)}</strong>
          </div>
        </div>

        {/* 1h */}
        <div style={stripBox}>
          <div className="small" style={{ color: "#e5e7eb", fontWeight: 800 }}>1h — Hourly Valuation</div>
          <div style={lineBox}>
            <Stoplight label="Overall" value={overall1} tone={toneForOverallState(state1, overall1)} />
            <Stoplight label="Breadth" value={breadth1} tone={toneForBreadth(breadth1)} />
            <Stoplight label="Momentum" value={mom1} tone={toneForMomentum(mom1)} />
            <Stoplight label="Squeeze" value={sq1} tone={toneForSqueezePsi(psi1)} />
            <Stoplight label="Liquidity" value={liq1} unit="%" tone={toneForLiquidity(liq1)} />
            <Stoplight label="Volatility" value={vol1} tone={toneForVol(vol1)} />
            <Stoplight label="Sector Dir" value={rising1} tone={toneForPct(rising1)} />
            <Stoplight label="Risk-On" value={risk1} tone={toneForPct(risk1)} />
          </div>
          <div style={{ color: "#9ca3af", fontSize: 12, marginTop: 4 }}>
            Last 1-hour: <strong>{fmtIso(ts1h)}</strong>
          </div>
        </div>

        {/* 4h */}
        <div style={stripBox}>
          <div className="small" style={{ color: "#e5e7eb", fontWeight: 800 }}>4h — Bridge Valuation</div>
          <div style={lineBox}>
            <Stoplight label="Overall" value={overall4} tone={toneForOverallState(state4, overall4)} />
            <Stoplight label="Breadth" value={breadth4} tone={toneForBreadth(breadth4)} />
            <Stoplight label="Momentum" value={mom4} tone={toneForMomentum(mom4)} />
            <Stoplight label="Squeeze" value={sq4} tone={toneForSqueezePsi(psi4)} />
            <Stoplight label="Liquidity" value={liq4} unit="%" tone={toneForLiquidity(liq4)} />
            <Stoplight label="Volatility" value={vol4} tone={toneForVol(vol4)} />
            <Stoplight label="Sector Dir" value={rising4} tone={toneForPct(rising4)} />
            <Stoplight label="Risk-On" value={risk4} tone={toneForPct(risk4)} />
          </div>
          <div style={{ color: "#9ca3af", fontSize: 12, marginTop: 4 }}>
            Last 4-hour: <strong>{fmtIso(ts4h)}</strong>
          </div>
        </div>

        {/* EOD */}
        <div style={stripBox}>
          <div className="small" style={{ color: "#e5e7eb", fontWeight: 800 }}>EOD — Daily Structure</div>
          <div style={lineBox}>
            <Stoplight label="Overall" value={eodScore} tone={toneForOverallState(eodState, eodScore)} />
            <Stoplight label="Participation" value={eodParticipation} tone={toneForPct(eodParticipation)} />
            <Stoplight label="Daily Squeeze" value={eodSqueezePsi} tone={toneForSqueezePsi(eodSqueezePsi)} />
            <Stoplight label="Vol Regime" value={eodVol} tone={toneForVol(eodVol)} />
            <Stoplight label="Liq Regime" value={eodLiq} unit="%" tone={toneForLiquidity(eodLiq)} />
            <Stoplight label="Risk-On" value={eodRiskOn} tone={toneForPct(eodRiskOn)} />
          </div>
          <div style={{ color: "#9ca3af", fontSize: 12, marginTop: 4 }}>
            Daily updated: <strong>{fmtIso(tsEod)}</strong>
          </div>
        </div>
      </div>

      {legendOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setLegendOpen(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 60,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(880px,92vw)",
              background: "#0b0b0c",
              border: "1px solid #2b2b2b",
              borderRadius: 12,
              padding: 16,
            }}
          >
            {legendOpen === "intraday" ? <MarketMeterIntradayLegend /> : <MarketMeterDailyLegend />}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
              <button
                onClick={() => setLegendOpen(null)}
                style={{
                  background: "#eab308",
                  color: "#111827",
                  border: "none",
                  borderRadius: 8,
                  padding: "8px 12px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
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
