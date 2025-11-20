// src/pages/rows/RowMarketOverview.jsx
import React from "react";
import { useDashboardPoll } from "../../lib/dashboardApiSafe";
import { LastUpdated } from "../../components/LastUpdated";
import {
  MarketMeterIntradayLegend,
  MarketMeterDailyLegend,
} from "../../components/MarketMeterLegend";

// --------- API endpoints (env-configured) ----------
const INTRADAY_URL = process.env.REACT_APP_INTRADAY_URL;      // /live/intraday
const HOURLY_URL   = process.env.REACT_APP_HOURLY_URL;        // /live/hourly
const EOD_URL      = process.env.REACT_APP_EOD_URL;           // /live/eod
const SANDBOX_URL  = process.env.REACT_APP_INTRADAY_SANDBOX_URL || "";

// ---------------- Utilities ----------------
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, Number(n)));
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
};

function fmtIso(ts) {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

const isStale = (ts, maxMs = 12 * 60 * 1000) => {
  if (!ts) return true;
  const t = new Date(ts).getTime();
  return !Number.isFinite(t) || Date.now() - t > maxMs;
};

function tsOf(x) {
  return x?.updated_at || x?.ts || null;
}

function newer(a, b) {
  const ta = tsOf(a);
  const tb = tsOf(b);
  if (!ta) return b;
  if (!tb) return a;
  return new Date(ta).getTime() >= new Date(tb).getTime() ? a : b;
}

// Map Liquidity PSI (0..120) → 0..100
function mapPsiToPct(psi) {
  if (!Number.isFinite(psi)) return NaN;
  return clamp((psi / 120) * 100, 0, 100);
}

// --------- Intraday overall scoring (unchanged) ----------
function overallIntradayScore(m, intraday) {
  if (!m) return NaN;

  const breadth   = num(m.breadth_10m_pct ?? m.breadth_pct);
  const momentum  = num(m.momentum_combo_pct ?? m.momentum_pct);

  // For scoring we still use EXPANSION (high = wide / “hot”)
  const sqRaw = num(m.squeeze_intraday_pct ?? m.squeeze_pct);
  const squeezeOk = Number.isFinite(sqRaw)
    ? clamp(100 - sqRaw, 0, 100)
    : NaN;

  const volOk = Number.isFinite(m.volatility_pct)
    ? clamp(100 - m.volatility_pct, 0, 100)
    : NaN;

  const liqPct  = mapPsiToPct(num(m.liquidity_psi ?? m.liquidity_pct));
  const sectorDir = num(intraday?.sectorDirection10m?.risingPct);
  const riskOn    = num(intraday?.riskOn10m?.riskOnPct);

  // weights
  const w = {
    breadth:    0.22,
    momentum:   0.22,
    squeezeOk:  0.18,
    volOk:      0.14,
    liqPct:     0.14,
    sectorDir:  0.05,
    riskOn:     0.05,
  };

  const parts = [
    { v: breadth,   w: w.breadth },
    { v: momentum,  w: w.momentum },
    { v: squeezeOk, w: w.squeezeOk },
    { v: volOk,     w: w.volOk },
    { v: liqPct,    w: w.liqPct },
    { v: sectorDir, w: w.sectorDir },
    { v: riskOn,    w: w.riskOn },
  ].filter((p) => Number.isFinite(p.v));

  if (!parts.length) return NaN;

  const totalW = parts.reduce((s, p) => s + p.w, 0);
  const score  = parts.reduce((s, p) => s + p.v * p.w, 0) / (totalW || 1);
  return clamp(score, 0, 100);
}

// --------- Tone helpers ----------
function toneForBreadth(v) {
  if (!Number.isFinite(v)) return "drill";
  if (v >= 65) return "ok";
  if (v >= 35) return "warn";
  return "danger";
}

function toneForMomentum(v) {
  if (!Number.isFinite(v)) return "info";
  if (v >= 65) return "ok";
  if (v >= 35) return "warn";
  return "danger";
}

// 10m: squeeze tile is now TIGHTNESS (0..100, high = tight = “danger”)
function toneForSqueeze(v) {
  if (!Number.isFinite(v)) return "info";
  if (v >= 85) return "danger";  // very tight
  if (v >= 65) return "warn";    // starting to compress
  if (v >= 35) return "ok";
  return "ok";
}

// 1h: expansion % (higher = more expanded / “hot”)
function toneForSqueeze1h(v) {
  if (!Number.isFinite(v)) return "info";
  if (v >= 85) return "danger"; // fully blown out / “hot”
  if (v >= 65) return "warn";
  return "ok";
}

// Volatility: higher = worse
function toneForVol(v) {
  if (!Number.isFinite(v)) return "info";
  if (v > 60) return "danger";
  if (v > 30) return "warn";
  return "ok";
}

// Simple percent tone
function toneForPercent(v) {
  if (!Number.isFinite(v)) return "info";
  if (v >= 60) return "ok";
  if (v >= 45) return "warn";
  return "danger";
}

// Daily trend slope
function toneForDailyTrend(slope) {
  if (!Number.isFinite(slope)) return "info";
  if (slope > 5) return "ok";
  if (slope >= -5) return "warn";
  return "danger";
}

// Daily squeeze (Lux-style: high = danger)
function toneForLuxDaily(v) {
  if (!Number.isFinite(v)) return "info";
  if (v >= 85) return "danger";
  if (v >= 80) return "warn";
  return "ok";
}

// Volatility band (“calm / elevated / high”)
function toneForVolBand(band) {
  if (band === "high") return "danger";
  if (band === "elevated") return "warn";
  if (band) return "ok";
  return "info";
}

// Liquidity band (“good / normal / thin”)
function toneForLiqBand(band) {
  if (band === "good") return "ok";
  if (band === "normal") return "warn";
  if (band) return "danger";
  return "info";
}

function toneForOverallState(state, score) {
  const s = (state || "").toLowerCase();
  if (s === "bull") return "ok";
  if (s === "bear") return "danger";
  if (s === "neutral") return "warn";
  return toneForPercent(score);
}

// --------- Stoplight component ----------
function Stoplight({
  label,
  value,
  baseline,
  size = 54,
  unit = "%",
  subtitle,
  toneOverride,
  extraBelow,
  clampValue = true,
}) {
  const rawV = Number.isFinite(value) ? Number(value) : NaN;
  const v = clampValue ? (Number.isFinite(rawV) ? clamp(rawV, 0, 100) : NaN) : rawV;

  const rawB = Number.isFinite(baseline) ? Number(baseline) : NaN;
  const delta = Number.isFinite(v) && Number.isFinite(rawB) ? v - rawB : NaN;

  const tone = toneOverride || "info";
  const colors = {
    ok:     { bg: "#22c55e", glow: "rgba(34, 197, 94, 0.45)" },
    warn:   { bg: "#fbbf24", glow: "rgba(251, 191, 36, 0.45)" },
    danger: { bg: "#ef4444", glow: "rgba(239, 68, 68, 0.45)" },
    info:   { bg: "#334155", glow: "rgba(51, 65, 85, 0.35)" },
  }[tone];

  const valueText = Number.isFinite(v)
    ? `${v.toFixed(1)}${unit === "%" ? "%" : unit ? ` ${unit}` : ""}`
    : "—";

  const deltaText = Number.isFinite(delta)
    ? `${delta.toFixed(1)}${unit === "%" ? "%" : unit ? ` ${unit}` : ""}`
    : unit === "%"
      ? "0.0%"
      : "0.0";

  const arrow =
    !Number.isFinite(delta) ? "→" : delta > 0 ? "↑" : delta < 0 ? "↓" : "→";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        minWidth: size + 36,
      }}
    >
      <div
        title={`${label}: ${valueText}`}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: colors.bg,
          boxShadow: `0 0 12px ${colors.glow}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "4px solid #0c1320",
        }}
      >
        <div
          style={{
            fontWeight: 800,
            fontSize: size >= 100 ? 20 : 16,
            color: "#0b1220",
          }}
        >
          {valueText}
        </div>
      </div>
      <div
        className="small"
        style={{ color: "#e5e7eb", fontWeight: 700, fontSize: 15, textAlign: "center" }}
      >
        {label}
      </div>
      {subtitle && (
        <div
          style={{
            color: "#94a3b8",
            fontSize: 12,
            fontWeight: 600,
            textAlign: "center",
          }}
        >
          {subtitle}
        </div>
      )}
      <div style={{ color: "#94a3b8", fontSize: 13, fontWeight: 600 }}>
        {arrow} {deltaText}
      </div>
      {extraBelow || null}
    </div>
  );
}

// --------- 5m delta (from sandbox) ----------
function useSandboxDeltas() {
  const [deltaMkt, setDeltaMkt] = React.useState({
    dB: null,
    dM: null,
    riskOn: null,
  });
  const [deltasUpdatedAt, setDUA] = React.useState(null);

  React.useEffect(() => {
    let stop = false;

    async function load() {
      if (!SAN
