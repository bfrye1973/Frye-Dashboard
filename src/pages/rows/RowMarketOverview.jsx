// src/pages/rows/RowMarketOverview.jsx
import React, { useEffect, useState } from "react";
import { useDashboardPoll } from "../../lib/dashboardApi";

/* ---------- helpers ---------- */
const clamp01 = (n) => Math.max(0, Math.min(100, Number(n)));
const pct = (n) => (Number.isFinite(n) ? n.toFixed(1) : "—");
const toneFor = (v) => (v >= 60 ? "ok" : v >= 40 ? "warn" : "danger");
const dayKey = () => new Date().toISOString().slice(0, 10);

function useDailyBaseline(keyName, current) {
  const [baseline, setBaseline] = useState(null);
  useEffect(() => {
    const k = `meter_baseline_${dayKey()}_${keyName}`;
    const saved = localStorage.getItem(k);
    if (saved === null && Number.isFinite(current)) {
      localStorage.setItem(k, String(current));
      setBaseline(current);
    } else if (saved !== null) {
      const n = Number(saved);
      setBaseline(Number.isFinite(n) ? n : null);
    }
  }, [keyName]);
  useEffect(() => {
    if (!Number.isFinite(current)) return;
    const k = `meter_baseline_${dayKey()}_${keyName}`;
    if (localStorage.getItem(k) === null) {
      localStorage.setItem(k, String(current));
      setBaseline(current);
    }
  }, [keyName, current]);
  return baseline;
}

/* ---------- stoplight (small/big size via prop) ---------- */
function Stoplight({ label, value, baseline, size = 60, unit = "%" }) {
  const v = clamp01(value);
  const delta = Number.isFinite(v) && Number.isFinite(baseline) ? v - baseline : NaN;

  const tone = toneFor(v);
  const colors = {
    ok:    { bg:"#22c55e", glow:"rgba(34,197,94,.45)"  }, // green
    warn:  { bg:"#fbbf24", glow:"rgba(251,191,36,.45)" }, // yellow
    danger:{ bg:"#ef4444", glow:"rgba(239,68,68,.45)"  }  // red
  }[tone];

  const arrow = !Number.isFinite(delta)
    ? "→" : Math.abs(delta) < 0.5
    ? "→" : delta > 0
    ? "↑" : "↓";

  const arrowClass =
    !Number.isFinite(delta) || Math.abs(delta) < 0.5
      ? "delta delta-flat"
      : delta > 0
      ? "delta delta-up"
      : "delta delta-down";

  return (
    <div className="light" style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
      <div
        title={`${label}: ${pct(v)}${unit === "%" ? "%" : ""}`}
        style={{
          width: size, height: size, borderRadius: "50%",
          background: colors.bg, boxShadow: `0 0 14px ${colors.glow}`,
          display:"flex", alignItems:"center", justifyContent:"center",
          border: "5px solid #0c1320"
        }}
      >
        <div style={{ fontWeight:800, fontSize: size > 100 ? 20 : 14, color:"#0b1220" }}>
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

/* ---------- legend (compact, inline to right of Market Meter) ---------- */
function LegendInline() {
  const Dot = ({ tone }) => {
    const c = tone === "ok" ? "#22c55e" : tone === "warn" ? "#fbbf24" : "#ef4444";
    return <span style={{ display:"inline-block", width:10, height:10, borderRadius:"50%", background:c, marginRight:6 }}/>;
  };
  return (
    <div className="panel meter-legend">
      <div className="panel-title small" style={{ marginBottom:6 }}>Legend</div>
      <div className="small" style={{ display:"flex", gap:14, flexWrap:"wrap", lineHeight:1.35 }}>
        <div><Dot tone="ok" /><strong>Green</strong>: strong</div>
        <div><Dot tone="warn" /><strong>Yellow</strong>: neutral</div>
        <div><Dot tone="danger" /><strong>Red</strong>: weak</div>
        <div><strong>Arrows</strong>: ⬆ up, → flat (&lt;0.5%), ⬇ down</div>
        <div><strong>Thresh.</strong>: B/M/S: G&gt;60, Y:40–60, R&lt;40 • Liquidity (PSI): G&gt;80, Y:50–80, R&lt;50</div>
      </div>
    </div>
  );
}

export default function RowMarketOverview() {
  const { data } = useDashboardPoll?.(5000) ?? { data:null };

  // live values
  const od = data?.odometers ?? {};
  const gg = data?.gauges ?? {};

  const breadth   = Number(od?.breadthOdometer ?? 50);
  const momentum  = Number(od?.momentumOdometer ?? 50);
  const squeeze   = Number.isFinite(od?.squeezeCompressionPct) ? od.squeezeCompressionPct
                  : Number.isFinite(gg?.fuelPct) ? gg.fuelPct : 50;
  const liquidity = Number.isFinite(gg?.oil?.psi) ? gg.oil.psi
                  : Number.isFinite(gg?.oilPsi)    ? gg.oilPsi : NaN;

  // Volatility mapping (placeholder until dedicated metric)
  const rawVol = Number.isFinite(gg?.waterTemp) ? gg.waterTemp : NaN;
  const volatility = Number.isFinite(rawVol)
    ? clamp01(((rawVol - 160) / (260 - 160)) * 100)
    : NaN;

  // baselines for arrows
  const baseBreadth   = useDailyBaseline("breadth", breadth);
  const baseMomentum  = useDailyBaseline("momentum", momentum);
  const baseSqueeze   = useDailyBaseline("squeeze", squeeze);
  const baseLiquidity = useDailyBaseline("liquidity", liquidity);
  const baseVol       = useDailyBaseline("volatility", volatility);

  // layout: [ left(3) | center(big) | right(2) | legend ]
  return (
    <section id="row-2" className="panel" style={{ padding:8 }}>
      <div className="panel-head">
        <div className="panel-title">Market Meter — Stoplights</div>
        <div className="spacer" />
        <span className="small muted">Legend always visible</span>
      </div>

      <div className="meter-grid">
        {/* left cluster: 3 small */}
        <div className="meter-small" style={{ justifyContent:"flex-start" }}>
          <Stoplight label="Breadth"   value={breadth}   baseline={baseBreadth} />
          <Stoplight label="Momentum"  value={momentum}  baseline={baseMomentum} />
          <Stoplight label="Squeeze"   value={squeeze}   baseline={baseSqueeze} />
        </div>

        {/* center big */}
        <div className="meter-center">
          <Stoplight label="Market Meter" value={
            Math.round(0.4 * breadth + 0.4 * momentum + 0.2 * (100 - clamp01(squeeze)))
          } baseline={null} size={110} />
        </div>

        {/* right cluster: 2 small */}
        <div className="meter-small" style={{ justifyContent:"flex-end" }}>
          <Stoplight label="Liquidity"  value={liquidity}  baseline={baseLiquidity} unit="" />
          <Stoplight label="Volatility" value={volatility} baseline={baseVol} />
        </div>

        {/* legend inline to the right of center light */}
        <LegendInline />
      </div>
    </section>
  );
}
