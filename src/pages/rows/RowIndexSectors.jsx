// src/pages/rows/RowIndexSectors.jsx
// v3.1 — Intraday/EOD + Δ10m / Δ1d pills (compact), strict backend bind, repaint by AZ timestamp

import React, { useEffect, useMemo, useState } from "react";

/* -------------------------- API base resolver -------------------------- */
function resolveApiBase() {
  const env = (process.env.REACT_APP_API_BASE || "").trim().replace(/\/+$/, "");
  if (env) return env;
  const winBase =
    typeof window !== "undefined" && window.__API_BASE__
      ? String(window.__API_BASE__).trim().replace(/\/+$/, "")
      : "";
  if (winBase) return winBase;
  return "https://frye-market-backend-1.onrender.com"; // backend origin
}

/* ------------------------------- helpers ------------------------------- */
const norm = (s = "") => s.trim().toLowerCase();

const ORDER = [
  "information technology",
  "materials",
  "health care",
  "communication services",
  "real estate",
  "energy",
  "consumer staples",
  "consumer discretionary",
  "financials",
  "utilities",
  "industrials",
];
const orderKey = (name = "") => {
  const i = ORDER.indexOf(norm(name));
  return i === -1 ? 999 : i;
};

function toneFor(outlook) {
  const s = String(outlook || "").toLowerCase();
  if (s.startsWith("bull")) return "ok";
  if (s.startsWith("bear")) return "danger";
  if (s.startsWith("neut")) return "warn";
  return "info";
}

function Badge({ text, tone = "info" }) {
  const map =
    {
      ok: { bg: "#22c55e", fg: "#0b1220", bd: "#16a34a" },
      warn: { bg: "#facc15", fg: "#111827", bd: "#ca8a04" },
      danger: { bg: "#ef4444", fg: "#fee2e2", bd: "#b91c1c" },
      info: { bg: "#0b1220", fg: "#93c5fd", bd: "#334155" },
    }[tone] || { bg: "#0b0f17", fg: "#93c5fd", bd: "#334155" };
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

function Pill({ label, value }) {
  if (!Number.isFinite(value)) return null;
  const v = Number(value);
  const tone = v > 0 ? "#22c55e" : v < 0 ? "#ef4444" : "#9ca3af";
  const arrow = v > 0 ? "▲" : v < 0 ? "▼" : "→";
  return (
    <span
      title={`${label}: ${v >= 0 ? "+" : ""}${v}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        borderRadius: 6,
        padding: "1px 4px",
        fontSize: 11,
        lineHeight: 1.1,     // compact → no vertical growth
        fontWeight: 600,
        background: "#0b0f17",
        color: tone,
        border: `1px solid ${tone}33`,
        whiteSpace: "nowrap",
      }}
    >
      {label}: {arrow} {v >= 0 ? "+" : ""}
      {v}
    </span>
  );
}

/* ------------------------------ Card UI ------------------------------ */
function SectorCard({ card, d10m, d1d }) {
  const nh = Number(card?.nh ?? NaN);
  const nl = Number(card?.nl ?? NaN);
  const netNH = Number.isFinite(nh) && Number.isFinite(nl) ? nh - nl : null;

  const breadth = Number(card?.breadth_pct ?? NaN);
  const momentum = Number(card?.momentum_pct ?? NaN);

  const tone = toneFor(card?.outlook);

  return (
    <div
      className="panel"
      style={{
        padding: 10,
        minWidth: 220,
        maxWidth: 260,
        borderRadius: 12,
        border: "1px solid #2b2b2b",
        background: "#0b0b0c",
        boxShadow: "0 8px 20px rgba(0,0,0,0.25)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <div className="panel-title small" style={{ color: "#f3f4f6" }}>
          {card?.sector || "Sector"}
        </div>
        <Badge text={card?.outlook || "Neutral"} tone={tone} />
      </div>

      {/* Compact Δ row (no extra height) */}
      <div style={{ display: "flex", gap: 6, margin: "0 0 4px 0", alignItems: "center" }}>
        <Pill label="Δ10m" value={Number.isFinite(d10m) ? d10m : undefined} />
        <Pill label="Δ1d" value={Number.isFinite(d1d) ? d1d : undefined} />
      </div>

      <div style={{ fontSize: 12, color: "#cbd5e1", display: "grid", gap: 2 }}>
        <div>
          Breadth Tilt:{" "}
          <b style={{ color: "#f3f4f6" }}>
            {Number.isFinite(breadth) ? `${breadth.toFixed(1)}%` : "—"}
          </b>
        </div>
        <div>
          Momentum:{" "}
          <b style={{ color: "#f3f4f6" }}>
            {Number.isFinite(momentum) ? `${momentum.toFixed(1)}%` : "—"}
          </b>
        </div>
        <div>
          Net NH: <b style={{ color: "#f3f4f6" }}>{netNH ?? "—"}</b>{" "}
          <span style={{ color: "#9ca3af" }}>
            (NH {Number.isFinite(nh) ? nh : "—"} / NL {Number.isFinite(nl) ? nl : "—"})
          </span>
        </div>
      </div>
    </div>
  );
}

/* ----------------------- Replay Δ helpers (Net NH) ----------------------- */
async function fetchJSON(url, signal) {
  const r = await fetch(url, { cache: "no-store", signal });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return await r.json();
}

function snapshotToNetNHMap(snap) {
  // Prefer top-level sectorCards; fallback to nested outlook.sectorCards if present
  const cards = Array.isArray(snap?.sectorCards)
    ? snap.sectorCards
    : Array.isArray(snap?.outlook?.sectorCards)
    ? snap.outlook.sectorCards
    : [];
  const out = {};
  for (const c of cards) {
    const key = norm(c?.sector || "");
    const nh = Number(c?.nh ?? NaN);
    const nl = Number(c?.nl ?? NaN);
    if (key && Number.isFinite(nh) && Number.isFinite(nl)) {
      out[key] = nh - nl; // Net NH
    }
  }
  return out;
}

async function computeDeltaNetNH(API, granularity, signal) {
  // Pull last two snapshots from replay and compute per-sector Δ(Net NH)
  const idx = await fetchJSON(
    `${API}/api/replay/index?granularity=${encodeURIComponent(granularity)}&t=${Date.now()}`,
    signal
  );
  const items = Array.isArray(idx?.items) ? idx.items : [];
  if (items.length < 2) return {};
  const tsA = items[0]?.ts;
  const tsB = items[1]?.ts;
  if (!tsA || !tsB) return {};
  const [snapA, snapB] = await Promise.all([
    fetchJSON(
      `${API}/api/replay/at?granularity=${encodeURIComponent(granularity)}&ts=${encodeURIComponent(tsA)}&t=${Date.now()}`,
      signal
    ),
    fetchJSON(
      `${API}/api/replay/at?granularity=${encodeURIComponent(granularity)}&ts=${encodeURIComponent(tsB)}&t=${Date.now()}`,
      signal
    ),
  ]);
  const A = snapshotToNetNHMap(snapA);
  const B = snapshotToNetNHMap(snapB);
  const out = {};
  const keys = new Set([...Object.keys(A), ...Object.keys(B)]);
  for (const k of keys) {
    if (Number.isFinite(A[k]) && Number.isFinite(B[k])) out[k] = A[k] - B[k];
  }
  return out;
}

/* -------------------------------- Main -------------------------------- */
export default function RowIndexSectors() {
  const API = resolveApiBase();
  const [sourceTf, setSourceTf] = useState("10m"); // "10m" | "eod"

  const [intraday, setIntraday] = useState({ ts: null, cards: [], err: null });
  const [eod, setEod] = useState({ ts: null, cards: [], err: null });

  // Δ maps
  const [d10mMap, setD10mMap] = useState({});
  const [d1dMap, setD1dMap] = useState({});

  // Poll intraday every 60s
  useEffect(() => {
    const ctrl = new AbortController();
    async function load() {
      const url = `${API}/live/intraday?t=${Date.now()}`;
      try {
        const j = await fetchJSON(url, ctrl.signal);
        const ts = j?.sectorsUpdatedAt || j?.updated_at || null;
        const cards = Array.isArray(j?.sectorCards) ? j.sectorCards.slice() : [];
        setIntraday({ ts, cards, err: null });
        console.log("[RowIndexSectors] intraday", { url, ts, count: cards.length });
      } catch (err) {
        setIntraday((p) => ({ ...p, err: String(err) }));
      }
    }
    load();
    const t = setInterval(load, 60_000);
    return () => {
      ctrl.abort();
      clearInterval(t);
    };
  }, [API]);

  // Fetch EOD on demand (and refresh every 5 min while selected)
  useEffect(() => {
    let timer = null;
    const ctrl = new AbortController();
    async function load() {
      const url = `${API}/live/eod?t=${Date.now()}`;
      try {
        const j = await fetchJSON(url, ctrl.signal);
        const ts = j?.sectorsUpdatedAt || j?.updated_at || null;
        const cards = Array.isArray(j?.sectorCards) ? j.sectorCards.slice() : [];
        setEod({ ts, cards, err: null });
        console.log("[RowIndexSectors] eod", { url, ts, count: cards.length });
      } catch (err) {
        setEod((p) => ({ ...p, err: String(err) }));
      }
    }
    if (sourceTf === "eod") {
      load();
      timer = setInterval(load, 300_000);
    }
    return () => {
      if (timer) clearInterval(timer);
      ctrl.abort();
    };
  }, [API, sourceTf]);

  // Compute Δ10m every 60s
  useEffect(() => {
    const ctrl = new AbortController();
    async function load() {
      try {
        const m = await computeDeltaNetNH(API, "10min", ctrl.signal);
        setD10mMap(m);
      } catch {
        setD10mMap({});
      }
    }
    load();
    const t = setInterval(load, 60_000);
    return () => {
      ctrl.abort();
      clearInterval(t);
    };
  }, [API]);

  // Compute Δ1d every 5 min
  useEffect(() => {
    const ctrl = new AbortController();
    async function load() {
      try {
        const m = await computeDeltaNetNH(API, "eod", ctrl.signal);
        setD1dMap(m);
      } catch {
        setD1dMap({});
      }
    }
    load();
    const t = setInterval(load, 300_000);
    return () => {
      ctrl.abort();
      clearInterval(t);
    };
  }, [API]);

  // Choose active source strictly
  const active = sourceTf === "eod" ? eod : intraday;

  // Sort by canonical order
  const cards = useMemo(() => {
    const arr = Array.isArray(active.cards) ? active.cards.slice() : [];
    return arr.sort((a, b) => orderKey(a?.sector) - orderKey(b?.sector));
  }, [active.cards]);

  // Repaint per backend tick
  const stableKey = `${active.ts || "no-ts"}•${cards.length}`;

  // Legend modal
  const [legendOpen, setLegendOpen] = useState(false);

  return (
    <section id="row-4" className="panel index-sectors" aria-label="Index Sectors" key={stableKey}>
      {/* Header */}
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

        {/* AZ timestamp + source dropdown */}
        <div style={{ marginLeft: 8, color: "#9ca3af", fontSize: 12 }}>
          Updated {active.ts || "—"}
        </div>
        <select
          value={sourceTf}
          onChange={(e) => setSourceTf(e.target.value)}
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

      {/* Body */}
      {cards.length > 0 ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 8,
            marginTop: 6,
          }}
        >
          {cards.map((c, i) => {
            const key = norm(c?.sector || "");
            const d10 = d10mMap[key];
            const d1d = d1dMap[key];
            return <SectorCard key={c?.sector || i} card={c} d10m={d10} d1d={d1d} />;
          })}
        </div>
      ) : (
        <div className="small muted" style={{ padding: 6 }}>
          {active.err ? "Failed to load sectors." : "No sector cards in payload."}
        </div>
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
              <b>Net NH</b> Δ pills show change in Net Highs (NH−NL) between the two most recent snapshots for each cadence:
              <br />• <b>Δ10m</b> compares last two 10-minute snapshots
              <br />• <b>Δ1d</b> compares last two end-of-day snapshots
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
