// src/App.js
import React, { useEffect, useState } from "react";
import CarbonGauge from "./components/CarbonGauge.jsx";
import LiveFeeds from "./pages/LiveFeeds.jsx";

// Ferrari gauge SVG logo (inline, so no hosting needed)
function FerrariLogo() {
  return (
    <svg width="200" height="100" viewBox="0 0 1200 700">
      <defs>
        <pattern id="cf" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="skewX(-20)">
          <rect width="16" height="16" fill="#0b0b0b"/>
          <rect x="0" y="0" width="8" height="16" fill="#111"/>
          <rect x="0" y="0" width="16" height="8" fill="#131313"/>
          <rect x="0" y="8" width="8" height="8" fill="#0e0e0e"/>
          <rect x="8" y="0" width="8" height="8" fill="#0e0e0e"/>
        </pattern>
        <radialGradient id="rim" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#cfd3d6"/>
          <stop offset="40%" stopColor="#9aa0a4"/>
          <stop offset="60%" stopColor="#e7eaec"/>
          <stop offset="100%" stopColor="#6e757a"/>
        </radialGradient>
        <linearGradient id="bevel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1a1a1a"/>
          <stop offset="100%" stopColor="#050505"/>
        </linearGradient>
        <radialGradient id="dial" cx="45%" cy="40%" r="75%">
          <stop offset="0%" stopColor="#ffd84d"/>
          <stop offset="60%" stopColor="#ffcc00"/>
          <stop offset="100%" stopColor="#e5b300"/>
        </radialGradient>
      </defs>
      <circle cx="350" cy="330" r="250" fill="url(#rim)"/>
      <circle cx="350" cy="330" r="230" fill="url(#bevel)"/>
      <circle cx="350" cy="330" r="220" fill="url(#dial)"/>
      <line x1="350" y1="330" x2="520" y2="250" stroke="#c40000" strokeWidth="12" strokeLinecap="round"/>
      <circle cx="350" cy="330" r="24" fill="#1a1a1a" stroke="#555" strokeWidth="2"/>
      <text x="650" y="360" fontSize="72" fontWeight="bold" fill="#fff">FRYE DASHBOARD</text>
    </svg>
  );
}

// Backend badge
const API_BASE_URL = "https://frye-market-backend-1.onrender.com";
function BackendBadge() {
  const [online, setOnline] = useState(false);
  useEffect(() => {
    const run = async () => {
      try {
        const r = await fetch(`${API_BASE_URL}/api/healthz`);
        setOnline(r.ok);
      } catch { setOnline(false); }
    };
    run();
    const id = setInterval(run, 15000);
    return () => clearInterval(id);
  }, []);
  const bg = online ? "#0b5d1e" : "#6b0d0d";
  const txt = online ? "Backend: online" : "Backend: offline";
  return (
    <div style={{
      position:"fixed", top:16, left:16, background:bg, color:"#fff",
      padding:"6px 10px", borderRadius:12, fontWeight:700, zIndex:2000
    }}>{txt}</div>
  );
}

// Ping card
function PingCard() {
  const [text, setText] = useState("—");
  async function runPing() {
    try {
      const r = await fetch(`${API_BASE_URL}/api/ping`);
      const data = await r.json();
      setText(JSON.stringify(data,null,2));
    } catch (e) { setText(`Error: ${e?.message||e}`); }
  }
  useEffect(()=>{ runPing(); },[]);
  return (
    <div style={{padding:16, background:"#0b1320", color:"#d9e1f2",
      borderRadius:12, width:320, border:"1px solid #1b2130"}}>
      <h3 style={{marginTop:0}}>Ping check</h3>
      <pre style={{whiteSpace:"pre-wrap",margin:0}}>{text}</pre>
      <button onClick={runPing} style={{marginTop:8, padding:"6px 10px", borderRadius:8}}>Ping again</button>
    </div>
  );
}

export default function App() {
  return (
    <>
      <BackendBadge />
      <header style={{padding:20, textAlign:"center", background:"#0f0f0f", borderBottom:"2px solid #1b2130"}}>
        <FerrariLogo />
      </header>

      <main style={{padding:24, maxWidth:1400, margin:"0 auto", fontFamily:"system-ui"}}>
        <div style={{display:"grid", gridTemplateColumns:"320px 1fr 1fr 1fr", gap:14, marginBottom:18}}>
          <PingCard />
          <CarbonGauge value={78} label="Momentum" hint="Uptrend strength"/>
          <CarbonGauge value={42} label="Breadth" hint="Advancers vs decliners"/>
          <CarbonGauge value={63} label="Volatility" hint="Risk pulse"/>
        </div>
        <h2 style={{margin:"6px 0 12px"}}>Trading Platform — Live Feeds</h2>
        <LiveFeeds />
      </main>
    </>
  );
}
