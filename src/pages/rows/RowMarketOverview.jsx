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
    warn:  { bg:"#fbbf24", glow:"rgba(251,191,36,.45)" }, // yellow
    danger:{ bg:"#ef4444", glow:"rgba(239,68,68,.45)"  }  // red
  }[tone];

  const arrow = !Number.isFinite(delta)
    ? "→"
    : Math.abs(delta) < 0.5
    ? "→"
    : delta > 0
    ? "↑"
    : "↓";

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
          background: colors.bg,
          boxShadow: `0 0 20px ${colors.glow}`,
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

/* ---------- legend (always visible, wider, larger text) ---------- */
function LegendMini() {
  const Dot = ({ tone }) => {
    const c = tone === "ok" ? "#22c55e" : tone === "warn" ? "#fbbf24" : "#ef4444";
    return <span style={{ display:"inline-block", width:10, height:10, borderRadius:"50%", background:c, marginRight:6 }}/>;
  };
  return (
    <div className="panel" style={{ padding:14, minWidth:340 }}>
      <div className="panel-title" style={{ marginBottom:10, fontSize:14 }}>Legend</div>
      <div style={{ fontSize:13, marginBottom:10 }}>
        <div style={{ marginBottom:6 }}><Dot tone="ok" /><strong>Green</strong>: strong / favorable</div>
        <div style={{ marginBottom:6 }}><Dot tone="warn" /><strong>Yellow</strong>: neutral / mixed</div>
        <div><Dot tone="danger" /><strong>Red</strong>: weak / unfavorable</div>
      </div>
      <div style={{ fontSize:13, marginBottom:10 }}>
        <strong>Arrows</strong> — ⬆ up vs baseline, → flat (&lt;0.5%), ⬇ down
      </div>
      <div style={{ fontSize:13 }}>
        <div style={{ marginBottom:8 }}>
          <strong>Breadth / Momentum / Squeeze</strong><br/>
          Green &gt; 60%, Yellow 40–60%, Red &lt; 40%
        </div>
        <div style={{ marginBottom:8 }}>
          <strong>Liquidity (PSI)</strong><br/>
          Green &gt; 80, Yellow 50–80, Red &lt; 50
        </div>
        <div>
          <strong>Volatility</strong><br/>
          Green = low, Yellow = medium, Red = high
        </div>
      </div>
    </div>
  );
}

export default function RowMarketOverview() {
  const { data, loading, error } = useDashboardPoll?.(5000) ?? { data:null, loading:false, error:null };

  // values
  const od = data?.odometers ?? {};
  const gg = data?.gauges ?? {};

  const breadth   = Number(od?.breadthOdometer ?? 50);
  const momentum  = Number(od?.momentumOdometer ?? 50);
  const squeeze   = Number.isFinite(od?.squeezeCompressionPct) ? od.squeezeCompressionPct
                  : Number.isFinite(gg?.fuelPct) ? gg.fuelPct : 50;

  const liquidity = Number.isFinite(gg?.oil?.psi) ? gg.oil.psi
                  : Number.isFinite(gg?.oilPsi)    ? gg.oilPsi
                  : NaN;

  // Volatility mapping (adjust when you have a proper metric)
  const rawVol = Number.isFinite(gg?.waterTemp) ? gg.waterTemp : NaN;
  const volatility = Number.isFinite(rawVol)
    ? clamp01(((rawVol - 160) / (260 - 160)) * 100) // map 160–260°F → 0..100 index
    : NaN;

  // baselines for arrows
  const breadthBase   = useDailyBaseline("breadth", breadth);
  const momentumBase  = useDailyBaseline("momentum", momentum);
  const squeezeBase   = useDailyBaseline("squeeze", squeeze);
  const liquidityBase = useDailyBaseline("liquidity", liquidity);
  const volBase       = useDailyBaseline("volatility", volatility);

  // optional headline composite
  const expansion = 100 - clamp01(squeeze);
  const baseMeter = 0.4 * breadth + 0.4 * momentum + 0.2 * expansion;
  const meter = Math.round(squeeze >= 90 ? 45 + (baseMeter - 50) * 0.30 : baseMeter);
  const meterTone = toneFor(meter);

  return (
    <section id="row-2" className="panel" style={{ padding: 10 }}>
      <div className="panel-head">
        <div className="panel-title">Market Meter — Stoplights</div>
        <div className="spacer" />
        <span className="small muted">Legend always visible</span>
      </div>

      {/* headline bar small & tight */}
      <div className={`kpi-bar ${meterTone}`} style={{ margin: "8px 0 4px 0" }}>
        <div className="kpi-fill" style={{ width: `${clamp01(meter)}%` }} />
      </div>
      <div className="small muted" style={{ display:"flex", justifyContent:"space-between" }}>
        <span>Meter: <strong>{pct(meter)}%</strong></span>
        {squeeze >= 90 && <span>Major squeeze — direction unknown</span>}
      </div>

      {/* layout: [ left(3) | center(big) | right(2) | legend ] */}
      <div style={{
        display:"grid",
        gridTemplateColumns:"auto auto auto 1fr", // left cluster | center | right cluster | legend (wide)
        gap:12, marginTop:10, alignItems:"start"
      }}>
        {/* LEFT: 3 lights (Breadth, Momentum, Squeeze) */}
        <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
          <Stoplight label="Breadth"   value={breadth}   baseline={breadthBase} />
          <Stoplight label="Momentum"  value={momentum}  baseline={momentumBase} />
          <Stoplight label="Squeeze"   value={squeeze}   baseline={squeezeBase} />
        </div>

        {/* CENTER: big Market Meter (2× size) */}
        <div style={{ display:"flex", justifyContent:"center" }}>
          <Stoplight label="Market Meter" value={meter} baseline={meter} size={140} />
        </div>

        {/* RIGHT: 2 lights (Liquidity, Volatility) */}
        <div style={{ display:"flex", gap:12, flexWrap:"wrap", justifyContent:"flex-end" }}>
          <Stoplight label="Liquidity"  value={liquidity}  baseline={liquidityBase} unit="" />
          <Stoplight label="Volatility" value={volatility} baseline={volBase} />
        </div>

        {/* LEGEND (wide, larger text) */}
        <LegendMini />
      </div>

      {loading && <div className="small muted" style={{ marginTop: 6 }}>Loading…</div>}
      {error   && <div className="small muted" style={{ marginTop: 6 }}>Failed to load.</div>}
    </section>
  );
}
