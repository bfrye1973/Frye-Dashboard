import React, { useEffect, useMemo, useState } from "react";

/** ------------------- data source helpers ------------------- */
function resolveLiveIntraday() {
  const env = (process.env.REACT_APP_INTRADAY_URL || "").trim();
  if (env) return env.replace(/\/+$/, "");
  const win = typeof window !== "undefined" ? (window.__LIVE_INTRADAY_URL || "") : "";
  if (win) return String(win).trim().replace(/\/+$/, "");
  return "https://frye-market-backend-1.onrender.com/live/intraday";
}

/** Color tokens for Lux-like status chips */
const CHIP_COLORS = {
  green:   { bg: "#16a34a", fg: "#0b1220", bd: "#0b7a32" },
  red:     { bg: "#ef4444", fg: "#fff0f0", bd: "#b91c1c" },
  purple:  { bg: "#0b1220", fg: "#93c5fd", bd: "#334155" },
  warn:    { bg: "#facc15", fg: "#111827", bd: "#ca8a04" },
  neutral: { bg: "#0b0f17", fg: "#9ca3af", bd: "#1f2937" },
};

function fmtTime(ts) {
  if (!ts) return "—";
  try {
    const d = new Date(ts);
    return d.toLocaleString();
  } catch {
    return String(ts);
  }
}

/** Compact signal pill */
function SignalPill({ label, tone = "neutral" }) {
  const c = CHIP_COLORS[tone] || CHIP_COLORS.neutral; // ✅ fixed typo
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontSize: 12,
        fontWeight: 600,
        padding: "4px 10px",
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.bd}`,
        borderRadius: 999,
        marginRight: 6,
        marginBottom: 6,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </div>
  );
}

/** Trend card for 10m / 1h / Daily */
function TrendCard({ title, trend }) {
  const state = trend?.state || "neutral";
  const colors =
    state === "green" ? CHIP_COLORS.green
      : state === "red" ? CHIP_COLORS.red
      : state === "purple" ? CHIP_COLORS.purple
      : CHIP_COLORS.neutral;

  return (
    <div
      style={{
        border: "1px solid #1f2937",
        background: "#0b0f14",
        borderRadius: 10,
        padding: 12,
        minWidth: 240,
        maxWidth: 340,
        flex: "1 1 260px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: 999,
            background: colors.bg,
            border: `1px solid ${colors.bd}`,
            marginRight: 8,
          }}
        />
        <div style={{ fontWeight: 700, color: "#d1d5db" }}>{title}</div>
      </div>
      <div style={{ fontSize: 13, color: "#9ca3af", lineHeight: 1.5 }}>
        <div>
          <strong>State:</strong>{" "}
          <span
            style={{
              color: colors.fg,
              background: colors.bg,
              padding: "1px 6px",
              borderRadius: 6,
            }}
          >
            {state.toUpperCase()}
          </span>
        </div>
        {trend?.reason && (
          <div>
            <strong>Reason:</strong> {trend.reason}
          </div>
        )}
        <div>
          <strong>Updated:</strong> {fmtTime(trend?.updatedAt)}
        </div>
      </div>
    </div>
  );
}

/** pull 10m/1h/daily trend objects from intraday payload */
function extractTrends(payload) {
  const intraday = payload?.intraday || {};
  const strat = intraday?.strategy || {};
  const trends = {
    t10: strat?.trend10m || null,
    t1h: strat?.trend1h || null,         // mirrored by 1h job if included
    td:  strat?.trendDaily || payload?.strategy?.trendDaily || null, // daily mirror
  };
  return trends;
}

/** map of signal keys → compact chip labels */
const PILL_MAP = [
  { key: "sigEMA10BullCross",  label: "10m EMA↑", tone: "green" },
  { key: "sigAccelUp",         label: "Accel↑",   tone: "green" },
  { key: "sigEMA10BearCross",  label: "10m EMA↑", tone: "red" },
  { key: "sigAccelDown",       label: "Accel↓",   tone: "red" },
  { key: "sigOverallBull",     label: "Overall Bull", tone: "green" },
  { key: "sigOverallBear",     label: "Overall Bear", tone: "red" },
  { key: "sigSMI1h_BullCross", label: "1h SMI↑", tone: "green" },
  { key: "sigSMI1h_BearCross", label: "1h SMI↓", tone: "red" },
  { key: "sigEMA1h_BullCross", label: "1h EMA↑", tone: "green" },
  { key: "sigEMA1h_BearCross", label: "1h EMA↓", tone: "red" },
  { key: "sigSqueezeTight",    label: "Tight",    tone: "purple" },
];

export default function RowEngineLights() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [updatedAt, setUpdatedAt] = useState(null);

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
        setUpdatedAt(
          j?.updated_at ||
          j?.updated_at_utc ||
          j?.intraday?.strategy?.trend10m?.updatedAt ||
          null
        );
      } catch (e) {
        setErr(String(e));
      }
    })();
    return () => { alive = false; };
  }, []);

  const signals = useMemo(() => (data?.engineLights?.signals || {}), [data]);
  const trends = useMemo(() => extractTrends(data || {}), [data]);

  const chips = useMemo(() => {
    const out = [];
    PILL_MAP.forEach(({ key, label, tone }) => {
      const active = !!(signals && signals[key] && signals[key].active);
      if (active) out.push({ label, tone });
    });
    return out;
  }, [signals]);

  return (
    <section style={{ padding: "8px 12px 4px 12px" }}>
      {err && <div style={{ color: "#ef4444", marginBottom: 8 }}>{err}</div>}

      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        {/* Signal pills */}
        <div style={{ flex: "2 1 560px", minWidth: 520 }}>
          <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 6 }}>
            <strong>Signals</strong> (updated {updatedAt ? new Date(updatedAt).toLocaleString() : "—"})
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              border: "1px solid #1f2937",
              background: "#0b0f14",
              borderRadius: 8,
              padding: 8,
              minHeight: 48,
            }}
          >
            {chips.length === 0 ? (
              <div style={{ color: "#9ca3af", fontSize: 12 }}>No active signals</div>
            ) : (
              chips.map((c, i) => <SignalPill key={i} label={c.label} tone={c.tone} />)
            )}
          </div>
        </div>

        {/* Trend cards */}
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
          <TrendCard title="10-Minute Trend" trend={trends.t10} />
          <TrendCard title="1-Hour Trend" trend={trends.t1h} />
          <TrendCard title="Daily Trend"  trend={trends.td} />
        </div>
      </div>
    </section>
  );
}
