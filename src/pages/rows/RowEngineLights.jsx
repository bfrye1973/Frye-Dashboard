// src/pages/rows/RowEngineLights.jsx
import React, { useEffect, useRef, useState } from "react";
import { useDashboardPoll } from "../../lib/dashboardApi";

/* ---- pill component ---- */
function Light({ label, tone = "info" }) {
  const palette = {
    ok:    { bg:"#064e3b", fg:"#d1fae5", bd:"#065f46" },
    warn:  { bg:"#5b4508", fg:"#fde68a", bd:"#a16207" },
    danger:{ bg:"#7f1d1d", fg:"#fecaca", bd:"#b91c1c" },
    info:  { bg:"#0b1220", fg:"#93c5fd", bd:"#334155" },
  }[tone] || { bg:"#0b1220", fg:"#93c5fd", bd:"#334155" };

  return (
    <span
      style={{
        display:"inline-flex", alignItems:"center",
        padding:"6px 10px", marginRight:8, marginBottom:6,
        borderRadius:8, fontWeight:700, fontSize:12,
        background: palette.bg, color: palette.fg, border:`1px solid ${palette.bd}`,
        boxShadow: `0 0 10px ${palette.bd}55`
      }}
    >
      {label}
    </span>
  );
}

/* ---- normalize signals into a list with tone ---- */
function extractActiveSignals(sigObj) {
  if (!sigObj || typeof sigObj !== "object") return [];

  const defs = [
    { key:"sigBreakout",     label:"Breakout"     },
    { key:"sigExpansion",    label:"Expansion"    },
    { key:"sigCompression",  label:"Compression"  },
    { key:"sigTurbo",        label:"Turbo"        },
    { key:"sigDistribution", label:"Distribution" },
    { key:"sigDivergence",   label:"Divergence"   },
    { key:"sigOverheat",     label:"Overheat"     },
    { key:"sigLowLiquidity", label:"Low Liquidity"},
  ];

  return defs
    .map(d => {
      const s = sigObj[d.key];
      const active = !!(s?.active ?? s === true);
      // prefer explicit severity if present
      const sev = String(s?.severity || "").toLowerCase();
      const tone =
        sev === "danger" ? "danger" :
        sev === "warn"   ? "warn"   :
        active           ? "ok"     : "info";
      return { label: d.label, active, tone };
    })
    .filter(x => x.active);
}

/* ---- Row 3: Engine Lights with last-good, no flicker ---- */
export default function RowEngineLights() {
  const { data, loading, error } = useDashboardPoll?.(5000) ?? { data:null, loading:false, error:null };

  const [lights, setLights] = useState([]);    // last-good list of active signals
  const [stale, setStale] = useState(false);   // empty refresh -> keep last-good
  const firstGoodRef = useRef(false);

  useEffect(() => {
    const sig = data?.signals;
    const list = extractActiveSignals(sig);

    if (!firstGoodRef.current) {
      if (list.length > 0) {
        setLights(list);
        setStale(false);
        firstGoodRef.current = true;
      }
      return; // don’t clear UI on first empty/undefined
    }

    // after first good: only replace when non-empty
    if (Array.isArray(list)) {
      if (list.length > 0) {
        setLights(list);
        setStale(false);
      } else {
        setStale(true); // keep last-good and show refreshing…
      }
    }
  }, [data]);

  return (
    <section id="row-3" className="panel" aria-label="Engine Lights">
      <div className="panel-head">
        <div className="panel-title">Engine Lights</div>
        <div className="spacer" />
        {stale && lights.length > 0 && <span className="small muted">refreshing…</span>}
      </div>

      {/* initial states */}
      {!firstGoodRef.current && loading && <div className="small muted">Loading…</div>}
      {!firstGoodRef.current && error   && <div className="small muted">Failed to load signals.</div>}
      {!firstGoodRef.current && !loading && !error && lights.length === 0 && (
        <div className="small muted">No active signals.</div>
      )}

      {/* active lights — last-good persisted, no flicker */}
      {lights.length > 0 && (
        <div style={{ display:"flex", flexWrap:"wrap", marginTop:8 }}>
          {lights.map((l, i) => <Light key={i} label={l.label} tone={l.tone} />)}
        </div>
      )}
    </section>
  );
}
