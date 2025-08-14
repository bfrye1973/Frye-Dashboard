// src/App.js
import React, { useEffect, useState } from "react";
import QuoteCard from "./components/QuoteCard"; // If you haven't created it yet, comment this line and the <QuoteCard /> below.

const API_BASE_URL =
  (typeof process !== "undefined" &&
    process.env &&
    (process.env.API_BASE_URL ||
      process.env.REACT_APP_API_BASE_URL ||
      process.env.VITE_API_BASE_URL)) ||
  "https://frye-market-backend-1.onrender.com";

// Small badge that shows backend status in the top-left
function BackendBadge() {
  const [online, setOnline] = useState(false);

  async function check() {
    try {
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
      }}
    >
      {txt}
    </div>
  );
}

// Simple ping box that calls GET /api/ping
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
        width: 300,
      }}
    >
      <h3 style={{ marginTop: 0 }}>Ping check</h3>
      <pre style={{ whiteSpace: "pre-wrap" }}>{text}</pre>
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
    <main
      style={{
        padding: 24,
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
      }}
    >
      <BackendBadge />
      <h1>Frye Dashboard (Staging)</h1>
      <p>Frontend is running. Backend badge is in the top-left.</p>

      <PingCard />

      {/* Shows the quote fetcher that calls /api/v1/quotes */}
      <QuoteCard />
    </main>
  );
}
