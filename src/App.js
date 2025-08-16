// src/App.js
import React, { useEffect, useState } from "react";
import LogoFerrari from "./components/LogoFerrari.jsx";
import CarbonGauge from "./components/CarbonGauge.jsx";
import LiveFeeds from "./pages/LiveFeeds.jsx";

/**
 * Backend base URL
 * - You can override by setting window.__API_BASE__ in public/index.html
 */
const API_BASE_URL =
  (typeof window !== "undefined" && window.__API_BASE__) ||
  "https://frye-market-backend-1.onrender.com";

/* ---------- Small status badge (fixed, top-left) ---------- */
function BackendBadge() {
  const [online, setOnline] = useState(false);

  useEffect(() => {
    const ping = async () => {
      try {
        const r = await fetch(`${API_BASE_URL}/api/healthz`);
        setOnline(r.ok);
      } catch {
        setOnline(false);
      }
    };
    ping();
    const id = setInterval(ping, 15000);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        top: 16,
        left: 16,
        zIndex: 2000,
        background: online ? "#0b5d1e" : "#6b0d0d",
        color: "#fff",
        padding: "6px 10px",
        borderRadius: 12,
        fontWeight: 800,
      }}
    >
      {online ? "Backend: online" : "Backend: offline"}
    </div>
  );
}

/* ---------- Quick ping card (for sanity checks) ---------- */
function PingCard() {
  const [text, setText] = useState("—");

  async function runPing() {
    try {
      const r = await fetch(`${API_BASE_URL}/api/ping`);
      if (!r.ok) throw new Error(`Ping ${r.status}`);
      const json = await r.json();
      setText(JSON.stringify(json, null, 2));
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
        border: "1px solid #1b2130",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
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

/* ------------------------------ App ------------------------------ */
export default function App() {
  return (
    <>
      <BackendBadge />

      {/* BIG Ferrari-style tach logo banner */}
      <LogoFerrari />

      <main
        style={{
          padding: 24,
          maxWidth: 1400,
          margin: "0 auto",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
        }}
      >
        {/* Top row: ping + three Ferrari gauges */}
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

        {/* Live tiles + chart */}
        <h2 style={{ margin: "6px 0 12px" }}>Trading Platform — Live Feeds</h2>
        <LiveFeeds />
      </main>
    </>
  );
}
