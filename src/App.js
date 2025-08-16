// src/App.jsx
import React, { useEffect, useState } from "react";
import CarbonGauge, { LogoGauge } from "./components/CarbonGauge.jsx";

/** ---------- Config ---------- */
const API_BASE =
  (typeof process !== "undefined" &&
    process.env &&
    (process.env.API_BASE_URL ||
      process.env.REACT_APP_API_BASE_URL ||
      process.env.VITE_API_BASE_URL)) ||
  "https://frye-market-backend-1.onrender.com";

/** Map backend metrics to the 4 gauges (adjust later to your real logic) */
function mapMetricsToGauges(m) {
  const sectors = m?.sectors ?? [];
  const highs = sectors.reduce((a, s) => a + (s?.newHighs ?? 0), 0);
  const lows = sectors.reduce((a, s) => a + (s?.newLows ?? 0), 0);
  const adrAvg =
    sectors.length > 0
      ? sectors.reduce((a, s) => a + (s?.adrAvg ?? 1), 0) / sectors.length
      : 1;

  const clamp01 = (x) => Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0));

  const momentum = clamp01((highs - lows + 50) / 100) * 100;
  const breadth = clamp01(highs / Math.max(highs + lows, 1)) * 100;
  const volatility = clamp01((adrAvg - 0.8) / (2.2 - 0.8)) * 100;
  const liquidity = clamp01((highs + lows) / 60) * 100;

  return {
    momentum: Math.round(momentum),
    breadth: Math.round(breadth),
    volatility: Math.round(volatility),
    liquidity: Math.round(liquidity),
  };
}

/** ---------- Small helpers ---------- */
function Badge({ ok }) {
  return (
    <div
      style={{
        position: "fixed",
        top: 12,
        left: 12,
        padding: "6px 10px",
        borderRadius: 10,
        fontWeight: 800,
        fontSize: 12,
        color: "#fff",
        background: ok ? "#0f8a41" : "#8a1d1d",
        zIndex: 9,
      }}
    >
      Backend: {ok ? "online" : "offline"}
    </div>
  );
}

function Panel({ title, right, children }) {
  return (
    <div
      style={{
        background:
          "linear-gradient(180deg,#0f1420,#121827)",
        border: "1px solid #1f2637",
        borderRadius: 14,
        overflow: "hidden",
        minHeight: 220,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 12px 8px",
          borderBottom: "1px solid #1f2637",
          background: "linear-gradient(180deg,#0d1220,#0b101a)",
        }}
      >
        <span style={{ fontWeight: 800, letterSpacing: 0.4 }}>{title}</span>
        {right ? (
          <span
            style={{
              background: "#1b2232",
              border: "1px solid #2b3650",
              borderRadius: 10,
              padding: "2px 8px",
              fontSize: 12,
              opacity: 0.9,
            }}
          >
            {right}
          </span>
        ) : null}
      </div>
      <div style={{ padding: "10px 12px" }}>{children}</div>
    </div>
  );
}

function PlaceholderRows({ rows = 6 }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          style={{
            display: "grid",
            gridTemplateColumns: "16px 1fr 54px",
            gap: 10,
            alignItems: "center",
          }}
        >
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: "#2b3246",
            }}
          />
          <div
            style={{
              height: 8,
              background: "linear-gradient(90deg,#243050,#2a3a61)",
              borderRadius: 8,
            }}
          />
          <div
            style={{
              justifySelf: "end",
              background: "#243050",
              border: "1px solid #33416a",
              borderRadius: 10,
              padding: "2px 8px",
              fontSize: 12,
              color: "#c8d2ea",
            }}
          >
            view
          </div>
        </div>
      ))}
    </div>
  );
}

/** ---------- Main App ---------- */
export default function App() {
  const [online, setOnline] = useState(false);
  const [g, setG] = useState({
    momentum: 78,
    breadth: 42,
    volatility: 63,
    liquidity: 55,
  });

  async function load() {
    try {
      const r = await fetch(`${API_BASE}/api/market-metrics`);
      setOnline(r.ok);
      const data = r.ok ? await r.json() : null;
      if (data) setG(mapMetricsToGauges(data));
    } catch {
      setOnline(false);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      style={{
        background: "#0b0f16",
        color: "#e8edf7",
        minHeight: "100vh",
        fontFamily:
          "ui-sans-serif, system-ui, Segoe UI, Roboto, Helvetica, Arial",
      }}
    >
      <Badge ok={online} />

      {/* Header */}
      <header style={{ padding: "12px 20px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              height: 6,
              flex: 1,
              background:
                "linear-gradient(90deg,#E01E37,#c71a2f 60%, #7a1424)",
              borderRadius: 8,
            }}
          />
          <div
            style={{
              fontWeight: 900,
              fontSize: 26,
              letterSpacing: 2,
              opacity: 0.92,
            }}
          >
            REDLINE TRADING — Powered By AI
          </div>
        </div>
      </header>

      {/* Top Ferrari cluster */}
      <section style={{ padding: "10px 18px 0" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto 1fr",
            gap: 18,
            background:
              "radial-gradient(1200px 300px at 50% -20%, rgba(255,255,255,.04), transparent 60%),\
               repeating-linear-gradient(45deg, #0e0f13, #0e0f13 12px, #10131a 12px, #10131a 24px)",
            border: "1px solid #222a3d",
            borderRadius: 18,
            padding: "16px 16px 8px",
          }}
        >
          {/* Left column */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 16,
            }}
          >
            <CarbonGauge label="Breadth" value={g.breadth} size={200} redlineStart={70} />
          </div>

          {/* Center logo gauge */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <LogoGauge value={g.momentum} size={260} label="Momentum" />
          </div>

          {/* Right column */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 16,
              flexDirection: "column",
            }}
          >
            <CarbonGauge label="Volatility" value={g.volatility} size={200} redlineStart={65} />
            <CarbonGauge
              label="Liquidity / Fuel"
              value={g.liquidity}
              size={160}
              redlineStart={30}
            />
          </div>
        </div>
      </section>

      {/* Bottom panels */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3,1fr)",
          gap: 16,
          padding: "16px 18px 24px",
        }}
      >
        <Panel title="Wave 3 Scanner">
          <PlaceholderRows rows={6} />
        </Panel>

        <Panel title="Flagpole Breakouts">
          <PlaceholderRows rows={6} />
        </Panel>

        <Panel title="EMA Run (D/W)">
          <PlaceholderRows rows={6} />
        </Panel>

        <Panel title="Live Chart" right="AAPL • 1m">
          <div
            style={{
              height: 250,
              border: "1px dashed #2a3653",
              borderRadius: 10,
              display: "grid",
              placeItems: "center",
              color: "#9fb2df",
              background:
                "repeating-linear-gradient(90deg,#0f1422,#0f1422 8px,#11182a 8px,#11182a 16px)",
            }}
          >
            Chart goes here (Lightweight Charts)
          </div>
        </Panel>
      </section>
    </div>
  );
}
