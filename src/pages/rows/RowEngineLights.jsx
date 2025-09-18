// src/pages/rows/RowEngineLights.jsx
import React, { useEffect, useRef, useState } from "react";
import { useDashboardPoll } from "../../lib/dashboardApi";
import { LastUpdated } from "../../components/LastUpdated";

/* ------------------------------------------------------------------ */
/* Light pill                                                          */
/* ------------------------------------------------------------------ */
function Light({ label, tone, active }) {
  var t = tone || "info";
  var palette =
    t === "ok"
      ? { bg: "#22c55e", fg: "#0b1220", bd: "#16a34a", shadow: "#16a34a" } // green
      : t === "warn"
      ? { bg: "#facc15", fg: "#111827", bd: "#ca8a04", shadow: "#ca8a04" } // yellow
      : t === "danger"
      ? { bg: "#ef4444", fg: "#fee2e2", bd: "#b91c1c", shadow: "#b91c1c" } // red
      : t === "off"
      ? { bg: "#0b0f17", fg: "#6b7280", bd: "#1f2937", shadow: "#111827" } // muted
      : { bg: "#0b1220", fg: "#93c5fd", bd: "#334155", shadow: "#334155" }; // info

  return (
    <span
      title={label}
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "6px 10px",
        marginRight: 8,
        borderRadius: 8,
        fontWeight: 700,
        fontSize: 12,
        background: palette.bg,
        color: palette.fg,
        border: "1px solid " + palette.bd,
        boxShadow: "0 0 10px " + palette.shadow + "55",
        opacity: active ? 1 : 0.45,
        filter: active ? "none" : "grayscale(40%)",
      }}
    >
      {label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Legend content                                                      */
/* ------------------------------------------------------------------ */
function Swatch({ color, label, note }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
      <span
        style={{
          width: 36,
          height: 12,
          borderRadius: 12,
          background: color,
          display: "inline-block",
          border: "1px solid rgba(255,255,255,0.1)",
        }}
      />
      <span style={{ color: "#e5e7eb", fontSize: 12, fontWeight: 700 }}>{label}</span>
      <span style={{ color: "#cbd5e1", fontSize: 12 }}>— {note}</span>
    </div>
  );
}

function EngineLightsLegendContent() {
  return (
    <div>
      <div style={{ color: "#f9fafb", fontSize: 14, fontWeight: 800, marginBottom: 8 }}>
        Engine Lights — Legend
      </div>

      {/* Examples that match your PDF language */}
      <Swatch color="#22c55e" label="Breakout" note="Market setting up for move." />
      <div style={{ height: 6 }} />
      <Swatch color="#ef4444" label="Distribution" note="Breadth negative, potential reversal." />
      <div style={{ height: 6 }} />
      <Swatch color="#facc15" label="Compression" note="Squeeze ≥ 70." />
      <div style={{ height: 6 }} />
      <Swatch color="#22c55e" label="Expansion" note="Post-squeeze ranges opening up." />
      <div style={{ height: 6 }} />
      <Swatch color="#facc15" label="Overheat (Warn)" note="Momentum > 85." />
      <Swatch color="#ef4444" label="Overheat (Danger)" note="Momentum > 92." />
      <div style={{ height: 6 }} />
      <Swatch color="#22c55e" label="Turbo" note="Momentum + Expansion together." />
      <div style={{ height: 6 }} />
      <Swatch color="#facc15" label="Divergence" note="Momentum strong, breadth weak." />
      <div style={{ height: 6 }} />
      <Swatch color="#facc15" label="Low Liquidity (Warn)" note="PSI < 40." />
      <Swatch color="#ef4444" label="Low Liquidity (Danger)" note="PSI < 30." />
      <div style={{ height: 6 }} />
      <Swatch color="#facc15" label="Volatility High (Warn)" note="Volatility > 70." />
      <Swatch color="#ef4444" label="Volatility High (Danger)" note="Volatility > 85." />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Signal definitions                                                  */
/* ------------------------------------------------------------------ */
var SIGNAL_DEFS = [
  { key: "sigBreakout", label: "Breakout", desc: "Market getting ready to make a move" },
  { key: "sigDistribution", label: "Distribution", desc: "Market might be turning direction" },
  { key: "sigCompression", label: "Compression", desc: "Squeeze ≥ 70 — direction unclear" },
  { key: "sigExpansion", label: "Expansion", desc: "Post-squeeze ranges opening up" },
  { key: "sigOverheat", label: "Overheat", desc: "Momentum > 85 (danger > 92)" },
  { key: "sigTurbo", label: "Turbo", desc: "Momentum > 92 with expansion" },
  { key: "sigDivergence", label: "Divergence", desc: "Momentum strong, breadth weak" },
  { key: "sigLowLiquidity", label: "Low Liquidity", desc: "PSI < 40 (danger < 30)" },
  { key: "sigVolatilityHigh", label: "Volatility High", desc: "Volatility > 70 (danger > 85)" },
];

/* ------------------------------------------------------------------ */
/* Helpers (no optional chaining / no nullish coalescing)              */
/* ------------------------------------------------------------------ */
function pick(obj, pathArr) {
  // simple safe getter: pick(obj, ["a","b","c"])
  var cur = obj;
  for (var i = 0; i < pathArr.length; i++) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = cur[pathArr[i]];
  }
  return cur;
}

function pickTs(obj) {
  if (!obj || typeof obj !== "object") return null;
  var v =
    (obj.engineLights && obj.engineLights.updatedAt) ||
    (obj.marketMeter && obj.marketMeter.updatedAt) ||
    (obj.meta && obj.meta.ts) ||
    obj.updated_at ||
    obj.ts ||
    null;
  return v || null;
}

function computeSignalList(sigObj) {
  var s = sigObj || {};
  return SIGNAL_DEFS.map(function (def) {
    var raw = s && s[def.key] ? s[def.key] : {};
    var isObj = raw && typeof raw === "object";
    var active = !!(isObj ? (raw.active !== undefined ? raw.active : false) : raw === true);
    var sev = String(isObj && raw.severity ? raw.severity : "").toLowerCase();

    var tone = "off"; // default muted
    if (active) {
      switch (def.key) {
        case "sigBreakout":
          tone = "ok";
          break;
        case "sigDistribution":
          tone = "danger";
          break;
        case "sigCompression":
          tone = "warn";
          break;
        case "sigExpansion":
          tone = "ok";
          break;
        case "sigOverheat":
          tone = sev === "danger" ? "danger" : "warn";
          break;
        case "sigTurbo":
          tone = "ok";
          break;
        case "sigDivergence":
          tone = "warn";
          break;
        case "sigLowLiquidity":
          tone = sev === "danger" ? "danger" : "warn";
          break;
        case "sigVolatilityHigh":
          tone = sev === "danger" ? "danger" : "warn";
          break;
        default:
          tone = sev === "danger" ? "danger" : sev === "warn" ? "warn" : "ok";
      }
    }

    return { key: def.key, label: def.label, desc: def.desc, active: active, tone: tone };
  });
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */
export default function RowEngineLights() {
  // Live poll
  var poll = useDashboardPoll("dynamic");
  var live = poll && poll.data ? poll.data : null;
  var loading = poll ? poll.loading : false;
  var error = poll ? poll.error : null;

  // Local state
  var [lights, setLights] = useState(computeSignalList({}));
  var [stale, setStale] = useState(false);
  var firstPaintRef = useRef(false);

  // Replay bridge (from RowMarketOverview via window event)
  var [replayOn, setReplayOn] = useState(false);
  var [replayData, setReplayData] = useState(null);

  // Legend modal
  var [legendOpen, setLegendOpen] = useState(false);

  useEffect(function () {
    function onReplay(e) {
      var detail = e && e.detail ? e.detail : {};
      var on = !!detail.on;
      setReplayOn(on);
      setReplayData(on ? (detail.data || null) : null);
    }
    if (typeof window !== "undefined") {
      window.addEventListener("replay:update", onReplay);
      return function () {
        window.removeEventListener("replay:update", onReplay);
      };
    }
    return function () {};
  }, []);

  // Choose source (snapshot vs live)
  var source = replayOn && replayData ? replayData : live;

  // Section timestamp (Arizona time is already converted by backend)
  var ts = pickTs(source);

  // Compute lights when source changes
  useEffect(
    function () {
      if (!source || typeof source !== "object") {
        if (firstPaintRef.current) setStale(true);
        return;
      }
      var sigs = pick(source, ["signals"]) || {};
      var list = computeSignalList(sigs);
      setLights(list);
      setStale(false);
      firstPaintRef.current = true;
    },
    [source]
  );

  return (
    <section id="row-3" className="panel" aria-label="Engine Lights" style={{ padding: 10 }}>
      {/* Header */}
      <div className="panel-head" style={{ alignItems: "center" }}>
        <div className="panel-title">Engine Lights</div>

        <button
          onClick={function () {
            setLegendOpen(true);
          }}
          style={{
            background: "#0b0b0b",
            color: "#e5e7eb",
            border: "1px solid #2b2b2b",
            borderRadius: 8,
            padding: "6px 10px",
            fontWeight: 600,
            cursor: "pointer",
            marginLeft: 8,
          }}
          title="Legend"
        >
          Legend
        </button>

        <div className="spacer" />
        <LastUpdated ts={ts} />
        {stale ? (
          <span className="small muted" style={{ marginLeft: 8 }}>
            refreshing…
          </span>
        ) : null}
      </div>

      {/* Lights row */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, overflow: "hidden", whiteSpace: "nowrap" }}>
        <div style={{ display: "flex", flexWrap: "nowrap", overflow: "hidden" }}>
          {lights.map(function (l) {
            return <Light key={l.key} label={l.label} tone={l.tone} active={l.active} />;
          })}
        </div>
      </div>

      {/* Legend modal */}
      {legendOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          onClick={function () {
            setLegendOpen(false);
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 60,
          }}
        >
          <div
            onClick={function (e) {
              e.stopPropagation();
            }}
            style={{
              width: "min(880px, 92vw)",
              background: "#0b0b0c",
              border: "1px solid #2b2b2b",
              borderRadius: 12,
              padding: 16,
              boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
            }}
          >
            <EngineLightsLegendContent />
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
              <button
                onClick={function () {
                  setLegendOpen(false);
                }}
                style={{
                  background: "#eab308",
                  color: "#111827",
                  border: "none",
                  borderRadius: 8,
                  padding: "8px 12px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Loading / error (first paint only) */}
      {!firstPaintRef.current && loading ? (
        <div className="small muted" style={{ marginTop: 6 }}>
          Loading…
        </div>
      ) : null}
      {!firstPaintRef.current && error ? (
        <div className="small muted" style={{ marginTop: 6 }}>
          Failed to load signals.
        </div>
      ) : null}
    </section>
  );
}
