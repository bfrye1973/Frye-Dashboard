// src/pages/DashboardPage.jsx
// Page shell with a left sidebar for controls and a main content area.
// Drop your existing controls into <SidebarControls/> below.

import React from "react";

// TODO: replace this with your real control block (symbol/timeframe/indicators)
function SidebarControls() {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {/* Paste your actual controls JSX from the top-left here */}
      {/* Example placeholders (remove): */}
      <div className="panel" style={{ padding: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Symbol</div>
        {/* your <select> or buttons here */}
      </div>
      <div className="panel" style={{ padding: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Timeframe</div>
        {/* your <select> or buttons here */}
      </div>
      <div className="panel" style={{ padding: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Indicators</div>
        {/* your indicators toggles here */}
      </div>
    </div>
  );
}

export default function DashboardPage({ children }) {
  return (
    <div className="page-shell" style={shell}>
      <aside className="sidebar" style={sidebar}>
        <SidebarControls />
      </aside>
      <main className="main" style={main}>
        {children}
      </main>
    </div>
  );
}

const shell = {
  display: "grid",
  gridTemplateColumns: "300px 1fr",  // sidebar | main
  gap: 12,
  alignItems: "start",
};

const sidebar = {
  position: "sticky",   // keeps controls visible on scroll
  top: 12,
  alignSelf: "start",
  display: "block",
};

const main = {
  minWidth: 0,          // allows charts to shrink without overflow
  display: "grid",
  gap: 12,
};
