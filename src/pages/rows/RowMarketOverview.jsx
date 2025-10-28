import React from "react";
import { useDashboardPoll } from "../../lib/dashboardApiSafe";
import { LastUpdated } from "../../components/LastUpdated";
import {
  MarketMeterIntradayLegend,
  MarketMeterDailyLegend,
} from "../../components/MarketMeterLegend";

/* ------------------- API endpoints ------------------- */
const INTRADAY_URL = process.env.REACT_APP_INTRADAY_URL;  // /live/intraday
const HOURLY_URL   = process.env.REACT_APP_HOURLY_URL;    // /live/hourly
const EOD_URL      = process.env.REACT_APP_EOD_URL;       // /live/eod
const SANBOX_URL   = process.env.REACT_APP_INTRADAY_SANDBOX_URL || "";

/* ------------------- Utilities ------------------- */
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, Number(n)));
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
};
const fmtIso = (ts) => {
  try { return new Date(ts).toLocaleString(); } catch { return ts; }
};
const isStale = (ts, ms = 12 * 60 * 1000) =>
  !ts || Date.now() - new Date(ts).getTime() > ms;
const tsOf = (x) => (x?.updated_at || x?.ts || null);
const newer = (a, b) => {
  const ta = tsOf(a), tb = tsOf(b);
  if (!ta) return b;
  if (!tb) return a;
  return new Date(ta).getTime() >= new Date(tb).getTime() ? a : b;
};

/* ------------------- Tone helpers ------------------- */
const toneForPercent = (v) => (!Number.isFinite(v) ? "info" : v >= 60 ? "ok" : v >= 45 ? "warn" : "danger");
const toneForBreadth = toneForPercent;
const toneForMomentum = toneForPercent;
const toneForSqueeze10m = (v) => (!Number.isFinite(v) ? "info" : v >= 85 ? "danger" : v >= 65 ? "warn" : v >= 35 ? "warn" : "ok"); // PSI/tightness
const toneForSqueeze1h = (v) => (!Number.isFinite(v) ? "info" : v >= 65 ? "ok" : v >= 35 ? "warn" : "danger"); // Expansion
const toneForLiquidity = (v) => (!Number.isFinite(v) ? "info" : v >= 60 ? "ok" : v >= 40 ? "warn" : "danger");
const toneForVol = (v) => (!Number.isFinite(v) ? "info" : v > 60 ? "danger" : v > 30 ? "warn" : "ok");
const toneForDailyTrend = (s) => (!Number.isFinite(s) ? "info" : s > 5 ? "ok" : s >= -5 ? "warn" : "danger");
const toneForVolBand = (b) => (b === "high" ? "danger" : b === "elevated" ? "warn" : b ? "ok" : "info");
const toneForLiqBand = (b) => (b === "good" ? "ok" : b === "normal" ? "warn" : b ? "danger" : "info");
const toneForOverallState = (state, score) => {
  const s = (state || "").toLowerCase();
  if (s === "bull") return "ok";
  if (s === "bear") return "danger";
  if (s === "neutral") return "warn";
  return toneForPercent(score);
};

/* ------------------- Stoplight ------------------- */
function Stoplight({ label, value, unit = "%", tone = "info", size = 50, minWidth = 90 }) {
  const v = Number.isFinite(value) ? value : NaN;
  const colors = {
    ok:     { bg: "#22c55e", glow: "rgba(34,197,94,.45)" },
    warn:   { bg: "#fbbf24", glow: "rgba(251,191,36,.45)" },
    danger: { bg: "#ef4444", glow: "rgba(239,68,68,.45)" },
    info:   { bg: "#334155", glow: "rgba(51,65,85,.35)" },
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
      <div style={{ fontSize: 12.5, fontWeight: 700, color: "#e5e7eb", marginTop: 4 }}>{label}</div>
    </div>
  );
}

/* ------------------- Δ5m sandbox ------------------- */
function useSandboxDeltas() {
  const [delta, setDelta] = React.useState({ dB: null, dM: null, riskOn: null });
  const [ts, setTs] = React.useState(null);

  React.useEffect(() => {
    let stop = false;
    async function pull() {
      if (!SANBOX_URL) return;
      try {
        const u = SANBOX_URL.includes("?") ? `${SANBOX_URL}&t=${Date.now()}` : `${SANBOX_URL}?t=${Date.now()}`;
        const r = await fetch(u, { cache: "no-store" });
        const j = await r.json();
        if (stop) return;
        setDelta({
          dB: Number(j?.deltas?.market?.dBreadthPct ?? null),
          dM: Number(j?.deltas?.market?.dMomentumPct ?? null),
          riskOn: Number(j?.deltas?.market?.riskOnPct ?? null),
        });
        setTs(j?.deltasUpdated ?? j?.deltasUpdatedAt ?? null);
      } catch {
        if (!stop) {
          setDelta({ dB: null, dM: null, riskOn: null });
          setTs(null);
        }
      }
    }
    pull();
    const id = setInterval(pull, 60_000);
    return () => { stop = true; clearInterval(id); };
  }, []);

  return { delta, ts };
}

/* ------------------- Main ------------------- */
export default function RowMarketOverview() {
  const { data: polled } = useDashboardPoll("dynamic");
  const [legendOpen, setLegendOpen] = React.useState(null);

  // Live pulls
  const [live10, setLive10] = React.useState(null);
  const [live1h, setLive1h] = React.useState(null);
  const [liveEOD, setLiveEOD] = React.useState(null);

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
        if (EOD_URL) {
          const r = await fetch(`${EOD_URL}?t=${Date.now()}`, { cache: "no-store" });
          const j = await r.json();
          if (!stop) setLiveEOD(j);
        }
      } catch {}
    }
    pull();
    const id = setInterval(pull, 60_000);
    return () => { stop = true; clearInterval(id); };
  }, []);

  const { delta, ts: deltaTs } = useSandboxDeltas();

  // Choose newest intraday versus polled
  const chosen = newer(live10, polled);
  const d10 = chosen || {};
  const m10 = d10?.metrics || {};
  const i10 = d10?.intraday || {};
  const ts10 = d10?.updated_at;

  const d1h  = live1h || {};
  const m1h  = d1h?.metrics || {};
  const h1   = d1h?.hourly  || {};
  const ts1h = d1h?.updated_at;

  const dd   = liveEOD || {};
  const tsEOD = dd?.updated_at;

  /* ---------- 10m strip ---------- */
  const breadth10 = num(m10.breadth_10m_pct ?? m10.breadth_pct);
  const mom10     = num(m10.momentum_combo_10m_pct ?? m10.momentum_10m_pct ?? m10.momentum_pct);
  const sq10      = num(m10.squeeze_intraday_pct ?? m10.squeeze_pct);
  const liq10     = num(m10.liquidity_psi ?? m10.liquidity_pct);
  const vol10     = num(m10.volatility_pct);
  const rising10  = num(i10?.sectorDirection10m?.risingPct);
  const risk10    = num(i10?.riskOn10m?.riskOnPct);
  const overall10 = num(i10?.overall10m?.score);
  const state10   = i10?.overall10m?.state || null;

  /* ---------- 1h strip ---------- */
  const breadth1  = num(m1h.breadth_1h_pct);
  const mom1      = num(m1h.momentum_combo_1h_pct ?? m1h.momentum_1h_pct ?? m1h.momentum_pct);
  const sq1       = num(m1h.squeeze_1h_pct);
  const liq1      = num(m1h.liquidity_1h);
  const vol1      = num(m1h.volatility_1h_scaled ?? m1h.volatility_1h_pct);
  const rising1   = num(h1?.sectorDirection1h?.risingPct);
  const risk1     = num(h1?.riskOn1h?.riskOnPct);
  const overall1  = num(h1?.overall1h?.score);
  const state1    = h1?.overall1h?.state || null;

  /* ---------- EOD strip (trendDaily mirror) ---------- */
  const td        = dd?.trendDaily || {};
  const tdSlope   = num(td?.trend?.emaSlope);
  const tdTrend   = td?.trend?.state || null;
  const tdTrendVal= Number.isFinite(num(tdSlope)) ? (tdSlope > 5 ? 75 : tdSlope < -5 ? 25 : 50) : NaN;
  const tdPartPct = num(td?.participation?.pctAboveMA);
  const tdVolPct  = num(td?.volatilityRegime?.atrPct);
  const tdVolBand = td?.volatilityRegime?.band || null;
  const tdLiqPsi  = num(td?.liquidityRegime?.psi);
  const tdLiqBand = td?.liquidityRegime?.band || null;
  const tdRiskOn  = num(dd?.rotation?.riskOnPct);
  const tdSdyDaily= num(dd?.metrics?.squeeze_daily_pct);

  /* ---------- Layout ---------- */
  const stripBox = { display:"flex", flexDirection:"column", gap:6, minWidth:820 };
  const lineBox  = { display:"flex", gap:12, alignItems:"center", whiteSpace:"nowrap", overflowX:"auto", paddingBottom:2 };

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
        <LastUpdated ts={tsOf(live10 || live1h || liveEOD)} />
      </div>

      {/* Three strips side-by-side (wrap on small screens) */}
      <div style={{ display: "flex", gap: 28, alignItems: "flex-start", flexWrap: "wrap", marginTop: 8 }}>
        {/* 10m strip */}
        <div style={stripBox}>
          <div className="small" style={{ color: "#9ca3af", fontWeight: 800 }}>10m — Intraday Scalp</div>
          <div style={lineBox}>
            <Stoplight label="Overall"   value={overall10} tone={toneForOverallState(state10, overall10)} />
            <Stoplight label="Breadth"   value={breadth10} tone={toneForBreadth(breadth10)} />
            <Stoplight label="Momentum"  value={mom10}     tone={toneForMomentum(mom10)} />
            <Stoplight label="Squeeze"   value={sq10}      tone={toneForSqueeze10m(sq10)} />
            <Stoplight label="Liquidity" value={liq10}     unit="PSI" tone={toneForLiquidity(liq10)} />
            <Stoplight label="Volatility" value={vol10}    tone={toneForVol(vol10)} />
            <Stoplight label="Sector Dir" value={rising10} tone={toneForPercent(rising10)} />
            <Stoplight label="Risk-On"    value={risk10}   tone={toneForPercent(risk10)} />
          </div>
          <div style={{ color: "#9ca3af", fontSize: 12 }}>
            Last 10-min: <strong>{fmtIso(ts10)}</strong> &nbsp;|&nbsp; Δ5m updated: <strong>{fmtIso(deltaTs) || "—"}</strong>
          </div>
        </div>

        {/* 1h strip */}
        <div style={stripBox}>
          <div className="small" style={{ color: "#9ca3af", fontWeight: 800 }}>1h — Hourly Valuation</div>
          <div style={lineBox}>
            <Stoplight label="Overall"    value={overall1} tone={toneForOverallState(state1, overall1)} />
            <Stoplight label="Breadth"    value={breadth1} tone={toneForBreadth(breadth1)} />
            <Stoplight label="Momentum"   value={mom1}     tone={toneForMomentum(mom1)} />
            <Stoplight label="Squeeze"    value={sq1}      tone={toneForSqueeze1h(sq1)} />
            <Stoplight label="Liquidity"  value={liq1}     unit="PSI" tone={toneForLiquidity(liq1)} />
            <Stoplight label="Volatility" value={vol1}     tone={toneForVol(vol1)} />
            <Stoplight label="Sector Dir" value={rising1}  tone={toneForPercent(rising1)} />
            <Stoplight label="Risk-On"    value={risk1}    tone={toneForPercent(risk1)} />
          </div>
          <div style={{ color: "#9ca3af", fontSize: 12 }}>
            Last 1-hour: <strong>{fmtIso(ts1h)}</strong>
          </div>
        </div>

        {/* EOD strip */}
        <div style={stripBox}>
          <div className="small" style={{ color: "#9ca3af", fontWeight: 800 }}>EOD — Daily Structure</div>
          <div style={lineBox}>
            <Stoplight label="Daily Trend"  value={tdTrendVal} tone={toneForDailyTrend(tdSlope)} />
            <Stoplight label="Participation" value={tdPartPct}  tone={toneForPercent(tdPartPct)} />
            <Stoplight label="Daily Squeeze" value={tdSdyDaily} tone={/* Lux daily */ tdSdyDaily >= 85 ? "danger" : tdSdyDaily >= 80 ? "warn" : "ok"} />
            <Stoplight label="Vol Regime"    value={tdVolPct}   tone={toneForVolBand(tdVolBand)} />
            <Stoplight label="Liq Regime"    value={tdLiqPsi}    unit="PSI" tone={toneForLiqBand(tdLiqBand)} />
            <Stoplight label="Risk-On"       value={tdRiskOn}    tone={toneForPercent(tdRiskOn)} />
          </div>
          <div style={{ color: "#9ca3af", fontSize: 12 }}>
            Daily updated: <strong>{fmtIso(tsEOD)}</strong>
          </div>
        </div>
      </div>

      {/* Legends */}
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
            zIndex: 60
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(880px, 92vw)",
              background: "#0b0b0c",
              border: "1px solid #2b2b2b",
              borderRadius: 12,
              padding: 16,
              boxShadow: "0 10px 30px rgba(0,0,0,0.35)"
            }}
          >
            <MarketMeterIntradayLegend />
            <MarketMeterDailyLegend />
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
                  cursor: "pointer"
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
