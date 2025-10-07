// src/pages/rows/RowIndexSectors.jsx
// v4.4 — Fixed: sectors bind to /live/* env URLs (no /api); session Δ pills kept
// - Δ10m = current intraday vs previous intraday (session)
// - Δ1h  = current hourly   vs previous hourly   (session)
// - Δ1d  = current EOD      vs previous EOD      (session)
// - Δ5m  = sandbox netTilt (read-only)
// If replay returns later, you can re-enable those maps without touching layout.

import React, { useEffect, useMemo, useState } from "react";

/* ------------------------------ ENV URLS ------------------------------ */
// IMPORTANT: these must be set in Render → Frye-Dashboard → Environment
const INTRADAY_URL = (process.env.REACT_APP_INTRADAY_URL || "").replace(/\/+$/, "");
const HOURLY_URL   = (process.env.REACT_APP_HOURLY_URL   || "").replace(/\/+$/, "");
const EOD_URL      = (process.env.REACT_APP_EOD_URL      || "").replace(/\/+$/, "");
const SANDBOX_URL  = process.env.REACT_APP_INTRADAY_SANDBOX_URL || "";

/* ------------------------------- helpers ------------------------------- */
const norm   = (s = "") => s.trim().toLowerCase();
const isStale = (ts, maxMs = 12 * 60 * 1000) => {
  if (!ts) return true;
  const t = new Date(ts).getTime();
  return !Number.isFinite(t) || Date.now() - t > maxMs;
};

const ORDER = [
  "information technology","materials","health care","communication services",
  "real estate","energy","consumer staples","consumer discretionary",
  "financials","utilities","industrials",
];
const orderKey = (name = "") => {
  const i = ORDER.indexOf(norm(name));
  return i === -1 ? 999 : i;
};
const toneFor = (outlook) => {
  const s = String(outlook || "").toLowerCase();
  if (s.startsWith("bull")) return "ok";
  if (s.startsWith("bear")) return "danger";
  if (s.startsWith("neut")) return "warn";
  return "info";
};

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
      padding:"4px 8px", borderRadius:8, fontSize:12, fontWeight:700,
      background: map.bg, color: map.fg, border:`1px solid ${map.bd}`
    }}>{text}</span>
  );
}

function Pill({ label, value }) {
  if (!Number.isFinite(value)) return null;
  const v = Number(value);
  const tone  = v > 0 ? "#22c55e" : v < 0 ? "#ef4444" : "#9ca3af";
  const arrow = v > 0 ? "▲" : v < 0 ? "▼" : "→";
  return (
    <span
      title={`${label}: ${v >= 0 ? "+" : ""}${v.toFixed(2)}`}
      style={{
        display:"inline-flex", alignItems:"center", gap:4,
        borderRadius:6, padding:"1px 4px", fontSize:11, lineHeight:1.1,
        fontWeight:600, background:"#0b0f17", color:tone, border:`1px solid ${tone}33`,
        whiteSpace:"nowrap",
      }}
    >
      {label}: {arrow} {v >= 0 ? "+" : ""}{v.toFixed(2)}
    </span>
  );
}

/* ------------------------------ Aliases ------------------------------ */
// Canonical aliases (used by 5m sandbox + mapping)
const ALIASES = {
  healthcare: "Health Care", "health care": "Health Care",
  "info tech": "Information Technology", "information technology": "Information Technology",
  communications: "Communication Services", "communication services": "Communication Services",
  "consumer staples": "Consumer Staples", "consumer discretionary": "Consumer Discretionary",
  financials: "Financials", industrials: "Industrials", materials: "Materials",
  "real estate": "Real Estate", utilities: "Utilities", energy: "Energy",
};

/* ------------------------------ Fetch util ------------------------------ */
async function fetchJSON(url, signal) {
  const r = await fetch(url, { cache: "no-store", signal });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
  return await r.json();
}

/* Build { sectorKey -> Net NH } from live cards (intraday/hourly/eod) */
function netNHMapFromCards(cards = []) {
  const out = {};
  for (const c of Array.isArray(cards) ? cards : []) {
    const raw = c?.sector || "";
    const canon = ALIASES[norm(raw)] || raw;
    const key = norm(canon);
    const nh = Number(c?.nh ?? NaN);
    const nl = Number(c?.nl ?? NaN);
    if (key && Number.isFinite(nh) && Number.isFinite(nl)) out[key] = nh - nl;
  }
  return out;
}

/* -------------------------------- Main -------------------------------- */
export default function RowIndexSectors() {
  const [sourceTf, setSourceTf] = useState("10m"); // "10m" | "eod"

  const [intraday, setIntraday] = useState({ ts: null, cards: [], err: null });
  const [eod,      setEod]      = useState({ ts: null, cards: [], err: null });

  // Session delta maps (live-only, no replay)
  const [d10mSess, setD10mSess] = useState({});
  const [d1hSess,  setD1hSess]  = useState({});
  const [d1dSess,  setD1dSess]  = useState({});

  // Last snapshots per cadence for session deltas
  const [last10m, setLast10m] = useState(null);
  const [last1h,  setLast1h]  = useState(null);
  const [last1d,  setLast1d]  = useState(null);

  // Sandbox deltas (5m)
  const [d5mMap, setD5mMap] = useState({});
  const [deltasUpdatedAt, setDeltasUpdatedAt] = useState(null);

  /* -------------------- Poll intraday (10m) + Δ10m session -------------------- */
  useEffect(() => {
    const ctrl = new AbortController();
    async function load() {
      if (!INTRADAY_URL) { setIntraday(p => ({ ...p, err: "Missing INTRADAY_URL" })); return; }
      try {
        const j = await fetchJSON(`${INTRADAY_URL}?t=${Date.now()}`, ctrl.signal);
        const ts    = j?.sectorsUpdatedAt || j?.updated_at || null;
        const cards = Array.isArray(j?.sectorCards) ? j.sectorCards.slice() : [];
        setIntraday({ ts, cards, err: null });

        // Session Δ10m
        const nowMap = netNHMapFromCards(cards);
        if (last10m) {
          const d = {};
          const keys = new Set([...Object.keys(nowMap), ...Object.keys(last10m)]);
          for (const k of keys) if (Number.isFinite(nowMap[k]) && Number.isFinite(last10m[k])) d[k] = nowMap[k] - last10m[k];
          setD10mSess(d);
        }
        setLast10m(nowMap);
      } catch (err) {
        setIntraday(p => ({ ...p, err: String(err) }));
      }
    }
    load();
    const t = setInterval(load, 60_000);
    return () => { ctrl.abort(); clearInterval(t); };
  }, [last10m]);

  /* -------------------- Poll hourly + Δ1h session -------------------- */
  useEffect(() => {
    const ctrl = new AbortController();
    async function load() {
      if (!HOURLY_URL) return;
      try {
        const j = await fetchJSON(`${HOURLY_URL}?t=${Date.now()}`, ctrl.signal);
        const cards = Array.isArray(j?.sectorCards) ? j.sectorCards : [];
        const nowMap = netNHMapFromCards(cards);
        if (last1h) {
          const d = {};
          const keys = new Set([...Object.keys(nowMap), ...Object.keys(last1h)]);
          for (const k of keys) if (Number.isFinite(nowMap[k]) && Number.isFinite(last1h[k])) d[k] = nowMap[k] - last1h[k];
          setD1hSess(d);
        }
        setLast1h(nowMap);
      } catch { /* keep previous session deltas */ }
    }
    load();
    const t = setInterval(load, 60_000);
    return () => { ctrl.abort(); clearInterval(t); };
  }, [last1h]);

  /* -------------------- Fetch EOD on demand + Δ1d session -------------------- */
  useEffect(() => {
    let timer = null;
    const ctrl = new AbortController();
    async function load() {
      if (!EOD_URL) { setEod(p => ({ ...p, err: "Missing EOD_URL" })); return; }
      try {
        const j = await fetchJSON(`${EOD_URL}?t=${Date.now()}`, ctrl.signal);
        const ts    = j?.sectorsUpdatedAt || j?.updated_at || null;
        const cards = Array.isArray(j?.sectorCards) ? j.sectorCards.slice() : [];
        setEod({ ts, cards, err: null });

        // Session Δ1d
        const nowMap = netNHMapFromCards(cards);
        if (last1d) {
          const d = {};
          const keys = new Set([...Object.keys(nowMap), ...Object.keys(last1d)]);
          for (const k of keys) if (Number.isFinite(nowMap[k]) && Number.isFinite(last1d[k])) d[k] = nowMap[k] - last1d[k];
          setD1dSess(d);
        }
        setLast1d(nowMap);
      } catch (err) {
        setEod(p => ({ ...p, err: String(err) }));
      }
    }
    if (sourceTf === "eod") {
      load();
      timer = setInterval(load, 300_000);
    }
    return () => { if (timer) clearInterval(timer); ctrl.abort(); };
  }, [sourceTf, last1d]);

  /* -------------------- Pull 5m sandbox deltas (read-only) -------------------- */
  useEffect(() => {
    let stop = false;
    async function loadSandbox() {
      if (!SANDBOX_URL) return;
      try {
        const u = SANDBOX_URL.includes("?") ? `${SANDBOX_URL}&t=${Date.now()}` : `${SANDBOX_URL}?t=${Date.now()}`;
        const r = await fetch(u, { cache: "no-store" });
        const j = await r.json();
        if (stop) return;

        const map = {};
        const ds = j?.deltas?.sectors || {};
        for (const key of Object.keys(ds)) {
          const canon = ALIASES[norm(key)] || key;
          map[norm(canon)] = Number(ds[key]?.netTilt ?? NaN); // Δ5m = netTilt
        }
        setD5mMap(map);
        setDeltasUpdatedAt(j?.deltasUpdatedAt || null);
      } catch { if (!stop) { setD5mMap({}); setDeltasUpdatedAt(null); } }
    }
    loadSandbox();
    const t = setInterval(loadSandbox, 60_000);
    return () => { stop = true; clearInterval(t); };
  }, []);

  // Active source strictly
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
      <div className="panel-head" style={{ alignItems:"center" }}>
        <div className="panel-title">Index Sectors</div>

        <button
          title="Legend" onClick={() => setLegendOpen(true)}
          style={{
            background:"#0b0b0b", color:"#e5e7eb", border:"1px solid #2b2b2b",
            borderRadius:6, padding:"4px 8px", fontSize:12, fontWeight:600, cursor:"pointer", marginLeft:8,
          }}
        >Legend</button>

        {/* AZ timestamp + source dropdown */}
        <div style={{ marginLeft:8, color:"#9ca3af", fontSize:12 }}>
          Updated {active.ts || "—"}
        </div>
        <select
          value={sourceTf} onChange={(e) => setSourceTf(e.target.value)}
          style={{
            marginLeft:8, background:"#0b0b0b", color:"#e5e7eb",
            border:"1px solid #2b2b2b", borderRadius:6, padding:"2px 6px", fontSize:12,
          }}
          title="Cards Source"
        >
          <option value="10m">10m</option>
          <option value="eod">EOD</option>
        </select>

        <div className="spacer" />
        {/* Δ5m staleness indicator */}
        {SANDBOX_URL && (
          <div style={{ color: stale5m ? "#9ca3af" : "#22c55e", fontSize:12, fontWeight:700 }}>
            Δ5m {stale5m ? "STALE" : "LIVE"} {deltasUpdatedAt ? `• ${deltasUpdatedAt}` : ""}
          </div>
        )}
      </div>

      {/* Body */}
      {cards.length > 0 ? (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(220px, 1fr))", gap:8, marginTop:6 }}>
          {cards.map((c, i) => {
            const key = norm(c?.sector || "");

            // 5m netTilt pill (sandbox; green/red/gray); hide if stale or missing
            const canon = ALIASES[key] || c?.sector || "";
            const d5 = d5mMap[norm(canon)];
            const show5 = Number.isFinite(d5) && !stale5m;

            // Session deltas (replay-ready fallback: prefer replay maps if added later)
            const d10 = d10mSess[key];
            const d1h = d1hSess[key];
            const d1d = d1dSess[key];

            const nh = Number(c?.nh ?? NaN);
            const nl = Number(c?.nl ?? NaN);
            const netNH = Number.isFinite(nh) && Number.isFinite(nl) ? nh - nl : null;

            const breadth  = Number(c?.breadth_pct  ?? NaN);
            const momentum = Number(c?.momentum_pct ?? NaN);
            const tone = toneFor(c?.outlook);

            return (
              <div
                key={c?.sector || i}
                className="panel"
                style={{
                  padding:10, minWidth:220, maxWidth:260, borderRadius:12,
                  border:"1px solid #2b2b2b", background:"#0b0b0c", boxShadow:"0 8px 20px rgba(0,0,0,0.25)",
                }}
              >
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:4 }}>
                  <div className="panel-title small" style={{ color:"#f3f4f6" }}>{c?.sector || "Sector"}</div>
                  <Badge text={c?.outlook || "Neutral"} tone={tone} />
                </div>

                {/* Compact Δ row (single line; no height change) */}
                <div style={{ display:"flex", gap:6, margin:"0 0 4px 0", alignItems:"center", flexWrap:"wrap" }}>
                  {show5 && <Pill label="Δ5m" value={d5} />}
                  <Pill label="Δ10m" value={Number.isFinite(d10) ? d10 : undefined} />
                  <Pill label="Δ1h"  value={Number.isFinite(d1h) ? d1h : undefined} />
                  <Pill label="Δ1d"  value={Number.isFinite(d1d) ? d1d : undefined} />
                </div>

                <div style={{ fontSize:12, color:"#cbd5e1", display:"grid", gap:2 }}>
                  <div> Breadth Tilt: <b style={{ color:"#f3f4f6" }}>{Number.isFinite(breadth) ? `${breadth.toFixed(1)}%` : "—"}</b> </div>
                  <div> Momentum:     <b style={{ color:"#f3f4f6" }}>{Number.isFinite(momentum) ? `${momentum.toFixed(1)}%` : "—"}</b> </div>
                  <div>
                    Net NH: <b style={{ color:"#f3f4f6" }}>{netNH ?? "—"}</b>
                    <span style={{ color:"#9ca3af" }}> (NH {Number.isFinite(nh) ? nh : "—"} / NL {Number.isFinite(nl) ? nl : "—"})</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="small muted" style={{ padding:6 }}>
          {active.err
            ? `Failed to load sectors. ${active.err}`
            : (!INTRADAY_URL ? "Missing REACT_APP_INTRADAY_URL" : "No sector cards in payload.")
          }
        </div>
      )}

      {/* Legend modal */}
      {legendOpen && (
        <div
          role="dialog" aria-modal="true" onClick={() => setLegendOpen(false)}
          style={{
            position:"fixed", inset:0, background:"rgba(0,0,0,0.5)",
            display:"flex", alignItems:"center", justifyContent:"center", zIndex:60,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width:"min(880px, 92vw)", background:"#0b0b0c", border:"1px solid #2b2b2b",
              borderRadius:12, padding:16, boxShadow:"0 10px 30px rgba(0,0,0,0.35)",
            }}
          >
            <div style={{ color:"#f9fafb", fontSize:14, fontWeight:800, marginBottom:8 }}>
              Index Sectors — Legend
            </div>
            <div style={{ color:"#e5e7eb", fontSize:13, fontWeight:700, marginTop:6 }}>
              Outlook
            </div>
            <div style={{ color:"#d1d5db", fontSize:12 }}>
              <b>Δ5m</b> from sandbox (netTilt).<br/>
              <b>Δ10m</b> from live intraday vs prior intraday (session).<br/>
              <b>Δ1h</b> from live hourly vs prior hourly (session).<br/>
              <b>Δ1d</b> from live EOD vs prior EOD (session).
            </div>
            <div style={{ display:"flex", justifyContent:"flex-end", marginTop:12 }}>
              <button
                onClick={() => setLegendOpen(false)}
                style={{
                  background:"#eab308", color:"#111827", border:"none",
                  borderRadius:8, padding:"8px 12px", fontWeight:700, cursor:"pointer",
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
