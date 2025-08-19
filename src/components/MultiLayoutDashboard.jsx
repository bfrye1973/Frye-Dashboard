import React, { useEffect, useMemo, useRef, useState } from "react";
import { createChart } from "lightweight-charts";

// If you already have src/lib/api.js with apiUrl(), import it:
// import { apiUrl } from "../lib/api";

// Tiny helper if apiUrl() isn't available:
const apiUrl = (p) => {
  const base =
    (typeof window !== "undefined" && window.__API_BASE__) ||
    (window.location.hostname.includes("localhost") ? "" : "");
  return `${base}${p.startsWith("/") ? p : `/${p}`}`;
};

// ---- Layout presets ---------------------------------------------------------
const LAYOUTS = {
  "1×1": { key: "1x1", rows: 1, cols: 1, defaults: ["SPY"] },
  "2×2": { key: "2x2", rows: 2, cols: 2, defaults: ["SPY", "QQQ", "IWM", "MDY"] },
  "3×3": {
    key: "3x3",
    rows: 3,
    cols: 3,
    defaults: ["SPY", "QQQ", "IWM", "MDY", "DIA", "NDX", "XLF", "XLK", "XLE"],
  },
};

// ---- One chart box ----------------------------------------------------------
function ChartBox({ symbol, timeframe, onChangeSymbol }) {
  const wrapRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);

  // Load history for symbol+tf
  async function load(symbol, tf) {
    try {
      const url = apiUrl(`/api/v1/ohlc?symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(tf)}`);
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) throw new Error(`OHLC ${r.status}`);
      const j = await r.json();

      const bars = Array.isArray(j?.bars)
        ? j.bars
        : Array.isArray(j)
        ? j
        : [];

      const out = bars.map((b) => ({
        time: Math.floor((b.t ?? b.time) / 1000),
        open: +(b.o ?? b.open),
        high: +(b.h ?? b.high),
        low: +(b.l ?? b.low),
        close: +(b.c ?? b.close),
      }));

      seriesRef.current?.setData(out);
    } catch (e) {
      console.error("fetchHistory error:", e);
      // Render nothing rather than throw; keeps UI responsive
      seriesRef.current?.setData([]);
    }
  }

  useEffect(() => {
    if (!wrapRef.current) return;

    // Create chart
    const chart = createChart(wrapRef.current, {
      width: wrapRef.current.clientWidth,
      height: wrapRef.current.clientHeight,
      layout: { background: { type: "Solid", color: "#0f1117" }, textColor: "#d1d4dc" },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.06)" },
        horzLines: { color: "rgba(255,255,255,0.06)" },
      },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: timeframe !== "1d", secondsVisible: timeframe === "1m" },
      crosshair: { mode: 1 },
    });
    const series = chart.addCandlestickSeries({
      upColor: "#26a69a",
      downColor: "#ef5350",
      borderUpColor: "#26a69a",
      borderDownColor: "#ef5350",
      wickUpColor: "#26a69a",
      wickDownColor: "#ef5350",
    });

    chartRef.current = chart;
    seriesRef.current = series;

    // Resize observer
    const ro = new ResizeObserver(() => {
      chart.applyOptions({
        width: wrapRef.current?.clientWidth || 300,
        height: wrapRef.current?.clientHeight || 200,
      });
    });
    ro.observe(wrapRef.current);

    // Initial load
    load(symbol, timeframe).then(() => {
      chart.timeScale().fitContent();
    });

    return () => {
      try { ro.disconnect(); } catch {}
      try { chart.remove(); } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload when symbol/tf changes
  useEffect(() => {
    load(symbol, timeframe);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, timeframe]);

  return (
    <div className="chartCell">
      <div className="chartHeader">
        <input
          className="symInput"
          value={symbol}
          onChange={(e) => onChangeSymbol(e.target.value.toUpperCase())}
          spellCheck={false}
        />
        <span className="hdrRight">{timeframe.toUpperCase()}</span>
      </div>
      <div ref={wrapRef} className="chartCanvas" />
    </div>
  );
}

// ---- Main dashboard with tabs ----------------------------------------------
export default function MultiLayoutDashboard() {
  const tabKeys = Object.keys(LAYOUTS);
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem("ml.activeTab") || tabKeys[0];
  });

  const [timeframe, setTimeframe] = useState(() => {
    return localStorage.getItem("ml.timeframe") || "1d";
  });

  // Per-layout symbols state (persisted)
  const [symbolsByLayout, setSymbolsByLayout] = useState(() => {
    const saved = localStorage.getItem("ml.symbolsByLayout");
    if (saved) return JSON.parse(saved);
    const obj = {};
    for (const name of tabKeys) {
      obj[name] = LAYOUTS[name].defaults.slice();
    }
    return obj;
  });

  useEffect(() => {
    localStorage.setItem("ml.activeTab", activeTab);
  }, [activeTab]);

  useEffect(() => {
    localStorage.setItem("ml.timeframe", timeframe);
  }, [timeframe]);

  useEffect(() => {
    localStorage.setItem("ml.symbolsByLayout", JSON.stringify(symbolsByLayout));
  }, [symbolsByLayout]);

  const layout = LAYOUTS[activeTab];
  const totalSlots = layout.rows * layout.cols;
  const symbols = useMemo(() => {
    const arr = (symbolsByLayout[activeTab] || []).slice(0, totalSlots);
    // pad with SPY if fewer than cells
    while (arr.length < totalSlots) arr.push("SPY");
    return arr;
  }, [symbolsByLayout, activeTab, totalSlots]);

  function updateSymbolAt(idx, val) {
    setSymbolsByLayout((prev) => {
      const next = { ...prev };
      const arr = (next[activeTab] || []).slice();
      arr[idx] = val || "SPY";
      next[activeTab] = arr;
      return next;
    });
  }

  return (
    <div className="multiWrap">

      {/* Tabs */}
      <div className="tabs">
        {tabKeys.map((name) => (
          <button
            key={name}
            className={`tab ${name === activeTab ? "active" : ""}`}
            onClick={() => setActiveTab(name)}
          >
            {name}
          </button>
        ))}

        <div className="spacer" />

        {/* Timeframe selector */}
        <select
          className="tfSelect"
          value={timeframe}
          onChange={(e) => setTimeframe(e.target.value)}
          title="Timeframe"
        >
          <option value="1m">1m</option>
          <option value="5m">5m</option>
          <option value="15m">15m</option>
          <option value="1h">1h</option>
          <option value="1d">1d</option>
        </select>
      </div>

      {/* Grid */}
      <div
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${layout.cols}, 1fr)`,
          gridTemplateRows: `repeat(${layout.rows}, minmax(240px, 1fr))`,
        }}
      >
        {symbols.map((sym, i) => (
          <ChartBox
            key={`${activeTab}-${i}`}
            symbol={sym}
            timeframe={timeframe}
            onChangeSymbol={(s) => updateSymbolAt(i, s)}
          />
        ))}
      </div>

      {/* Styles */}
      <style>{`
        .multiWrap { height: 100vh; display: flex; flex-direction: column; background:#0d1117; color:#d1d4dc; }
        .tabs { display:flex; align-items:center; padding:10px; gap:8px; border-bottom:1px solid #1b2130; }
        .tab { background:#0f1320; color:#d1d4dc; border:1px solid #1b2130; padding:6px 10px; border-radius:6px; cursor:pointer; }
        .tab.active { background:#1a2236; border-color:#2a3350; }
        .spacer { flex:1; }
        .tfSelect { background:#0f1320; color:#d1d4dc; border:1px solid #1b2130; padding:6px 8px; border-radius:6px; }

        .grid { flex:1; display:grid; gap:8px; padding:8px; overflow:auto; }
        .chartCell { position:relative; border:1px solid #1b2130; border-radius:10px; overflow:hidden; background:#0f1117; }
        .chartHeader {
          position:absolute; z-index:5; top:6px; left:6px; right:6px;
          display:flex; align-items:center; justify-content:space-between;
          pointer-events:none;
        }
        .symInput {
          pointer-events:auto; width:86px; background:#0f1320; color:#d1d4dc;
          border:1px solid #1b2130; border-radius:6px; padding:2px 6px; font-weight:600;
        }
        .hdrRight { background:rgba(255,255,255,0.06); padding:2px 6px; border-radius:6px; }
        .chartCanvas { position:absolute; inset:0; }
      `}</style>
    </div>
  );
}
