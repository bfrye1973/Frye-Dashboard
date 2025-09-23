// src/pages/rows/RowIndexSectors.jsx
import React, { useEffect, useMemo, useState } from "react";
import { LastUpdated } from "../../components/LastUpdated";
import { useDashboardPoll } from "../../lib/dashboardApi";

/* ------------------------------- UI helpers ------------------------------- */
const norm = (s = "") => s.trim().toLowerCase();
const ALIASES = {
  tech: "information technology",
  "information technology": "information technology",
  materials: "materials",
  healthcare: "healthcare",
  "communication services": "communication services",
  "real estate": "real estate",
  energy: "energy",
  "consumer staples": "consumer staples",
  "consumer discretionary": "consumer discretionary",
  financials: "financials",
  utilities: "utilities",
  industrials: "industrials",
};
const ORDER = [
  "tech","materials","healthcare","communication services",
  "real estate","energy","consumer staples","consumer discretionary",
  "financials","utilities","industrials",
];
const orderKey = (s) => {
  const i = ORDER.indexOf(norm(s));
  return i === -1 ? 999 : i;
};
const toneFor = (o) => {
  if (!o) return "info";
  const s = String(o).toLowerCase();
  if (s.startsWith("bull")) return "ok";
  if (s.startsWith("bear")) return "danger";
  return "warn";
};

function Badge({ text, tone = "info" }) {
  const map =
    {
      ok: { bg: "#22c55e", fg: "#0b1220", bd: "#16a34a" },
      warn: { bg: "#facc15", fg: "#111827", bd: "#ca8a04" },
      danger: { bg: "#ef4444", fg: "#fee2e2", bd: "#b91c1c" },
      info: { bg: "#0b1220", fg: "#93c5fd", bd: "#334155" },
    }[tone] || { bg: "#0b1220", fg: "#93c5fd", bd: "#334155" };
  return (
    <span
      style={{
        padding: "4px 8px",
        borderRadius: 8,
        fontSize: 12,
        fontWeight: 700,
        background: map.bg,
        color: map.fg,
        border: `1px solid ${map.bd}`,
      }}
    >
      {text}
    </span>
  );
}

/* Compact sparkline (optional – unchanged) */
function Sparkline({ data = [], width = 160, height = 28 }) {
  if (!Array.isArray(data) || data.length < 2) return <div className="small muted"> </div>;
  const min = Math.min(...data), max = Math.max(...data);
  const span = max - min || 1;
  const stepX = width / (data.length - 1);
  const d = data
    .map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / span) * height;
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <path d={d} fill="none" stroke="#60a5fa" strokeWidth="2" />
    </svg>
  );
}

/* Card (unchanged content) */
function SectorCard({ sector, outlook, spark, last, deltaPct }) {
  const tone = toneFor(outlook);
  const arr = Array.isArray(spark) ? spark : [];
  let _last = Number.isFinite(last) ? last : null;
  let _tilt = Number.isFinite(deltaPct) ? deltaPct : null;

  if ((_last === null || _tilt === null) && arr.length >= 2) {
    const first = Number(arr[0]) || 0;
    const lst = Number(arr[arr.length - 1]) || 0;
    const base = Math.abs(first) > 1e-6 ? Math.abs(first) : 1;
    _last = _last === null ? lst : _last;
    _tilt = _tilt === null ? ((lst - first) / base) * 100 : _tilt;
  }
  if (_last === null) _last = 0;
  if (_tilt === null) _tilt = 0;

  const arrow = Math.abs(_tilt) < 0.5 ? "→" : _tilt > 0 ? "↑" : "↓";
  const tiltColor = _tilt > 0 ? "#22c55e" : _tilt < 0 ? "#ef4444" : "#9ca3af";

  return (
    <div className="panel" style={{ padding: 8 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div className="panel-title small">{sector || "Sector"}</div>
        <Badge text={outlook || "Neutral"} tone={tone} />
      </div>

      <div className="small" style={{ display: "flex", justifyContent: "space-between", margin: "4px 0" }}>
        <span>Net NH: <strong>{Number.isFinite(_last) ? _last.toFixed(0) : "—"}</strong></span>
        <span style={{ color: tiltColor, fontWeight: 700 }}>
          Breadth Tilt: {arrow} {Number.isFinite(_tilt) ? (_tilt >= 0 ? "+" : "") + _tilt.toFixed(1) + "%" : "0.0%"}
        </span>
      </div>

      <Sparkline data={arr} />
    </div>
  );
}

/* Legend modal content (unchanged) */
function Pill({ color }) {
  return (
    <span
      style={{
        width: 34, height: 12, borderRadius: 12, background: color,
        display: "inline-block", border: "1px solid rgba(255,255,255,0.1)", marginRight: 8
      }}
    />
  );
}
function IndexSectorsLegendContent() {
  return (
    <div>
      <div style={{ color: "#f9fafb", fontSize: 14, fontWeight: 800, marginBottom: 8 }}>Index Sectors — Legend</div>
      <div style={{ color: "#e5e7eb", fontSize: 13, fontWeight: 700, marginTop: 6 }}>Outlook</div>
      <div style={{ color: "#d1d5db", fontSize: 12 }}>
        Sector trend bias from breadth: <b>Bullish</b> (NH&gt;NL), <b>Neutral</b> (mixed), <b>Bearish</b> (NL&gt;NH).
      </div>
      <div style={{ display: "flex", gap: 12, margin: "6px 0", alignItems: "center" }}>
        <Pill color="#22c55e" /> <span style={{ color: "#e5e7eb", fontWeight: 700, fontSize: 12 }}>Bullish</span>
        <Pill color="#facc15" /> <span style={{ color: "#e5e7eb", fontWeight: 700, fontSize: 12 }}>Neutral</span>
        <Pill color="#ef4444" /> <span style={{ color: "#e5e7eb", fontWeight: 700, fontSize: 12 }}>Bearish</span>
      </div>
      <div style={{ color: "#e5e7eb", fontSize: 13, fontWeight: 700, marginTop: 6 }}>Net NH & Breadth Tilt</div>
      <div style={{ color: "#d1d5db", fontSize: 12 }}>
        <b>Net NH</b> = New Highs − New Lows. <br />
        <b>Breadth Tilt</b> = tilt in % terms: (NH − NL) / (NH + NL).
      </div>
    </div>
  );
}

/* ------------------------------ helpers ------------------------------ */
async function fetchJSON(url) {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return await r.json();
}

/* ------------------------------ main row ------------------------------ */
export default function RowIndexSectors() {
  const { data: live, loading, error } = useDashboardPoll("dynamic");

  // choose updated timestamp (we now emit AZ time as updated_at)
  const ts =
    live?.sectors?.updatedAt ||
    live?.marketMeter?.updatedAt ||
    live?.updated_at ||
    live?.ts ||
    null;

  // legend modal
  const [legendOpen, setLegendOpen] = useState(false);

  // build cards list as before (from live)
  const cards = useMemo(() => {
    const arr = live?.outlook?.sectorCards;
    if (!Array.isArray(arr)) return [];
    return arr.sort((a, b) => orderKey(a.sector) - orderKey(b.sector));
  }, [live]);

  return (
    <section id="row-4" className="panel index-sectors" aria-label="Index Sectors">
      <div className="panel-head" style={{ alignItems: "center" }}>
        <div className="panel-title">Index Sectors</div>
        <button
          onClick={() => setLegendOpen(true)}
          style={{
            background: "#0b0b0b", color: "#e5e7eb", border: "1px solid #2b2b2b",
            borderRadius: 6, padding: "4px 8px", fontSize: 12, fontWeight: 600,
            cursor: "pointer", marginLeft: 8,
          }}
          title="Legend"
        >
          Legend
        </button>
        {/* AZ timestamp on LEFT next to Legend */}
        <div style={{ marginLeft: 8, color: "#9ca3af", fontSize: 12 }}>
          Updated {ts || "--"}
        </div>
        <div className="spacer" />
        {/* (Removed right-side LastUpdated to avoid duplication) */}
      </div>

      {!live && loading && <div className="small muted">Loading…</div>}
      {error && <div className="small muted">Failed to load sectors.</div>}

      {Array.isArray(cards) && cards.length > 0 ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))",
            gap: 8,
            marginTop: 6,
          }}
        >
          {cards.map((c, i) => (
            <SectorCard
              key={c?.sector || i}
              sector={c?.sector}
              outlook={c?.outlook}
              spark={c?.spark}
              last={c?.last}
              deltaPct={c?.deltaPct}
            />
          ))}
        </div>
      ) : (
        !loading && <div className="small muted">No sector data.</div>
      )}

      {legendOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setLegendOpen(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 60,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(880px, 92vw)", background: "#0b0b0c", border: "1px solid #2b2b2b",
              borderRadius: 12, padding: 16, boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
            }}
          >
            <IndexSectorsLegendContent />
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
              <button
                onClick={() => setLegendOpen(false)}
                style={{
                  background: "#eab308", color: "#111827", border: "none",
                  borderRadius: 8, padding: "8px 12px", fontWeight: 700, cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
