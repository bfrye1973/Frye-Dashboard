// src/App.js
import React, { useEffect, useMemo, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import NewDashboard from "./pages/NewDashboard";
import ErrorBoundary from "./ErrorBoundary";
import "./index.css";
import UIScaler from "./components/UIScaler";

// NEW: bring in the provider so selection is available app-wide
import { ModeProvider, ViewModes } from "./context/ModeContext";

// Lazy-load to keep the first load fast
const FullChart = React.lazy(() => import("./pages/FullChart"));

/* ------------------------- config: backend base ------------------------- */
// Try window override first (for local dev), then env, then hard default.
// NOTE: fallback includes /api so routes like /v1/ohlc resolve correctly.
const API_BASE =
  (typeof window !== "undefined" && (window.__API_BASE__ || "")) ||
  process.env.REACT_APP_API_BASE ||
  process.env.VITE_TRADING_API_BASE ||
  "https://frye-market-backend-1.onrender.com/api";

/* --------------------------- small date helpers ------------------------- */
const fmtAz = (iso) => {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Phoenix",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso || "";
  }
};

/* --------------------------- Health Status Bar -------------------------- */
/**
 * Read-only health bar:
 * GET {API_BASE}/api/health → { ok: boolean, ts: ISO, service: string }
 */
function HealthStatusBar() {
  const [state, setState] = useState({
    ok: null,
    ts: null,
    service: "",
    error: null,
    lastChecked: null,
  });

  const url = useMemo(() => `${API_BASE.replace(/\/+$/, "")}/api/health`, []);

  useEffect(() => {
    let alive = true;
    const fetchHealth = async () => {
      try {
        const res = await fetch(url, { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        if (!alive) return;
        setState({
          ok: Boolean(json.ok),
          ts: json.ts || null,
          service: json.service || "backend",
          error: null,
          lastChecked: new Date().toISOString(),
        });
      } catch (e) {
        if (!alive) return;
        setState((s) => ({
          ...s,
          ok: false,
          error: e?.message || "Network error",
          lastChecked: new Date().toISOString(),
        }));
      }
    };

    // initial + poll every 10s
    fetchHealth();
    const id = setInterval(fetchHealth, 10000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [url]);

  const connected = state.ok === true;
  const statusColor = connected ? "#16a34a" : "#dc2626"; // green/red
  const heartbeat = state.ts ? fmtAz(state.ts) : "—";
  const checked = state.lastChecked ? fmtAz(state.lastChecked) : "—";

  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 1000,
        width: "100%",
        background: "#0b0f14",
        borderBottom: "1px solid #1f2937",
        color: "#e5e7eb",
        fontSize: 13,
      }}
      data-healthbar
    >
      <div
        style={{
          display: "flex",
          gap: 16,
          alignItems: "center",
          padding: "6px 10px",
          flexWrap: "wrap",
        }}
      >
        <strong style={{ color: "#93c5fd" }}>Service:</strong>
        <span>{state.service || "frye-market-backend"}</span>

        <span style={{ opacity: 0.5 }}>|</span>

        <strong style={{ color: "#93c5fd" }}>Connected:</strong>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            color: statusColor,
            fontWeight: 600,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: statusColor,
              display: "inline-block",
            }}
          />
          {connected ? "✓" : "✗"}
        </span>

        <span style={{ opacity: 0.5 }}>|</span>

        <strong style={{ color: "#93c5fd" }}>Last heartbeat (AZ):</strong>
        <span>{heartbeat}</span>

        <span style={{ opacity: 0.5 }}>|</span>

        <strong style={{ color: "#93c5fd" }}>Checked at (AZ):</strong>
        <span>{checked}</span>

        {state.error && (
          <>
            <span style={{ opacity: 0.5 }}>|</span>
            <span style={{ color: "#f97316" }}>Note:</span>
            <span style={{ color: "#fca5a5" }}>{state.error}</span>
          </>
        )}
      </div>
    </div>
  );
}

/* --------------------------------- App --------------------------------- */
export default function App() {
  return (
    <ErrorBoundary>
      <UIScaler>
        <div style={{ minHeight: "100vh" }}>
          <BrowserRouter>
            {/* Read-only health bar at the very top */}
            <HealthStatusBar />

            <ModeProvider initial={ViewModes.METER_TILES}>
              <React.Suspense
                fallback={
                  <div style={{ padding: 16, color: "#9ca3af" }}>Loading…</div>
                }
              >
                <Routes>
                  <Route path="/" element={<NewDashboard />} />
                  <Route path="/chart" element={<FullChart />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </React.Suspense>
            </ModeProvider>
          </BrowserRouter>
        </div>
      </UIScaler>
    </ErrorBoundary>
  );
}

/* ----------------------------- named export ----------------------------- */
export { API_BASE };
