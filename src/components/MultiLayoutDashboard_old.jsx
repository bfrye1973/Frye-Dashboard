// src/components/MultiLayoutDashboard.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createChart } from "lightweight-charts";

/* -----------------------------------------------------------------------------
   Tiny apiUrl helper. If you already have src/lib/api.js, replace with that.
----------------------------------------------------------------------------- */
const apiUrl = (p) => {
  const base =
    (typeof window !== "undefined" && window.__API_BASE__) ||
    (window.location.hostname.includes("localhost") ? "" : "");
  return `${base}${p.startsWith("/") ? p : `/${p}`}`;
};

/* -----------------------------------------------------------------------------
   Layout presets
----------------------------------------------------------------------------- */
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

/* -----------------------------------------------------------------------------
   One chart box
----------------------------------------------------------------------------- */
function ChartBox({ symbol, timeframe, onChangeSymbol }) {
  const wrapRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);

  async function load(sym, tf) {
    try {
      const url = apiUrl(
        `/api/v1/ohlc?symbol=${encodeURIComponent(sym)}&timeframe=${encodeURIComponent(tf)}`
      );
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) throw new Error(`OHLC ${r.status}`);
      const j = await r.json();

      const bars = Array.isArray(j?.bars) ? j.bars : Array.isArray(j) ? j : [];
      const out = bars
        .map((b) => ({
          time: Math.floor((b.t ?? b.time) / 1000),
          open: +(b.o ?? b.open),
          high: +(b.h ?? b.high),
          low: +(b.l ?? b.low),
          close: +(b.c ?? b.close),
        }))
        .filter((b) => Number.isFinite(b.open));

      seriesRef.current?.setData(out);
    } catch (e) {
      console.error("fetchHistory error:", e);
      seriesRef.current?.setData([]);
    }
  }

  useEffect(() => {
    if (!wrapRef.current) return;

    const chart = createChart(wrapRef.current, {
      width: wrapRef.current.clientWidth,
      height: wrapRef.current.clientHeight,
      layout: { background: { type: "Solid", color: "#0f1117" }, textColor: "#d1d4dc" },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.06)" },
        horzLines: { color: "rgba(255,255,255,0.06)" },
      },
      rightPriceScale: { borderVisible: false },
      timeScale: {
        borderVisible: false,
        timeVisible: timeframe !== "1d",
        secondsVisible: timeframe === "1m",
      },
      crosshair: { mode: 1 },
    });

    const series = chart.addCandlestickSeries({
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderUpColor: "#22c55e",
      borderDownColor: "#ef4444",
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const ro = new ResizeObserver(() => {
      if (!wrapRef.current) return;
      chart.applyOptions({
        width: wrapRef.current.clientWidth,
        height: wrapRef.current.clientHeight,
      });
    });
    ro.observe(wrapRef.current);

    load(symbol, timeframe).then(() => chart.timeScale().fitContent());

    return () => {
      try { ro.disconnect(); } catch {}
      try { chart.remove(); } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

/* -----------------------------------------------------------------------------
   Main Dashboard (no vh; uses fixed header + flexible grid)
----------------------------------------------------------------------------- */
export default function MultiLayoutDashboard() {
  const tabKeys = Object.keys(LAYOUTS);

  const [activeTab, setActiveTab] = useState(
    () => localStorage.getItem("ml.activeTab") || tabKeys[0]
  );
  const [timeframe, setTimeframe] = useState(
    () => localStorage.getItem("ml.timeframe") || "1d"
  );

  const [symbolsByLayout, setSymbolsByLayout] = useState(() => {
    const saved = localStorage.getItem("ml.symbolsByLayout");
    if (saved) return JSON.parse(saved);
    const obj = {};
    for (const name of tabKeys) obj[name] = LAYOUTS[name].defaults.slice();
    return obj;
  });

  useEffect(() => localStorage.setItem("ml.activeTab", activeTab), [activeTab]);
  useEffect(() => localStorage.setItem("ml.timeframe", timeframe), [timeframe]);
  useEffect(
    () => localStorage.setItem("ml.symbolsByLayout", JSON.stringify(symbolsByLayout)),
    [symbolsByLayout]
  );

  const layout = LAYOUTS[activeTab];
  const totalSlots = layout.rows * layout.cols;
  const symbols = useMemo(() => {
    const arr = (symbolsByLayout[activeTab] || []).slice(0, totalSlots);
    while (arr.length < totalSlots) arr.push("SPY");
    return arr;
  }, [symbolsByLayout, activeTab, totalSlots]);

  function updateSymbolAt(idx, val) {
    setSymbolsByLayout((prev) => {
      const next = { ...prev };
      const arr = (next[activeTab] || []).slice();
      arr[idx] = (val || "SPY").toUpperCase();
      next[activeTab] = arr;
      return next;
    });
  }

  return (
    <div className="multiWrap">
      {/* Header (fixed height; no vh anywhere) */}
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

      {/* Grid (fills remaining space; scrolls if needed) */}
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

      {/* Local styles (no vh usage) */}
      <style>{`
        /* Shell: column layout, fixed header, flexible grid area */
        .multiWrap {
          height: 100%;
          min-height: 0;                  /* allow children to size themselves */
          display: flex;
          flex-direction: column;
          background: #0d1117;
          color: #d1d4dc;
        }

        .tabs {
          flex: 0 0 52px;                 /* fixed header, prevents blow-ups */
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 10px;
          border-bottom: 1px solid #1b2130;
          background: #0f1320;
        }
        .tab {
          background:#0f1320;
          color:#d1d4dc;
          border:1px solid #1b2130;
          padding:6px 10px;
          border-radius:6px;
          cursor:pointer;
        }
        .tab.active { background:#1a2236; border-color:#2a3350; }
        .spacer { flex: 1; }
        .tfSelect {
          background:#0f1320; color:#d1d4dc; border:1px solid #1b2130;
          padding:6px 8px; border-radius:6px;
        }

        .grid {
          /* take the rest of the height; scroll instead of stretching page */
          flex: 1 1 auto;
          min-height: 0;
          display: grid;
          gap: 8px;
          padding: 8px;
          overflow: auto;
          background: #0d1117;
        }

        .chartCell {
          position: relative;
          border: 1px solid #1b2130;
          border-radius: 10px;
          overflow: hidden;
          background: #0f1117;
          min-height: 240px;
        }

        .chartHeader {
          position: absolute;
          z-index: 5;
          top: 6px; left: 6px; right: 6px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          pointer-events: none;
        }
        .symInput {
          pointer-events: auto;
          width: 86px;
          background:#0f1320; color:#d1d4dc;
          border:1px solid #1b2130; border-radius:6px;
          padding:2px 6px; font-weight:600;
        }
        .hdrRight {
          background: rgba(255,255,255,0.06);
          padding: 2px 6px;
          border-radius: 6px;
        }

        .chartCanvas {
          position: absolute; inset: 0;
        }
      `}</style>
    </div>
  );
}
