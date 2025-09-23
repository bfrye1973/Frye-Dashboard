// src/pages/rows/RowIndexSectors.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
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

function DeltaPill({ label, value }) {
  if (value == null || !Number.isFinite(value)) return null;
  const v = Number(value);
  const tone = v > 0 ? "#22c55e" : v < 0 ? "#ef4444" : "#9ca3af";
  const arrow = v > 0 ? "▲" : v < 0 ? "▼" : "→";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        borderRadius: 6,
        padding: "1px 4px",
        fontSize: 11,
        fontWeight: 600,
        background: "#0b0f17",
        color: tone,
        border: `1px solid ${tone}33`,
      }}
    >
      {label}: {arrow} {v >= 0 ? "+" : ""}{v.toFixed(1)}%
    </span>
  );
}

/* Card */
function SectorCard({ sector, outlook, spark, last, deltaPct, d10m, d1h, d1d }) {
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
    <div
      className="panel"
      style={{
        padding: 10,
        minWidth: 260,   // wider horizontally
        maxWidth: 280,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div className="panel-title small">{sector || "Sector"}</div>
        <Badge text={outlook || "Neutral"} tone={tone} />
      </div>

      {/* Δ pills: 2 on top, 1 on bottom */}
      <div style={{ margin: "4px 0" }}>
        <div style={{ display: "flex", gap: 4 }}>
          {Number.isFinite(d10m) && <DeltaPill label="Δ10m" value={d10m} />}
          {Number.isFinite(d1h) && <DeltaPill label="Δ1h" value={d1h} />}
        </div>
        {Number.isFinite(d1d) && (
          <div style={{ marginTop: 4 }}>
            <DeltaPill label="Δ1d" value={d1d} />
          </div>
        )}
      </div>

      {/* Net NH + Breadth Tilt */}
      <div
        className="small"
        style={{
          display: "flex",
          justifyContent: "space-between",
          margin: "2px 0 4px 0",
        }}
      >
        <span>Net NH: <strong>{Number.isFinite(_last) ? _last.toFixed(0) : "—"}</strong></span>
        <span style={{ color: tiltColor, fontWeight: 700 }}>
          Breadth Tilt: {arrow}{" "}
          {Number.isFinite(_tilt) ? (_tilt >= 0 ? "+" : "") + _tilt.toFixed(1) + "%" : "0.0%"}
        </span>
      </div>
    </div>
  );
}

/* ----------------- Main ----------------- */
export default function RowIndexSectors() {
  const { data: live, loading, error } = useDashboardPoll("dynamic");

  const ts = live?.updated_at || live?.ts || null;

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
          style={{
            background: "#0b0b0b",
            color: "#e5e7eb",
            border: "1px solid #2b2b2b",
            borderRadius: 6,
            padding: "4px 8px",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            marginLeft: 8,
          }}
        >
          Legend
        </button>
        <div style={{ marginLeft: 8, color: "#9ca3af", fontSize: 12 }}>
          Updated {ts || "--"}
        </div>
        <div className="spacer" />
      </div>

      {!live && loading && <div className="small muted">Loading…</div>}
      {error && <div className="small muted">Failed to load sectors.</div>}

      {Array.isArray(cards) && cards.length > 0 ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", // match wider card
            gap: 8,
            marginTop: 6,
          }}
        >
          {cards.map((c, i) => {
            return (
              <SectorCard
                key={c?.sector || i}
                sector={c?.sector}
                outlook={c?.outlook}
                spark={c?.spark}
                last={c?.last}
                deltaPct={c?.deltaPct}
                d10m={c?.d10m}
                d1h={c?.d1h}
                d1d={c?.d1d}
              />
            );
          })}
        </div>
      ) : (
        !loading && <div className="small muted">No sector data.</div>
      )}
    </section>
  );
}
