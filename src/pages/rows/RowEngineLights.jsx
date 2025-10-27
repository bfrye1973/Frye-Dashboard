// src/pages/rows/EngineLights.jsx
// v5.2 — Stable layout, 10m/1h/NOW/Legacy pills + compact trend capsules on right,
//        no extra wrappers; timestamps on the left; minimal risk changes.

import React, { useEffect, useRef, useMemo, useState } from "react";
import { LastUpdated } from "../../components/LastUpdated";

/* ---------------- URL helpers ---------------- */
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

/* ---------------- Small UI Helpers ---------------- */
function Pill({ label, tone = "info", active = true, title }) {
  const palette =
    {
      ok: { bg: "#22c55e", fg: "#0b1220", bd: "#16a34a", sh: "#16a34a" },
      warn: { bg: "#facc15", fg: "#111827", bd: "#ca8a04", sh: "#ca8a04" },
      danger: { bg: "#ef4444", fg: "#fee2e2", bd: "#b91c1c", sh: "#b91c1c" },
      info: { bg: "#0b1220", fg: "#93c5fd", bd: "#334155", sh: "#334155" },
      off: { bg: "#0b0f17", fg: "#6b7280", bd: "#1f2937", sh: "#0b1220" },
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

// compact capsule — shows a single trend with timestamp; no layout side-effects
function TrendTiny({ title, trend }) {
  const state = (trend?.state || "").toLowerCase();
  const chip =
    state === "green" ? { bg: "#16a34a", fg: "#0b1220", bd: "#0b7a32" } :
    state === "red"   ? { bg: "#ef4444", fg: "#fff0f0", bd: "#991b1b" } :
                        { bg: "#0b1220", fg: "#93c5fd", bd: "#334155" };

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

/* ---------------- Signal dictionaries ---------------- */
// Legacy (unchanged)
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

// 5m (NOW)
const R11_NOW_DEF = [
  { k: "sigNowAccelUp",   label: "NOW Accel ↑", tone: () => "ok" },
  { k: "sigNowAccelDown", tone: () => "danger" },
  { k: "sigNowBull",      label: "NOW Bull",    tone: () => "ok" },
  { k: "sigNowBear",      label: "NOW Bear",    tone: () => "danger" },
];

// 1h (only if present in the intraday payload; we don’t change layout if absent)
const R11_1H_DEF = [
  { k: "sigEMA1hBullCross",  label: "EMA1h ↑",     tone: () => "ok" },
  { k: "sigEMA1hBearCross",  label: "EMA1h ↓",     tone: () => "danger" },
  { k: "sigSMI1hBullCross",  label: "SMI1h ↑",     tone: () => "ok" },
  { k: "sigSMI1hBearCross",  label: "SMI1h ↓",     tone: () => "danger" },
  { k: "sigAccelUp1h",       label: "Accel ↑ (1h)", tone: () => "ok" },
  { k: "sigAccelDown1h",     label: "Accel ↓ (1h)", tone: () => "danger" },
  { k: "sigOverallBull1h",   label: "Overall ↑ (1h)", tone: () => "ok" },
  { k: "sigOverallBear1h",   label: "Overall ↓ (1h)", tone: () => "danger" },
];

/* ---------------- Utility for converting signals ---------------- */
function toPills(defs, sigs) {
  return defs
    .map(({ k, label, tone }) => {
      const s = sigs?.[k];
      const active = !!(s && s.active);
      const t = active ? tone(s) : "off";
      const reason = s?.reason?.trim() || "";
      const when = s?.lastChanged ? ` • ${new Date(s.lastChanged).toLocaleString()}` : "";
      return {
        key: k,
        text: label,
        tone: t,
        title: `${label} — ${active ? (s?.severity || "ON").toUpperCase()}${reason ? ` • ${reason}` : ""}${when}`,
        active,
      };
    })
    .filter(Boolean);
}

/* ---------------- Main component ---------------- */
export default function EngineLights() {
  const LIVE_10_URL = resolveLiveIntraday();
  const LIVE_1H_URL = resolveLiveHourly();

  const [payload, setPayload] = useState(null);
  const [ts10, setTs10] = useState(null);
  const [ts1h, setTs1h] = useState(null);
  const [err, setErr] = useState("");
  const [legendOpen, setLegendOpen] = useState(false);

  const poll10Ref = useRef(null);
  const poll1hRef = useRef(null);

  // fetch 10m intraday (pills + 10m trend)
  useEffect(() => {
    let abort = false;
    const ctrl = new AbortController();

    const fetch10 = async () => {
      try {
        const res = await fetch(`${guardLive(LIVE_10_URL)}?v=${Date.now()}`, {
          cache: "no-store",
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const j = await res.json();
        if (abort) return;
        setPayload(j);
        setTs10(j?.engineLights?.updatedAt || j?.updated_at || j?.ts || null);
        setErr("");
      } catch (e) {
        if (!abort) setErr(String(e));
      }
    };

    fetch10();
    poll10Ref.current = setInterval(fetch10, 30000);

    return () => {
      abort = true;
      try { ctrl.abort(); } catch {}
      if (poll10Ref.current) clearInterval(poll10Ref.current);
    };
  }, [LIVE_10_URL]);

  // fetch 1h timestamp only (for timestamp chip and optional mirrored pills)
  useEffect(() => {
    let abort = false;
    const ctrl = ac();
    const fetch1h = async () => {
      try {
        const res = await fetch(`${guardLive(LIVE_1H_URL)}?v=${Date.now()}`, {
          cache: "no-store",
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const j = await res.json();
        if (abort) return;
        setTs1h(j?.updated_at || j?.updated_at_utc || j?.ts || null);
      } catch (e) {
        /* do not surface, keep stable */
      }
    };
    fetch1h();
    poll1hRef.current = setInterval(fetch1h, 60000);

    return () => {
      abort = true;
      try { ctrl.abort(); } catch {}
      if (poll1hRef.current) clearInterval(poll1hRef.current);
    };
  }, [LIVE_1H_URL]);

  // data derivation
  const intraday = payload?.intraday || {};
  const strategy = intraday?.strategy || {};
  const signals = payload?.engineLights?.signals || {};
  const trend10 = strategy?.trend10m || null;
  const trend1h = strategy?.trend1h || null;  // present if mirrored by 1h job
  const trendD  = strategy?.trendDaily || null;

  const families = useMemo(() => detectFamily(signals), [signals]);

  const pillsCore  = useMemo(() => (families.hasR11Core ? toPills(R11_CORE_DEF, signals) : []), [families, signals]);
  const pills1h    = useMemo(() => (families.hasR11H1   ? toPills(R11_1H_DEF,   signals) : []), [families, signals]);
  const pillsNow   = useMemo(() => (families.hasR11Now  ? toPills(R11_NOW_DEF,  signals) : []), [families, signals]);
  const pillsLegacy= useMemo(() => (families.hasLegacy  ? toPills(LEGACY_DEF,   signals) : []), [families, signals]);

  const stableKey = useMemo(() => {
    const sigStr = Object.entries(signals)
      .map(([k, v]) => `${k}:${v?.active ? 1 : 0}-${v?.severity || ""}`)
      .join("|");
    return `${ts10 || "no-ts"}|${sigStr}`;
  }, [signals, ts10]);

  return (
    <section id="row-3" className="panel" aria-label="Engine Lights" key={stableKey}>
      {/* Header (unchanged) */}
      <div className="panel-head" style={{ alignItems: "center", gap: 8 }}>
        <div className="panel-title">Engine Lights</div>
        <button
          onClick={() => setLegendOpen(true)}
          style={{
            background: "#0b0b0b",
            color: "#e5e7eb",
            border: "1px solid #2b2b2b",
            borderRadius: 8,
            padding: "6px 10px",
            fontWeight: 600,
            cursor: "pointer",
            marginLeft: 8,
          }}
          title="Legend"
        >
          Legend
        </button>
        <div className="spacer" />
        <span className="small muted" style={{ marginRight: 12 }}>
          <strong>10m:</strong> <LastUpdated ts={ts10} />
        </span>
        <span className="small muted" style={{ marginRight: 0 }}>
          <strong>1h:</strong> <LastUpdated ts={ts1h} />
        </span>
      </div>

      {/* Pills: existing stacks remain; no new wrappers added above or below */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {pillsCore.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center" }}>
            {pillsCore.map((p) => (
              <Pill key={p.key} label={p.text} tone={p.tone} title={p.title} />
            ))}
          </div>
        )}
        {pills1h.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center" }}>
            {pills1h.map((p) => (
              <Pill key={p.key} label={p.text} tone={p.tone} title={p.title} />
            ))}
          </div>
        )}
        {pillsNow.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center" }}>
            {pillsNow.map((p) => (
              <Pill key={p.key} label={p.text} tone={p.tone} title={p.title} />
            ))}
          </div>
        )}
        {pillsLegacy.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center" }}>
            {pillsLegacy.map((p) => (
              <Pill key={p.key} label={p.text} tone={p.tone} title={p.title} />
            ))}
          </div>
        )}
        {pillsCore.length + pills1h.length + pillsNow.length + pillsLegacy.length === 0 && (
          <div className="small muted">No active signals.</div>
        )}
      </div>

      {/* Compact Trends on the right — appended inline, no new outer containers */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
        <TrendTiny title="10m Trend"   trend={trend10} />
        <TrendTiny title="1h Trend"    trend={trend1h} />
        <TrendTiny title="Daily Trend" trend={trendD} />
      </div>

      {/* Legend Modal (unchanged) */}
      {legendOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setLegendOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 60,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(880px, 92vw)",
              background: "#0b0b0c",
              border: "1px solid #2b2b2b",
              borderRadius: 12,
              padding: 16,
              boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
            }}
          >
            <div style={{ color: "#f9faff", fontSize: 14, fontWeight: 800, marginBottom: 8 }}>
              Engine Lights — Legend
            </div>
            <p className="small muted" style={{ marginBottom: 8 }}>
              Pill families auto-detected from intraday payload:<br />
              • 10m Core (Overall / EMA10 / Accel / Risk / Sector)<br />
              • 1h Crosses (if mirrored from hourly) — EMA1h / SMI1h / Accel1h / Overall1h<br />
              • 5m NOW sandbox (acceleration & bias)<br />
              • Legacy (Breakout / Distribution / Compression / …)
            </p>
            <div className="small muted">
              Hover a pill to see its “reason” and “lastChanged” detail.
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
              <button
                onClick={() => setLegendOpen(false)}
                style={{
                  background: "#eab308", color: "#111827", border: "none",
                  borderRadius: 8, padding: "8px 12px", fontWeight: 700
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/* Utility to create AbortController in older browser/runtime */
function ac() {
  return typeof AbortController !== "undefined"
    ? new AbortController()
    : { abort: () => {}, signal: undefined };
}
