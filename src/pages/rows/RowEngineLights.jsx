import React, { useEffect, useMemo, useState } from "react";

/* -----------------------------------------------------------
   Data source & utils
----------------------------------------------------------- */
function resolveLiveIntraday() {
  const env = (process.env.REACT_APP_INTRADAY_URL || "").trim();
  if (env) return env.replace(/\/+$/, "");
  const w = typeof window !== "undefined" ? (window.__LIVE_INTRADAY_URL || "") : "";
  if (w) return String(w).trim().replace(/\/+$/, "");
  return "https://frye-market-backend-1.onrender.com/live/intraday";
}

function fmtTime(ts) {
  if (!ts) return "—";
  try {
    const d = new Date(ts);
    return d.toLocaleString();
  } catch {
    return String(ts);
  }
}

const CHIP = {
  green:   { bg: "#16a34a", fg: "#0b1220", bd: "#0b7a32" },
  red:     { bg: "#ef4444", fg: "#fff0f0", bd: "#b91c1c" },
  purple:  { bg: "#0b1220", fg: "#93c5fd", bd: "#334155" },
  warn:    { bg: "#facc15", fg: "#111827", bd: "#ca8a04" },
  neutral: { bg: "#0b0f17", fg: "#9ca3af", bd: "#1f2937" },
};

function Pill({ text, tone = "neutral" }) {
  const c = CHIP[tone] || CHIP.neutral;
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 10px",
        marginRight: 6,
        marginBottom: 6,
        borderRadius: 999,
        border: `1px solid ${c.bd}`,
        background: c.bg,
        color: c.fg,
        fontSize: 12,
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
      title={text}
    >
      {text}
    </div>
  );
}

function TrendCard({ title, trend }) {
  const state = (trend?.state || "neutral").toString();
  const c =
    state === "green" ? CHIP.green :
    state === "red"   ? CHIP.red   :
    state === "purple"? CHIP.purple:
                        CHIP.neutral;
  return (
    <div
      style={{
        border: "1px solid #1f2937",
        background: "#0b0f14",
        borderRadius: 10,
        padding: 12,
        minWidth: 260,
        maxWidth: 360,
        flex: "1 1 300px"
      }}
    >
      <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
        <div
          style={{
            width: 10, height: 10, borderRadius: 999,
            background: c.bg, border: `1px solid ${c.bd}`, marginRight: 8
          }}
        />
        <div style={{ fontWeight: 700, color: "#d1d5db" }}>{title}</div>
      </div>
      <div style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.45 }}>
        <div>
          <strong>State:</strong>{" "}
          <span style={{ background: c.bg, color: c.fg, padding: "1px 6px", borderRadius: 6 }}>
            {state.toUpperCase()}
          </span>
        </div>
        {trend?.reason && (
          <div><strong>Reason:</strong> {trend.reason}</div>
        )}
        <div><strong>Updated:</strong> {fmtTime(trend?.updatedAt)}</div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------
   Mapping logic: convert your signal keys → compact pill labels
   Supports both your original (`sigBreakout`, `sigCompression`, etc.)
   and your new 10m/1h pills (`sigEMA10BullCross`, `sigSMI1h_BullCross`, ...)
----------------------------------------------------------------- */
function mapSignalToPill(key, obj) {
  const on = obj?.active === true;
  if (!on) return null;

  const nm = (key || "").toLowerCase();
  const reason = (obj?.reason || "").toLowerCase();

  // hard-coded common keys → nice short label + tone
  const direct = {
    sigbreakout:        { label: "Breakout",     tone: "green" },
    sigcompression:     { label: "Compression",  tone: "warn" },
    sigovertheat:       { label: "Overheat",     tone: "red" },
    sigvolatilityhigh:  { label: "Vol High",     tone: "warn" },
    siglowliquidity:    { label: "Low Liquidity",tone: "warn" },
    sigoverallbull:     { label: "Overall Bull", tone: "green" },
    sigoverallbear:     { label: "Overall Bear", tone: "red" },
    sigema10bullcross:  { label: "10m EMA↑",     tone: "green" },
    sigema10bearcross:  { label: "10m EMA↓",     tone: "red" },
    sigaccelup:         { label: "Accel↑",       tone: "green" },
    sigacceldown:       { label: "Accel↓",       tone: "red" },
    sigsmi1h_bullcross: { label: "1h SMI↑",      tone: "green" },
    sigsmi1h_bearcross: { label: "1h SMI↓",      tone: "red" },
    sigema1h_bullcross: { label: "1h EMA↑",      tone: "green" },
    sigema1h_bearcross: { label: "1h EMA↓",      tone: "red" },
  };
  if (direct[nm]) return direct[nm];

  // Fallback heuristics (covers any new names)
  if (/bull|up|long/.test(nm))  return { label: key, tone: "green" };
  if (/bear|down|short/.test(nm)) return { label: key, tone: "red" };
  if (/tight|squeez|purple/.test(nm) || /tight/.test(reason)) return { label: "Tight", tone: "purple" };
  if (/overheat|risk\s*off|vol.?high/.test(nm) || /overheat|risk/.test(reason)) return { label: key, tone: "red" };
  return { label: key, tone: "neutral" };
}

/* -----------------------------------------------------------
   Component
----------------------------------------------------------- */
export default function RowEngineLights() {
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    const url = `${resolveLiveIntraday()}?v=${Date.now()}`;
    (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const j = await res.json();
        if (!alive) return;
        setPayload(j);
      } catch (e) {
        setError(String(e));
      }
    })();
    return () => { alive = false; };
  }, []);

  const intraday  = payload?.intraday || {};
  const strategy  = intraday?.strategy || {};
  const signals   = payload?.engineLights?.signals || {};
  const updatedAt = payload?.updated_at || payload?.updated_at_utc || strategy?.trend10m?.updatedAt || null;

  const pills = useMemo(() => {
    const arr = [];
    Object.keys(signals || {}).forEach((k) => {
      const pill = mapSignalToPill(k, signals[k]);
      if (pill) arr.push(pill);
    });
    // keep stable order by label then tone
    return arr.sort((a, b) => a.label.localeCompare(b.label));
  }, [signals]);

  // Extract trends (uses intraday.strategy.trend10m, trend1h if mirrored, and trendDaily)
  const trend10 = strategy?.trend10m || null;
  const trend1h = strategy?.trend1h || null;
  const trendD  = strategy?.trendDaily || payload?.strategy?.trendDaily || null;

  return (
    <section style={{ padding: "8px 12px 8px 12px" }}>
      {error && <div style={{ color: "#ef4444", marginBottom: 8 }}>Engine Lights error: {error}</div>}

      {/* Left: Pills / Right: Trend cards */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        {/* Left column: signal pills */}
        <div style={{ flex: "2 1 560px", minWidth: 520 }}>
          <div style={{ color: "#9ca3af", fontSize: 12, marginBottom: 6 }}>
            <strong>Signals</strong> (updated {fmtTime(updatedAt)})
          </div>
          <div
            style={{
              border: "1px solid #1f2937",
              background: "#0b0f14",
              borderRadius: 8,
              padding: 8,
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              minHeight: 48,
            }}
          >
            {pills.length === 0 ? (
              <div style={{ color: "#9ca3af", fontSize: 12 }}>No active signals</div>
            ) : (
              pills.map((p, idx) => <Pill key={`${p.label}-${idx}`} text={p.label} tone={p.tone} />)
            )}
          </div>
        </div>

        {/* Right column: trend cards */}
        <div
          style={{
            flex: "1 1 480px",
            minWidth: 420,
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            justifyContent: "flex-end",
          }}
        >
          <TrendCard title="10-Minute Trend" trend={trend10} />
          <TrendCard title="1-Hour Trend"   trend={trend1h} />
          <TrendCard title="Daily Trend"    trend={trendD} />
        </div>
      </div>
    </section>
  );
}
