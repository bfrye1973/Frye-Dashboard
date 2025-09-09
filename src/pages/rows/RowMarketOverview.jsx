// src/pages/rows/RowMarketOverview.jsx
import React, { useEffect, useState } from "react";
import { useDashboardPoll } from "../../lib/dashboardApi";

/* ---------- helpers ---------- */
const clamp01 = (n) => Math.max(0, Math.min(100, Number(n)));
const pct = (n) => (Number.isFinite(n) ? n.toFixed(1) : "—");
const toneFor = (v) => (v >= 60 ? "ok" : v >= 40 ? "warn" : "danger"); // green / yellow / red

// daily baseline kept in localStorage so we can show Δ today
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
    const saved = localStorage.getItem(k);
    if (saved === null) {
      localStorage.setItem(k, String(current));
      setBaseline(current);
    }
  }, [keyName, current]);

  return baseline;
}

/* ---------- big stoplight (≈80px) ---------- */
function Stoplight({ label, value, baseline, unit = "%" }) {
  const v = clamp01(value);
  const delta = Number.isFinite(v) && Number.isFinite(baseline) ? v - baseline : NaN;

  const tone = toneFor(v);
  // use TRUE yellow (not orange)
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
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:8, minWidth:120 }}>
      {/* 80px circle */}
      <div
        title={`${label}: ${pct(v)}${unit}`}
        style={{
          width: 84, height: 84, borderRadius: "50%",
          background: colors.bg,
          boxShadow: `0 0 22px ${colors.glow}`,
          display:"flex", alignItems:"center", justifyContent:"center",
          border: "6px solid #0c1320"
        }}
      >
        <div style={{ fontWeight:800, fontSize:18, color:"#0b1220" }}>
          {pct(v)}{unit === "%" ? "%" : ""}
        </div>
      </div>

      {/* label + delta */}
      <div style={{ textAlign:"center", lineHeight:1.15 }}>
        <div className="small" style={{ fontWeight:700 }}>{label}</div>
        <div className={arrowClass} style={{ marginTop:4 }}>
          {arrow} {Number.isFinite(delta) ? delta.toFixed(1) : "0.0"}{unit === "%" ? "%" : ""}
        </div>
      </div>
    </div>
  );
}

/* ---------- legend mini panel (always visible, right side) ---------- */
function LegendMini() {
  const Dot = ({ tone }) => {
    const c = tone === "ok" ? "#22c55e" : tone === "warn" ? "#fbbf24" : "#ef4444";
    return <span style={{
      display:"inline-block", width:10, height:10, borderRadius:"50%", background:c, marginRight:6
    }}/>;
  };
  return (
    <div className="panel" style={{ padding:10, minWidth:260 }}>
      <div className="panel-title small" style={{ marginBottom:8 }}>Legend</div>

      <div className="small" style={{ marginBottom:8 }}>
        <div><Dot tone="ok" /> <strong>Green</strong>: strong / favorable</div>
        <div><Dot tone="warn" /> <strong>Yellow</strong>: neutral / mixed</div>
        <div><Dot tone="danger" /> <strong>Red</strong>: weak / unfavorable</div>
      </div>

      <div className="small" style={{ marginBottom:8 }}>
        <div><strong>Arrows</strong> — ⬆ up vs baseline, → flat (&lt;0.5%), ⬇ down</div>
      </div>

      <div className="small">
        <div style={{ marginBottom:6 }}><strong>Breadth / Momentum / Squeeze</strong><br/>
          Green &gt; 60%, Yellow 40–60%, Red &lt; 40%
        </div>
        <div style={{ marginBottom:6 }}><strong>Liquidity (PSI)</strong><br/>
          Green &gt; 80, Yellow 50–80, Red &lt; 50
        </div>
        <div><strong>Volatility</strong><br/>
          Green = low, Yellow = medium, Red = high
        </div>
      </div>
    </div>
  );
}

export default function RowMarketOverview() {
  const { data, loading, error } = useDashboardPoll?.(5000) ?? { data:null, loading:false, error:null };

  // read values safely
  const od = data?.odometers ?? {};
  const gg = data?.gauges ?? {};

  const breadth   = Number(od?.breadthOdometer ?? 50);
  const momentum  = Number(od?.momentumOdometer ?? 50);
  const squeeze   = Number.isFinite(od?.squeezeCompressionPct) ? od.squeezeCompressionPct
                  : Number.isFinite(gg?.fuelPct) ? gg.fuelPct : 50;

  // Liquidity (PSI) from gauges.oil.psi or oilPsi
  const liquidity = Number.isFinite(gg?.oil?.psi) ? gg.oil.psi
                  : Number.isFinite(gg?.oilPsi)    ? gg.oilPsi
                  : NaN;

  // Volatility — if you have a real field, map it here. Else leave NaN (shows "—")
  // Example placeholder: map waterTemp (degF) into a 0..100 index if present
  const rawVol = Number.isFinite(gg?.waterTemp) ? gg.waterTemp : NaN;
  const volatility = Number.isFinite(rawVol)
    ? clamp01(((rawVol - 160) / (260 - 160)) * 100) // map 160–260°F to 0–100 index
    : NaN;

  // baselines for delta arrows
  const breadthBaseline   = useDailyBaseline("breadth", breadth);
  const momentumBaseline  = useDailyBaseline("momentum", momentum);
  const squeezeBaseline   = useDailyBaseline("squeeze", squeeze);
  const liquidityBaseline = useDailyBaseline("liquidity", liquidity);
  const volBaseline       = useDailyBaseline("volatility", volatility);

  // top headline meter (composite) — optional
  const expansion = 100 - clamp01(squeeze);
  const baseMeter = 0.4 * breadth + 0.4 * momentum + 0.2 * expansion;
  const meter = Math.round(squeeze >= 90 ? 45 + (baseMeter - 50) * 0.30 : baseMeter);
  const meterTone = toneFor(meter);

  return (
    <section id="row-2" className="panel" style={{ padding: 10 }}>
      <div className="panel-head">
        <div className="panel-title">Market Meter — Stoplights</div>
        <div className="spacer" />
        <span className="small muted">Always-visible legend on the right</span>
      </div>

      {/* headline meter bar (optional) */}
      <div className={`kpi-bar ${meterTone}`} style={{ margin: "10px 0 6px 0" }}>
        <div className="kpi-fill" style={{ width: `${clamp01(meter)}%` }} />
      </div>
      <div className="small muted" style={{ display:"flex", justifyContent:"space-between" }}>
        <span>Meter: <strong>{pct(meter)}%</strong></span>
        {squeeze >= 90 && <span>Major squeeze — direction unknown</span>}
      </div>

      {/* Horizontal: 5 stoplights left, legend mini-panel right */}
      <div style={{
        display:"grid",
        gridTemplateColumns:"1fr auto", // left cluster, right legend
        gap:12, marginTop:12, alignItems:"start"
      }}>
        {/* left cluster: five stoplights */}
        <div style={{ display:"flex", gap:14, flexWrap:"wrap" }}>
          <Stoplight label="Breadth"   value={breadth}   baseline={breadthBaseline} />
          <Stoplight label="Momentum"  value={momentum}  baseline={momentumBaseline} />
          <Stoplight label="Squeeze"   value={squeeze}   baseline={squeezeBaseline} />
          <Stoplight label="Liquidity" value={liquidity} baseline={liquidityBaseline} unit="" />
          <Stoplight label="Volatility" value={volatility} baseline={volBaseline} />
        </div>

        {/* right: legend mini panel */}
        <LegendMini />
      </div>

      {loading && <div className="small muted" style={{ marginTop: 8 }}>Loading…</div>}
      {error   && <div className="small muted" style={{ marginTop: 8 }}>Failed to load.</div>}
    </section>
  );
}
