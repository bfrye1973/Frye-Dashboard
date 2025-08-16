// src/App.js
import React, { useEffect, useState } from "react";
import HeaderBar from "./components/HeaderBar.jsx";
import CarbonGauge from "./components/CarbonGauge.jsx";
import LiveFeeds from "./pages/LiveFeeds.jsx";

// Read backend base from global (set in index.html). No process.env in browser.
const API_BASE_URL =
  (typeof window !== "undefined" && window.__API_BASE__) ||
  "https://frye-market-backend-1.onrender.com";

// Backend status badge (top-left floating)
function BackendBadge() {
  const [online, setOnline] = useState(false);
  useEffect(() => {
    const run = async () => {
      try {
        const r = await fetch(`${API_BASE_URL}/api/healthz`);
        setOnline(r.ok);
      } catch {
        setOnline(false);
      }
    };
    run();
    const id = setInterval(run, 15000);
    return () => clearInterval(id);
  }, []);
  const bg = online ? "#0b5d1e" : "#6b0d0d";
  const txt = online ? "Backend: online" : "Backend: offline";
  return (
    <div
      style={{
        position: "fixed",
        top: 16,
        left: 16,
        background: bg,
        color: "#fff",
        padding: "6px 10px",
        borderRadius: 12,
        fontWeight: 700,
        zIndex: 2000,
      }}
    >
      {txt}
    </div>
  );
}

// Small ping card (kept so you can verify API quickly)
function PingCard() {
  const [text, setText] = useState("—");
  async function runPing() {
    try {
      const r = await fetch(`${API_BASE_URL}/api/ping`);
      if (!r.ok) throw new Error(`Ping ${r.status}`);
      const data = await r.json();
      setText(JSON.stringify(data, null, 2));
    } catch (e) {
      setText(`Error: ${e?.message || e}`);
    }
  }
  useEffect(() => {
    runPing();
  }, []);
  return (
    <div
      style={{
        padding: 16,
        background: "#0b1320",
        color: "#d9e1f2",
        borderRadius: 12,
        width: 320,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
        border: "1px solid #1b2130",
      }}
    >
      <h3 style={{ marginTop: 0 }}>Ping check</h3>
      <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>{text}</pre>
      <button
        onClick={runPing}
        style={{ marginTop: 8, padding: "6px 10px", borderRadius: 8 }}
      >
        Ping again
      </button>
    </div>
  );
}

export default function App() {
  return (
    <>
      <BackendBadge />
      <HeaderBar />

      <main
        style={{
          padding: 24,
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
          maxWidth: 1400,
          margin: "0 auto",
        }}
      >
        {/* top row: ping + three Ferrari gauges */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "320px 1fr 1fr 1fr",
            gap: 14,
            alignItems: "stretch",
            marginBottom: 18,
          }}
        >
          <PingCard />
          <CarbonGauge value={78} label="Momentum" hint="Uptrend strength" />
          <CarbonGauge value={42} label="Breadth" hint="Advancers vs decliners" />
          <CarbonGauge value={63} label="Volatility" hint="Risk pulse" />
        </div>

        {/* live tiles + chart */}
        <h2 style={{ margin: "6px 0 12px" }}>Trading Platform — Live Feeds</h2>
        <LiveFeeds />
      </main>
    </>
  );
}
