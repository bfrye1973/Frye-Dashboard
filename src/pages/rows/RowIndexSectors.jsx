// src/pages/rows/RowIndexSectors.jsx
// Compact sectors row: wider cards; AZ timestamp on LEFT; tiny source dropdown (10m/EOD);
// Δ pills (Δ10m + Δ1h on top, Δ1d bottom); Legend button opens local modal.
// Row height and spacing remain unchanged.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useDashboardPoll } from "../../lib/dashboardApi";

/* ------------------------------- helpers ------------------------------- */
const norm = (s = "") => s.trim().toLowerCase();

// Extended aliases to ensure sector keys align across /live/* and /api/sectorTrend
const ALIASES = {
  // info tech
  it: "information technology",
  "info tech": "information technology",
  "information technology": "information technology",
  technology: "information technology",
  tech: "information technology",

  // materials
  materials: "materials",
  material: "materials",

  // health care (many variants)
  healthcare: "health care",
  "health care": "health care",
  "health-care": "health care",
  "health  care": "health care",
  "healthcare ": "health care",

  // communication services (and short forms)
  "communication services": "communication services",
  communications: "communication services",
  "comm services": "communication services",
  "comm. services": "communication services",
  telecom: "communication services",

  // real estate
  "real estate": "real estate",
  reit: "real estate",
  reits: "real estate",

  // energy
  energy: "energy",

  // consumer staples
  staples: "consumer staples",
  "consumer staples": "consumer staples",

  // consumer discretionary
  discretionary: "consumer discretionary",
  "consumer discretionary": "consumer discretionary",

  // financials
  financials: "financials",
  finance: "financials",

  // utilities
  utilities: "utilities",
  utility: "utilities",

  // industrials
  industrials: "industrials",
  industry: "industrials",
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
    }[tone] || { bg: "#0b0b17", fg: "#93c5fd", bd: "#334155" };
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

function buildSectorLastMap(snapshot) {
  const cards = snapshot?.outlook?.sectorCards || snapshot?.sectorCards || [];
  const out = {};
  for (const c of cards) {
    const name = norm(c?.sector || "");
    const val = Number(c?.last ?? c?.value ?? NaN);
    if (name && Number.isFinite(val)) out[name] = val;
  }
  return out;
}

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
      if (Number.isFinite(a) && Number.isFinite(b)) out[k] = a - b;
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
        minWidth: 260,     // wider horizontally
        maxWidth: 280,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div className="panel-title small">{sector || "Sector"}</div>
        <Badge text={outlook || "Neutral"} tone={tone} />
      </div>

      {/* Δ pills — top: 10m + 1h; bottom: 1d */}
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

      {/* Net NH + Breadth Tilt (kept) */}
      <div
        className="small"
        style={{ display: "flex", justifyContent: "space-between", margin: "2px 0 4px 0" }}
      >
        <span>Net NH: <strong>{Number.isFinite(_last) ? _last.toFixed(0) : "—"}</strong></span>
        <span style={{ color: tiltColor, fontWeight: 700 }}>
          Breadth Tilt: {arrow} {(_tilt >= 0 ? "+" : "") + _tilt.toFixed(1)}%
        </span>
      </div>

      <Sparkline data={arr} />
    </div>
  );
}

/* ---------------------------- Main Row ---------------------------- */
export default function RowIndexSectors() {
  const { data: live, loading, error } = useDashboardPoll("dynamic");

  // 10m/EOD source dropdown (for spreadsheet compare)
  const [srcTf, setSrcTf] = useState("10m"); // "10m" | "eod"
  const [eodData, setEodData] = useState(null);

  useEffect(() => {
    let alive = true;
    async function loadEod() {
      try {
        const j = await fetchJSON(`${API}/live/eod`);
        if (alive) setEodData(j);
      } catch {
        if (alive) setEodData(null);
      }
    }
    if (srcTf === "eod") loadEod();
    return () => { alive = false; };
  }, [srcTf]);

  // AZ time
  const ts =
    live?.sectorsUpdatedAt ||  // preferred
    live?.updated_at ||        // fallback (AZ)
    null;

  // In header:
  <div style={{ marginLeft: 8, color: "#9ca3af", fontSize: 12 }}>
    Updated {ts || "--"}
  </div>

  // choose cards source
  const source = srcTf === "eod" ? (eodData || live) : live;

  const cards = useMemo(() => {
    const arr = source?.outlook?.sectorCards;
    if (!Array.isArray(arr)) return [];
    return arr.sort((a, b) => orderKey(a.sector) - orderKey(b.sector));
  }, [source]);

  // Δ maps (10m, 1h, 1d)
  const [d10mMap, setD10mMap] = useState({});
  const [d1dMap, setD1dMap] = useState({});
  const [d1hMap, setD1hMap] = useState({});

  // Δ10m
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
    return () => { alive = false; clearInterval(t); };
  }, []);

  // Δ1d
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
    return () => { alive = false; clearInterval(t); };
  }, []);

  // Δ1h (sectorTrend) — with TEMP console.log so you can verify keys/values
  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    async function load() {
      try {
        const r = await fetch(`${API}/api/sectorTrend?window=1`, {
          signal: controller.signal, cache: "no-store",
        });
        const j = await r.json();
        // TEMP DEBUG: inspect incoming keys once
        console.log("[sectorTrend window=1]", j);
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
    return () => { alive = false; controller.abort(); clearInterval(t); };
  }, []);

  // Legend modal
  const [legendOpen, setLegendOpen] = useState(false);

  return (
    <section id="row-4" className="panel index-sectors" aria-label="Index Sectors">
      {/* header (unchanged height) */}
      <div className="panel-head" style={{ alignItems: "center" }}>
        <div className="panel-title">Index Sectors</div>
        <button
          title="Legend"
          onClick={() => setLegendOpen(true)}
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
        {/* AZ time + tiny source dropdown next to Legend */}
        <div style={{ marginLeft: 8, color: "#9ca3af", fontSize: 12 }}>
          Updated {ts || "--"}
        </div>
        <select
          value={srcTf}
          onChange={(e) => setSrcTf(e.target.value)}
          style={{
            marginLeft: 8,
            background: "#0b0b0b",
            color: "#e5e7eb",
            border: "1px solid #2b2b2b",
            borderRadius: 6,
            padding: "2px 6px",
            fontSize: 12,
          }}
          title="Cards Source"
        >
          <option value="10m">10m</option>
          <option value="eod">EOD</option>
        </select>
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

      {/* Legend modal */}
      {legendOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setLegendOpen(false)}
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
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(880px, 92vw)",
              background: "#0b0b0c",
              border: "1px solid #2b2b2b",
              borderRadius: 12,
              padding: 16,
              boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
            }}
          >
            <div style={{ color: "#f9fafb", fontSize: 14, fontWeight: 800, marginBottom: 8 }}>
              Index Sectors — Legend
            </div>
            <div style={{ color: "#e5e7eb", fontSize: 13, fontWeight: 700, marginTop: 6 }}>
              Outlook
            </div>
            <div style={{ color: "#d1d5db", fontSize: 12 }}>
              Sector trend bias from breadth: <b>Bullish</b> (NH&gt;NL), <b>Neutral</b> (mixed), <b>Bearish</b> (NL&gt;NH).
            </div>
            <div style={{ display: "flex", gap: 12, margin: "6px 0", alignItems: "center" }}>
              <span style={{ width: 34, height: 12, borderRadius: 12, background: "#22c55e", border: "1px solid rgba(255,255,255,0.1)" }} />
              <span style={{ color: "#e5e7eb", fontWeight: 700, fontSize: 12 }}>Bullish</span>
              <span style={{ width: 34, height: 12, borderRadius: 12, background: "#facc15", border: "1px solid rgba(255,255,255,0.1)" }} />
              <span style={{ color: "#e5e7eb", fontWeight: 700, fontSize: 12 }}>Neutral</span>
              <span style={{ width: 34, height: 12, borderRadius: 12, background: "#ef4444", border: "1px solid rgba(255,255,255,0.1)" }} />
              <span style={{ color: "#e5e7eb", fontWeight: 700, fontSize: 12 }}>Bearish</span>
            </div>
            <div style={{ color: "#e5e7eb", fontSize: 13, fontWeight: 700, marginTop: 6 }}>
              Net NH & Breadth Tilt
            </div>
            <div style={{ color: "#d1d5db", fontSize: 12 }}>
              <b>Net NH</b> = New Highs − New Lows. <br />
              <b>Breadth Tilt</b> = tilt in % terms: (NH − NL) / (NH + NL).
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
              <button
                onClick={() => setLegendOpen(false)}
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
      )}
    </section>
  );
}
