// src/App.js
// Engine 25D update:
// - Keeps normal dashboard pages inside UIScaler
// - Moves /engine25-full OUTSIDE UIScaler so the full research page is not shrunk to 60%
// - Keeps API_BASE export, HealthStatusBar, ModeProvider, and existing routes

import React, { useEffect, useMemo, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import NewDashboard from "./pages/NewDashboard";
import ErrorBoundary from "./ErrorBoundary";
import "./index.css";
import UIScaler from "./components/UIScaler";
import { ModeProvider, ViewModes } from "./context/ModeContext";

const FullChart = React.lazy(() => import("./pages/FullChart"));
const StrategiesFull = React.lazy(() => import("./pages/StrategiesFull"));
const JournalFull = React.lazy(() => import("./pages/JournalFull"));
const Engine25FullDashboard = React.lazy(() =>
  import("./pages/engine25/Engine25FullDashboard")
);

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

/* ---------------------- Normal dashboard scaled shell ------------------- */
function ScaledDashboardShell({ children }) {
  return (
    <UIScaler
      minReadable={0.45}
      defaultScale={0.60}
      defaultMode="manual"
      maxScale={1.6}
    >
      <ModeProvider initial={ViewModes.METER_TILES}>
        {children}
      </ModeProvider>
    </UIScaler>
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
      <BrowserRouter>
        <HealthStatusBar />

        <React.Suspense
          fallback={
            <div style={{ padding: 16, color: "#9ca3af" }}>
              Loading…
            </div>
          }
        >
          <Routes>
            {/* Engine 25 full page is intentionally OUTSIDE UIScaler */}
            <Route path="/engine25-full" element={<Engine25FullDashboard />} />

            {/* Normal dashboard routes stay inside UIScaler */}
            <Route
              path="/"
              element={
                <ScaledDashboardShell>
                  <NewDashboard />
                </ScaledDashboardShell>
              }
            />

            <Route
              path="/chart"
              element={
                <ScaledDashboardShell>
                  <FullChart />
                </ScaledDashboardShell>
              }
            />

            <Route
              path="/strategies-full"
              element={
                <ScaledDashboardShell>
                  <StrategiesFull />
                </ScaledDashboardShell>
              }
            />

            <Route
              path="/journal-full"
              element={
                <ScaledDashboardShell>
                  <JournalFull />
                </ScaledDashboardShell>
              }
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </React.Suspense>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

/* ----------------------------- named export ----------------------------- */
export { API_BASE };
