import React, { useEffect, useMemo, useState } from "react";

/* ---------------------------------------
   Data source
----------------------------------------*/
function resolveLiveIntraday() {
  const env = (process.env.REACT_APP_INTRADAY_URL || "").trim();
  if (env) return env.replace(/\/+$/, "");
  const w = typeof window !== "undefined" ? (window.__LIVE_INTRADAY_URL || "") : "";
  return (w || "https://frye-market-backend-1.onrender.com/live/intraday");
}

function fmtTime(ts) {
  if (!ts) return "—";
  try {
    const d = new Date(ts);
    return d.toLocaleString();
  } catch { return String(ts); }
}

/* ---------------------------------------
   Colors & small UI bits
----------------------------------------*/
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

function TrendBox({ title, trend }) {
  const state = (trend?.state || "neutral").toLowerCase();
  const c =
    state === "green" ? CHIP.green :
    state === "red"   ? CHIP.red   :
    state === "purple" ? CHIP.purple : CHIP.neutral;

  return (
    <div
      style={{
        border: "1px solid #1f2937",
        background: "#0b0f14",
        borderRadius: 10,
        padding: 10,
        minWidth: 220,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
        <div
          style={{
            width: 10, height: 10, borderRadius: 999,
            background: c.bg, border: `1px solid ${c.bd}`, marginRight: 8
          }}
        />
        <div style={{ fontWeight: 700, color: "#d1d5db", fontSize: 12 }}>{title}</div>
      </div>
      <div style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.4 }}>
        <div>
          <strong>State:</strong>{" "}
          <span style={{ background: c.bg, color: c.fg, padding: "1px 6px", borderRadius: 6 }}>
            {state.toUpperCase()}
          </span>
        </div>
        <div><strong>Updated:</strong> {fmtTime(trend?.updatedAt)}</div>
      </div>
    </div>
  );
}

/* ---------------------------------------
   Map signal keys → pills (supports old + new)
----------------------------------------*/
const SIGNAL_MAP = {
  // 10m
  sigEMA10BullCross:  { text: "10m EMA↑",  tone: "green" },
  sigEMA10BearCross:  { text: "10m EMA↓",  tone: "red"   },
  sigAccelUp:         { text: "Accel↑",    tone: "green" },
  sigAccelDown:       { text: "Accel↓",    tone: "red"   },
  sigOverallBull:     { text: "Overall↑",  tone: "green" },
  sigOverallBear:     { text: "Overall↓",  tone: "red"   },

  // 1h (if you mirror them into intraday)
  sigSMI1h_BullCross: { text: "1h SMI↑",   tone: "green" },
  sigSMI1h_BearCross: { text: "1h SMI↓",   tone: "red"   },
  sigEMA1h_BullCross: { text: "1h EMA↑",   tone: "green" },
  sigEMA1h_BearCross: { text: "1h EMA↓",   tone: "red"   },

  // legacy / extra
  sigBreakout:        { text: "Breakout",  tone: "green" },
  sigCompression:     { text: "Compression", tone: "warn" },
  sigOverheat:        { text: "Overheat",  tone: "red"   },
  sigVolatilityHigh:  { text: "Vol High",  tone: "warn"  },
  sigLowLiquidity:    { text: "Low Liquidity", tone: "warn" },
  sigSqueezeTight:    { text: "Tight",     tone: "purple" },
};

/* ---------------------------------------
   Main component
----------------------------------------*/
export default function RowEngineLights() {
  const [payload, setPayload] = useState(null);
  const [loadErr, setLoadErr] = useState("");

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
        setLoadErr(String(e));
      }
    })();
    return () => { alive = false; };
  }, []);

  const intraday = payload?.intraday || {};
  const strategy = intraday?.strategy || {};
  const signals  = payload?.engineLights?.signals || {};

  const trend10  = strategy?.trend10m || null;
  const trend1h  = strategy?.trend1h || null;   // mirrored by 1h job (optional)
  const trendD   = strategy?.trendDaily || payload?.strategy?.trendDaily || null;

  const updatedAt =
    payload?.updated_at ||
    payload?.updated_at_utc ||
    strategy?.trend10m?.updatedAt ||
    null;

  const pills = useMemo(() => {
    const list = [];
    Object.entries(signals || {}).forEach(([k, obj]) => {
      if (!obj?.active) return;
      const def = SIGNAL_MAP[k] || null;
      if (def) list.push(def);
    });
    return list.sort((a, b) => (a.text || "").localeCompare(b.text || ""));
  }, [signals]);

  return (
    <section style={{ padding: "8px 12px 4px 12px" }}>
      {loadErr && <div style={{ color: "#ef4444", marginBottom: 8 }}>Engine Lights error: {loadErr}</div>}

      <div
        /* One single row; left = pills, right = trends; no extra full-width container */
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(540px, 1fr) minmax(420px, 1fr)",
          gap: 16,
          alignItems: "start",
        }}
      >
        {/* Pills (left) */}
        <div>
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
              pills.map((p, i) => <Pill key={`${p.text}-${i}`} text={p.text} tone={p.tone} />)
            )}
          </div>
        </div>

        {/* Trend capsules (right) */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <TrendBox title="10-Minute Trend" trend={trend10} />
          <TrendBox title="1-Hour Trend"    trend={trend1h} />
          <TrendBox title="Daily Trend"      trend={trendD} />
        </div>
      </div>
    </section>
  );
}
