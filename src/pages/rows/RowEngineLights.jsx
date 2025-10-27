// src/pages/rows/RowEngineLights.jsx
// Baseline: your last working version, with the following updates:
// - Compact layout, no full width stretch (chips are next to the main pills)
// - Trend chips placed immediately after the pill row (same flex line)
// - LuxAlgo color palette for pill states (green/purple/red/gray)
// - Optional trend chips derived from existing payload metrics (hidden if missing)

import React, { useEffect, useRef, useState } from "react";

// ---------- Lux palette + small helpers ----------
const LUX = {
  green:  "#16a34a",  // ≈ LuxAlgo “bullish”
  purple: "#8b5cf6",  // ≈ LuxAlgo “compression/purple”
  red:    "#ef4444",  // ≈ LuxAlgo “bearish”
  gray:   "#1f2937",  // Dark gray background
  yellow: "#f59e0b"   // accent if you want it
};

// Simple chip for trend / squeeze / volume sentiment
function TrendChip({ label, value, color, title }) {
  if (value == null || value === undefined) return null;
  return (
    <span
      title={title || label}
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "5px 10px",
        borderRadius: 9999,
        fontSize: 12,
        fontWeight: 700,
        color: "#0b1220",
        background: color || LUX.gray,
        marginLeft: 8,
      }}
    >
      <span style={{ marginRight: 6, opacity: 0.85 }}>{label}</span>
      <span style={{ background: "rgba(0,0,0,0.12)", padding: "2px 8px", borderRadius: 9999 }}>
        {typeof value === "number" ? `${Math.round(value)}%` : String(value)}
      </span>
    </span>
  );
}

// Decide chip colors roughly like Lux: positive -> green; negative -> red; else purple/gray fallback
function colorForPct(n, mode = "strength") {
  if (n == null || n === undefined) return LUX.gray;
  if (mode === "strength") {
    if (n >= 40) return LUX.green;
    if (n <= 20) return LUX.red;
    return LUX.purple;
  }
  // generic fallback
  return n >= 0 ? LUX.green : LUX.red;
}

function extractTrendFromPayload(j) {
  // We compute “trend strength” from whatever is in the payload.
  // We don’t change your schema – it’s purely optional.
  const m = j?.metrics || {};

  // 1) Trend Strength (fallback to momentum)
  const trendStrength =
    (typeof m.trend_strength_pct === "number" && m.trend_strength_pct) ||
    (typeof m.momentum_combo_pct === "number" && m.momentum_combo_pct) ||
    (typeof m.momentum_10m_pct === "number" && m.momentum_10m_pct) ||
    null;

  // 2) Squeeze: if you have a PSI % in m.squeeze_pct, we invert to “expansion”
  // If you’re already publishing “squeeze_expansion_pct”, prefer it.
  const squeezeRaw =
    (typeof m.squeeze_expansion_pct === "number" && m.squeeze_expansion_pct) ||
    (typeof m.squeeze_pct === "number" ? (100 - m.squeeze_pct) : null);

  // 3) Volume Sentiment – if you have it; otherwise hide
  const volumeSent =
    (typeof m.volume_sentiment_pct === "number" && m.volume_sentiment_pct) ||
    (typeof m.volume_psy_pct === "number" && m.volume_psy_pct) ||
    null;

  return {
    trendStrength: trendStrength != null ? Math.max(0, Math.min(100, trendStrength)) : null,
    squeezeExpansion: squeezeRaw != null ? Math.max(0, Math.min(100, squeezeRaw)) : null,
    volumeSentiment: volumeSent
  };
}

// ---------- Pill color mapping -----------------
// Keep your existing “ok/warn/danger/off” semantics but use Lux colors
function luxColorForTone(tone) {
  switch (tone) {
    case "ok":     return LUX.green;
    case "warn":   return LUX.purple;  // LuxAlgo compressions are purple/yellow range
    case "danger": return LUX.red;
    default:       return LUX.gray;
  }
}

// ---------- Main Component ---------------------
export default function RowEngineLights() {
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState("");
  const [ts, setTs] = useState(null);
  const [showTrendChips, setShowTrendChips] = useState(true);

  const timerRef = useRef(null);

  // You can leave this pointing to the same endpoint you used last time
  // The logic will just look at 'payload' and compute trend chips optionally
  const API = window?.__API_BASE || process?.env?.REACT_APP_API_BASE || "";
  const endpointIntraday = `${API?.replace(/\/+$/,"") || ""}/live/intraday`;

  // poll – match your last working rate (30/60s etc.)
  useEffect(() => {
    let active = true;

    const fetchOnce = async () => {
      try {
        const r = await fetch(`${endpointIntraday}?nocache=${Date.now()}`, { cache: "no-store" });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = await r.json();
        if (!active) return;
        setPayload(j || null);
        setTs(
          j?.engineLights?.updatedAt ||
          j?.updated_at ||
          j?.timestamp ||
          null
        );
        setError("");
      } catch (e) {
        if (!active) return;
        setError(`Fetch failed: ${String(e)}`);
      }
    };

    fetchOnce();
    timerRef.current = setInterval(fetchOnce, 30000);
    return () => {
      active = false;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [endpointIntraday]);

  // ------------ small UI helpers ---------------
  const metrics = payload?.metrics || {};
  const intraday = payload?.intraday || {};
  const engine = payload?.engineLights || {};

  // Pill definitions (no changes to your schema; just color map)
  const pillDefs = [
    { key: "sigOverallBull",    label: "Bull Bias",    tone: "ok" },
    { key: "sigOverallBear",    label: "Bear Bias",    tone: "danger" },
    { key: "sigAccelUp",        label: "Accel ↑",      tone: "ok" },
    { key: "sigAccelDown",      label: "Accel ↓",      tone: "danger" },
    { key: "sigEMA10BullCross", label: "EMA10 ↑",      tone: "ok" },
    { key: "sigEMA10BearCross", label: "EMA10 ↓",      tone: "danger" },
    // keep your purple/purple compress warnings:
    { key: "sigCompression",    label: "Compression",  tone: "warn" },
    { key: "sigSqueeze",        label: "Squeeze",      tone: "purple" }, // optional older alias
    { key: "sigRiskOn",         label: "Risk On",      tone: "ok" },
    { key: "sigRiskOff",        label: "Risk Off",     tone: "danger" },
    // any extras you had previously are still safe
  ];

  // Build the pill list from engine signals
  function buildPills() {
    const sigs = engine?.signals || {};
    const onPills = pillDefs
      .filter(d => {
        const obj = sigs[d.key];
        if (!obj) return false;
        // Accept any active truthy or active === true
        return Boolean(obj?.active);
      })
      .map(d => {
        const obj = engine.signals[d.key] || {};
        const color = luxColorForTone(obj?.severity === "danger"
          ? "danger"
          : obj?.severity === "warn" ? "warn"
          : d.tone || "ok"
        );
        const title = `${d.label} — ${obj?.reason || ""}`;
        return (
          <span
            key={d.key}
            title={title}
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "6px 10px",
              borderRadius: 9999,
              color: "#0b1220",
              background: color,
              fontWeight: 700,
              fontSize: 12,
              marginRight: 8
            }}
          >
            {d.label}
          </span>
        );
      });

    return onPills;
  }

  // Build optional “trend chips” (derivative – does not modify schema)
  const trend = extractTrendFromPayload(payload);
  const chips = [
    trend?.trendStrength != null && (
      <TrendChip
        key="chip-ts"
        label="Trend"
        value={trend.trendStrength}
        color={colorForPct(trend.trendStrength, "strength")}
        title="Trend Strength (derived)"
      />
    ),
    trend?.squeezeExpansion != null && (
      <TrendChip
        key="chip-sq"
        label="Squeeze"
        value={trend.squeezeExpansion}
        color={trend.squeezeExpansion >= 60 ? LUX.green : trend.squeezeExpansion <= 20 ? LUX.purple : LUX.purple}
        title="Expansion % (100 - PSI)"
      />
    ),
    trend?.volumeSentiment != null && (
      <TrendChip
        key="chip-vs"
        label="Volume"
        value={trend.volumeSentiment}
        color={colorForPct(trend.volumeSentiment, "vol")}
        title="Volume Sentiment"
      />
    )
  ].filter(Boolean);

  const trendRow = (showTrendChips && chips?.length > 0) ? (
    <div style={{ display: "inline-flex" }}>
      {chips}
    </div>
  ) : null;

  // error banner
  const errorBanner = error ? (
    <div style={{
      marginTop: 8, padding: 8, borderRadius: 6,
      background: "#7f1d1d", color: "#fff", fontSize: 12
    }}>
      {error}
    </div>
  ) : null;

  // ---- layout: no full-width stretching; everything left, wrap safely
  return (
    <section id="row-3" aria-label="Engine Lights" style={{ padding: "8px 0" }}>
      {/* SECTION HEADER */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
          justifyContent: "flex-start"
        }}
      >
        {/* Main Pills (left-aligned; compact) */}
        <div style={{ display: "inline-flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          {buildPills()}
        </div>

        {/* Inline trend chips immediately next to pills */}
        {trendRow}
      </div>

      {/* Small timestamp hint */}
      <div style={{ marginTop: 6, color: "#94a3b8", fontSize: 11 }}>
        {ts ? `Updated ${new Date(ts).toLocaleString()}` : "Waiting for data..."}
      </div>

      {errorBanner}
    </section>
  );
}
