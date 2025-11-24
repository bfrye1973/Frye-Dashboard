// src/pages/rows/RowMarketOverview.jsx
// Market Meter — 10m / 1h / EOD stoplights with Lux Squeeze aligned + 5m Pulse

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
const EOD_URL = process.env.REACT_APP_EOD_URL; // /live/eod

// 5-minute deltas (pills) — prefer PULSE_URL, fall back to legacy sandbox if present
const SANDBOX_URL =
  process.env.REACT_APP_PULSE_URL ||
  process.env.REACT_APP_PILLS_URL ||
  process.env.REACT_APP_INTRADAY_SANDBOX_URL ||
  "";

// ----------------- Utilities -----------------
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, Number(n)));

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

const newer = (a, b) => {
  const ta = tsOf(a);
  const tb = tsOf(b);
  if (!ta) return b;
  if (!tb) return a;
  return new Date(ta).getTime() >= new Date(tb).getTime() ? a : b;
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
 * Lux Squeeze tone (PSI tightness, 0..100):
 *   psi >= 85 → danger (hard coil)
 *   15 <= psi < 85 → warn (working squeeze)
 *   psi < 15 → OK (open)
 */
const toneForSqueezePsi = (psi) => {
  if (!Number.isFinite(psi)) return "info";
  if (psi >= 85) return "danger";
  if (psi >= 15) return "warn";
  return "OK";
};

const toneForSqueeze10Psi = toneForSqueezePsi;
const toneForSqueeze1hPsi = toneForSqueezePsi;

const toneForDailyTrend = (s) =>
  !Number.isFinite(s) ? "info" : s > 5 ? "OK" : s >= -5 ? "warn" : "danger";

/**
 * EOD Lux squeeze tone (PSI):
 *   ≥85 → danger
 *   80–84.9 → warn
 *   else → OK
 */
const toneForLuxDaily = (v) =>
  !Number.isFinite(v) ? "info" : v >= 85 ? "danger" : v >= 80 ? "warn" : "OK";

const toneForVolBand = (b) =>
  b === "high" ? "danger" : b === "elevated" ? "warn" : b ? "OK" : "info";

const toneForLiqBand = (b) =>
  b === "good" ? "OK" : b === "normal" ? "warn" : b ? "danger" : "info";

const toneForOverallState = (state, score) => {
  const s = (state || "").toLowerCase();
  if (s === "bull") return "OK";
  if (s === "bear") return "danger";
  if (s === "neutral") return "warn";
  return toneForPct(score);
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
    dB: null, // avg d5m
    dM: null, // avg d10m
    riskOn: null, // reserved
    ts: null, // stamp5
  });

  React.useEffect(() => {
    if (!SANDBOX_URL) return;

    let stop = false;

    async function pull() {
      try {
        const sep = SANDBOX_URL.includes("?") ? "&" : "?";
        const res = await fetch(`${SANDBOX_URL}?${sep}${Date.now()}`, {
          cache: "no-store",
        });
        const j = await res.json();

        // Expected /live/pills schema:
        // { stamp5, stamp10, sectors: { key: { d5m, d10m } } }
        const sectors = j?.sectors || {};
        const values = Object.values(sectors);

        let avgD5m = null;
        let avgD10m = null;
        if (values.length) {
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
          ts: j?.stamp5 || j?.deltasUpdatedAt || j?.updated_at || null,
        });
      } catch (err) {
        console.error("[RowMarketOverview] useSandboxDeltas error:", err);
        if (!stop) {
          setState({ dB: null, dM: null, riskOn: null, ts: null });
        }
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

  const [legendOpen, setLegendOpen] = React.useState(null); // "intraday" | "daily" | null
  const [live10, setLive10] = React.useState(null);
  const [live1h, setLive1h] = React.useState(null);
  const [liveEOD, setLiveEOD] = React.useState(null);

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
        if (EOD_URL) {
          const r = await fetch(`${EOD_URL}?t=${Date.now()}`, {
            cache: "no-store",
          });
          const j = await r.json();
          if (!stop) setLiveEOD(j);
        }
      } catch (err) {
        console.error("[RowMarketOverview] live fetch error:", err);
      }
    }

    pull();
    const id = setInterval(pull, 60_000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, []);

  // 5m deltas from /live/pills
  const { dB: deltaB, dM: deltaM, riskOn: deltaRisk, ts: deltaTs } =
    useSandboxDeltas();

  // choose freshest intraday snapshot between polled + live
  const d10 = newer(live10, polled) || {};
  const m10 = d10.metrics || {};
  const i10 = d10.intraday || {};
  const eng10 = (d10.engineLights && d10.engineLights["10m"]) || {};
  const ts10 = d10.updated_at || d10.updated_at_utc || null;

  const d1h = live1h || {};
  const m1h = d1h.metrics || {};
  const h1 = d1h.hourly || {};
  const ts1h = d1h.updated_at || d1h.updated_at_utc || null;

  const dd = liveEOD || {};
  const tsEod = dd.updated_at || dd.updated_at_utc || null;

  /* ---------- 10m strip ---------- */
  const breadth10 = num(m10.breadth_10m_pct ?? m10.breadth_pct);

  const mom10 =
    num(m10.momentum_10m_pct) ||
    num(m10.momentum_combo_10m_pct) ||
    num(m10.momentum_pct);

  // 10m squeeze: tile shows expansion (100 - PSI), tone uses PSI
  const psi10 = num(m10.squeeze_10m_pct ?? m10.squeeze_psi_10m_pct);
  let sq10 = num(m10.squeeze_pct ?? m10.squeeze_expansion_pct);
  if (Number.isFinite(psi10)) {
    sq10 = clamp(100 - psi10, 0, 100);
  }

  const liq10 = num(m10.liquidity_10m ?? m10.liquidity_psi ?? m10.liquidity_pct);
  const vol10 = num(m10.volatility_10m_pct ?? m10.volatility_pct);

  const rising10 = num(i10?.sectorDirection10m?.risingPct);
  let risk10 = num(m10.riskOn_10m_pct);
  if (!Number.isFinite(risk10)) {
    risk10 = num(i10?.riskOn10m?.riskOnPct);
  }

  let overall10 = num(i10?.overall10m?.score);
  if (!Number.isFinite(overall10)) {
    overall10 = num(eng10.score);
  }
  const state10 = i10?.overall10m?.state || eng10.state || "neutral";

  /* ---------- 1h strip ---------- */
  const breadth1 = num(m1h.breadth_1h_pct);

  const mom1 =
    num(m1h.momentum_1h_pct) ||
    num(m1h.momentum_combo_1h_pct) ||
    num(m1h.momentum_pct);

  const psi1 = num(m1h.squeeze_1h_pct ?? m1h.squeeze_psi_1h_pct);
  let sq1 = num(m1h.squeeze_1h_expansion_pct ?? m1h.squeeze_1h_pct);
  if (Number.isFinite(psi1)) {
    sq1 = clamp(100 - psi1, 0, 100);
  }

  const liq1 = num(m1h.liquidity_1h);
  const vol1 = num(m1h.volatility_1h_scaled ?? m1h.volatility_1h_pct);
  const rising1 = num(h1?.sectorDirection1h?.risingPct);
  const risk1 = num(h1?.riskOn1h?.riskOnPct);
  const overall1 = num(h1?.overall1h?.score);
  const state1 = h1?.overall1h?.state || "neutral";

  /* ---------- EOD strip ---------- */
  const td = dd.trendDaily || {};
  const tdSlope = num(td?.trend?.emaSlope);
  const tdTrendVal = Number.isFinite(tdSlope)
    ? tdSlope > 5
      ? 75
      : tdSlope < -5
      ? 25
      : 50
    : NaN;

  const tdPartPct = num(td?.participation?.pctAboveMA);
  const tdVolReg = dd?.volatilityRegime || td?.volatilityRegime || {};
  const tdVolPct = num(tdVolReg.atrPct);
  const tdVolBand = tdVolReg.band || null;

  const tdLiqReg = dd?.liquidityRegime || {};
  const tdLiqPsi = num(tdLiqReg.psi);
  const tdLiqBand = tdLiqReg.band || null;

  const tdRiskOn = num(dd?.rotation?.riskOnPct);

  // Daily squeeze tile shows PSI directly
  const dm = dd.metrics || {};
  const tdSqueezePsi = num(
    dm.daily_squeeze_pct ?? dm.squeezePct ?? dm.squeeze_daily_pct
  );

  /* ---------- Layout ---------- */
  const stripBox = {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    minWidth: 820,
  };

  const lineBox = {
    display: "flex",
    gap: 12,
    alignItems: "center",
    whiteSpace: "nowrap",
    overflowX: "auto",
    paddingBottom: 2,
  };

  return (
    <section id="row-2" className="panel" style={{ padding: 10 }}>
      {/* Header */}
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
        <LastUpdated ts={tsOf(d10 || d1h || dd || polled)} />
      </div>

      {/* Strips */}
      <div
        style={{
          display: "flex",
          gap: 28,
          alignItems: "flex-start",
          flexWrap: "wrap",
          marginTop: 8,
        }}
      >
        {/* 10m strip */}
        <div style={stripBox}>
          <div
            className="small"
            style={{ color: "#e5e7eb", fontWeight: 800 }}
          >
            10m — Intraday Scalp
          </div>
          <div style={lineBox}>
            <Stoplight
              label="Overall"
              value={overall10}
              tone={toneForOverallState(state10, overall10)}
            />
            <Stoplight
              label="Breadth"
              value={breadth10}
              tone={toneForBreadth(breadth10)}
            />
            <Stoplight
              label="Momentum"
              value={mom10}
              tone={toneForMomentum(mom10)}
            />
            <Stoplight
              label="Squeeze"
              value={sq10}
              tone={toneForSqueeze10Psi(psi10)}
            />
            <Stoplight
              label="Liquidity"
              value={liq10}
              unit="%"
              tone={toneForLiquidity(liq10)}
            />
            <Stoplight
              label="Volatility"
              value={vol10}
              tone={toneForVol(vol10)}
            />
            <Stoplight
              label="Sector Dir"
              value={rising10}
              tone={toneForPct(rising10)}
            />
            <Stoplight
              label="Risk-On"
              value={risk10}
              tone={toneForPct(risk10)}
            />
          </div>
          <div
            style={{
              color: "#9ca3af",
              fontSize: 12,
              marginTop: 4,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              Last 10-min: <strong>{fmtIso(ts10)}</strong> &nbsp;|&nbsp; Δ5m
              updated: <strong>{fmtIso(deltaTs)}</strong>
            </div>
            <PulseIcon10m />
          </div>
        </div>

        {/* 1h strip */}
        <div style={stripBox}>
          <div
            className="small"
            style={{ color: "#e5e7eb", fontWeight: 800 }}
          >
            1h — Hourly Valuation
          </div>
          <div style={lineBox}>
            <Stoplight
              label="Overall"
              value={overall1}
              tone={toneForOverallState(state1, overall1)}
            />
            <Stoplight
              label="Breadth"
              value={breadth1}
              tone={toneForBreadth(breadth1)}
            />
            <Stoplight
              label="Momentum"
              value={mom1}
              tone={toneForMomentum(mom1)}
            />
            <Stoplight
              label="Squeeze"
              value={sq1}
              tone={toneForSqueeze1hPsi(psi1)}
            />
            <Stoplight
              label="Liquidity"
              value={liq1}
              unit="%"
              tone={toneForLiquidity(liq1)}
            />
            <Stoplight
              label="Volatility"
              value={vol1}
              tone={toneForVol(vol1)}
            />
            <Stoplight
              label="Sector Dir"
              value={rising1}
              tone={toneForPct(rising1)}
            />
            <Stoplight
              label="Risk-On"
              value={risk1}
              tone={toneForPct(risk1)}
            />
          </div>
          <div style={{ color: "#9ca3af", fontSize: 12, marginTop: 4 }}>
            Last 1-hour: <strong>{fmtIso(ts1h)}</strong>
          </div>
        </div>

        {/* EOD strip */}
        <div style={stripBox}>
          <div
            className="small"
            style={{ color: "#e5e7eb", fontWeight: 800 }}
          >
            EOD — Daily Structure
          </div>
          <div style={lineBox}>
            <Stoplight
              label="Daily Trend"
              value={tdTrendVal}
              tone={toneForDailyTrend(tdSlope)}
            />
            <Stoplight
              label="Participation"
              value={tdPartPct}
              tone={toneForPct(tdPartPct)}
            />
            <Stoplight
              label="Daily Squeeze"
              value={tdSdyDaily}        // PSI
              tone={toneForLuxDaily(tdSdyDaily)} // PSI bands
             />
            
            <Stoplight
              label="Vol Regime"
              value={tdVolPct}
              tone={toneForVolBand(tdVolBand)}
            />
            <Stoplight
              label="Liq Regime"
              value={tdLiqPsi}
              unit="PSI"
              tone={toneForLiqBand(tdLiqBand)}
             />

         
            <Stoplight
              label="Risk-On"
              value={tdRiskOn}
              tone={toneForPct(tdRiskOn)}
            />
          </div>
          <div style={{ color: "#9ca3af", fontSize: 12, marginTop: 4 }}>
            Daily updated: <strong>{fmtIso(tsEod)}</strong>
          </div>
        </div>
      </div>

      {/* Legend modal */}
      {legendOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setPCell }
