// src/App.js
// Engine 25D update:
// - Keeps normal dashboard pages inside UIScaler
// - Moves /engine25-full OUTSIDE UIScaler so the full research page is not shrunk to 60%
// - Adds /engine25-credit-stress OUTSIDE UIScaler
// - Keeps API_BASE export, HealthStatusBar, ModeProvider, and existing routes

import React, { useEffect, useMemo, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import NewDashboard from "./pages/NewDashboard";
import ErrorBoundary from "./ErrorBoundary";
import "./index.css";
import UIScaler from "./components/UIScaler";
import RedlineAppShell from "./components/RedlineAppShell";
import { ModeProvider, ViewModes } from "./context/ModeContext";

const FullChart = React.lazy(() => import("./pages/FullChart"));
const StrategiesFull = React.lazy(() => import("./pages/StrategiesFull"));
const JournalFull = React.lazy(() => import("./pages/JournalFull"));
const MarketMeterPage = React.lazy(() => import("./pages/redline/MarketMeterPage"));
const IndexSectorsPage = React.lazy(() => import("./pages/redline/IndexSectorsPage"));
const WaveDegreesPage = React.lazy(() => import("./pages/redline/WaveDegreesPage"));

const Engine25FullDashboard = React.lazy(() =>
  import("./pages/engine25/Engine25FullDashboard")
);

const Engine25CreditStressDetail = React.lazy(() =>
  import("./pages/engine25/Engine25CreditStressDetail")
);

const Engine25MarketXrayPreview = React.lazy(() =>
  import("./pages/engine25/Engine25MarketXrayPreview")
);

const Engine29FullDashboard = React.lazy(() =>
  import("./pages/engine29/Engine29FullDashboard")
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

  const url = useMemo(
    () => `${API_BASE.replace(/\/+$/, "")}/api/health`,
    []
  );

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

        setState((current) => ({
          ...current,
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
        background:
          "linear-gradient(90deg, rgba(27,5,5,.98), rgba(7,9,12,.99) 24%, rgba(7,9,12,.99))",
        borderBottom: "1px solid rgba(239,68,68,.26)",
        boxShadow: "0 4px 18px rgba(0,0,0,.34)",
        color: "#e5e7eb",
        fontSize: 12,
      }}
      data-healthbar
    >
      <div
        style={{
          minHeight: 34,
          display: "flex",
          gap: 12,
          alignItems: "center",
          padding: "5px 12px",
          flexWrap: "wrap",
        }}
      >
        <strong
          style={{
            color: "#ef4444",
            letterSpacing: ".06em",
            fontWeight: 1000,
          }}
        >
          REDLINE SYSTEM
        </strong>

        <span style={{ opacity: 0.28 }}>|</span>

        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            color: statusColor,
            fontWeight: 900,
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: 999,
              background: statusColor,
              display: "inline-block",
              boxShadow: `0 0 8px ${statusColor}88`,
            }}
          />
          {connected ? "BACKEND CONNECTED" : "BACKEND OFFLINE"}
        </span>

        <span style={{ opacity: 0.28 }}>|</span>

        <span style={{ color: "#94a3b8" }}>
          Heartbeat AZ:
          <strong style={{ color: "#cbd5e1", marginLeft: 5 }}>
            {heartbeat}
          </strong>
        </span>

        <span style={{ opacity: 0.28 }}>|</span>

        <span style={{ color: "#94a3b8" }}>
          Checked:
          <strong style={{ color: "#cbd5e1", marginLeft: 5 }}>
            {checked}
          </strong>
        </span>

        <span
          style={{
            marginLeft: "auto",
            color: "#64748b",
            fontWeight: 800,
            letterSpacing: ".04em",
            textTransform: "uppercase",
          }}
        >
          Powered by AI
        </span>

        {state.error && (
          <span
            style={{
              width: "100%",
              color: "#fca5a5",
              fontSize: 11,
            }}
          >
            {state.error}
          </span>
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
      defaultScale={0.6}
      defaultMode="manual"
      maxScale={1.6}
    >
      <ModeProvider initial={ViewModes.METER_TILES}>
        {children}
      </ModeProvider>
    </UIScaler>
  );
}

function RedlineModuleHeader({ title, subtitle }) {
  return (
    <div
      style={{
        border: "1px solid rgba(239,68,68,.24)",
        borderLeft: "4px solid #ef4444",
        borderRadius: 12,
        padding: "12px 14px",
        background:
          "linear-gradient(90deg, rgba(127,29,29,.16), rgba(10,13,17,.96) 32%)",
        marginBottom: 14,
      }}
    >
      <div
        style={{
          color: "#f8fafc",
          fontSize: 24,
          fontWeight: 1000,
          letterSpacing: ".02em",
        }}
      >
        {title}
      </div>
      <div style={{ color: "#94a3b8", fontSize: 13, marginTop: 4 }}>
        {subtitle}
      </div>
    </div>
  );
}

/* --------------------------------- App --------------------------------- */

export default function App() {
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
            {/* Engine 25 research pages are outside UIScaler */}

            <Route
              path="/engine25-full"
              element={<Engine25FullDashboard />}
            />

            <Route
              path="/engine25-credit-stress"
              element={<Engine25CreditStressDetail />}
            />

            <Route
              path="/engine25-market-xray-preview"
              element={
                <RedlineAppShell>
                  <Engine25MarketXrayPreview />
                </RedlineAppShell>
              }
            />

            <Route
              path="/engine29-full"
              element={<Engine29FullDashboard />}
            />

            {/* Normal dashboard routes stay inside UIScaler */}

            <Route
              path="/"
              element={
                <RedlineAppShell>
                  <Engine25MarketXrayPreview />
                </RedlineAppShell>
              }
            />

            <Route
              path="/market-meter"
              element={
                <RedlineAppShell>
                  <MarketMeterPage />
                </RedlineAppShell>
              }
            />

            <Route
              path="/index-sectors"
              element={
                <RedlineAppShell>
                  <IndexSectorsPage />
                </RedlineAppShell>
              }
            />

            <Route
              path="/wave-degrees"
              element={
                <RedlineAppShell>
                  <WaveDegreesPage />
                </RedlineAppShell>
              }
            />

            <Route
              path="/legacy-dashboard"
              element={
                <RedlineAppShell>
                  <ScaledDashboardShell>
                    <NewDashboard />
                  </ScaledDashboardShell>
                </RedlineAppShell>
              }
            />

            <Route
              path="/chart"
              element={
                <RedlineAppShell>
                  <RedlineModuleHeader
                    title="CHART"
                    subtitle="Live ES chart workspace with Engine overlays, structure, levels, and trade-planning tools."
                  />
                  <ScaledDashboardShell>
                    <FullChart />
                  </ScaledDashboardShell>
                </RedlineAppShell>
              }
            />

            <Route
              path="/strategies-full"
              element={
                <RedlineAppShell>
                  <RedlineModuleHeader
                    title="STRATEGIES"
                    subtitle="Wave structure, tactical setup state, candidate location, confirmation, and strategy readiness."
                  />
                  <ScaledDashboardShell>
                    <StrategiesFull />
                  </ScaledDashboardShell>
                </RedlineAppShell>
              }
            />

            <Route
              path="/journal-full"
              element={
                <RedlineAppShell>
                  <RedlineModuleHeader
                    title="JOURNAL"
                    subtitle="Trade history, contract-level outcomes, campaign tracking, and performance review."
                  />
                  <ScaledDashboardShell>
                    <JournalFull />
                  </ScaledDashboardShell>
                </RedlineAppShell>
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
