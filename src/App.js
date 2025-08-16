// src/App.js
import React, { useEffect, useState } from "react";
import LiveFeeds from "./pages/LiveFeeds.jsx"; // ← live chart + market panels
// import QuoteCard from "./components/QuoteCard"; // optional: leave commented if not present

// ---- Backend base URL (keeps your original logic, adds common env names) ----
const API_BASE_URL =
  (typeof process !== "undefined" &&
    process.env &&
    (process.env.API_BASE_URL ||
      process.env.REACT_APP_API_BASE ||       // common CRA name
      process.env.REACT_APP_API_BASE_URL ||   // your existing name
      process.env.VITE_API_BASE_URL)) ||      // Vite-style
  "https://frye-market-backend-1.onrender.com";

// ---- Small badge that shows backend status (unchanged behavior) ----
function BackendBadge() {
  const [online, setOnline] = useState(false);

  async function check() {
    try {
      // your backend exposes /api/healthz – keep that endpoint
      const r = await fetch(`${API_BASE_URL}/api/healthz`);
      setOnline(r.ok);
    } catch {
      setOnline(false);
    }
  }

  useEffect(() => {
    check();
    const id = setInterval(check, 15000); // re-check every 15s
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
        fontWeight: 600,
        zIndex: 9999,
      }}
    >
      {txt}
    </div>
  );
}

// ---- Simple ping box that calls GET /api/ping (kept from your file) ----
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

// ---- App: shows your badge + ping card + the new Live Feeds page ----
export default function App() {
  return (
    <main
      style={{
        padding: 24,
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
      }}
    >
      <BackendBadge />
      <h1>Frye Dashboard — Live Feeds</h1>
      <p style={{ marginTop: 0 }}>
        Frontend is running & connected to backend (see badge at top-left).
      </p>

      <div style={{ marginBottom: 24 }}>
        <PingCard />
      </div>

      {/* Live page: sector panels + candlestick chart */}
      <LiveFeeds />

      {/* Optional: keep your QuoteCard below if/when you have the component */}
      {/* <div style={{ marginTop: 24 }}>
        <QuoteCard />
      </div> */}
    </main>
  );
}
