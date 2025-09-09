// src/pages/rows/RowEngineLights.jsx
import React from "react";
import { useDashboardPoll } from "../../lib/dashboardApi"; // same hook StrategiesPanel uses

// small pill component
function Light({ label, tone = "info" }) {
  const bg =
    tone === "ok"    ? "#064e3b" :
    tone === "warn"  ? "#5b4508" :
    tone === "danger"? "#7f1d1d" : "#0b1220";
  const fg =
    tone === "ok"    ? "#d1fae5" :
    tone === "warn"  ? "#fde68a" :
    tone === "danger"? "#fecaca" : "#93c5fd";
  const bd =
    tone === "ok"    ? "#065f46" :
    tone === "warn"  ? "#a16207" :
    tone === "danger"? "#b91c1c" : "#334155";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 10px",
        marginRight: 8,
        borderRadius: 8,
        fontWeight: 700,
        fontSize: 12,
        background: bg,
        color: fg,
        border: `1px solid ${bd}`,
        boxShadow: `0 0 10px ${bd}55`
      }}
    >
      {label}
    </span>
  );
}

export default function RowEngineLights() {
  // poll every 5s (same as your other rows)
  const { data, loading, error } = useDashboardPoll?.(5000) ?? { data:null, loading:false, error:null };

  // read signals safely
  const signals = data?.signals ?? {};
  // normalize to a list of {key,label,active,severity}
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

  const active = defs.map(d => {
    const s = signals[d.key];
    return {
      label: d.label,
      active: !!(s?.active ?? s === true),
      tone: (s?.severity === "danger") ? "danger" :
            (s?.severity === "warn")   ? "warn"   :
            (s?.active === true)       ? "ok"     : "info"
    };
  }).filter(x => x.active);

  return (
    <section id="row-3" className="panel" aria-label="Engine Lights">
      <div className="panel-head">
        <div className="panel-title">Engine Lights</div>
      </div>

      {/* states */}
      {error && <div className="small muted">Failed to load signals.</div>}
      {loading && <div className="small muted">Loading…</div>}
      {!loading && active.length === 0 && (
        <div className="small muted">No active signals.</div>
      )}

      {/* active lights */}
      <div style={{ marginTop: 8 }}>
        {active.map((s, i) => (
          <Light key={i} label={s.label} tone={s.tone} />
        ))}
      </div>
    </section>
  );
}
