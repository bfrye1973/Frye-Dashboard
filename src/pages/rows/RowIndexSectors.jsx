// src/pages/rows/RowIndexSectors.jsx
// v4.8 — Pills persist across refreshes
// - Uses /live env URLs only (no /api)
// - Δ10m: persists prev intraday snapshot AND last computed Δ10m (shows on refresh)
// - Δ5m: persists sandbox map; always renders if numeric (no stale hiding)
// - Δ1h: hour-over-hour with fallback (intraday − lastHourly)
// - Bigger, wider cards; pills stay on one line

import React, { useEffect, useMemo, useRef, useState } from "react";

/* ------------------------------ ENV URLS ------------------------------ */
const INTRADAY_URL = (process.env.REACT_APP_INTRADAY_URL || "").replace(/\/+$/, "");
const HOURLY_URL   = (process.env.REACT_APP_HOURLY_URL   || "").replace(/\/+$/, "");
const EOD_URL      = (process.env.REACT_APP_EOD_URL      || "").replace(/\/+$/, "");
const SANDBOX_URL  = process.env.REACT_APP_INTRADAY_SANDBOX_URL || "";

/* ------------------------------- helpers ------------------------------- */
const norm = (s = "") => s.trim().toLowerCase();
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

const ALIASES = {
  healthcare: "Health Care", "health care": "Health Care",
  "info tech": "Information Technology", "information technology": "Information Technology",
  communications: "Communication Services", "communication services": "Communication Services",
  "consumer staples": "Consumer Staples", "consumer discretionary": "Consumer Discretionary",
  financials: "Financials", industrials: "Industrials", materials: "Materials",
  "real estate": "Real Estate", utilities: "Utilities", energy: "Energy",
};

const toneFor = (o) => {
  const s = String(o || "").toLowerCase();
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
      padding:"4px 10px", borderRadius:10, fontSize:13, fontWeight:800,
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
        display:"inline-flex", alignItems:"center", gap:8,
        borderRadius:10, padding:"3px 10px", fontSize:14, lineHeight:1.1,
        fontWeight:800, background:"#0b0f17", color:tone, border:`1px solid ${tone}33`,
        whiteSpace:"nowrap",
      }}
    >
      {label}: {arrow} {v >= 0 ? "+" : ""}{v.toFixed(2)}
    </span>
  );
}

/* ------------------------------ Fetch util ------------------------------ */
async function fetchJSON(url, signal) {
  const r = await fetch(url, { cache: "no-store", signal });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
  return await r.json();
}

/* Build { sectorKey -> Net NH } from live cards */
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

/* --------------------------- localStorage helpers --------------------------- */
const LS_PREV_10M_TS   = "idx_prev10m_ts";
const LS_PREV_10M_MAP  = "idx_prev10m_map";
const LS_LAST_D10M_MAP = "idx_last_d10m_map";
const LS_LAST_D5M_MAP  = "idx_last_d5m_map";
const LS_LAST_D5M_TS   = "idx_last_d5m_ts";

function safeSet(k, v) { try { localStorage.setItem(k, v); } catch {} }
function safeGet(k)    { try { return localStorage.getItem(k); } catch { return null; } }

function savePrev10m(ts, mapObj) {
  if (ts)  safeSet(LS_PREV_10M_TS, ts);
  if (mapObj) safeSet(LS_PREV_10M_MAP, JSON.stringify(mapObj));
}
function loadPrev10m() {
  try {
    const ts  = safeGet(LS_PREV_10M_TS);
    const raw = safeGet(LS_PREV_10M_MAP);
    return { ts, map: raw ? JSON.parse(raw) : null };
  } catch { return { ts:null, map:null }; }
}
function saveLastD10m(mapObj) {
  if (mapObj) safeSet(LS_LAST_D10M_MAP, JSON.stringify(mapObj));
}
function loadLastD10m() {
  try { const raw = safeGet(LS_LAST_D10M_MAP); return raw ? JSON.parse(raw) : {}; }
  catch { return {}; }
}
function saveLastD5m(ts, mapObj) {
  if (ts) safeSet(LS_LAST_D5M_TS, ts);
  if (mapObj) safeSet(LS_LAST_D5M_MAP, JSON.stringify(mapObj));
}
function loadLastD5m() {
  try {
    const ts = safeGet(LS_LAST_D5M_TS);
    const raw = safeGet(LS_LAST_D5M_MAP);
    return { ts, map: raw ? JSON.parse(raw) : {} };
  } catch { return { ts:null, map:{} }; }
}

/* -------------------------------- Main -------------------------------- */
export default function RowIndexSectors() {
  const [sourceTf, setSourceTf] = useState("10m");

  const [intraday, setIntraday] = useState({ ts: null, cards: [], err: null });
  const [hourly,   setHourly]   = useState({ ts: null, cards: [], err: null });
  const [eod,      setEod]      = useState({ ts: null, cards: [], err: null });

  // Session deltas (visible immediately via persistence)
  const [d10mSess, setD10mSess] = useState(loadLastD10m());  // ← load cached Δ10m
  const [d1hSess,  setD1hSess]  = useState({});
  const [d1dSess,  setD1dSess]  = useState({});

  // Stable refs for Δ10m previous snapshot (initialized from storage)
  const bootPrev = loadPrev10m();
  const prev10mMapRef = useRef(bootPrev.map);
  const prev10mTsRef  = useRef(bootPrev.ts);

  // Δ5m sandbox (persisted)
  const bootD5 = loadLastD5m();
  const [d5mMap, setD5mMap] = useState(bootD5.map);
  const [deltasUpdatedAt, setDeltasUpdatedAt] = useState(bootD5.ts);

  /* -------------------- Poll intraday (10m) + Δ10m via refs -------------------- */
  useEffect(() => {
    const ctrl = new AbortController();

    async function load() {
      if (!INTRADAY_URL) { setIntraday(p => ({ ...p, err: "Missing INTRADAY_URL" })); return; }
      try {
        const j = await fetchJSON(`${INTRADAY_URL}?t=${Date.now()}`, ctrl.signal);
        const ts    = j?.sectorsUpdatedAt || j?.updated_at || null;
        const cards = Array.isArray(j?.sectorCards) ? j.sectorCards.slice() : [];
        setIntraday({ ts, cards, err: null });

        // Compute Δ10m only when backend ts advances
        const nowMap = netNHMapFromCards(cards);
        if (prev10mMapRef.current && prev10mTsRef.current && ts && ts !== prev10mTsRef.current) {
          const d = {};
          const keys = new Set([...Object.keys(nowMap), ...Object.keys(prev10mMapRef.current)]);
          for (const k of keys) {
            const a = nowMap[k], b = prev10mMapRef.current[k];
            if (Number.isFinite(a) && Number.isFinite(b)) d[k] = a - b;
          }
          setD10mSess(d);
          saveLastD10m(d); // persist for next refresh
        }

        // Update prev snapshot + persist for next page load
        prev10mMapRef.current = nowMap;
        prev10mTsRef.current  = ts;
        savePrev10m(ts, nowMap);

        // If deltas embedded, capture them and persist as well
        const ds = j?.deltas?.sectors || {};
        if (ds && typeof ds === "object") {
          const map = {};
          for (const key of Object.keys(ds)) {
            const canon = ALIASES[norm(key)] || key;
            map[norm(canon)] = Number(ds[key]?.netTilt ?? NaN);
          }
          setD5mMap(map);
          const dts = j?.deltasUpdatedAt || null;
          setDeltasUpdatedAt(dts);
          saveLastD5m(dts, map);
        }
      } catch (err) {
        setIntraday(p => ({ ...p, err: String(err) }));
      }
    }

    load();
    const t = setInterval(load, 60_000);
    return () => { ctrl.abort(); clearInterval(t); };
  }, [INTRADAY_URL]);

  /* -------------------- Poll hourly + Δ1h (fallback intraday−lastHourly) ----- */
  useEffect(() => {
    const ctrl = new AbortController();

    async function load() {
      if (!HOURLY_URL) { setHourly(p => ({ ...p, err: "Missing HOURLY_URL" })); return; }
      try {
        const j = await fetchJSON(`${HOURLY_URL}?t=${Date.now()}`, ctrl.signal);
        const ts    = j?.sectorsUpdatedAt || j?.updated_at || null;
        const cards = Array.isArray(j?.sectorCards) ? j.sectorCards : [];
        setHourly({ ts, cards, err: null });

        const nowH = netNHMapFromCards(cards);

        // Hour-over-hour if we have two hourly snapshots
        if (hourly.ts && ts && ts !== hourly.ts) {
          const prevH = netNHMapFromCards(hourly.cards || []);
          const d = {};
          const keys = new Set([...Object.keys(nowH), ...Object.keys(prevH)]);
          for (const k of keys) {
            const a = nowH[k], b = prevH[k];
            if (Number.isFinite(a) && Number.isFinite(b)) d[k] = a - b;
          }
          setD1hSess(d);
        } else if (intraday.cards?.length) {
          // Fallback until next hourly closes
          const now10 = netNHMapFromCards(intraday.cards);
          const dAlt = {};
          const keys = new Set([...Object.keys(now10), ...Object.keys(nowH)]);
          for (const k of keys) {
            const a = now10[k], b = nowH[k];
            if (Number.isFinite(a) && Number.isFinite(b)) dAlt[k] = a - b;
          }
          setD1hSess(dAlt);
        }
      } catch (err) {
        setHourly(p => ({ ...p, err: String(err) }));
      }
    }

    load();
    const t = setInterval(load, 60_000);
    return () => { ctrl.abort(); clearInterval(t); };
  }, [HOURLY_URL, intraday.cards, hourly.ts]);

  /* -------------------- Poll EOD on demand + Δ1d (session) -------------------- */
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

        if (eod.cards?.length) {
          const nowMap = netNHMapFromCards(cards);
          const prev   = netNHMapFromCards(eod.cards);
          const d = {};
          const keys = new Set([...Object.keys(nowMap), ...Object.keys(prev)]);
          for (const k of keys) {
            const a = nowMap[k], b = prev[k];
            if (Number.isFinite(a) && Number.isFinite(b)) d[k] = a - b;
          }
          setD1dSess(d);
        }
      } catch (err) {
        setEod(p => ({ ...p, err: String(err) }));
      }
    }

    if (sourceTf === "eod") {
      load();
      timer = setInterval(load, 300_000);
    }
    return () => { if (timer) clearInterval(timer); ctrl.abort(); };
  }, [EOD_URL, sourceTf, eod.cards]);

  /* -------------------- Standalone sandbox deltas (5m) -------------------- */
  useEffect(() => {
    let stop = false;
    async function loadSandbox() {
      if (!SANDBOX_URL) return;
      try {
        const u = SANDBOX_URL.includes("?") ? `${SANDBOX_URL}&t=${Date.now()}` : `${SANDBOX_URL}?t=${Date.now()}`;
        const r = await fetch(u, { cache: "no-store" });
        const j = await r.json();
        if (stop) return;

        const ds = j?.deltas?.sectors || {};
        const map = {};
        for (const key of Object.keys(ds)) {
          const canon = ALIASES[norm(key)] || key;
          map[norm(canon)] = Number(ds[key]?.netTilt ?? NaN);
        }
        setD5mMap(map);
        const dts = j?.deltasUpdatedAt || null;
        setDeltasUpdatedAt(dts);
        saveLastD5m(dts, map);
      } catch { if (!stop) { /* keep previous persisted d5m */ } }
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

  // Legend modal
  const [legendOpen, setLegendOpen] = useState(false);

  // Note: we no longer hide Δ5m on stale; we show last known values
  // const stale5m = isStale(deltasUpdatedAt);

  return (
    <section id="row-4" className="panel index-sectors" aria-label="Index Sectors">
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
        {/* Δ5m freshness note (optional visual only) */}
        {SANDBOX_URL && (
          <div style={{ color: "#22c55e", fontSize:12, fontWeight:700 }}>
            Δ5m last • {deltasUpdatedAt || "—"}
          </div>
        )}
      </div>

      {/* Body */}
      {cards.length > 0 ? (
        <div
          style={{
            display:"grid",
            gridTemplateColumns:"repeat(auto-fill, minmax(360px, 1fr))", // longer cards
            gap:12,
            marginTop:8,
          }}
        >
          {cards.map((c, i) => {
            const key = norm(c?.sector || "");

            // Δ5m sandbox pill (persisted)
            const canon = ALIASES[key] || c?.sector || "";
            const d5 = d5mMap[norm(canon)];

            // Session deltas (persisted for Δ10m; immediate for Δ1h fallback)
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
                  padding:14,
                  minWidth:360, maxWidth:520,
                  borderRadius:14,
                  border:"1px solid #2b2b2b",
                  background:"#0b0b0c",
                  boxShadow:"0 10px 24px rgba(0,0,0,0.28)",
                }}
              >
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
                  <div className="panel-title small" style={{ color:"#f3f4f6", fontSize:18, fontWeight:900, letterSpacing:"0.3px" }}>
                    {c?.sector || "Sector"}
                  </div>
                  <Badge text={c?.outlook || "Neutral"} tone={tone} />
                </div>

                {/* Single-line pill row (never wraps) */}
                <div style={{
                  display:"flex", gap:10, margin:"0 0 8px 0", alignItems:"center",
                  whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"
                }}>
                  <Pill label="Δ5m"  value={Number.isFinite(d5)  ? d5  : 0} />
                  <Pill label="Δ10m" value={Number.isFinite(d10) ? d10 : 0} />
                  <Pill label="Δ1h"  value={Number.isFinite(d1h) ? d1h : 0} />
                  <Pill label="Δ1d"  value={Number.isFinite(d1d) ? d1d : 0} />
                </div>

                <div style={{ fontSize:15, color:"#cbd5e1", lineHeight:1.5, display:"grid", gap:6 }}>
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
        <div className="small muted" style={{ padding:8 }}>
          {(!INTRADAY_URL && "Missing REACT_APP_INTRADAY_URL") ||
            (intraday.err ? `Failed to load sectors. ${intraday.err}` : "No sector cards in payload.")}
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
              width:"min(880px, 92vw)", background:"#0b0b0c", border: "1px solid #2b2b2b",
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
              <b>Δ5m</b> uses last sandbox netTilt and persists across refresh.<br/>
              <b>Δ10m</b> shows last computed delta immediately and updates when the backend timestamp advances.<br/>
              <b>Δ1h</b> shows hour-over-hour or intraday−last-hourly until next hourly closes.<br/>
              <b>Δ1d</b> shows daily session delta.
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
