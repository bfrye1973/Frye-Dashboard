// Engine 2C Phase 3 — visual-only LIVE / RESEARCH rollback gate.
// Original RowChart is intentionally unmodified and only mounts in LIVE mode.
// No research candles can enter OHLC, execution, sizing, zones, Journal or Replay.
import React, { useState, useRef, useEffect } from "react";
import { useDashboardSnapshot } from "../hooks/useDashboardSnapshot";
import LegacyRowChart from "./rows/RowChart/index.jsx";

function initialMode() {
  if (typeof window === "undefined") return "LIVE";
  const search = new URLSearchParams(window.location.search);
  const override = search.get("engine2cChart");
  if (override === "live") return "LIVE";
  if (override === "research") return "RESEARCH";
  return process.env.REACT_APP_ENGINE2C_DEFAULT_RESEARCH === "true" ? "RESEARCH" : "LIVE";
}

export default function RowChartModeGate(props) {
  const [mode, setMode] = useState(initialMode);
  const frameRef = useRef(null);
  const { data: engine22Snapshot } = useDashboardSnapshot("ES", { pollMs: 20000 });
  const currentChartAnchors = engine22Snapshot?.strategies?.["intraday_scalp@10m"]?.engine22WaveStrategy?.chartAnchors || null;
  useEffect(() => {
    if (mode !== "RESEARCH" || !currentChartAnchors) return;
    const frame = frameRef.current;
    if (!frame?.contentWindow) return;
    const publish = () => frame.contentWindow?.postMessage({
      type: "ENGINE2D_CHART_ANCHORS_V1", packet: currentChartAnchors
    }, window.location.origin);
    publish();
    frame.addEventListener("load", publish);
    return () => frame.removeEventListener("load", publish);
  }, [mode, currentChartAnchors]);
  const research = mode === "RESEARCH";
  // Owner-only local test selection: the deployed dashboard stays on Render,
  // while historical prices are served exclusively from this computer.
  const localHistory = typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("engine2cHistory") === "local";
  const select = (next) => {
    setMode(next);
    // This flag changes only the visible frontend presentation, not engine authority.
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("engine2cChart", next.toLowerCase());
      window.history.replaceState(window.history.state, "", url.toString());
    }
  };
  return (
    <section data-engine2c-chart-gate style={{ minWidth: 0, width: "100%", ...(props.fullScreen ? { height: "100%", minHeight: 0, display: "flex", flexDirection: "column" } : {}) }}>
      <nav aria-label="Chart display selection" style={{
        display:"flex", alignItems:"center", flexWrap:"wrap", gap:8,
        padding:"9px 12px", color:"#e2e8f0", background:"#0b1220",
        border:"1px solid #334155", borderRadius:8, marginBottom:6
      }}>
        <strong style={{ marginRight:10 }}>ES CHART VIEW</strong>
        <button type="button" aria-pressed={!research} onClick={() => select("LIVE")}
          data-engine2c-live
          style={{ background:research?"#1e293b":"#166534", color:"white", border:"1px solid #64748b", borderRadius:6, padding:"7px 12px", cursor:"pointer" }}>
          LIVE — original chart
        </button>
        <button type="button" aria-pressed={research} onClick={() => select("RESEARCH")}
          data-engine2c-research
          style={{ background:research?"#92400e":"#1e293b", color:"white", border:"1px solid #64748b", borderRadius:6, padding:"7px 12px", cursor:"pointer" }}>
          RESEARCH — seven-degree ES
        </button>
        <span style={{ fontSize:12, color:"#fbbf24" }}>
          {research ? (localHistory ? "LOCAL AUTHENTIC ES HISTORY / RESEARCH ONLY" : "ARCHIVED SAMPLE / NOT LIVE / NONOFFICIAL") : "LIVE feeds + existing engine overlays"}
        </span>
      </nav>
      {research ? (
        <div data-engine2c-research-panel style={{ position:"relative",minWidth:0,width:"100%",height:props.fullScreen?"calc(100vh - 220px)":"min(860px, 85vh)",minHeight:470 }}>
          <iframe
            ref={frameRef}
            title="Engine 2C seven-degree ES research — historical research, not live"
            src={`${process.env.PUBLIC_URL || ""}/engine2c-research/index.html${localHistory ? "?engine2cHistory=local" : ""}`}
            loading="eager"
            style={{ width:"100%", height:"100%", border:"1px solid #334155", borderRadius:8, background:"#090e17" }}
            sandbox="allow-scripts allow-same-origin"
          />
        </div>
      ) : (
        <div data-engine2c-live-panel style={props.fullScreen ? { flex: "1 1 auto", minHeight: 0, height: "100%", display: "flex", flexDirection: "column" } : undefined}><LegacyRowChart {...props} /></div>
      )}
    </section>
  );
}
