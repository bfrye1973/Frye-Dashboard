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
function Stoplight({ label, value, baseline, size = 72, unit = "%" }) {
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
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:6, minWidth:size+36 }}>
      <div
        title={`${label}: ${pct(v)}${unit === "%" ? "%" : ""}`}
        style={{
          width: size, height: size, borderRadius: "50%",
          background: colors.bg, boxShadow: `0 0 18px ${colors.glow}`,
          display:"flex", alignItems:"center", justifyContent:"center",
          border: "6px solid #0c1320"
        }}
      >
        <div style={{ fontWeight:800, fontSize: size > 100 ? 20 : 16, color:"#0b1220" }}>
          {pct(v)}{unit === "%" ? "%" : ""}
        </div>
      </div>
      <div style={{ textAlign:"center", lineHeight:1.15 }}>
        <div className="small" style={{ fontWeight:700 }}>{label}</div>
        <div className={arrowClass} style={{ marginTop:4 }}>
          {arrow} {Number.isFinite(delta) ? delta.toFixed(1) : "0.0"}{unit === "%" ? "%" : ""}
        </div>
      </div>
    </div>
  );
}

/* ---------- legend (wide, readable, always visible) ---------- */
function LegendWide() {
  const Dot = ({ tone }) => {
    const c = tone === "ok" ? "#22c55e" : tone === "warn" ? "#fbbf24" : "#ef4444";
    return <span style={{ display:"inline-block", width:10, height:10, borderRadius:"50%", background:c, marginRight:6 }}/>;
  };
  return (
    <div className="panel" style={{ padding:12 }}>
      <div className="panel-title" style={{ marginBottom:8, fontSize:14 }}>Legend</div>
      <div style={{ fontSize:13, display:"flex", flexWrap:"wrap", gap:18 }}>
        <div><Dot tone="ok" /><strong>Green</strong>: strong / favorable</div>
        <div><Dot tone="warn" /><strong>Yellow</strong>: neutral / mixed</div>
        <div><Dot tone="danger" /><strong>Red</strong>: weak / unfavorable</div>
        <div><strong>Arrows</strong> — ⬆ up vs baseline, → flat (&lt;0.5%), ⬇ down</div>
      </div>
      <div style={{ fontSize:13, display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginTop:8 }}>
        <div><strong>Breadth / Momentum / Squeeze</strong><br/>Green &gt; 60%, Yellow 40–60%, Red &lt; 40%</div>
        <div><strong>Liquidity (PSI)</strong><br/>Green &gt; 80, Yellow 50–80, Red &lt; 50</div>
        <div><strong>Volatility</strong><br/>Green = low, Yellow = medium, Red = high</div>
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

  // Volatility placeholder mapping (adjust when dedicated metric available)
  const rawVol = Number.isFinite(gg?.waterTemp) ? gg.waterTemp : NaN;
  const volatility = Number.isFinite(rawVol)
    ? clamp01(((rawVol - 160) / (260 - 160)) * 100) /* 160–260°F => 0..100 */
    : NaN;

  // baselines
  const baseBreadth   = useDailyBaseline("breadth", breadth);
  const baseMomentum  = useDailyBaseline("momentum", momentum);
  const baseSqueeze   = useDailyBaseline("squeeze", squeeze);
  const baseLiquidity = useDailyBaseline("liquidity", liquidity);
  const baseVol       = useDailyBaseline("volatility", volatility);

  // composite (for center light, not the top bar)
  const expansion = 100 - clamp01(squeeze);
  const baseMeter = 0.4 * breadth + 0.4 * momentum + 0.2 * expansion;
  const meter = Math.round(squeeze >= 90 ? 45 + (baseMeter - 50) * 0.30 : baseMeter);

  return (
    <section id="row-2" className="panel" style={{ padding:10 }}>
      <div className="panel-head">
        <div className="panel-title">Market Meter — Stoplights</div>
        <div className="spacer" />
        <span className="small muted">Legend always visible</span>
      </div>

      {/* Compact 3-column layout: left(3) | center(big) | right(2) */}
      <div style={{
        display:"grid",
        gridTemplateColumns:"1fr auto 1fr",
        alignItems:"center",
        gap:12,
        marginTop:6
      }}>
        {/* Left cluster (3) */}
        <div style={{ display:"flex", gap:10, justifyContent:"flex-start", flexWrap:"wrap" }}>
          <Stoplight label="Breadth"   value={breadth}   baseline={baseBreadth} />
          <Stoplight label="Momentum"  value={momentum}  baseline={baseMomentum} />
          <Stoplight label="Squeeze"   value={squeeze}   baseline={baseSqueeze} />
        </div>

        {/* Center big light */}
        <div style={{ display:"flex", justifyContent:"center" }}>
          <Stoplight label="Market Meter" value={meter} baseline={meter} size={140} />
        </div>

        {/* Right cluster (2) */}
        <div style={{ display:"flex", gap:10, justifyContent:"flex-end", flexWrap:"wrap" }}>
          <Stoplight label="Liquidity"  value={liquidity}  baseline={baseLiquidity} unit="" />
          <Stoplight label="Volatility" value={volatility} baseline={baseVol} />
        </div>
      </div>

      {/* Wide legend below (keeps row compact and centers big light above) */}
      <div style={{ marginTop:10 }}>
        <LegendWide />
      </div>
    </section>
  );
}
