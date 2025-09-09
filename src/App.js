// src/App.js
import React from "react";
import NewDashboard from "./pages/NewDashboard";
import ErrorBoundary from "./ErrorBoundary";
import "./index.css";

export default function App() {
  return (
    <div style={{ minHeight: "100vh" }}>
      <ErrorBoundary>
        <NewDashboard />
      </ErrorBoundary>
    </div>
  );
}
