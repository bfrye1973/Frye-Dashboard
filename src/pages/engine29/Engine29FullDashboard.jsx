import React, { useEffect, useState } from "react";

// Engine 29 — Presentation V1
// Full presentation rewrite. Backend Engine29 authority is unchanged.

const API_BASE =
  (typeof window !== "undefined" && (window.__API_BASE__ || "")) ||
  process.env.REACT_APP_API_BASE ||
  process.env.VITE_TRADING_API_BASE ||
  "https://frye-market-backend-1.onrender.com";

const API_ROOT = API_BASE.replace(/\/+$/, "").replace(/\/api$/, "");
const ROUTE = API_ROOT + "/api/v1/engine29/cross-market-stress";
const UPDATE_ROUTE = API_ROOT + "/api/v1/engine29/update";
const READ_POLL_MS = 15_000;
const LIVE_REBUILD_MS = 10 * 60_000;
const FONT = "Arial, Helvetica, sans-serif";

const COLORS = {
  bg: "#020817", panel: "#0b1426", border: "#26364f", text: "#e2e8f0",
  muted: "#7f91aa", blue: "#60a5fa", green: "#22c55e", yellow: "#fbbf24",
  orange: "#f97316", red: "#ef4444"
};

function clean(value) {
  if (value === null || value === undefined || value === "") return "—";
  return String(value).replaceAll("_", " ");
}

function pct(value, digits = 1) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  const scaled = Math.abs(n) <= 1 ? n * 100 : n;
  return scaled.toFixed(digits) + "%";
}

function stateColor(value) {
  const s = String(value || "").toUpperCase();
  if (/HEALTHY|CONFIRMED|SUPPORTS|RECLAIM|POSITIVE|RECOVER/.test(s)) return COLORS.green;
  if (/SEVERE|BREAK|DETERIOR|NEGATIVE|OPPOSES|FAILED|INVALID/.test(s)) return COLORS.red;
  if (/STRESS|WEAK|PRESSURE|CAUTION|WATCH|FORMING|RISING/.test(s)) return COLORS.orange;
  if (/MIXED|STABIL|NEUTRAL|MONITOR|PARTIAL|TEST|SWEEP/.test(s)) return COLORS.yellow;
  return COLORS.blue;
}

function Card({ children, style = {} }) {
  return <div style={{
    background: "linear-gradient(180deg, rgba(15,26,47,.98), rgba(7,16,32,.98))",
    border: "1px solid " + COLORS.border, borderRadius: 10, padding: 12,
    boxShadow: "0 10px 24px rgba(0,0,0,.16)", ...style
  }}>{children}</div>;
}

function SectionTitle({ children, color = COLORS.blue }) {
  return <div style={{ color, fontSize: 12, fontWeight: 950, letterSpacing: ".055em", textTransform: "uppercase" }}>{children}</div>;
}

function KV({ label, value, valueColor }) {
  return <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
    <span style={{ color: COLORS.muted, fontSize: 12 }}>{label}</span>
    <strong style={{ color: valueColor || stateColor(value), fontSize: 12, textAlign: "right" }}>{clean(value)}</strong>
  </div>;
}

/*__COMPONENTS_A__*/
/*__COMPONENTS_B__*/
/*__COMPONENTS_C__*/
/*__MAIN__*/
