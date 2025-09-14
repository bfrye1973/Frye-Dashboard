// src/App.js
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import NewDashboard from "./pages/NewDashboard";
import ErrorBoundary from "./ErrorBoundary";
import "./index.css";

// Lazy-load to keep the first load fast
const FullChart = React.lazy(() => import("./pages/FullChart"));

export default function App() {
  return (
    <div style={{ minHeight: "100vh" }}>
      <ErrorBoundary>
        <BrowserRouter>
          <React.Suspense fallback={<div style={{ padding: 16, color: "#9ca3af" }}>Loading…</div>}>
            <Routes>
              <Route path="/" element={<NewDashboard />} />
              <Route path="/chart" element={<FullChart />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </React.Suspense>
        </BrowserRouter>
      </ErrorBoundary>
    </div>
  );
}
