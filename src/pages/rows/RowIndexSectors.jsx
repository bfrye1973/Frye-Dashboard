// src/pages/rows/RowIndexSectors.jsx
// v6.0 — One-source pills (backend-computed)
// - Frontend polls ONE route: /live/pills (every ~30s)
// - Δ5m = data.sectors[k].d5m
// - Δ10m = data.sectors[k].d10m
// - No localStorage, no seeding, no dual polling
// - Cards still render from the same /live/intraday source you already use elsewhere?  ❌ Not needed here.
//   We display the sector metrics included in your cards payload only if you decide to merge sources later.
//   For now, pills are the goal → fetch pills, render pills. Simple and stable.

import React, { useEffect, useMemo, useRef, useState } from "react";

/* ------------------------------ ENV URL ------------------------------ */
/** Point this to your backend pills route. */
const PILLS_URL = (process.env.REACT_APP_PILLS_URL || "https://frye-market-backend-1.onrender.com/live/pills").replace(/\/+$/, "");

/* If you also want to show Breadth/Momentum/NH/NL like before,
   wire your canonical cards feed back in later. For now, we keep
   the UI focused on pills stability. */

/* ------------------------------- helpers ------------------------------- */
const norm = (s = "") => s.trim().toLowerCase();

/** Canonical display order */
const ORDER = [
  "information technology","materials","health care","communication services",
  "real estate","energy","consumer staples","consumer discretionary",
  "financials","utilities","industrials",
];
const orderKey = (name = "") => {
  const i = ORDER.indexOf(norm(name));
  return i === -1 ? 999 : i;
};

/** Simple alias map (kept for key normalization if you later join cards) */
const ALIASES = {
  healthcare: "health care","health-care":"health care","health care":"health care",
  "info tech":"information technology","technology":"information technology","tech":"information technology",
  communications:"communication services","comm services":"communication services","telecom":"communication services",
  staples:"consumer staples","discretionary":"consumer discretionary",
  finance:"financials","industry":"industrials","reit":"real estate","reits":"real estate",
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
      ok:    { bg: "#22c55e", fg: "#0b1220", bd: "#16a34a" },
      warn:  { bg: "#facc15", fg: "#111827", bd: "#ca8a04" },
      danger:{ bg: "#ef4444", fg: "#fee2e2", bd: "#b91c1c" },
      info:  { bg: "#0b1220", fg: "#93c5fd", bd: "#334155" },
    }[tone] || { bg: "#0b0f17", fg: "#93c5fd", bd: "#334155" };
  return (
    <span style={{
      padding:"4px 10px", borderRadius:10, fontSize:13, fontWeight:800,
      background: map.bg, color: map.fg, border:`1px solid ${map.bd}`
    }}>{text}</span>
  );
}

function Pill({ label, value }) {
  const isNum = typeof value === "number" && Number.isFinite(value);
  const v = isNum ? Number(value) : null;
  const tone  = isNum ? (v > 0 ? "#22c55e" : v < 0 ? "#ef4444" : "#9ca3af") : "#9ca3af";
  const arrow = isNum ? (v > 0 ? "▲" : v < 0 ? "▼" : "→") : "—";
  const text  = isNum ? v.toFixed(2) : "—";
  return (
    <span
      title={`${label}: ${isNum ? (v >= 0 ? "+" : "") + v.toFixed(2) : "—"}`}
      style={{
        display:"inline-flex", alignItems:"center", gap:8,
        borderRadius:10, padding:"3px 10px", fontSize:14, lineHeight:1.1,
        fontWeight:800, background:"#0b0f17", color:tone, border:`1px solid ${tone}33`,
        whiteSpace:"nowrap",
      }}
    >
      {label}: {arrow} {isNum && v >= 0 ? "+" : ""}{text}
    </span>
  );
}

/* ------------------------------ Fetch util ------------------------------ */
async function fetchJSON(url, opts = {}) {
  const r = await fetch(url, { cache: "no-store", ...opts });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
  return await r.json();
}

/* -------------------------------- Main -------------------------------- */
export default function RowIndexSectors() {
  // pills payload
  const [pills, setPills] = useState({ stamp5: null, stamp10: null, sectors: {} });
  const [err, setErr] = useState(null);

  // last stamps we rendered (to avoid flicker)
  const last5Ref = useRef(null);
  const last10Ref = useRef(null);

  useEffect(() => {
    let stop = false;
    const ctrl = new AbortController();

    async function load() {
      try {
        const u = PILLS_URL + (PILLS_URL.includes("?") ? "&" : "?") + "t=" + Date.now();
        const j = await fetchJSON(u, { signal: ctrl.signal });
        if (stop) return;

        // Only update when something actually changes
        const s5 = j?.stamp5 || null;
        const s10 = j?.stamp10 || null;

        // If stamps changed, render; if both unchanged, do nothing (prevents flicker)
        if (s5 !== last5Ref.current || s10 !== last10Ref.current) {
          setPills({
            stamp5: s5,
            stamp10: s10,
            sectors: j?.sectors || {},
          });
          last5Ref.current = s5;
          last10Ref.current = s10;
        }
        setErr(null);
      } catch (e) {
        setErr(String(e?.message || e));
        // keep last pills on error (no wipe)
      }
    }

    load();
    const t = setInterval(load, 30_000); // 30s cadence
    return () => { stop = true; try { ctrl.abort(); } catch {}; clearInterval(t); };
  }, []);

  // Build list of sectors from ORDER (ensures stable layout)
  const sectorKeys = useMemo(() => ORDER.slice(), []);

  // Simple placeholder for outlook label (optional). If you want real outlook tags,
  // extend /live/pills to include an "outlook" per sector and read it here.
  const getOutlook = (_k) => "Neutral";

  return (
    <section id="row-4" className="panel index-sectors" aria-label="Index Sectors">
      {/* Header */}
      <div className="panel-head" style={{ alignItems:"center" }}>
        <div className="panel-title">Index Sectors</div>

        <div style={{ marginLeft:8, color:"#9ca3af", fontSize:12 }}>
          Δ5m last: {pills.stamp5 || "—"} • Δ10m last: {pills.stamp10 || "—"}
        </div>

        <div className="spacer" />
        {err && (
          <div style={{ color:"#fca5a5", fontSize:12 }}>
            {err}
          </div>
        )}
      </div>

      {/* Body */}
      <div
        style={{
          display:"grid",
          gridTemplateColumns:"repeat(auto-fill, minmax(360px, 1fr))",
          gap:12,
          marginTop:8,
        }}
      >
        {sectorKeys.map((keyName, i) => {
          const k = norm(keyName);
          const sd = pills.sectors?.[k] || pills.sectors?.[keyName] || {};
          const d5  = typeof sd.d5m  === "number" && Number.isFinite(sd.d5m)  ? sd.d5m  : null;
          const d10 = typeof sd.d10m === "number" && Number.isFinite(sd.d10m) ? sd.d10m : null;

          const tone = toneFor(getOutlook(k));

          return (
            <div
              key={keyName || i}
              className="panel"
              style={{
                padding:14,
                minWidth:360, maxWidth:560,
                borderRadius:14,
                border:"1px solid #2b2b2b",
                background:"#0b0b0c",
                boxShadow:"0 10px 24px rgba(0,0,0,0.28)",
              }}
            >
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
                <div className="panel-title small" style={{ color:"#f3f4f6", fontSize:18, fontWeight:900, letterSpacing:"0.3px" }}>
                  {keyName}
                </div>
                <Badge text={getOutlook(k)} tone={tone} />
              </div>

              {/* Two-row pills: Top (Δ5m, Δ10m). You can add Δ1h/Δ1d later if needed. */}
              <div style={{ display:"grid", gridTemplateRows:"auto", rowGap:6, margin:"0 0 8px 0" }}>
                <div style={{ display:"flex", gap:10, alignItems:"center", whiteSpace:"nowrap", overflow:"hidden" }}>
                  <Pill label="Δ5m"  value={d5} />
                  <Pill label="Δ10m" value={d10} />
                </div>
              </div>

              {/* (Optional) If you want to show Breadth/Momentum/NH/NL again,
                  either extend /live/pills to include them or add a second
                  fetch for /live/intraday and join here. */}
              <div style={{ fontSize:13, color:"#9ca3af" }}>
                {/* minimalist card; pills are the focus for stability */}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
