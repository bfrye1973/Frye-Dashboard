// src/pages/rows/RowMarketOverview.jsx
import React from "react";
import { useDashboardPoll } from "../../lib/dashboardApi";
import { LastUpdated } from "../../components/LastUpdated";

/* ---------- helpers ---------- */
const clamp01 = (n) => Math.max(0, Math.min(100, Number(n)));
const pct = (n) => (Number.isFinite(n) ? n.toFixed(1) : "—");
const toneFor = (v) => (v >= 60 ? "ok" : v >= 40 ? "warn" : "danger");

/* ---------- baselines (per day) ---------- */
const dayKey = () => new Date().toISOString().slice(0, 10);
function useDailyBaseline(keyName, current) {
  const [baseline, setBaseline] = React.useState(null);
  React.useEffect(() => {
    const k = `meter_baseline_${dayKey()}_${keyName}`;
    const saved = localStorage.getItem(k);
    if (saved === null && Number.isFinite(current)) {
      localStorage.setItem(k, String(current));
      setBaseline(current);
    } else if (saved !== null) {
      const n = Number(saved);
      setBaseline(Number.isFinite(n) ? n : null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyName]);

  React.useEffect(() => {
    if (!Number.isFinite(current)) return;
    const k = `meter_baseline_${dayKey()}_${keyName}`;
    if (localStorage.getItem(k) === null) {
      localStorage.setItem(k, String(current));
      setBaseline(current);
    }
  }, [keyName, current]);

  return baseline;
}

/* ---------- stoplight ---------- */
function Stoplight({ label, value, baseline, size = 60, unit = "%" }) {
  const v = Number.isFinite(value) ? clamp01(value) : NaN;
  const delta = Number.isFinite(v) && Number.isFinite(baseline) ? v - baseline : NaN;

  const tone = Number.isFinite(v) ? toneFor(v) : "info";
  const colors = {
    ok:    { bg:"#22c55e", glow:"rgba(34,197,94,.45)"  },
    warn:  { bg:"#fbbf24", glow:"rgba(251,191,36,.45)" },
    danger:{ bg:"#ef4444", glow:"rgba(239,68,68,.45)"  },
    info:  { bg:"#334155", glow:"rgba(51,65,85,.35)"   }
  }[tone];

  const arrow =
    !Number.isFinite(delta) ? "→" :
    Math.abs(delta) < 0.5   ? "→" :
    delta > 0               ? "↑" : "↓";

  const arrowClass =
    !Number.isFinite(delta) || Math.abs(delta) < 0.5
      ? "delta delta-flat"
      : delta > 0
      ? "delta delta-up"
      : "delta delta-down";

  return (
    <div className="light" style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4, minWidth:size+36 }}>
      <div
        title={`${label}: ${pct(v)}${unit === "%" ? "%" : ""}`}
        style={{
          width: size, height: size, borderRadius:"50%",
          background: colors.bg, boxShadow:`0 0 14px ${colors.glow}`,
          display:"flex", alignItems:"center", justifyContent:"center",
          border: "5px solid #0c1320"
        }}
      >
        <div style={{ fontWeight:800, fontSize:size > 100 ? 20 : 14, color:"#0b1220" }}>
          {pct(v)}{unit === "%" ? "%" : ""}
        </div>
      </div>
      <div className="small" style={{ fontWeight:700, lineHeight:1.1 }}>{label}</div>
      <div className={arrowClass} style={{ marginTop:2 }}>
        {arrow} {Number.isFinite(delta) ? delta.toFixed(1) : "0.0"}{unit === "%" ? "%" : ""}
      </div>
    </div>
  );
}

export default function RowMarketOverview() {
  // ✅ dynamic cadence (RTH=15s, pre/post=30s, overnight/weekend=120s)
  const { data } = useDashboardPoll?.("dynamic") ?? { data:null };

  const od = data?.odometers ?? {};
  const gg = data?.gauges ?? {};
  const ts = data?.meta?.ts || null;

  // normalized (from dashboardApi)
  const breadth   = Number(od?.breadthOdometer ?? 50);
  const momentum  = Number(od?.momentumOdometer ?? 50);

  // intraday squeeze (compression), expansion = 100 - compression
  const squeezeIntra = Number(od?.squeezeCompressionPct ?? 50);

  // daily squeeze (compression) — MUST be under gauges.squeezeDaily.pct
  const squeezeDaily = Number.isFinite(gg?.squeezeDaily?.pct) ? gg.squeezeDaily.pct : null;

  // liquidity & volatility; accept both canonical and water.pct
  const liquidity  = Number.isFinite(gg?.oilPsi) ? gg.oilPsi : (Number.isFinite(gg?.oil?.psi) ? gg.oil.psi : NaN);
  const volatility = Number.isFinite(gg?.volatilityPct) ? gg.volatilityPct : (Number.isFinite(gg?.water?.pct) ? gg.water.pct : NaN);

  // baselines
  const bBreadth   = useDailyBaseline("breadth", breadth);
  const bMomentum  = useDailyBaseline("momentum", momentum);
  const bSqueezeIn = useDailyBaseline("squeezeIntraday", squeezeIntra);
  const bSqueezeDy = useDailyBaseline("squeezeDaily", squeezeDaily);
  const bLiquidity = useDailyBaseline("liquidity", liquidity);
  const bVol       = useDailyBaseline("volatility", volatility);

  // ----- Market Meter formula -----
  const expansion  = 100 - clamp01(squeezeIntra);
  const baseMeter  = 0.4 * breadth + 0.4 * momentum + 0.2 * expansion;

  // blend toward neutral by daily squeeze
  const Sdy = Number.isFinite(squeezeDaily) ? clamp01(squeezeDaily) / 100 : 0;
  const blended = (1 - Sdy) * baseMeter + Sdy * 50; // 0..100
  const meterValue = Math.round(blended);

  return (
    <section id="row-2" className="panel" style={{ padding:8 }}>
      <div className="panel-head">
        <div className="panel-title">Market Meter — Stoplights</div>
        <div className="spacer" />
        <LastUpdated ts={ts} />
      </div>

      {/* 3-column cluster: left(3) | center(big+daily) | right(2) */}
      <div style={{
        display:"grid",
        gridTemplateColumns:"1fr auto 1fr",
        alignItems:"center",
        gap:10,
        marginTop:6
      }}>        
        {/* Market Meter — Stoplights (narrow row) */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div
            style={{
              display: 'flex',
              gap: 16,               // spacing between the 3 buttons
              maxWidth: 420,         // 👈 cap total width (tune 360–520 as you like)
              width: '100%',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            {/* Replace these with your actual components/elements */}
            <Stoplight label="Breadth"  value={breadthPct}  delta={breadthDelta}  />
            <Stoplight label="Momentum" value={momentumPct} delta={momentumDelta} />
            <Stoplight label="Intraday Squeeze" value={squeezePct} delta={squeezeDelta} />
          </div>
        </div>

        {/* CENTER: Big Market Meter + Daily Squeeze */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:12 }}>
          <Stoplight label="Market Meter"  value={meterValue} baseline={meterValue} size={110} />
          <Stoplight label="Daily Squeeze" value={squeezeDaily} baseline={bSqueezeDy} />
        </div>

        {/* RIGHT: Liquidity, Volatility */}
        <div style={{ display:"flex", gap:10, flexWrap:"nowrap", justifyContent:"flex-end" }}>
          <Stoplight label="Liquidity"  value={liquidity}  baseline={bLiquidity} unit="" />
          <Stoplight label="Volatility" value={volatility} baseline={bVol} />
        </div>
      </div>
    </section>
  );
}
