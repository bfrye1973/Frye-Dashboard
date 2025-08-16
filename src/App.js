// src/App.js
import React, { useEffect, useState } from "react";
import Header from "./components/Header";              // NEW
import CarbonGauge from "./components/CarbonGauge.jsx";

// -------------------- Config --------------------
const API_BASE =
  (typeof process !== "undefined" &&
    (process.env.API_BASE_URL ||
      process.env.REACT_APP_API_BASE_URL ||
      process.env.VITE_API_BASE_URL)) ||
  "https://frye-market-backend-1.onrender.com";

// Clamp helper
const clamp01 = (n) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));

// -------------------- App -----------------------
export default function App() {
  const [online, setOnline] = useState(false);
  const [mom, setMom] = useState(72);        // Momentum
  const [breadth, setBreadth] = useState(41);
  const [vol, setVol] = useState(63);
  const [liq, setLiq] = useState(55);

  // Health check (drives the green/red badge in the header)
  async function checkHealth() {
    try {
      const r = await fetch(`${API_BASE}/api/health`);
      if (r.ok) return setOnline(true);
      // fallback some backends expose /healthz
      const r2 = await fetch(`${API_BASE}/api/healthz`);
      setOnline(r2.ok);
    } catch {
      setOnline(false);
    }
  }

  // Pull metrics → map to our 4 gauges
  async function fetchMetrics() {
    try {
      const r = await fetch(`${API_BASE}/api/market-metrics`);
      if (!r.ok) throw new Error(`metrics ${r.status}`);
      const data = await r.json();

      // expected shape:
      // { timestamp, sectors: [{sector, newHighs, newLows, adrAvg }] }
      const sectors = Array.isArray(data?.sectors) ? data.sectors : [];

      // crude mapping (you’ll replace with your real formulas later)
      const highs = sectors.reduce((a, s) => a + (s.newHighs ?? 0), 0);
      const lows = sectors.reduce((a, s) => a + (s.newLows ?? 0), 0);
      const adrAvg =
        sectors.length > 0
          ? sectors.reduce((a, s) => a + (s.adrAvg ?? 0), 0) / sectors.length
          : 1;

      const sectorsActive = Math.max(1, sectors.length);

      const momentum = clamp01((highs - lows + 60) / 120) * 100; // 0–100
      const breadthPct = clamp01(highs / Math.max(1, highs + lows)) * 100;
      const volatility = clamp01((adrAvg - 0.8) / (2.0 - 0.8)) * 100;
      const liquidity = clamp01((highs + sectorsActive) / 60) * 100;

      setMom(Math.round(momentum));
      setBreadth(Math.round(breadthPct));
      setVol(Math.round(volatility));
      setLiq(Math.round(liquidity));
    } catch {
      // keep last values if API hiccups
    }
  }

  useEffect(() => {
    checkHealth();
    fetchMetrics();
    const t1 = setInterval(checkHealth, 15000);
    const t2 = setInterval(fetchMetrics, 20000);
    return () => {
      clearInterval(t1);
      clearInterval(t2);
    };
  }, []);

  return (
    <main style={styles.page}>
      {/* Header (Ferrari strip + badge) */}
      <Header online={online} />

      {/* TOP: 4 gauges */}
      <section style={styles.gaugeRow}>
        <div style={styles.gaugeColSm}>
          <CarbonGauge value={breadth} label="Breadth" size="sm" />
        </div>

        <div style={styles.gaugeColLg}>
          {/* Center “logo” gauge */}
          <CarbonGauge value={mom} label="Momentum" isLogo size="lg" />
        </div>

        <div style={styles.gaugeColSm}>
          <CarbonGauge value={vol} label="Volatility" size="sm" />
          <div style={{ height: 18 }} />
          <CarbonGauge value={liq} label="Liquidity / Fuel" size="sm" />
        </div>
      </section>

      {/* MIDDLE: 3 list panels */}
      <section style={styles.panelsRow}>
        <div style={styles.panel}>
          <div style={styles.panelTitle}>Wave 3 Scanner</div>
          <ListSkeleton rows={7} />
        </div>
        <div style={styles.panel}>
          <div style={styles.panelTitle}>Flagpole Breakouts</div>
          <ListSkeleton rows={7} />
        </div>
        <div style={styles.panel}>
          <div style={styles.panelTitle}>EMA Run (D/W)</div>
          <ListSkeleton rows={7} />
        </div>
      </section>

      {/* BOTTOM: Chart placeholder */}
      <section style={styles.chartWrap}>
        <div style={styles.chartTitle}>
          Live Chart <span style={{ opacity: 0.6, marginLeft: 8 }}>AAPL · 1m</span>
        </div>
        <div style={styles.chartBox}>Chart goes here (Lightweight Charts)</div>
      </section>
    </main>
  );
}

/* ---------- small shared pieces ---------- */

function ListSkeleton({ rows = 6 }) {
  return (
    <div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={styles.row}>
          <div style={styles.rowBar} />
          <button style={styles.viewBtn}>view</button>
        </div>
      ))}
    </div>
  );
}

/* ---------------- styles ----------------- */

const carbonBg =
  "repeating-linear-gradient(135deg,#0b0e13 0px,#0b0e13 4px,#11161f 4px,#11161f 8px)";

const styles = {
  page: {
    minHeight: "100vh",
    color: "#d9e2f1",
    background: "#070a0f",
    "--line": "#202733",
    "--soft": "#0f1520",
    letterSpacing: ".015em",
  },

  gaugeRow: {
    display: "grid",
    gridTemplateColumns: "380px 1fr 380px",
    gap: 24,
    padding: "20px 18px 8px",
    background: carbonBg,
    borderBottom: "1px solid var(--line)",
  },
  gaugeColSm: { display: "flex", flexDirection: "column", alignItems: "center" },
  gaugeColLg: { display: "flex", justifyContent: "center" },

  panelsRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 18,
    padding: "16px 18px",
  },
  panel: {
    background: "linear-gradient(180deg,#0b1320, #09101a)",
    border: "1px solid var(--line)",
    borderRadius: 10,
    padding: "10px 10px 12px",
    boxShadow: "inset 0 0 0 1px rgba(255,255,255,.02)",
  },
  panelTitle: {
    fontWeight: 700,
    fontSize: 13,
    letterSpacing: ".06em",
    margin: "6px 8px 10px",
    opacity: 0.9,
  },
  row: {
    display: "grid",
    gridTemplateColumns: "1fr 56px",
    alignItems: "center",
    gap: 8,
    padding: "6px 8px",
  },
  rowBar: {
    height: 8,
    borderRadius: 6,
    background:
      "linear-gradient(90deg,#213048,#2f466c,#3a5685)",
  },
  viewBtn: {
    fontSize: 12,
    padding: "4px 10px",
    borderRadius: 8,
    border: "1px solid #2a3342",
    background: "#0f1520",
    color: "#c9d6ea",
    cursor: "pointer",
  },

  chartWrap: { padding: "6px 18px 24px" },
  chartTitle: {
    margin: "10px 0 8px",
    fontWeight: 700,
    letterSpacing: ".06em",
  },
  chartBox: {
    height: 420,
    borderRadius: 10,
    border: "1px solid var(--line)",
    background: "linear-gradient(180deg,#0b1320, #09101a)",
    display: "grid",
    placeItems: "center",
    color: "#7c92b6",
  },
};
