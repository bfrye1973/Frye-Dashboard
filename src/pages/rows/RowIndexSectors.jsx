// src/pages/rows/RowIndexSectors.jsx
// v4.2 — Δ5m (sandbox), Δ10m (replay), Δ1h (replay), Δ1d (replay)
// Uses the same computeDeltaNetNH() helper for 10m/1h/1d. No layout/size changes.

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
const isStale = (ts, maxMs = 12 * 60 * 1000) => {
  if (!ts) return true;
  const t = new Date(ts).getTime();
  return !Number.isFinite(t) || Date.now() - t > maxMs;
};

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
      title={`${label}: ${v >= 0 ? "+" : ""}${v.toFixed(2)}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        borderRadius: 6,
        padding: "1px 4px",
        fontSize: 11,
        lineHeight: 1.1,
        fontWeight: 600,
        background: "#0b0f17",
        color: tone,
        border: `1px solid ${tone}33`,
        whiteSpace: "nowrap",
      }}
    >
      {label}: {arrow} {v >= 0 ? "+" : ""}
      {v.toFixed(2)}
    </span>
  );
}

/* ------------------------------ Sandbox 5m ------------------------------ */
const SANDBOX_URL = process.env.REACT_APP_INTRADAY_SANDBOX_URL || "";
const ALIASES = {
  "healthcare": "Health Care",
  "health care": "Health Care",
  "info tech": "Information Technology",
  "information technology": "Information Technology",
  "communications": "Communication Services",
  "communication services": "Communication Services",
  "consumer staples": "Consumer Staples",
  "consumer discretionary": "Consumer Discretionary",
  "financials": "Financials",
  "industrials": "Industrials",
  "materials": "Materials",
  "real estate": "Real Estate",
  "utilities": "Utilities",
  "energy": "Energy",
};

async function fetchJSON(url, signal) {
  const r = await fetch(url, { cache: "no-store", signal });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return await r.json();
}

function snapshotToNetNHMap(snap) {
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
  // helper to fetch the index list
  async function fetchIndex(g) {
    return await fetchJSON(
      `${API}/api/replay/index?granularity=${encodeURIComponent(g)}&t=${Date.now()}`,
      signal
    );
  }

  // 1) try the requested granularity
  let idx = await fetchIndex(granularity);

  // 2) if asking for hourly and it’s empty, also try the other common name
  if ((granularity === "1h" || granularity === "hourly") && (!idx?.items?.length)) {
    const alt = granularity === "1h" ? "hourly" : "1h";
    idx = await fetchIndex(alt);
  }

  const items = Array.isArray(idx?.items) ? idx.items : [];
  if (items.length < 2) return {};           // need two snapshots to compute a delta

  const tsA = items[0]?.ts;
  const tsB = items[1]?.ts;
  if (!tsA || !tsB) return {};

  // fetch the two snapshots
  const [snapA, snapB] = await Promise.all([
    fetchJSON(`${API}/api/replay/at?granularity=${encodeURIComponent(items[0]?.granularity || granularity)}&ts=${encodeURIComponent(tsA)}&t=${Date.now()}`, signal),
    fetchJSON(`${API}/api/replay/at?granularity=${encodeURIComponent(items[1]?.granularity || granularity)}&ts=${encodeURIComponent(tsB)}&t=${Date.now()}`, signal),
  ]);

  // turn snapshots into { sectorKey -> NetNH }
  const A = snapshotToNetNHMap(snapA);
  const B = snapshotToNetNHMap(snapB);

  // delta = latest - previous
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
  const [d1hMap, setD1hMap] = useState({});   // NEW — hourly via replay
  const [d1dMap, setD1dMap] = useState({});

  // Sandbox deltas (5m)
  const [d5mMap, setD5mMap] = useState({});
  const [deltasUpdatedAt, setDeltasUpdatedAt] = useState(null);

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

  // Δ10m every 60s
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

  // Δ1h every 5 min (same pattern as 10m/eod)
  useEffect(() => {
    const ctrl = new AbortController();
    async function load() {
      try {
        const m = await computeDeltaNetNH(API, "1h", ctrl.signal);
        setD1hMap(m);
      } catch {
        setD1hMap({});
      }
    }
    load();
    const t = setInterval(load, 300_000);
    return () => {
      ctrl.abort();
      clearInterval(t);
    };
  }, [API]);

  // Δ1d every 5 min
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

  // Pull 5m sandbox deltas every 60s (read-only)
  useEffect(() => {
    let stop = false;
    async function loadSandbox() {
      if (!SANDBOX_URL) return;
      try {
        const u = SANDBOX_URL.includes("?")
          ? `${SANDBOX_URL}&t=${Date.now()}`
          : `${SANDBOX_URL}?t=${Date.now()}`;
        const r = await fetch(u, { cache: "no-store" });
        const j = await r.json();
        if (stop) return;

        const map = {};
        const ds = j?.deltas?.sectors || {};
        for (const key of Object.keys(ds)) {
          const canon = ALIASES[norm(key)] || key; // keep canon case
          map[norm(canon)] = Number(ds[key]?.netTilt ?? NaN); // show netTilt as Δ5m
        }
        setD5mMap(map);
        setDeltasUpdatedAt(j?.deltasUpdatedAt || null);
      } catch {
        if (!stop) { setD5mMap({}); setDeltasUpdatedAt(null); }
      }
    }
    loadSandbox();
    const t = setInterval(loadSandbox, 60_000);
    return () => { stop = true; clearInterval(t); };
  }, []);

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

  const stale5m = isStale(deltasUpdatedAt);

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
        {/* Δ5m staleness indicator */}
        {SANDBOX_URL && (
          <div style={{ color: stale5m ? "#9ca3af" : "#22c55e", fontSize: 12, fontWeight: 700 }}>
            Δ5m {stale5m ? "STALE" : "LIVE"} {deltasUpdatedAt ? `• ${deltasUpdatedAt}` : ""}
          </div>
        )}
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
            const d5 = (() => {
              const canon = ALIASES[key] || c?.sector || "";
              const v = d5mMap[norm(canon)];
              return Number.isFinite(v) && !stale5m ? v : undefined;
            })();
            const d10 = d10mMap[key];
            const d1h = d1hMap[key];
            const d1d = d1dMap[key];

            const nh = Number(c?.nh ?? NaN);
            const nl = Number(c?.nl ?? NaN);
            const netNH = Number.isFinite(nh) && Number.isFinite(nl) ? nh - nl : null;

            const breadth = Number(c?.breadth_pct ?? NaN);
            const momentum = Number(c?.momentum_pct ?? NaN);
            const tone = toneFor(c?.outlook);

            return (
              <div
                key={c?.sector || i}
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
                    {c?.sector || "Sector"}
                  </div>
                  <Badge text={c?.outlook || "Neutral"} tone={tone} />
                </div>

                {/* Compact Δ row (single line; no height change) */}
                <div style={{ display: "flex", gap: 6, margin: "0 0 4px 0", alignItems: "center", flexWrap: "wrap" }}>
                  {Number.isFinite(d5) && <Pill label="Δ5m" value={d5} />}
                  <Pill label="Δ10m" value={Number.isFinite(d10) ? d10 : undefined} />
                  <Pill label="Δ1h"  value={Number.isFinite(d1h) ? d1h : undefined} />
                  <Pill label="Δ1d"  value={Number.isFinite(d1d) ? d1d : undefined} />
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
              <b>Δ5m</b> from sandbox (netTilt).<br/>
              <b>Δ10m</b> from replay: last two 10-minute snapshots.<br/>
              <b>Δ1h</b> from replay: last two hourly snapshots.<br/>
              <b>Δ1d</b> from replay: last two end-of-day snapshots.
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
