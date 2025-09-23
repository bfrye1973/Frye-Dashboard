// src/pages/rows/RowIndexSectors.jsx
// v3 — FIXED: strict bind to backend /live endpoints; no fallbacks; repaint by AZ timestamp
// - Intraday (10m) and EOD dropdown both fetch backend Render URLs directly
// - Binds ONLY to top-level { sectorsUpdatedAt, sectorCards[] }
// - Adds cache-buster + no-store; forces React repaint by timestamp
// - Minimal UI (sector, outlook badge, Breadth%, Momentum%, Net NH); Legend modal preserved

import React, { useEffect, useMemo, useRef, useState } from "react";

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

// Canonical order for visual consistency
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

/* ------------------------------ Card UI ------------------------------ */
function SectorCard({ card }) {
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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div className="panel-title small" style={{ color: "#f3f4f6" }}>
          {card?.sector || "Sector"}
        </div>
        <Badge text={card?.outlook || "Neutral"} tone={tone} />
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

/* ------------------------------- Main ------------------------------- */
export default function RowIndexSectors() {
  const API = resolveApiBase();

  // Source toggle (10m vs EOD)
  const [sourceTf, setSourceTf] = useState("10m"); // "10m" | "eod"

  // Payload state (strict)
  const [intraday, setIntraday] = useState({ ts: null, cards: [], err: null });
  const [eod, setEod] = useState({ ts: null, cards: [], err: null });

  // Poll intraday every 60s
  useEffect(() => {
    const ctrl = new AbortController();
    async function load() {
      const url = `${API}/live/intraday?t=${Date.now()}`;
      try {
        const res = await fetch(url, { cache: "no-store", signal: ctrl.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const j = await res.json();
        const ts = j?.sectorsUpdatedAt || j?.updated_at || null;
        const cards = Array.isArray(j?.sectorCards) ? j.sectorCards.slice() : [];
        setIntraday({ ts, cards, err: null });
        // Dev beacon for quick QA:
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

  // Fetch EOD on demand (and every 5 min while selected)
  useEffect(() => {
    let timer = null;
    const ctrl = new AbortController();
    async function load() {
      const url = `${API}/live/eod?t=${Date.now()}`;
      try {
        const res = await fetch(url, { cache: "no-store", signal: ctrl.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const j = await res.json();
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
      ctrl.abort();
      if (timer) clearInterval(timer);
    };
  }, [API, sourceTf]);

  // Choose active source strictly
  const active = sourceTf === "eod" ? eod : intraday;

  // Sort cards by canonical order (no filtering, no alias tricks needed here)
  const cards = useMemo(() => {
    const arr = Array.isArray(active.cards) ? active.cards.slice() : [];
    return arr.sort((a, b) => orderKey(a?.sector) - orderKey(b?.sector));
  }, [active.cards]);

  // Force repaint on each backend tick
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
          {cards.map((c, i) => (
            <SectorCard key={c?.sector || i} card={c} />
          ))}
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
              Sector trend bias from breadth: <b>Bullish</b> (NH&gt;NL), <b>Neutral</b> (mixed),{" "}
              <b>Bearish</b> (NL&gt;NH).
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
              <b>Breadth Tilt</b> = NH / (NH + NL) × 100.
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
