import React, { useEffect, useState } from "react";
import { useDashboardPoll } from "../../lib/dashboardApi";

/* ---------- helpers ---------- */
const clamp01 = (n) => Math.max(0, Math.min(100, Number(n)));
const pct = (n) => (Number.isFinite(n) ? n.toFixed(1) : "—");
const toneFor = (v) => (v >= 60 ? "ok" : v >= 40 ? "warn" : "danger");

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
function Stoplight({ label, value, baseline }) {
  const v = clamp01(value);
  const delta = Number.isFinite(v) && Number.isFinite(baseline) ? v - baseline : NaN;

  const tone = toneFor(v);
  const colors = {
    ok:    { bg:"#16a34a", glow:"rgba(22,163,74,.45)"  },
    warn:  { bg:"#f59e0b", glow:"rgba(245,158,11,.45)" },
    danger:{ bg:"#ef4444", glow:"rgba(239,68,68,.45)"  }
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
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:8, minWidth:110 }}>
      {/* 80px circle */}
      <div
        title={`${label}: ${pct(v)}%`}
        style={{
          width: 84, height: 84, borderRadius: "50%",
          background: colors.bg,
          boxShadow: `0 0 22px ${colors.glow}`,
          display:"flex", alignItems:"center", justifyContent:"center",
          border: "6px solid #0c1320"
        }}
      >
        <div style={{ fontWeight:800, fontSize:18, color:"#0b1220" }}>
          {pct(v)}%
        </div>
      </div>

      {/* label + delta */}
      <div style={{ textAlign:"center" }}>
        <div className="small" style={{ fontWeight:700 }}>{label}</div>
        <div className={arrowClass} style={{ marginTop:4 }}>
          {arrow} {Number.isFinite(delta) ? delta.toFixed(1) : "0.0"}%
        </div>
      </div>
    </div>
  );
}

/* ---------- small KPI bar tile ---------- */
function KpiTile({ title, value }) {
  const v = clamp01(value);
  const tone = toneFor(v);
  return (
    <div className="panel">
      <div className="panel-title small">{title}</div>
      <div className={`kpi-bar ${tone}`} style={{ marginTop: 8 }}>
        <div className="kpi-fill" style={{ width: `${v}%` }} />
      </div>
      <div className="small muted" style={{ marginTop: 6 }}>{pct(v)}%</div>
    </div>
  );
}

export default function RowMarketOverview() {
  const { data, loading, error } = useDashboardPoll?.(5000) ?? { data:null, loading:false, error:null };

  // read values
  const od = data?.odometers ?? {};
  const gg = data?.gauges ?? {};

  const breadth   = Number(od?.breadthOdometer ?? 50);
  const momentum  = Number(od?.momentumOdometer ?? 50);
  const squeeze   = Number.isFinite(od?.squeezeCompressionPct) ? od.squeezeCompressionPct
                  : Number.isFinite(gg?.fuelPct) ? gg.fuelPct : 50;
  const liquidity = Number(gg?.oilPsi ?? gg?.oil?.psi ?? NaN);
  // If your backend exposes volatility explicitly, map here; else leave NaN (shows "—%")
  const volatility = Number(gg?.waterTemp ?? NaN); // placeholder: replace with real metric when available

  // baselines for delta arrows
  const breadthBaseline = useDailyBaseline("breadth", breadth);

  // meter headline (optional)
  const expansion = 100 - clamp01(squeeze);
  const baseMeter = 0.4 * breadth + 0.4 * momentum + 0.2 * expansion;
  const meter = Math.round(squeeze >= 90 ? 45 + (baseMeter - 50) * 0.30 : baseMeter);
  const meterTone = toneFor(meter);

  return (
    <section id="row-2" className="panel" style={{ padding: 10 }}>
      <div className="panel-head">
        <div className="panel-title">Market Meter — Stoplight Test</div>
        <div className="spacer" />
        <span className="small muted">Breadth stoplight • others stay as bars</span>
      </div>

      {/* headline meter bar (optional) */}
      <div className={`kpi-bar ${meterTone}`} style={{ margin: "10px 0 6px 0" }}>
        <div className="kpi-fill" style={{ width: `${clamp01(meter)}%` }} />
      </div>
      <div className="small muted" style={{ display:"flex", justifyContent:"space-between" }}>
        <span>Meter: <strong>{pct(meter)}%</strong></span>
        {squeeze >= 90 && <span>Major squeeze — direction unknown</span>}
      </div>

      {/* HORIZONTAL CLUSTER: Breadth stoplight + other KPI bars */}
      <div style={{ display:"grid", gridTemplateColumns:"auto 1fr 1fr 1fr 1fr", gap: 12, alignItems:"center", marginTop: 12 }}>
        {/* BIG STOPLIGHT (Breadth) */}
        <Stoplight label="Breadth" value={breadth} baseline={breadthBaseline} />

        {/* Other KPIs as bars for now (so you can compare) */}
        <KpiTile title="Momentum"  value={momentum} />
        <KpiTile title="Squeeze (Compression)" value={squeeze} />
        <KpiTile title="Liquidity (PSI)" value={liquidity} />
        <KpiTile title="Volatility" value={volatility} />
      </div>

      {loading && <div className="small muted" style={{ marginTop: 8 }}>Loading…</div>}
      {error   && <div className="small muted" style={{ marginTop: 8 }}>Failed to load.</div>}
    </section>
  );
}
