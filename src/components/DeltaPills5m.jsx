// src/components/DeltaPills5m.jsx
// Drop-in 5m sandbox deltas: Provider + Market/ Sector delta UI.
// Usage examples are at the bottom of this file.

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

// --------- CONFIG ---------

// Read-only sandbox URL (keep your prod URLs unchanged).
// Put this in your .env.local too, but we defensively fall back if missing.
const SANDBOX_URL =
  (typeof process !== "undefined" && process.env.REACT_APP_INTRADAY_SANDBOX_URL) ||
  ""; // e.g. https://raw.githubusercontent.com/<org>/<repo>/data-live-10min-sandbox/data/outlook_intraday.json

// Sector name aliases (normalize card titles to sandbox delta keys)
const ALIASES = {
  "healthcare": "Health Care",
  "health care": "Health Care",
  "info tech": "Information Technology",
  "information technology": "Information Technology",
  "communications": "Communication Services",
  "communication services": "Communication Services",
  "consumer staples": "Consumer Staples",
  "consumer discretionary": "Consumer Discretionary",
  "financials": "Financials",
  "industrials": "Industrials",
  "materials": "Materials",
  "real estate": "Real Estate",
  "utilities": "Utilities",
  "energy": "Energy",
};

// Colors for delta tags / pills
function deltaColor(v) {
  if (v == null || Number.isNaN(v)) return "#9CA3AF"; // gray-400
  if (v >= 1) return "#10B981"; // green-500
  if (v <= -1) return "#EF4444"; // red-500
  return "#9CA3AF"; // gray-400
}

function tiltArrow(tilt) {
  if (tilt == null) return "•";
  if (tilt >= 1) return "▲";
  if (tilt <= -1) return "▼";
  return "■";
}

// --------- CONTEXT / PROVIDER ---------

const DeltaCtx = createContext({
  data: null,
  stale: false,
  updatedAt: null,
  deltasUpdatedAt: null,
  error: null,
  refresh: () => {},
});

/**
 * DeltaProvider — fetches the sandbox payload on mount and every 60s.
 * Read-only; does not affect your 10-minute prod levels.
 */
export function DeltaProvider({ children, refreshMs = 60000 }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [deltasUpdatedAt, setDeltasUpdatedAt] = useState(null);

  async function fetchSandbox() {
    if (!SANDBOX_URL) {
      setError("REACT_APP_INTRADAY_SANDBOX_URL not set");
      return;
    }
    try {
      const url = SANDBOX_URL.includes("?")
        ? `${SANDBOX_URL}&t=${Date.now()}`
        : `${SANDBOX_URL}?t=${Date.now()}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json || null);
      setUpdatedAt(json?.updated_at || null);
      setDeltasUpdatedAt(json?.deltasUpdatedAt || null);
      setError(null);
    } catch (e) {
      setError(String(e));
      setData(null);
      setUpdatedAt(null);
      setDeltasUpdatedAt(null);
    }
  }

  useEffect(() => {
    fetchSandbox(); // initial
    const id = setInterval(fetchSandbox, refreshMs);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // stale if deltasUpdatedAt older than 12 minutes
  const stale = useMemo(() => {
    try {
      if (!deltasUpdatedAt) return true;
      const now = Date.now();
      const t = new Date(deltasUpdatedAt).getTime();
      return Number.isFinite(t) ? now - t > 12 * 60 * 1000 : true;
    } catch {
      return true;
    }
  }, [deltasUpdatedAt]);

  const value = useMemo(
    () => ({
      data,
      error,
      updatedAt,
      deltasUpdatedAt,
      stale,
      refresh: fetchSandbox,
    }),
    [data, error, updatedAt, deltasUpdatedAt, stale]
  );

  return <DeltaCtx.Provider value={value}>{children}</DeltaCtx.Provider>;
}

export function useSandboxDeltas() {
  return useContext(DeltaCtx);
}

// --------- MARKET DELTA TAGS (Breadth/Momentum) ---------

/**
 * MarketDeltaTags — shows tiny Δ tags for Breadth / Momentum under the dials.
 * Render this right under your Breadth/Momentum values in the Market Meter row.
 */
export function MarketDeltaTags() {
  const { data, stale } = useSandboxDeltas();
  const dB = data?.deltas?.market?.dBreadthPct;
  const dM = data?.deltas?.market?.dMomentumPct;

  const cB = deltaColor(dB);
  const cM = deltaColor(dM);

  const styleTag = {
    display: "inline-block",
    fontSize: 12,
    lineHeight: "16px",
    padding: "2px 6px",
    borderRadius: 6,
    marginRight: 8,
    background: "#111827",
    color: "#E5E7EB",
    border: "1px solid #374151",
  };

  const styleDot = {
    display: "inline-block",
    width: 8,
    height: 8,
    borderRadius: 999,
    background: stale ? "#9CA3AF" : "#10B981",
    marginLeft: 6,
    verticalAlign: "middle",
  };

  return (
    <div style={{ marginTop: 6 }}>
      <span style={{ ...styleTag, borderColor: cB }}>
        ΔBreadth: <span style={{ color: cB }}>{fmt(dB)}</span>
      </span>
      <span style={{ ...styleTag, borderColor: cM }}>
        ΔMomentum: <span style={{ color: cM }}>{fmt(dM)}</span>
      </span>
      <span title={stale ? "Deltas stale (>12m)" : "Deltas fresh"} style={styleDot} />
    </div>
  );
}

// --------- SECTOR DELTA PILLS (one tile) ---------

/**
 * SectorDeltaPills —  Δ5m pills for a single sector tile.
 * Props:
 *   sectorName (string) — the title of the tile, e.g., "Information Technology"
 *   compact (bool) — smaller pills (default true)
 */
export function SectorDeltaPills({ sectorName, compact = true }) {
  const { data, stale } = useSandboxDeltas();

  const canonical = useMemo(() => {
    if (!sectorName) return null;
    const key = String(sectorName).trim().toLowerCase();
    return ALIASES[key] || sectorName;
  }, [sectorName]);

  const sd = canonical ? data?.deltas?.sectors?.[canonical] : null;
  const dB = sd?.dBreadthPct;
  const dM = sd?.dMomentumPct;
  const tilt = sd?.netTilt;

  if (!sd) {
    // Hide when sandbox missing or sector not found (no layout churn)
    return null;
  }

  const cB = deltaColor(dB);
  const cM = deltaColor(dM);
  const arrow = tiltArrow(tilt);

  const stylePill = {
    display: "inline-block",
    fontSize: compact ? 11 : 12,
    lineHeight: compact ? "14px" : "16px",
    padding: compact ? "2px 6px" : "3px 8px",
    borderRadius: 999,
    marginRight: 6,
    background: "#0B1220",
    color: "#E5E7EB",
    border: "1px solid #334155",
  };

  return (
    <div style={{ marginTop: compact ? 4 : 6 }}>
      <span style={{ ...stylePill, borderColor: cB }}>
        ΔBreadth: <span style={{ color: cB }}>{fmt(dB)}</span>
      </span>
      <span style={{ ...stylePill, borderColor: cM }}>
        ΔMomentum: <span style={{ color: cM }}>{fmt(dM)}</span>
      </span>
      <span
        title={`Tilt: ${fmt(tilt)}`}
        style={{
          ...stylePill,
          fontWeight: 700,
          color: stale ? "#9CA3AF" : "#E5E7EB",
        }}
      >
        {arrow}
      </span>
    </div>
  );
}

// --------- HELPERS ---------

function fmt(v) {
  if (v == null || Number.isNaN(v)) return "—";
  const s = Number(v).toFixed(2);
  return (v > 0 ? "+" : "") + s;
}

// --------- EXAMPLES (delete or keep) ---------

/**
 * Example: wrap a fragment of your dashboard rows with DeltaProvider once.
 *
 * <DeltaProvider>
 *   <RowMarketOverview />  // inside this row, under the Breadth/Momentum values:
 *   <MarketDeltaTags />
 *
 *   <RowIndexSectors />    // inside the IT tile header/body:
 *   <SectorDeltaPills sectorName="Information Technology" />
 * </DeltaProvider>
 */

export default function DeltaPillsDemo() {
  // Tiny demo preview (safe to remove). Shows one market bar + one sector sample.
  return (
    <DeltaProvider>
      <div style={{ padding: 16, background: "#0F172A", color: "#E5E7EB", fontFamily: "Inter, ui-sans-serif, system-ui" }}>
        <h3 style={{ margin: 0, fontWeight: 700 }}>Market — Δ5m</h3>
        <MarketDeltaTags />
        <hr style={{ borderColor: "#1F2937", margin: "12px 0" }} />
        <h3 style={{ margin: 0, fontWeight: 700 }}>Information Technology — Δ5m</h3>
        <SectorDeltaPills sectorName="Information Technology" />
      </div>
    </DeltaProvider>
  );
}
