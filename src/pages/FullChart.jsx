// src/pages/FullChart.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import RowChart from "./rows/RowChart";                  // your existing chart row
import TradeDrawer from "../components/trading/TradeDrawer";
import usePaperStatus from "../hooks/usePaperStatus";    // for the tiny green/red pill

export default function FullChart() {
  const [params] = useSearchParams();
  const nav = useNavigate();

  // Query params (symbol + tf)
  const symbol = useMemo(() => (params.get("symbol") || "SPY").toUpperCase(), [params]);
  const tf     = useMemo(() => params.get("tf") || "10m", [params]);

  // Page scroll lock while full chart is open
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prevOverflow; };
  }, []);

  // Trade drawer
  const [tradeOpen, setTradeOpen] = useState(false);
  const { connected: paperConnected } = usePaperStatus(); // just to show live status dot on the button

  return (
    <div
      className="fullchart-page"
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        background: "#0b0f14",
        zIndex: 100, // below the drawer (drawer uses a higher z via portal)
      }}
    >
      {/* Top bar */}
      <div
        className="fullchart-topbar"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "8px 10px",
          borderBottom: "1px solid #1f2937",
          background: "#0b0f14",
          color: "#e5e7eb",
          flex: "0 0 auto",
        }}
      >
        <button
          className="fullchart-back"
          onClick={() => nav(-1)}
          style={{
            background: "transparent",
            color: "#93c5fd",
            border: "1px solid #1f2937",
            borderRadius: 8,
            padding: "6px 10px",
            cursor: "pointer",
          }}
        >
          ← Back
        </button>

        <div className="fullchart-title" style={{ fontWeight: 700 }}>Full Chart</div>
        <div className="fullchart-meta" style={{ opacity: 0.7 }}>
          {symbol} · {tf}
        </div>

        {/* spacer */}
        <div style={{ flex: 1 }} />

        {/* (Optional: put other header items here) */}
      </div>

      {/* Body fills the rest of the viewport */}
      <div
        className="fullchart-body"
        style={{
          position: "relative",
          flex: "1 1 auto",
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        {/* Render the same chart component, but in bare/fullscreen mode */}
        <RowChart
          key={`${symbol}-${tf}`}
          defaultSymbol={symbol}
          defaultTimeframe={tf}
          fullScreen
        />
      </div>

      {/* Floating Trade button (bottom-right). Safe overlay; does not affect layout */}
      <button
        onClick={() => setTradeOpen(true)}
        style={{
          position: "fixed",
          right: 18,
          bottom: 18,
          zIndex: 2200,
          background: "#1f2937",
          border: "1px solid #374151",
          color: "#e5e7eb",
          borderRadius: 12,
          padding: "10px 14px",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          boxShadow: "0 6px 16px rgba(0,0,0,0.35)",
        }}
        title="Open Trade Drawer"
      >
        <span style={{ fontWeight: 700 }}>Trade</span>
        <span
          style={{
            display: "inline-block",
            width: 8,
            height: 8,
            borderRadius: 999,
            background: paperConnected ? "#10b981" : "#ef4444",
          }}
        />
      </button>

      {/* Trade Drawer (portal; defined inside component for clarity) */}
      <TradeDrawer open={tradeOpen} onClose={() => setTradeOpen(false)} defaultSymbol={symbol} />
    </div>
  );
}
