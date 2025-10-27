// src/pages/rows/EngineLights.jsx
// v5.3 — Stable layout; 10m/1h/NOW/Legacy pill families + compact 10m/1h/Daily trend capsules.
//         Timestamps on left; no extra section wrappers; React/ESLint clean.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { LastUpdated } from "../../components/LastUpdated";

/* -------------------------------- URLs -------------------------------- */

function resolveLiveIntraday() {
  const env = (process.env.REACT_APP_INTRADAY_URL || "").trim();
  if (env) return env.replace(/\/+$/, "");
  const win =
    typeof window !== "undefined" && window.__LIVE_INTRADAY_URL
      ? String(window.__LIVE_INTRADAY_URL).trim()
      : "";
  if (win) return win.replace(/\/+$/, "");
  return "https://frye-market-backend-1.onrender.com/live/intraday";
}
function resolveLiveHourly() {
  const env = (process.env.REACT_APP_HOURLY_URL || "").trim();
  if (env) return env.replace(/\/+$/, "");
  const win =
    typeof window !== "undefined" && window.__LIVE_HOURLY_URL
      ? String(window.__LIVE_HOURLY_URL).trim()
      : "";
  if (win) return win.replace(/\/+$/, "");
  return "https://frye-market-backend-1.onrender.com/live/hourly";
}
function guardLive(url) {
  return url.replace(/\/api\/live\//, "/live/").replace(/\/api\/?(\?|$)/, "/");
}

/* ----------------------------- Tiny helpers ---------------------------- */

function ac() {
  return typeof AbortController !== "undefined"
    ? new AbortController()
    : { abort: () => {}, signal: undefined };
}

/* ----------------------------- Pill component -------------------------- */

function Pill({ label, tone = "info", active = true, title }) {
  const palette =
    {
      ok:     { bg: "#22c55e", fg: "#0b1220", bd: "#16a34a", sh: "#16a34a" },
      warn:   { bg: "#facc15", fg: "#111827", bd: "#ca8a04", sh: "#ca8a04" },
      danger: { bg: "#ef4444", fg: "#fee2e2", bd: "#b91c1c", sh: "#b91c1c" },
      info:   { bg: "#0b1220", fg: "#93c5fd", bd: "#334155", sh: "#334155" },
      off:    { bg: "#0b0f17", fg: "#6b7280", bd: "#1f2937", sh: "#0b1220" },
    }[tone] || { bg: "#0b0f17", fg: "#6b7280", bd: "#1f2937", sh: "#0b1220" };

  return (
    <span
      title={title || label}
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "6px 10px",
        marginRight: 8,
        marginBottom: 6,
        borderRadius: 8,
        fontWeight: 700,
        fontSize: 12,
        background: palette.bg,
        color: palette.fg,
        border: `1px solid ${palette.bd}`,
        boxShadow: `0 0 10px ${palette.sh}55`,
        opacity: active ? 1 : 0.45,
        filter: active ? "none" : "grayscale(40%)",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

/* ------------------------ Compact trend capsule ------------------------ */

function TrendTiny({ title, trend }) {
  const state = (trend?.state || "").toLowerCase();
  const chip =
    state === "green"
      ? { bg: "#16a34a", fg: "#0b1220", bd: "#0b7a32" }
      : state === "red"
      ? { bg: "#ef4444", fg: "#fff0f0", bd: "#991b1b" }
      : { bg: "#0b1220", fg: "#93c5fd", bd: "#334155" };

  const ts = trend?.updatedAt
    ? new Date(trend.updatedAt).toLocaleString()
    : "—";

  return (
    <div
      style={{
        border: "1px solid #1f2937",
        background: "#0b0f14",
        borderRadius: 8,
        padding: 10,
        minWidth: 200,
      }}
      title={`${title} — ${trend?.state || "—"} • ${ts}`}
    >
      <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: 999,
            background: chip.bg,
            border: `1px solid ${chip.bd}`,
            marginRight: 8,
          }}
        />
        <div style={{ fontWeight: 700, color: "#d1d5db", fontSize: 12 }}>
          {title}
        </div>
      </div>
      <div style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.35 }}>
        <div>
          <strong>State:</strong>{" "}
          <span
            style={{
              background: chip.bg,
              color: chip.fg,
              padding: "1px 6px",
              borderRadius: 6,
            }}
          >
            {state ? state.toUpperCase() : "—"}
          </span>
        </div>
        <div>
          <strong>Updated:</strong> {ts}
        </div>
      </div>
    </div>
  );
}

/* ---------------------- Families & transforms -------------------------- */

// Legacy
const LEGACY_DEF = [
  { k: "sigBreakout",       label: "Breakout",         tone: (s) => (s.severity === "danger" ? "danger" : "ok") },
  { k: "sigDistribution",   label: "Distribution",     tone: () => "danger" },
  { k: "sigCompression",    label: "Compression",      tone: () => "warn" },
  { k: "sigExpansion",      label: "Expansion",        tone: () => "ok" },
  { k: "sigOverheat",       label: "Overheat",         tone: (s) => (s.severity === "danger" ? "danger" : "warn") },
  { k: "sigTurbo",          label: "Turbo",            tone: () => "ok" },
  { k: "sigDivergence",     label: "Divergence",       tone: () => "warn" },
  { k: "sigLowLiquidity",   label: "Low Liquidity",    tone: (s) => (s.severity === "danger" ? "danger" : "warn") },
  { k: "sigVolatilityHigh", label: "Volatility High",  tone: (s) => (s.severity === "danger" ? "danger" : "warn") },
];

// 10m core
const R11_CORE_DEF = [
  { k: "sigOverallBull",     label: "Overall Bull",     tone: () => "ok" },
  { k: "sigOverallBear",     label: "Overall Bear",     tone: () => "danger" },
  { k: "sigEMA10BullCross",  label: "EMA10 ↑",         tone: () => "ok" },
  { k: "sigEMA10BearCross",  label: "EMA10 ↓",         tone: () => "danger" },
  { k: "sigAccelUp",         label: "Accel ↑",         tone: () => "ok" },
  { k: "sigAccelDown",       label: "Accel ↓",         tone: () => "danger" },
  { k: "sigRiskOn",          label: "Risk-On",          tone: () => "ok" },
  { k: "sigRiskOff",         label: "Risk-Off",         tone: () => "danger" },
  { k: "sigSectorThrust",    label: "Sector Thrust",    tone: () => "ok" },
  { k: "sigSectorWeak",      label: "Sector Weak",      tone: () => "danger" },
];

// 5m NOW
const R11_NOW_DEF = [
  { k: "sigNowAccelUp",   label: "NOW Accel ↑", tone: () => "ok" },
  { k: "sigNowAccelDown", label: "NOW Accel ↓", tone: () => "danger" },
  { k: "sigNowBull",      label: "NOW Bull",    tone: () => "ok" },
  { k: "sigNowBear",      label: "NOW Bear",    tone: () => "danger" },
];

// 1h (optional if mirrored into intraday payload)
const R11_1H_DEF = [
  { k: "sigEMA1hBullCross",  label: "EMA1h ↑",      tone: () => "ok" },
  { k: "sigEMA1hBearCross",  label: "EMA1h ↓",      tone: () => "danger" },
  { k: "sigSMI1hBullCross",  label: "SMI1h ↑",      tone: () => "ok" },
  { k: "sigSMI1hBearCross",  label: "SMI1h ↓",      tone: () => "danger" },
  { k: "sigAccelUp1h",       label: "Accel ↑ (1h)", tone: () => "ok" },
  { k: "sigAccelDown1h",     label: "Accel ↓ (1h)", tone: () => "danger" },
  { k: "sigOverallBull1h",   label: "Overall ↑ (1h)", tone: () => "ok" },
  { k: "sigOverallBear1h",   label: "Overall ↓ (1h)", tone: () => "danger" },
];

function toPills(defs, sigs) {
  return defs
    .map(({ k, label, tone }) => {
      const s = sigs?.[k];
      const active = !!(s && s.active);
      const t = active ? tone(s) : "off";
      const reason = s?.reason?.trim() || "";
      const when = s?.lastChanged ? ` • ${new Date(s.lastChanged).toLocaleString()}` : "";
      const title = `${label} — ${active ? (s?.severity || "ON").toUpperCase() : "OFF"}${
        reason ? ` • ${reason}` : ""
      }${when}`;
      return { key: k, label, tone: t, title, active };
    })
    .filter(Boolean);
}

function detectFamily(signals) {
  const keys = Object.keys(signals || {});
  const hasR11Core = keys.some((k) =>
    /^sig(Overall(Bull|Bear)|EMA10(Bull|Bear)Cross|Accel(Up|Down)|Risk(On|Off)|Sector(Thrust|Weak))$/.test(k)
  );
  const hasR11Now = keys.some((k) => /^sigNow/.test(k));
  const hasLegacy = keys.some((k) =>
    /^sig(Breakout|Distribution|Compression|Expansion|Overheat|Turbo|Divergence|LowLiquidity|VolatilityHigh)$/.test(k)
  );
  const hasR11H1 = keys.some((k) =>
    /^sig(EMA1h(Bull|Bear)Cross|SMI1h(Bull|Bear)Cross|Accel(Up|Down)1h|Overall(Bull|Bear)1h)$/.test(k)
  );
  return { hasR11Core, hasR11Now, hasLegacy, hasR11H1 };
}

/* ------------------------------ Component ------------------------------ */

export default function EngineLights() {
  const LIVE10 = resolveLiveIntraday();
  const LIVE1H = resolveLiveHourly();

  const [intraday, setIntraday] = useState(null); // entire /live/intraday payload
  const [ts10, setTs10] = useState(null);
  const [ts1h, setTs1h] = useState(null);
  const [err, setErr] = useState("");

  const poll10Ref = useRef(null);
  const poll1hRef = useRef(null);

  // 10m payload (pills + optional strategy.trendX)
  useEffect(() => {
    const ctrl = ac();

    const load = async () => {
      try {
        const r = await fetch(`${guardLive(LIVE10)}?v=${Date.now()}`, {
          cache: "no-store",
          signal: ctrl.signal,
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = await r.json();
        setIntraday(j);
        setTs10(j?.engineLights?.updatedAt || j?.updated_at || j?.ts || null);
        setErr("");
      } catch (e) {
        setErr(String(e));
      }
    };

    load();
    poll10Ref.current = setInterval(load, 30000);
    return () => {
      try { ctrl.abort(); } catch {}
      if (poll10Ref.current) clearInterval(poll10Ref.current);
    };
  }, [LIVE10]);

  // 1h timestamp only
  useEffect(() => {
    const ctrl = ac();

    const load1h = async () => {
      try {
        const r = await fetch(`${guardLive(LIVE1H)}?v=${Date.now()}`, {
          cache: "no-store",
          signal: ctrl.signal,
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = await r.json();
        setTs1h(j?.updated_at || j?.updated_at_utc || j?.ts || null);
      } catch (_) {
        /* ignore hourly fetch errors for stability */
      }
    };

    load1h();
    poll1hRef.current = setInterval(load1h, 60000);
    return () => {
      try { ctrl.abort(); } catch {}
      if (poll1hRef.current) clearInterval(poll1hRef.current);
    };
  }, [LIVE1H]);

  const signals = intraday?.engineLights?.signals || {};
  const strategy = intraday?.intraday?.strategy || {};
  const families = useMemo(() => detectFamily(signals), [signals]);

  const pillsCore   = useMemo(() => (families.hasR11Core ? toPills(R11_CORE_DEF, signals) : []), [families, signals]);
  const pills1h     = useMemo(() => (families.hasR11H1   ? toPills(R11_1H_DEF,   signals) : []), [families, signals]);
  const pillsNow    = useMemo(() => (families.hasR11Now  ? toPills(R11_NOW_DEF,  signals) : []), [families, signals]);
  const pillsLegacy = useMemo(() => (families.hasLegacy  ? toPills(LEGACY_DEF,   signals) : []), [families, signals]);

  const stableKey = useMemo(() => {
    const sigStr = Object.entries(signals)
      .map(([k, v]) => `${k}:${v?.active ? 1 : 0}-${v?.severity || ""}`)
      .join("|");
    return `${ts10 || "no-ts"}|${sigStr}`;
  }, [signals, ts10]);

  const trend10 = strategy?.trend10m || null;
  const trend1h = strategy?.trend1h || null;
  const trendD  = strategy?.trendDaily || null;

  return (
    <section id="row-3" className="panel" aria-label="Engine Lights" key={stableKey}>
      {/* Header – timestamps on the left */}
      <div className="panel-head" style={{ alignItems: "center", gap: 8 }}>
        <div className="panel-title">Engine Lights</div>
        <div className="spacer" />
        <span className="small muted" style={{ marginRight: 12 }}>
          <strong>10m:</strong> <LastUpdated ts={ts10} />
        </span>
        <span className="small muted">
          <strong>1h:</strong> <LastUpdated ts={ts1h} />
        </span>
      </div>

      {/* Pills — no extra wrappers to avoid row stretch */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {pillsCore.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center" }}>
            {pillsCore.map((p) => (
              <Pill key={p.key} label={p.label} tone={p.tone} title={p.title} />
            ))}
          </div>
        )}
        {pills1h.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center" }}>
            {pills1h.map((p) => (
              <Pill key={p.key} label={p.label} tone={p.tone} title={p.title} />
            ))}
          </div>
        )}
        {pillsNow.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center" }}>
            {pillsNow.map((p) => (
              <Pill key={p.key} label={p.label} tone={p.tone} title={p.title} />
            ))}
          </div>
        )}
        {pillsLegacy.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center" }}>
            {pillsLegacy.map((p) => (
              <Pill key={p.key} label={p.label} tone={p.tone} title={p.title} />
            ))}
          </div>
        )}
        {pillsCore.length + pills1h.length + pillsNow.length + pillsLegacy.length === 0 && (
          <div className="small muted">No active signals.</div>
        )}
      </div>

      {/* Compact trend capsules (right-aligned). No extra outer wrapper above/below. */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
        <TrendTiny title="10m Trend"   trend={trend10} />
        <TrendTiny title="1h Trend"    trend={trend1h} />
        <TrendTiny title="Daily Trend" trend={trendD} />
      </div>
    </section>
  );
}
