// src/pages/rows/RowIndexSectors.jsx
// v8 — FIXED IT & HEALTHCARE — Full Rewrite With Correct Aliases & Normalization

import React, { useEffect, useMemo, useRef, useState } from "react";

/* ------------------------------ ENV URLs ------------------------------ */
const PILLS_URL     = (process.env.REACT_APP_PILLS_URL     || "https://frye-market-backend-1.onrender.com/live/pills").replace(/\/+$/,"");
const INTRADAY_URL  = (process.env.REACT_APP_INTRADAY_URL  || "https://frye-market-backend-1.onrender.com/live/intraday").replace(/\/+$/,"");
const HOURLY_URL    = (process.env.REACT_APP_HOURLY_URL    || "https://frye-market-backend-1.onrender.com/live/hourly").replace(/\/+$/,"");
const EOD_URL       = (process.env.REACT_APP_EOD_URL       || "https://frye-market-backend-1.onrender.com/live/eod").replace(/\/+$/,"");

/* ------------------------------ NORMALIZATION ------------------------------ */
const norm = (s = "") => s.trim().toLowerCase();

/*
 FULL NORMALIZED CANONICAL SECTOR NAMES
 --------------------------------------
 These MUST match exactly the labels used in ORDER[].
*/
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

/*
  MASSIVE ALIAS TABLE — ANY POSSIBLE SPELLING VARIANT IS CAPTURED
  ---------------------------------------------------------------
*/
const ALIASES = {
  // Information Technology
  "information technology": "information technology",
  "info tech": "information technology",
  "technology": "information technology",
  "tech": "information technology",
  "it": "information technology",

  // Materials
  materials: "materials",

  // Health Care
  "health care": "health care",
  healthcare: "health care",
  "health-care": "health care",
  "health": "health care",

  // Communication Services
  "communication services": "communication services",
  communications: "communication services",
  "communication": "communication services",
  "comm services": "communication services",
  telecom: "communication services",

  // Real Estate
  "real estate": "real estate",
  reit: "real estate",
  reits: "real estate",

  // Energy
  energy: "energy",

  // Consumer Staples
  "consumer staples": "consumer staples",
  staples: "consumer staples",

  // Consumer Discretionary
  "consumer discretionary": "consumer discretionary",
  discretionary: "consumer discretionary",

  // Financials
  financials: "financials",
  finance: "financials",

  // Utilities
  utilities: "utilities",
  utility: "utilities",

  // Industrials
  industrials: "industrials",
  industry: "industrials",
};

/* ------------------------------ Tone Mapping ------------------------------ */
const toneFor = (o) => {
  const s = String(o || "").toLowerCase();
  if (s.startsWith("bull")) return "ok";
  if (s.startsWith("bear")) return "danger";
  if (s.startsWith("neut")) return "warn";
  return "info";
};

const labelOutlook = (b, m) => {
  const B = Number(b), M = Number(m);
  if (B >= 55 && M >= 55) return "Bullish";
  if (B <= 45 && M <= 45) return "Bearish";
  return "Neutral";
};

/* ------------------------------ UI Bits ------------------------------ */
function Badge({ text, tone = "info" }) {
  const map = {
    ok:     { bg:"#22c55e", fg:"#0b1220", bd:"#16a34a" },
    warn:   { bg:"#facc15", fg:"#111827", bd:"#ca8a04" },
    danger: { bg:"#ef4444", fg:"#fee2e2", bd:"#b91c1c" },
    info:   { bg:"#0b1220", fg:"#93c5fd", bd:"#334155" },
  }[tone];

  return (
    <span style={{
      padding:"4px 10px", borderRadius:10, fontSize:13, fontWeight:800,
      background:map.bg, color:map.fg, border:`1px solid ${map.bd}`
    }}>
      {text}
    </span>
  );
}

function Pill({ label, value }) {
  const ok = typeof value === "number" && Number.isFinite(value);
  const v  = ok ? value : null;
  const tone = ok ? (v>0?"#22c55e":v<0?"#ef4444":"#9ca3af") : "#9ca3af";
  const arrow = ok ? (v>0?"▲":v<0?"▼":"→") : "—";
  const text  = ok ? v.toFixed(2) : "—";

  return (
    <span style={{
      display:"inline-flex", alignItems:"center", gap:8, borderRadius:10,
      padding:"3px 10px", fontSize:14, fontWeight:800,
      background:"#0b1220", color:tone, border:`1px solid ${tone}33`
    }}>
      {label}: {arrow} {ok && v>=0 ? "+" : ""}{text}
    </span>
  );
}

async function fetchJSON(url, opts={}) {
  const r = await fetch(url, { cache:"no-store", ...opts });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
  return r.json();
}

/* ------------------------------ MAIN COMPONENT ------------------------------ */
export default function RowIndexSectors() {

  const [cardsSource, setCardsSource] = useState("10m");
  const [pills, setPills]   = useState({ stamp5:null, stamp10:null, sectors:{} });
  const [cards, setCards]   = useState([]);
  const [cardsTs, setCardsTs] = useState(null);
  const [d1hMap, setD1hMap] = useState({});
  const lastHourlyRef = useRef({ ts:null, map:null });
  const last5Ref = useRef(null);
  const last10Ref = useRef(null);
  const [err, setErr] = useState(null);

  /* -------------------- Load Δ5m & Δ10m Pills -------------------- */
  useEffect(() => {
    let stop=false; const ctrl=new AbortController();

    async function load() {
      try {
        const u = PILLS_URL + "?t=" + Date.now();
        const j = await fetchJSON(u, { signal:ctrl.signal });

        const s5  = j?.stamp5 || null;
        const s10 = j?.stamp10 || null;

        if (s5 !== last5Ref.current || s10 !== last10Ref.current) {
          setPills({ stamp5:s5, stamp10:s10, sectors:j?.sectors || {} });
          last5Ref.current  = s5;
          last10Ref.current = s10;
        }
        setErr(null);
      } catch(e) { setErr(String(e)); }
    }

    load();
    const t = setInterval(load, 30000);
    return ()=>{ stop=true; ctrl.abort(); clearInterval(t); };
  }, []);

  /* -------------------- Load 10m / 1h / EOD Cards -------------------- */
  useEffect(() => {
    let stop=false; const ctrl=new AbortController();

    async function loadCards() {
      try {
        const base = cardsSource==="10m"
          ? INTRADAY_URL
          : cardsSource==="1h"
            ? HOURLY_URL
            : EOD_URL;

        const u = base + "?t=" + Date.now();
        const j = await fetchJSON(u, { signal:ctrl.signal });

        const ts = j?.sectorsUpdatedAt || j?.updated_at || null;
        setCardsTs(ts);

        let arr = Array.isArray(j?.sectorCards) ? j.sectorCards.slice() : [];
        if (!arr.length && Array.isArray(j?.sectors)) arr = j.sectors.slice();

        const out = arr.map(c => {
          const o = c?.outlook || labelOutlook(c?.breadth_pct, c?.momentum_pct);
          return { ...c, outlook:o };
        });

        setCards(out);
        setErr(null);
      } catch(e) {
        setErr(String(e)); setCards([]); setCardsTs(null);
      }
    }

    loadCards();
    const t = setInterval(loadCards, cardsSource==="eod" ? 30000 : 30000);
    return ()=>{ stop=true; ctrl.abort(); clearInterval(t); };
  }, [cardsSource]);

  /* -------------------- Load Δ1h (Hourly Deltas) -------------------- */
  useEffect(() => {
    let stop=false; const ctrl=new AbortController();

    const toMap = (arr=[]) => {
      const m={};
      for (const c of arr) {
        const raw = norm(c?.sector || "");
        const key = ALIASES[raw] || raw;
        const nh = Number(c?.nh ?? NaN);
        const nl = Number(c?.nl ?? NaN);
        if (Number.isFinite(nh) && Number.isFinite(nl)) m[key] = nh-nl;
      }
      return m;
    };

    async function load() {
      try {
        const u = HOURLY_URL + "?t=" + Date.now();
        const j = await fetchJSON(u, { signal:ctrl.signal });

        const ts = j?.sectorsUpdatedAt || j?.updated_at || null;
        const now = toMap(j?.sectorCards || []);

        const prev = lastHourlyRef.current;
        if (!prev.ts || !prev.map) {
          const zeros = Object.fromEntries(ORDER.map(k=>[k,0]));
          setD1hMap(zeros);
          lastHourlyRef.current = { ts, map:now };
          return;
        }

        if (ts && ts !== prev.ts) {
          const keys = new Set([...Object.keys(now), ...Object.keys(prev.map)]);
          const d = {};
          for (const k of keys) {
            const a = now[k], b = prev.map[k];
            d[k] = (Number.isFinite(a)&&Number.isFinite(b)) ? +(a-b).toFixed(2) : 0;
          }
          setD1hMap(d);
          lastHourlyRef.current = { ts, map:now };
        }
      } catch(e){ setErr(String(e)); }
    }

    load();
    const t = setInterval(load, 60000);
    return ()=>{ stop=true; ctrl.abort(); clearInterval(t); };
  }, []);

  /* -------------------- NORMALIZE CARDS INTO VIEW -------------------- */
  const view = useMemo(() => {
    const byKey={};

    for (const c of cards) {
      const raw = norm(c?.sector || "");
      const canon = ALIASES[raw] || raw;   // FIXED
      byKey[canon] = c;
    }

    // ORDER gives exact UI order
    return ORDER.map(name => ({
      key: name,
      name,
      card: byKey[name] || null
    }));
  }, [cards]);

  /* ------------------------------ UI ------------------------------ */
  return (
    <section id="row-4" className="panel index-sectors">
      
      <div className="panel-head" style={{ alignItems:"center" }}>
        <div className="panel-title">Index Sectors</div>

        {/* Toggle Timeframes */}
        <div style={{ marginLeft:12, display:"inline-flex", gap:6 }}>
          {["10m","1h","eod"].map(tf => (
            <button key={tf}
              onClick={()=>setCardsSource(tf)}
              style={{
                padding:"4px 8px", borderRadius:6, fontSize:12, fontWeight:700,
                color: cardsSource===tf ? "#0b1220" : "#e5e7eb",
                background: cardsSource===tf ? "#facc15" : "#0b0b0b",
                border:"1px solid #2b2b2b"
              }}>
              {tf.toUpperCase()}
            </button>
          ))}
        </div>

        <div style={{ marginLeft:12, color:"#9ca3af", fontSize:12 }}>
          Δ5m: {pills.stamp5 || "—"} • Δ10m: {pills.stamp10 || "—"}
          • Cards[{cardsSource}]: {cardsTs || "—"}
        </div>

        <div className="spacer" />
        {err && <div style={{ color:"#fca5a5", fontSize:12 }}>{err}</div>}
      </div>

      {/* CARDS GRID */}
      <div style={{
        display:"grid",
        gridTemplateColumns:"repeat(auto-fill, minmax(360px, 1fr))",
        gap:12,
        marginTop:8
      }}>
        {view.map(({ key, name, card }, i) => {
          const pd = pills.sectors?.[key] || pills.sectors?.[name] || {};
          const d5  = Number.isFinite(pd.d5m)  ? pd.d5m  : null;
          const d10 = Number.isFinite(pd.d10m) ? pd.d10m : null;
          const d1h = Number.isFinite(d1hMap[key]) ? d1hMap[key] : null;

          const breadth  = Number(card?.breadth_pct ?? NaN);
          const momentum = Number(card?.momentum_pct ?? NaN);
          const nh = Number(card?.nh ?? NaN);
          const nl = Number(card?.nl ?? NaN);
          const netNH = (Number.isFinite(nh)&&Number.isFinite(nl)) ? nh-nl : null;

          const badgeText = card?.outlook || labelOutlook(breadth, momentum);
          const tone = toneFor(badgeText);

          return (
            <div key={name} className="panel"
              style={{
                padding:14, minWidth:360, maxWidth:560,
                borderRadius:14, border:"1px solid #2b2b2b",
                background:"#0b0b0c", boxShadow:"0 10px 24px rgba(0,0,0,0.28)"
              }}>
              
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                <div className="panel-title small"
                     style={{ color:"#f3f4f6", fontSize:18, fontWeight:900 }}>
                  {name}
                </div>
                <Badge text={badgeText} tone={tone} />
              </div>

              <div style={{ display:"flex", gap:10, marginBottom:8 }}>
                <Pill label="Δ5m" value={d5} />
                <Pill label="Δ10m" value={d10} />
                <Pill label="Δ1h" value={d1h} />
              </div>

              <div style={{ fontSize:15, color:"#cbd5e1", display:"grid", gap:6 }}>
                <div>
                  Breadth Tilt: <b style={{ color:"#f3f4f6" }}>
                    {Number.isFinite(breadth) ? `${breadth.toFixed(1)}%` : "—"}
                  </b>
                </div>
                <div>
                  Momentum: <b style={{ color:"#f3f4f6" }}>
                    {Number.isFinite(momentum) ? `${momentum.toFixed(1)}%` : "—"}
                  </b>
                </div>
                <div>
                  Net NH: <b style={{ color:"#f3f4f6" }}>{netNH ?? "—"}</b>
                  <span style={{ color:"#9ca3af" }}>
                    {" "} (NH {Number.isFinite(nh)?nh:"—"} / NL {Number.isFinite(nl)?nl:"—"})
                  </span>
                </div>
              </div>

            </div>
          );
        })}
      </div>
    </section>
  );
}
