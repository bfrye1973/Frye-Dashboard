// src/App.js
// FULL REWRITE (SAFE) — wraps app with ReplayProvider (Replay Mode global state)
// ✅ Keeps: API_BASE export, HealthStatusBar, UIScaler, ModeProvider, routes
// ✅ Adds: ReplayProvider above dashboard so replay context is available everywhere

import React, { useEffect, useMemo, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import NewDashboard from "./pages/NewDashboard";
import ErrorBoundary from "./ErrorBoundary";
import "./index.css";
import UIScaler from "./components/UIScaler";
import { ModeProvider, ViewModes } from "./context/ModeContext";
import { ReplayProvider } from "./replay/ReplayContext"; // ✅ NEW

const FullChart = React.lazy(() => import("./pages/FullChart"));
const StrategiesFull = React.lazy(() => import("./pages/StrategiesFull"));

/* ------------------------- API base resolution ------------------------- */
const API_BASE =
  (typeof window !== "undefined" && (window.__API_BASE__ || "")) ||
  process.env.REACT_APP_API_BASE ||
  process.env.VITE_TRADING_API_BASE ||
  "https://frye-market-backend-1.onrender.com/api";

/* --------------------------- date helper (AZ) --------------------------- */
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

    fetchHealth();
    const id = setInterval(fetchHealth, 10000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [url]);

  const connected = state.ok === true;
  const statusColor = connected ? "#16a34a" : "#dc2626";
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
  // FINAL clamp so zooming/resizes never re-widen the grid
  useEffect(() => {
    const fixWidth = () => {
      const grid = document.querySelector(".dashboard-grid");
      if (grid) {
        grid.style.width = "100%";
        grid.style.maxWidth = "100vw";
        grid.style.overflowX = "hidden";
      }
    };
    fixWidth();
    window.addEventListener("resize", fixWidth);
    window.addEventListener("orientationchange", fixWidth);
    return () => {
      window.removeEventListener("resize", fixWidth);
      window.removeEventListener("orientationchange", fixWidth);
    };
  }, []);

  return (
    <ErrorBoundary>
      <UIScaler
        minReadable={0.45}
        defaultScale={0.60}
        defaultMode="manual"
        maxScale={1.6}
      >
        <div style={{ minHeight: "100vh" }}>
          <BrowserRouter>
            <HealthStatusBar />

            {/* ✅ Replay context available to entire app */}
            <ReplayProvider>
              <ModeProvider initial={ViewModes.METER_TILES}>
                <React.Suspense
                  fallback={<div style={{ padding: 16, color: "#9ca3af" }}>Loading…</div>}
                >
                  <Routes>
                    <Route path="/" element={<NewDashboard />} />
                    <Route path="/chart" element={<FullChart />} />

                    {/* ✅ Full Strategies page */}
                    <Route path="/strategies-full" element={<StrategiesFull />} />

                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </React.Suspense>
              </ModeProvider>
            </ReplayProvider>
          </BrowserRouter>
        </div>
      </UIScaler>
    </ErrorBoundary>
  );
}

/* ----------------------------- named export ----------------------------- */
export { API_BASE };
