// src/pages/rows/RowEngineLights.jsx
import React, { useEffect, useRef, useState } from "react";
import { useDashboardPoll } from "../../lib/dashboardApi";
import { LastUpdated } from "../../components/LastUpdated";

/* ------------------------------------------------------------------ */
/* Color pill                                                          */
/* ------------------------------------------------------------------ */
function Light({ label, tone = "info", active = true }) {
  // Bright legend-aligned tones (green / yellow / red)
  const palette = {
    ok:     { bg:"#22c55e", fg:"#0b1220", bd:"#16a34a", shadow:"#16a34a" }, // green
    warn:   { bg:"#facc15", fg:"#111827", bd:"#ca8a04", shadow:"#ca8a04" }, // yellow
    danger: { bg:"#ef4444", fg:"#fee2e2", bd:"#b91c1c", shadow:"#b91c1c" }, // red
    info:   { bg:"#0b1220", fg:"#93c5fd", bd:"#334155", shadow:"#334155" },
    off:    { bg:"#0b0f17", fg:"#6b7280", bd:"#1f2937", shadow:"#111827" }
  }[tone] || { bg:"#0b1220", fg:"#93c5fd", bd:"#334155", shadow:"#334155" };

  return (
    <span
      title={label}
      style={{
        display:"inline-flex", alignItems:"center",
        padding:"6px 10px", marginRight:8,
        borderRadius:8, fontWeight:700, fontSize:12,
        background: palette.bg, color: palette.fg, border:`1px solid ${palette.bd}`,
        boxShadow: `0 0 10px ${palette.shadow}55`,
        opacity: active ? 1 : 0.45, filter: active ? "none" : "grayscale(40%)"
      }}
    >
      {label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Legend content (modal body)                                         */
/* ------------------------------------------------------------------ */
function Swatch({ color, label, note }) {
  return (
    <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:6}}>
      <span style={{
        width:36, height:12, borderRadius:12, background:color,
        display:"inline-block", border:"1px solid rgba(255,255,255,0.1)"
      }} />
      <span style={{ color:"#e5e7eb", fontSize:12, fontWeight:700 }}>{label}</span>
      <span style={{ color:"#cbd5e1", fontSize:12 }}>— {note}</span>
    </div>
  );
}
function EngineLightsLegendContent(){
  return (
    <div>
      <div style={{ color:"#f9fafb", fontSize:14, fontWeight:800, marginBottom:8 }}>
        Engine Lights — Legend
      </div>
      {/* … (unchanged legend content) … */}
      {/* Breakout */}
      <div style={{ color:"#e5e7eb", fontSize:13, fontWeight:700, marginTop:6 }}>Breakout</div>
      <div style={{ color:"#d1d5db", fontSize:12 }}>
        Market getting ready to make a move — heads-up to prepare for entry.
      </div>
      <div style={{ color:"#f9fafb", fontSize:12, marginTop:2, marginLeft:8 }}>
        Example: Breakout active → More stocks making new highs than lows. Attention: possible entry opportunity.
      </div>
      <Swatch color="#22c55e" label="Active" note="Market setting up for move." />
      {/* Distribution */}
      <div style={{ color:"#e5e7eb", fontSize:13, fontWeight:700, marginTop:6 }}>Distribution</div>
      <div style={{ color:"#d1d5db", fontSize:12 }}>
        Market might be turning direction — breadth flipping negative.
      </div>
      <div style={{ color:"#f9fafb", fontSize:12, marginTop:2, marginLeft:8 }}>
        Example: Distribution active → More stocks making new lows than highs. Possible trend reversal warning.
      </div>
      <Swatch color="#ef4444" label="Active" note="Breadth negative, potential reversal." />
      {/* Compression */}
      <div style={{ color:"#e5e7eb", fontSize:13, fontWeight:700, marginTop:6 }}>Compression</div>
      <div style={{ color:"#d1d5db", fontSize:12 }}>
        Market in a squeeze — big move could be coming but direction unclear.
      </div>
      <div style={{ color:"#f9fafb", fontSize:12, marginTop:2, marginLeft:8 }}>
        Example: Compression active → Market tightly compressed; breakout possible, direction uncertain.
      </div>
      <Swatch color="#facc15" label="Caution" note="Squeeze ≥ 70." />
      {/* Expansion */}
      <div style={{ color:"#e5e7eb", fontSize:13, fontWeight:700, marginTop:6 }}>Expansion</div>
      <div style={{ color:"#d1d5db", fontSize:12 }}>
        Ranges opening up after a squeeze — directional energy.
      </div>
      <div style={{ color:"#f9fafb", fontSize:12, marginTop:2, marginLeft:8 }}>
        Example: Expansion active → Squeeze released, volatility opening up.
      </div>
      <Swatch color="#22c55e" label="Active" note="Ranges expanding." />
      {/* Overheat */}
      <div style={{ color:"#e5e7eb", fontSize:13, fontWeight:700, marginTop:6 }}>Overheat</div>
      <div style={{ color:"#d1d5db", fontSize:12 }}>
        Momentum too high — risk of exhaustion.
      </div>
      <div style={{ color:"#f9fafb", fontSize:12, marginTop:2, marginLeft:8 }}>
        Example: Overheat active → Momentum 90%. Market may be stretched.
      </div>
      <Swatch color="#facc15" label="Warn"   note="Momentum > 85." />
      <Swatch color="#ef4444" label="Danger" note="Momentum > 92." />
      {/* Turbo */}
      <div style={{ color:"#e5e7eb", fontSize:13, fontWeight:700, marginTop:6 }}>Turbo</div>
      <div style={{ color:"#d1d5db", fontSize:12 }}>
        Very strong momentum with expansion — turbocharged environment.
      </div>
      <div style={{ color:"#f9fafb", fontSize:12, marginTop:2, marginLeft:8 }}>
        Example: Turbo active → Momentum > 92 with expansion. Market in runaway mode.
      </div>
      <Swatch color="#22c55e" label="Active" note="Momentum + Expansion together." />
      {/* Divergence */}
      <div style={{ color:"#e5e7eb", fontSize:13, fontWeight:700, marginTop:6 }}>Divergence</div>
      <div style={{ color:"#d1d5db", fontSize:12 }}>
        Momentum strong but breadth weak — caution, move may be unstable.
      </div>
      <div style={{ color:"#f9fafb", fontSize:12, marginTop:2, marginLeft:8 }}>
        Example: Divergence active → Speed up while breadth falters.
      </div>
      <Swatch color="#facc15" label="Active" note="Momentum strong, breadth weak." />
      {/* Low Liquidity */}
      <div style={{ color:"#e5e7eb", fontSize:13, fontWeight:700, marginTop:6 }}>Low Liquidity</div>
      <div style={{ color:"#d1d5db", fontSize:12 }}>
        Thin depth — harder fills, higher slippage.
      </div>
      <div style={{ color:"#f9fafb", fontSize:12, marginTop:2, marginLeft:8 }}>
        Example: Low Liquidity active → PSI < 40. Market harder to trade.
      </div>
      <Swatch color="#facc15" label="Warn"   note="Liquidity < 40." />
      <Swatch color="#ef4444" label="Danger" note="Liquidity < 30." />
      {/* Volatility High */}
      <div style={{ color:"#e5e7eb", fontSize:13, fontWeight:700, marginTop:6 }}>Volatility High</div>
      <div style={{ color:"#d1d5db", fontSize:12 }}>
        Big swings — market unstable.
      </div>
      <div style={{ color:"#f9fafb", fontSize:12, marginTop:2, marginLeft:8 }}>
        Example: Volatility High active → Volatility 90%. High risk environment.
      </div>
      <Swatch color="#facc15" label="Warn"   note="Volatility > 70." />
      <Swatch color="#ef4444" label="Danger" note="Volatility > 85." />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Signal definitions (tooltips only)                                  */
/* ------------------------------------------------------------------ */
const SIGNAL_DEFS = [
  { key:"sigBreakout",       label:"Breakout",        desc:"Market getting ready to make a move" },
  { key:"sigDistribution",   label:"Distribution",    desc:"Market might be turning direction" },
  { key:"sigCompression",    label:"Compression",     desc:"Squeeze ≥ 70 — direction unclear" },
  { key:"sigExpansion",      label:"Expansion",       desc:"Post-squeeze ranges opening up" },
  { key:"sigOverheat",       label:"Overheat",        desc:"Momentum > 85 (danger > 92)" },
  { key:"sigTurbo",          label:"Turbo",           desc:"Momentum > 92 with expansion" },
  { key:"sigDivergence",     label:"Divergence",      desc:"Momentum strong, breadth weak" },
  { key:"sigLowLiquidity",   label:"Low Liquidity",   desc:"PSI < 40 (danger < 30)" },
  { key:"sigVolatilityHigh", label:"Volatility High", desc:"Volatility > 70 (danger > 85)" },
];

/* ------------------------------------------------------------------ */
/* Tone mapping that matches the PDF                                   */
/* ------------------------------------------------------------------ */
function computeSignalList(sigObj = {}) {
  return SIGNAL_DEFS.map(def => {
    const sig = sigObj?.[def.key] || {};
    const active = !!(sig.active ?? sig === true);
    const sev = String(sig.severity || "").toLowerCase();

    let tone = "off"; // muted by default

    if (active) {
      switch (def.key) {
        case "sigBreakout":        tone = "ok";     break; // green
        case "sigDistribution":    tone = "danger"; break; // red
        case "sigCompression":     tone = "warn";   break; // yellow
        case "sigExpansion":       tone = "ok";     break; // green
        case "sigOverheat":        tone = (sev === "danger") ? "danger" : "warn"; break; // yellow/red
        case "sigTurbo":           tone = "ok";     break; // green
        case "sigDivergence":      tone = "warn";   break; // yellow
        case "sigLowLiquidity":    tone = (sev === "danger") ? "danger" : "warn"; break; // yellow/red
        case "sigVolatilityHigh":  tone = (sev === "danger") ? "danger" : "warn"; break; // yellow/red
        default:
          tone = (sev === "danger") ? "danger" : (sev === "warn" ? "warn" : "ok");
      }
    }

    return { key: def.key, label: def.label, desc: def.desc, active, tone };
  });
}

/* ------------------------------------------------------------------ */
/* Row: Engine Lights (replay-aware + legend modal)                    */
/* ------------------------------------------------------------------ */
export default function RowEngineLights() {
  // Live poll (rules-of-hooks compliant)
  const { data: live, loading, error } = useDashboardPoll("dynamic");

  // Local state
  const [lights, setLights] = useState(() => computeSignalList({}));
  const [stale, setStale] = useState(false);
  const firstPaintRef = useRef(false);

  // Replay bridge
  const [replayOn, setReplayOn] = useState(false);
  const [replayData, setReplayData] = useState(null);

  // Legend modal
  const [legendOpen, setLegendOpen] = useState(false);

  useEffect(() => {
    function onReplay(e) {
      const detail = e?.detail || {};
      const on = !!detail.on;
      setReplayOn(on);
      setReplayData(on ? (detail.data || null) : null);
    }
    window.addEventListener("replay:update", onReplay);
    return () => window.removeEventListener("replay:update", onReplay);
  }, []);

  // Choose source (snapshot vs live)
  const source = (replayOn && replayData) ? replayData : live;

  // Compute row lights
  useEffect(() => {
    if (!source || typeof source !== "object") {
      if (firstPaintRef.current) setStale(true);
      return;
    }
    const list = computeSignalList(source.signals || {});
    setLights(list);
    setStale(false);
    firstPaintRef.current = true;
  }, [source]);

  // NEW: pick stamp from section (fallback to meta/updated_at)
  const ts =
    source?.engineLights?.updatedAt ||
    source?.meta?.ts ||
    source?.updated_at ||
    source?.ts ||
    null;

  return (
    <section id="row-3" className="panel" aria-label="Engine Lights">
      {/* Header with Legend button (no inline legend text) */}
      <div className="panel-head" style={{ alignItems:"center" }}>
        <div className="panel-title">Engine Lights</div>
        <button
          onClick={()=> setLegendOpen(true)}
          style={{
            background:"#0b0b0b", color:"#e5e7eb",
            border:"1px solid #2b2b2b", borderRadius:8,
            padding:"6px 10px", fontWeight:600, cursor:"pointer", marginLeft:8
          }}
          title="Legend"
        >
          Legend
        </button>
        <div className="spacer" />
        <LastUpdated ts={ts} tz="America/Phoenix" />
        {stale && <span className="small muted" style={{ marginLeft:8 }}>refreshing…</span>}
      </div>

      {/* Lights row */}
      <div style={{ display:"flex", alignItems:"center", gap:12, overflow:"hidden", whiteSpace:"nowrap" }}>
        <div style={{ display:"flex", flexWrap:"nowrap", overflow:"hidden" }}>
          {lights.map(l => (
            <Light key={l.key} label={l.label} tone={l.tone} active={l.active} />
          ))}
        </div>
      </div>

      {/* Legend modal */}
      {legendOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={()=> setLegendOpen(false)}
          style={{
            position:"fixed", inset:0, background:"rgba(0,0,0,0.5)",
            display:"flex", alignItems:"center", justifyContent:"center", zIndex:60
          }}
        >
          <div
            onClick={(e)=> e.stopPropagation()}
            style={{
              width:"min(880px, 92vw)", background:"#0b0b0c",
              border:"1px solid #2b2b2b", borderRadius:12, padding:16,
              boxShadow:"0 10px 30px rgba(0,0,0,0.35)"
            }}
          >
            <EngineLightsLegendContent />
            <div style={{ display:"flex", justifyContent:"flex-end", marginTop:12 }}>
              <button
                onClick={()=> setLegendOpen(false)}
                style={{
                  background:"#eab308", color:"#111827", border:"none",
                  borderRadius:8, padding:"8px 12px", fontWeight:700, cursor:"pointer"
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading / error (first paint) */}
      {!firstPaintRef.current && loading && (
        <div className="small muted" style={{ marginTop:6 }}>Loading…</div>
      )}
      {!firstPaintRef.current && error && (
        <div className="small muted" style={{ marginTop:6 }}>Failed to load signals.</div>
      )}
    </section>
  );
}
