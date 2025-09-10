// src/pages/rows/RowMarketOverview.jsx
import React, { useEffect, useState } from "react";
import { useDashboardPoll } from "../../lib/dashboardApi";

/* ---------- helpers ---------- */
const clamp01 = (n) => Math.max(0, Math.min(100, Number(n)));
const pct = (n) => (Number.isFinite(n) ? n.toFixed(1) : "—");
const toneFor = (v) => (v >= 60 ? "ok" : v >= 40 ? "warn" : "danger"); // green / yellow / red
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

/* ---------- stoplight ---------- */
function Stoplight({ label, value, baseline, size = 60, unit = "%" }) {
  const v = clamp01(value);
  const delta = Number.isFinite(v) && Number.isFinite(baseline) ? v - baseline : NaN;

  const tone = toneFor(v);
  const colors = {
    ok:    { bg:"#22c55e", glow:"rgba(34,197,94,.45)"  }, // green
    warn:  { bg:"#fbbf24", glow:"rgba(251,191,36,.45)" }, // yellow (true)
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

export default function RowMarketOverview() {
  const { data } = useDashboardPoll?.(5000) ?? { data:null };

  const od = data?.odometers ?? {};
  const gg = data?.gauges ?? {};

  const breadth    = Number(od?.breadthOdometer ?? 50);
  const momentum   = Number(od?.momentumOdometer ?? 50);

  // Intraday squeeze: odometers.squeezeCompressionPct (fallback fuelPct)
  const squeezeIntra = Number.isFinite(od?.squeezeCompressionPct) ? od.squeezeCompressionPct
                      : Number.isFinite(gg?.fuelPct) ? gg.fuelPct : 50;

  // Daily squeeze: gauges.squeezeDaily.pct
  const squeezeDaily = Number.isFinite(gg?.squeezeDaily?.pct) ? gg.squeezeDaily.pct : null;

  const liquidity  = Number.isFinite(gg?.oil?.psi) ? gg.oil.psi
                   : Number.isFinite(gg?.oilPsi)    ? gg.oilPsi : NaN;

  // Volatility mapping (placeholder → convert your real metric when available)
  const rawVol = Number.isFinite(gg?.waterTemp) ? gg.waterTemp : NaN;
  const volatility = Number.isFinite(rawVol)
    ? clamp01(((rawVol - 160) / (260 - 160)) * 100)  // map 160–260°F to 0–100
    : NaN;

  // baselines for arrows
  const baseBreadth    = useDailyBaseline("breadth", breadth);
  const baseMomentum   = useDailyBaseline("momentum", momentum);
  const baseSqueezeIn  = useDailyBaseline("squeezeIntraday", squeezeIntra);
  const baseSqueezeDay = useDailyBaseline("squeezeDaily", squeezeDaily);
  const baseLiquidity  = useDailyBaseline("liquidity", liquidity);
  const baseVol        = useDailyBaseline("volatility", volatility);

  // composite Market Meter (center big light)
  const expansion = 100 - clamp01(squeezeIntra);
  const baseMeter = 0.4 * breadth + 0.4 * momentum + 0.2 * expansion;
  const meter = Math.round((squeezeDaily ?? 0) >= 90 ? 45 + (baseMeter - 50) * 0.30 : baseMeter);

  return (
    <section id="row-2" className="panel" style={{ padding:8 }}>
      <div className="panel-head">
        <div className="panel-title">Market Meter — Stoplights</div>
        <div className="spacer" />
        <span className="small muted">Daily Squeeze + Intraday Squeeze</span>
      </div>

      {/* 3-column cluster (left | center | right) */}
      <div style={{
        display:"grid",
        gridTemplateColumns:"1fr auto 1fr",
        alignItems:"center",
        gap:10,
        marginTop:6
      }}>
        {/* LEFT: Breadth, Momentum, Intraday Squeeze */}
        <div style={{ display:"flex", gap:10, flexWrap:"nowrap", justifyContent:"flex-start" }}>
          <Stoplight label="Breadth" value={breadth} baseline={baseBreadth} />
          <Stoplight label="Momentum" value={momentum} baseline={baseMomentum} />
          <Stoplight label="Intraday Squeeze" value={squeezeIntra} baseline={baseSqueezeIn} />
        </div>

        {/* CENTER: Big Market Meter */}
        <div style={{ display:"flex", justifyContent:"center" }}>
          <Stoplight label="Market Meter" value={meter} baseline={meter} size={110} />
        </div>

        {/* RIGHT: Liquidity, Daily Squeeze */}
        <div style={{ display:"flex", gap:10, flexWrap:"nowrap", justifyContent:"flex-end" }}>
          <Stoplight label="Liquidity" value={liquidity} baseline={baseLiquidity} unit="" />
          <Stoplight label="Daily Squeeze" value={squeezeDaily} baseline={baseSqueezeDay} />
        </div>
      </div>
    </section>
  );
}
