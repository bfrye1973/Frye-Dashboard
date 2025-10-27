import React, { useEffect, useMemo, useState } from "react";

/* ------------------ Data Source ------------------ */
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

/* ------------------ Pill + Colors ------------------ */
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

/* ------------------ Trend Capsules ------------------ */
function TrendCapsule({ label, trend }) {
  const state = (trend?.state || "neutral").toLowerCase();
  const c =
    state === "green" ? CHIP.green
    : state === "red" ? CHIP.red
    : state === "purple" ? CHIP.purple
    : CHIP.neutral;

  return (
    <div
      style={{
        border: "1px solid #1f2937",
        background: "#0b0f14",
        borderRadius: 10,
        display: "grid",
        gridTemplateColumns: "auto 1fr",
        gridColumnGap: 10,
        gridRowGap: 4,
        padding: "8px 10px",
        minWidth: 220,
      }}
    >
      <div
        style={{
          gridColumn: "1 / span 1",
          gridRow: "1 / span 2",
          width: 12,
          height: 12,
          marginTop: 2,
          borderRadius: "50%",
          background: c.bg,
          border: `1px solid ${c.bd}`,
        }}
        title={state.toUpperCase()}
      />
      <div style={{ gridColumn: "2 / span 1", fontSize: 12, color: "#d1d5db", fontWeight: 700 }}>
        {label}
      </div>
      <div style={{ gridColumn: "2 / span 1", fontSize: 11, color: "#9ca3af" }}>
        <div><strong>State:</strong> <span style={{ color: c.fg, background: c.bg, padding: "0 6px", borderRadius: 6 }}>{state.toUpperCase()}</span></div>
        <div><strong>Updated:</strong> {fmtTime(trend?.updatedAt)}</div>
      </div>
    </div>
  );
}

/* map signal keys to pill labels; supports both new + legacy keys */
const SIGNAL_MAP = {
  sigEMA10BullCross:  { text: "10m EMA↑", tone: "green" },
  sigEMA10BearCross:  { text: "10m EMA↓", tone: "red"   },
  sigAccelUp:         { text: "Accel↑",   tone: "green" },
  sigAccelDown:       { text: "Accel↓",   tone: "red"   },
  sigOverallBull:     { text: "Overall Bull", tone: "green" },
  sigOverallBear:     { text: "Overall Bear", tone: "red"   },
  // 1h
  sigSMI1h_BullCross: { text: "1h SMI↑", tone: "green" },
  sigSMI1h_BearCross: { text: "1h SMI↓", tone: "red"   },
  sigEMA1h_BullCross: { text: "1h EMA↑", tone: "green" },
  sigEMA1h_BearCross: { text: "1h EMA↓", tone: "red"   },
  // common/original names
  sigBreakout:        { text: "Breakout",    tone: "green" },
  sigCompression:     { text: "Compression", tone: "warn"  },
  sigOverheat:        { text: "Overheat",    tone: "red"   },
  sigVolatilityHigh:  { text: "Vol High",    tone: "warn"  },
  sigLowLiquidity:    { text: "Low Liquidity", tone: "warn" },
  sigSqueezeTight:    { text: "Tight",       tone: "purple" },
};

/* ------------------ Component ------------------ */
export default function RowEngineLights() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    const url = `${resolveLiveIntraday()}?v=${Date.now()}`;
    (async () => {
      try {
        const r = await fetch(url);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = await r.json();
        if (!alive) return;
        setData(j);
      } catch (e) {
        setErr(String(e));
      }
    })();
    return () => { alive = false; };
  }, []);

  const intraday = data?.intraday || {};
  const strategy = intraday?.strategy || {};
  const signals  = data?.engineLights?.signals || {};

  const trend10 = strategy?.trend10m || null;
  const trend1h  = strategy?.trend1h || null;
  const trendD   = strategy?.trendDaily || data?.strategy?.trendDaily || null; // daily mirror
  const updatedAt =
    data?.updated_at || data?.updated_at_utc ||
    strategy?.trend10m?.updatedAt ||
    null;

  const pills = useMemo(() => {
    const list = [];
    Object.entries(signals || {}).forEach(([k, obj]) => {
      if (!obj?.active) return;
      const m = SIGNAL_MAP[k.toString()];
      if (m) list.push(m);
    });
    // stable deterministic order: by label then tone
    return list.sort((a, b) => (a.text || "").localeCompare(b.text || ""));
  }, [signals]);

  return (
    <section style={{ padding: "8px 12px 4px 12px" }}>
      {err && <div style={{ color: "#ef4444", marginBottom: 8 }}>Engine Lights error: {String(err)}</div>}

      {/* 2-column grid, single row; left pills, right trend capsules */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(520px, 1fr) minmax(420px, 1fr)",
          gap: 16,
          alignItems: "start",
        }}
      >
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
              pills.map((p, i) => (
                <Pill key={`${p.text}-${i}`} text={p.text} tone={p.tone} />
              ))
            )}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            justifyContent: "flex-end",
          }}
        >
          <TrendCard title="10-Minute Trend" trend={trend10} />
          <TrendCard title="1-Hour Trend" trend={trend1h} />
          <TrendCard title="Daily Trend" trend={trendD} />
        </div>
      </div>
    </section>
  );
}
