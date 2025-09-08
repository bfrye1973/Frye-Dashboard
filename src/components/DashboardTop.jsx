// src/components/DashboardTop.jsx
// Beginner-friendly top: Market Meter + KPI Tiles (default) with mode toggle.
// Modes: "meter" (recommended), "lights", "arrows"
// Uses lastGood fallback, no backend changes.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useDashboardPoll } from "../lib/dashboardApi";

/* ---------- helpers ---------- */
const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Number(n) || 0));
const fmt = (n, d = 0) => (Number.isFinite(Number(n)) ? Number(n).toFixed(d) : "—");
const tone = (v) => (clamp(v) >= 60 ? "ok" : clamp(v) >= 40 ? "warn" : "danger");

// derive a simple label from value thresholds
const toneLabel = (v) => (clamp(v) >= 60 ? "Bullish" : clamp(v) >= 40 ? "Neutral" : "Bearish");

// compute delta (today minus previous)
const delta = (now, prev) =>
  Number.isFinite(Number(now)) && Number.isFinite(Number(prev))
    ? Number(now) - Number(prev)
    : 0;

/* ---------- Market Meter (0–100) ---------- */
function MarketMeter({ value = 50, delta = 0, label = "Market Meter" }) {
  const t = tone(value);
  return (
    <div className="panel" style={{ padding: 12, border: "1px solid #1f2a44", borderRadius: 12, background: "#0e1526" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ fontWeight: 700 }}>{label}</div>
        <div className="small muted">Bearish &larr; 0 … 100 &rarr; Bullish</div>
      </div>
      <div style={{ position: "relative", height: 16, border: "1px solid #334155", borderRadius: 8, background: "#0b1220", overflow: "hidden" }}>
        <div className={`meter-fill ${t}`} style={{ width: `${clamp(value)}%`, height: "100%" }} />
        <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", fontWeight: 800 }}>
          {fmt(value)}
        </div>
      </div>
      <div className="small muted" style={{ marginTop: 6 }}>
        Δ day:{" "}
        <b style={{ color: delta > 0 ? "#22c55e" : delta < 0 ? "#ef4444" : "#93a3b8" }}>
          {delta > 0 ? "+" : ""}
          {fmt(delta, 1)}
        </b>
      </div>
    </div>
  );
}

/* ---------- KPI Tile ---------- */
function KpiTile({ title, value = 0, unit = "", hint = "" }) {
  const t = tone(value);
  return (
    <div className="panel" style={{ padding: 12, border: "1px solid #1f2a44", borderRadius: 12, background: "#0e1526" }}>
      <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 6 }}>{title}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <div style={{ fontSize: 28, fontWeight: 800 }}>{fmt(value)}</div>
        <div style={{ opacity: 0.75 }}>{unit}</div>
      </div>
      <div className={`kpi-bar ${t}`} style={{ marginTop: 8 }}>
        <div className="kpi-fill" style={{ width: `${clamp(value)}%` }} />
      </div>
      <div className="small muted" style={{ marginTop: 6 }}>{hint || toneLabel(value)}</div>
    </div>
  );
}

/* ---------- Traffic Lights (mode "lights") ---------- */
function CircleLight({ label, value }) {
  const t = tone(value);
  const bg = t === "ok" ? "#16a34a" : t === "warn" ? "#f59e0b" : "#ef4444";
  return (
    <div className="panel" style={{ padding: 12, border: "1px solid #1f2a44", borderRadius: 12, background: "#0e1526", display: "grid", gap: 8, placeItems: "center" }}>
      <div style={{ width: 64, height: 64, borderRadius: "50%", background: bg, boxShadow: `0 0 18px ${bg}` }} />
      <div style={{ fontWeight: 700 }}>{label}</div>
      <div className="small muted">{fmt(value)}</div>
    </div>
  );
}

/* ---------- Arrow Scorecards (mode "arrows") ---------- */
function ArrowCard({ title, value, delta }) {
  const t = tone(value);
  const arrow = delta > 0 ? "↑" : delta < 0 ? "↓" : "→";
  const color = delta > 0 ? "#22c55e" : delta < 0 ? "#ef4444" : "#eab308";
  return (
    <div className="panel" style={{ padding: 12, border: "1px solid #1f2a44", borderRadius: 12, background: "#0e1526" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <div style={{ fontSize: 28, fontWeight: 800 }}>{fmt(value)}</div>
        <div style={{ fontSize: 22, color }}>{arrow}</div>
      </div>
      <div className={`kpi-bar ${t}`} style={{ marginTop: 8 }}>
        <div className="kpi-fill" style={{ width: `${clamp(value)}%` }} />
      </div>
      <div className="small muted" style={{ marginTop: 6 }}>{title}</div>
    </div>
  );
}

/* ---------- DEFAULT EXPORT ---------- */
export default function DashboardTop() {
  const { data, error } = useDashboardPoll(5000);

  // remember last good so the top doesn't vanish on a transient 500
  const [lastGood, setLastGood] = useState(null);
  useEffect(() => { if (data) setLastGood(data); }, [data]);
  const working = data || lastGood || null;

  // simple mode toggle (default: meter + tiles)
  const [mode, setMode] = useState("meter"); // "meter" | "lights" | "arrows"

  if (!working) {
    return (
      <div className="panel" style={{ padding: 12, border: "1px solid #1f2a44", borderRadius: 12, background: "#0e1526" }}>
        <div className="small muted">(Waiting for data…)</div>
      </div>
    );
  }

  const summary   = working.summary   || {};
  const odom     = working.odometers || {};
  const gauges   = working.gauges    || {};
  const signals  = working.signals   || {};

  // derive primary values
  const breadth  = clamp(odom.breadthOdometer);
  const momentum = clamp(odom.momentumOdometer);
  const squeeze  = clamp(gauges.fuelPct); // squeeze pressure %

  // composite suggestion: avg of breadth, momentum, (100 - squeeze)
  const composite = (breadth + momentum + clamp(100 - squeeze)) / 3;

  // crude deltas using previous values (stored in ref)
  const prevRef = useRef({ breadth, momentum, squeeze, composite });
  const deltas = useMemo(() => {
    const d = {
      breadth: delta(breadth, prevRef.current.breadth),
      momentum: delta(momentum, prevRef.current.momentum),
      squeeze: delta(squeeze, prevRef.current.squeeze),
      composite: delta(composite, prevRef.current.composite),
    };
    prevRef.current = { breadth, momentum, squeeze, composite };
    return d;
  }, [breadth, momentum, squeeze, composite]);

  // engine lights — only active, sorted by rough importance
  const lightOrder = [
    "sigBreakout",
    "sigOverextended",
    "sigRiskAlert",
    "sigDivergence",
    "sigDistribution",
    "sigLowLiquidity",
    "sigOverheat",
    "sigTurbo",
  ];
  const labelMap = {
    sigBreakout: "Breakout",
    sigOverextended: "Overextended",
    sigRiskAlert: "Risk Alert",
    sigDivergence: "Divergence",
    sigDistribution: "Distribution",
    sigLowLiquidity: "Liquidity Weak",
    sigOverheat: "Squeeze",
    sigTurbo: "Turbo",
  };
  const iconMap = {
    sigBreakout: "📈",
    sigOverextended: "🚀",
    sigRiskAlert: "⚡",
    sigDivergence: "↔️",
    sigDistribution: "📉",
    sigLowLiquidity: "💧",
    sigOverheat: "⏳",
    sigTurbo: "⚡",
  };
  const activeLights = lightOrder
    .map(k => ({ key: k, data: signals?.[k] }))
    .filter(x => x.data && x.data.active);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {/* mode toggle */}
      <div className="panel" style={{ padding: 8, border: "1px solid #1f2a44", borderRadius: 12, background: "#0e1526" }}>
        <div style={{ display: "flex", gap: 8 }}>
          {["meter", "lights", "arrows"].map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                padding: "6px 10px",
                borderRadius: 8,
                border: mode === m ? "1px solid #60a5fa" : "1px solid #334155",
                background: mode === m ? "#111827" : "#0b1220",
                color: "#e5e7eb",
                cursor: "pointer",
                fontSize: 12
              }}
            >
              {m === "meter" ? "Meter + Tiles" : m === "lights" ? "Traffic Lights" : "Arrow Scorecards"}
            </button>
          ))}
        </div>
      </div>

      {/* main mode content */}
      {mode === "meter" ? (
        <>
          <MarketMeter value={composite} delta={deltas.composite} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            <KpiTile title="Breadth"  value={breadth}  hint={summary.breadthState} />
            <KpiTile title="Momentum" value={momentum} hint={summary.momentumState} />
            <KpiTile title="Squeeze"  value={squeeze}  unit="%" hint="Lower is tighter" />
          </div>
        </>
      ) : mode === "lights" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          <CircleLight label="Breadth"  value={breadth} />
          <CircleLight label="Momentum" value={momentum} />
          <CircleLight label="Squeeze"  value={squeeze} />
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          <ArrowCard title="Breadth"  value={breadth}  delta={deltas.breadth} />
          <ArrowCard title="Momentum" value={momentum} delta={deltas.momentum} />
          <ArrowCard title="Squeeze"  value={squeeze}  delta={deltas.squeeze} />
        </div>
      )}

      {/* Engine Lights — only active signals */}
      <div className="panel" style={{ padding: 10, border: "1px solid #1f2a44", borderRadius: 12, background: "#0e1526" }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Engine Lights</div>
        {activeLights.length === 0 ? (
          <div className="small muted">(No active signals)</div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {activeLights.map(({ key, data }) => (
              <span
                key={key}
                style={{
                  display: "inline-flex", gap: 6, alignItems: "center",
                  padding: "4px 8px", borderRadius: 999, border: "1px solid #334155",
                  background: "#0b1220", color: "#e5e7eb", fontSize: 12
                }}
                title={key}
              >
                <span role="img" aria-hidden>{iconMap[key]}</span>
                <span>{labelMap[key]}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {error ? <div className="small text-danger">Error: {String(error?.message || error)}</div> : null}
    </div>
  );
}
