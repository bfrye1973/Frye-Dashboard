// src/pages/rows/RowIndexSectors.jsx
// Compact sectors row:
// - Cards slightly wider (horizontal) without changing row height
// - AZ timestamp on LEFT next to "Legend"
// - Δ pills: Δ10m + Δ1h (top line), Δ1d (second line)
// - Net NH + Breadth Tilt labels preserved

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useDashboardPoll } from "../../lib/dashboardApi";

/* ------------------------------- helpers ------------------------------- */
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

const API =
  (typeof window !== "undefined" && (window.__API_BASE__ || "")) ||
  "https://frye-market-backend-1.onrender.com";

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
      title={`${label}: ${v >= 0 ? "+" : ""}${v.toFixed(1)}%`}
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
      {label}: {arrow} {v >= 0 ? "+" : ""}
      {v.toFixed(1)}%
    </span>
  );
}

function Sparkline({ data = [], width = 160, height = 28 }) {
  if (!Array.isArray(data) || data.length < 2)
    return <div className="small muted"> </div>;
  const min = Math.min(...data),
    max = Math.max(...data);
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

/* -------------------------- fetch helpers -------------------------- */
async function fetchJSON(url) {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return await r.json();
}

// Build a { sectorKey -> NetNH } map from a snapshot
function buildSectorLastMap(snapshot) {
  const cards = snapshot?.outlook?.sectorCards || snapshot?.sectorCards || [];
  const out = {};
  for (const c of cards) {
    const name = norm(c?.sector || "");
    // Net NH often appears as `last` or `value` in legacy sectorCards
    const val = Number(c?.last ?? c?.value ?? NaN);
    if (name && Number.isFinite(val)) out[name] = val;
  }
  return out;
}

// Δ map from replay snapshots (granularity: "10min" or "eod")
async function computeDeltaFromReplay(granularity) {
  try {
    const idx = await fetchJSON(
      `${API}/api/replay/index?granularity=${encodeURIComponent(
        granularity
      )}&t=${Date.now()}`
    );
    const items = Array.isArray(idx?.items) ? idx.items : [];
    if (items.length < 2) return {};
    const tsA = items[0]?.ts;
    const tsB = items[1]?.ts;
    if (!tsA || !tsB) return {};
    const [snapA, snapB] = await Promise.all([
      fetchJSON(
        `${API}/api/replay/at?granularity=${granularity}&ts=${encodeURIComponent(
          tsA
        )}&t=${Date.now()}`
      ),
      fetchJSON(
        `${API}/api/replay/at?granularity=${granularity}&ts=${encodeURIComponent(
          tsB
        )}&t=${Date.now()}`
      ),
    ]);
    const mapA = buildSectorLastMap(snapA);
    const mapB = buildSectorLastMap(snapB);
    const out = {};
    const keys = new Set([...Object.keys(mapA), ...Object.keys(mapB)]);
    for (const k of keys) {
      const a = mapA[k];
      const b = mapB[k];
      if (Number.isFinite(a) && Number.isFinite(b)) out[k] = a - b; // change in Net NH
    }
    return out;
  } catch {
    return {};
  }
}

/* ---------------------------- Sector Card ---------------------------- */
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
        minWidth: 260,       // wider horizontally
        maxWidth: 280,
      }}
    >
      {/* header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div className="panel-title small">{sector || "Sector"}</div>
        <Badge text={outlook || "Neutral"} tone={tone} />
      </div>

      {/* Δ pills — top row: 10m + 1h; bottom row: 1d */}
      <div style={{ margin: "4px 0" }}>
        <div style={{ display: "flex", gap: 6 }}>
          {Number.isFinite(d10m) && <DeltaPill label="Δ10m" value={d10m} />}
          {Number.isFinite(d1h) && <DeltaPill label="Δ1h" value={d1h} />}
        </div>
        {Number.isFinite(d1d) && (
          <div style={{ marginTop: 4 }}>
            <DeltaPill label="Δ1d" value={d1d} />
          </div>
        )}
      </div>

      {/* Net NH + Breadth Tilt (kept as before) */}
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
          {Number.isFinite(_tilt)
            ? (_tilt >= 0 ? "+" : "") + _tilt.toFixed(1) + "%"
            : "0.0%"}
        </span>
      </div>

      {/* optional spark, unchanged */}
      <Sparkline data={arr} />
    </div>
  );
}

/* ---------------------------- Main Row ---------------------------- */
export default function RowIndexSectors() {
  const { data: live, loading, error } = useDashboardPoll("dynamic");

  // AZ updated time (backend now emits updated_at in AZ)
  const ts = live?.sectors?.updatedAt
    || live?.marketMeter?.updatedAt
    || live?.updated_at
    || live?.ts
    || null;

  // sector cards from live payload
  const cards = useMemo(() => {
    const arr = live?.outlook?.sectorCards;
    if (!Array.isArray(arr)) return [];
    return arr.sort((a, b) => orderKey(a.sector) - orderKey(b.sector));
  }, [live]);

  // build Δ maps
  const [d10mMap, setD10mMap] = useState({});
  const [d1dMap, setD1dMap] = useState({});
  const [d1hMap, setD1hMap] = useState({});

  // Δ10m from replay (last two 10m snapshots)
  useEffect(() => {
    let alive = true;
    (async () => {
      const m = await computeDeltaFromReplay("10min");
      if (alive) setD10mMap(m);
    })();
    const t = setInterval(async () => {
      const m = await computeDeltaFromReplay("10min");
      setD10mMap(m);
    }, 60_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  // Δ1d from replay (last two EOD snapshots)
  useEffect(() => {
    let alive = true;
    (async () => {
      const m = await computeDeltaFromReplay("eod");
      if (alive) setD1dMap(m);
    })();
    const t = setInterval(async () => {
      const m = await computeDeltaFromReplay("eod");
      setD1dMap(m);
    }, 300_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  // Δ1h from backend trend endpoint
  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    async function load() {
      try {
        const r = await fetch(`${API}/api/sectorTrend?window=1`, {
          signal: controller.signal,
          cache: "no-store",
        });
        const j = await r.json();
        if (!alive) return;
        const map = {};
        const sectors = j?.sectors || {};
        for (const [rawKey, pair] of Object.entries(sectors)) {
          const key = ALIASES[norm(rawKey)] || norm(rawKey);
          const d = Number(pair?.deltaPct ?? NaN);
          if (Number.isFinite(d)) map[key] = d;
        }
        setD1hMap(map);
      } catch {
        if (alive) setD1hMap({});
      }
    }
    load();
    const t = setInterval(load, 60_000);
    return () => {
      alive = false;
      controller.abort();
      clearInterval(t);
    };
  }, []);

  return (
    <section id="row-4" className="panel index-sectors" aria-label="Index Sectors">
      {/* header (unchanged height) */}
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
          title="Legend"
          onClick={() =>
            window.dispatchEvent(
              new CustomEvent("sectors:legend", { detail: { open: true } })
            )
          }
        >
          Legend
        </button>
        {/* AZ timestamp next to Legend */}
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
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", // wider cards
            gap: 8,
            marginTop: 6,
          }}
        >
          {cards.map((c, i) => {
            // Normalize key for delta maps
            const nameKey = ALIASES[norm(c?.sector || "")] || norm(c?.sector || "");
            const d10 = d10mMap[nameKey];
            const d1h = d1hMap[nameKey];
            const d1d = d1dMap[nameKey];

            return (
              <SectorCard
                key={c?.sector || i}
                sector={c?.sector}
                outlook={c?.outlook}
                spark={c?.spark}
                last={c?.last}
                deltaPct={c?.deltaPct}
                d10m={Number.isFinite(d10) ? d10 : undefined}
                d1h={Number.isFinite(d1h) ? d1h : undefined}
                d1d={Number.isFinite(d1d) ? d1d : undefined}
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
