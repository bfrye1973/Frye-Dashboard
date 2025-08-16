// src/App.js
import React, { useEffect, useState } from "react";
import LiveFeeds from "./pages/LiveFeeds.jsx"; // live chart + market panels
// import QuoteCard from "./components/QuoteCard"; // optional

const API_BASE_URL =
  (typeof window !== "undefined" && window.__API_BASE__) ||
  "https://frye-market-backend-1.onrender.com";

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
    <div style={{
      position: "fixed", top: 16, left: 16, background: bg, color: "#fff",
      padding: "6px 10px", borderRadius: 12, fontWeight: 600, zIndex: 9999
    }}>
      {txt}
    </div>
  );
}

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
  useEffect(() => { runPing(); }, []);
  return (
    <div style={{ padding: 16, background: "#0b1320", color: "#d9e1f2", borderRadius: 12, width: 320 }}>
      <h3 style={{ marginTop: 0 }}>Ping check</h3>
      <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>{text}</pre>
      <button onClick={runPing} style={{ marginTop: 8, padding: "6px 10px", borderRadius: 8 }}>
        Ping again
      </button>
    </div>
  );
}

export default function App() {
  return (
    <main style={{ padding: 24, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial" }}>
      <BackendBadge />
      <h1>Frye Dashboard — Live Feeds</h1>
      <p style={{ marginTop: 0 }}>Frontend is running & connected to backend (see badge at top-left).</p>
      <div style={{ marginBottom: 24 }}><PingCard /></div>
      <LiveFeeds />
    </main>
  );
}
