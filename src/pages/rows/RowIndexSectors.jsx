// src/pages/rows/RowIndexSectors.jsx
// v7 — 3-way toggle (10m / 1h / EOD) + robust card loader + Δ5m/Δ10m/Δ1h pills

import React, { useEffect, useMemo, useRef, useState } from "react";

/* ------------------------------ ENV URLs ------------------------------ */
const PILLS_URL     = (process.env.REACT_APP_PILLS_URL     || "https://frye-market-backend-1.onrender.com/live/pills").replace(/\/+$/,"");
const INTRADAY_URL  = (process.env.REACT_APP_INTRADAY_URL  || "https://frye-market-backend-1.onrender.com/live/intraday").replace(/\/+$/,"");
const HOURLY_URL    = (process.env.REACT_APP_HOURLY_URL    || "https://frye-market-backend-1.onrender.com/live/hourly").replace(/\/+$/,"");
const EOD_URL       = (process.env.REACT_APP_EOD_URL       || "https://frye-market-backend-1.onrender.com/live/eod").replace(/\/+$/,"");
/* NEW: enhanced 10m sectorCards API */
const SECTORCARDS_10M_URL = (process.env.REACT_APP_SECTORCARDS_10M_URL || "https://frye-market-backend-1.onrender.com/api/sectorcards-10m").replace(/\/+$/,"");

/* ------------------------------- helpers ------------------------------- */
const norm = (s="") => s.trim().toLowerCase();
const ORDER = [
  "information technology","materials","health care","communication services",
  "real estate","energy","consumer staples","consumer discretionary",
  "financials","utilities","industrials",
];
const orderKey = (name="") => { const i = ORDER.indexOf(norm(name)); return i === -1 ? 999 : i; };
const ALIASES = {
  healthcare:"health care","health-care":"health care","health care":"health care",
  "info tech":"information technology","technology":"information technology","tech":"information technology",
  communications:"communication services","comm services":"communication services","telecom":"communication services",
  staples:"consumer staples","discretionary":"consumer discretionary",
  finance:"financials","industry":"industrials","reit":"real estate","reits":"real estate",
};
const toneFor = (o) => { const s=String(o||"").toLowerCase(); if (s.startsWith("bull")) return "ok"; if (s.startsWith("bear")) return "danger"; if (s.startsWith("neut")) return "warn"; return "info"; };

const labelOutlook = (b, m) => {
  const B = Number(b), M = Number(m);
  if (Number.isFinite(B) && Number.isFinite(M)) {
    if (B >= 55 && M >= 55) return "Bullish";
    if (B <= 45 && M <= 45) return "Bearish";
  }
  return "Neutral";
};

function Badge({ text, tone="info" }) {
  const map={ ok:{bg:"#22c55e",fg:"#0b1220",bd:"#16a34a"}, warn:{bg:"#facc15",fg:"#111827",bd:"#ca8a04"},
              danger:{bg:"#ef4444",fg:"#fee2e2",bd:"#b91c1c"}, info:{bg:"#0b1220",fg:"#93c5fd",bd:"#334155"} }[tone] || {bg:"#0b0f17",fg:"#93c5fd",bd:"#334155"};
  return <span style={{padding:"4px 10px",borderRadius:10,fontSize:13,fontWeight:800,background:map.bg,color:map.fg,border:`1px solid ${map.bd}`}}>{text}</span>;
}
function Pill({ label, value }) {
  const ok = typeof value === "number" && Number.isFinite(value);
  const v = ok ? Number(value) : null;
  const tone  = ok ? (v>0?"#22c55e":v<0?"#ef4444":"#9ca3af") : "#9ca3af";
  const arrow = ok ? (v>0?"▲":v<0?"▼":"→") : "—";
  const text  = ok ? v.toFixed(2) : "—";
  return (
    <span title={`${label}: ${ok? (v>=0?"+":"")+v.toFixed(2) : "—"}`}
      style={{display:"inline-flex",alignItems:"center",gap:8,borderRadius:10,padding:"3px 10px",fontSize:14,fontWeight:800,
              background:"#0b0f17",color:tone,border:`1px solid ${tone}33`,whiteSpace:"nowrap"}}>
      {label}: {arrow} {ok && v>=0 ? "+" : ""}{text}
    </span>
  );
}
async function fetchJSON(url, opts={}) { const r = await fetch(url,{cache:"no-store",...opts}); if(!r.ok) throw new Error(`HTTP ${r.status} ${url}`); return r.json(); }

/* -------------------------------- Main -------------------------------- */
export default function RowIndexSectors() {
  // timeframe for cards: "10m" | "1h" | "eod"
  const [cardsSource, setCardsSource] = useState("10m");

  // pills payload (Δ5m/Δ10m)
  const [pills, setPills] = useState({ stamp5:null, stamp10:null, sectors:{} });

  // sector cards + timestamp (from selected source)
  const [cardsTs, setCardsTs] = useState(null);
  const [cards, setCards] = useState([]);

  // Δ1h map (hour-over-hour)
  const [d1hMap, setD1hMap] = useState({});
  const lastHourlyRef = useRef({ ts:null, map:null });

  const [err, setErr] = useState(null);
  const last5Ref = useRef(null);
  const last10Ref = useRef(null);

  /* --------- /live/pills (Δ5m, Δ10m; 30s) --------- */
  useEffect(() => {
    let stop=false; const ctrl=new AbortController();
    async function load() {
      try{
        const u = PILLS_URL + (PILLS_URL.includes("?")?"&":"?") + "t=" + Date.now();
        const j = await fetchJSON(u,{ signal: ctrl.signal });
        if (stop) return;
        const s5 = j?.stamp5 || null; const s10 = j?.stamp10 || null;
        if (s5!==last5Ref.current || s10!==last10Ref.current) {
          setPills({ stamp5:s5, stamp10:s10, sectors: j?.sectors || {} });
          last5Ref.current = s5; last10Ref.current = s10;
        }
        setErr(null);
      }catch(e){ setErr(String(e?.message || e)); }
    }
    load(); const t=setInterval(load,30_000);
    return ()=>{ stop=true; ctrl.abort(); clearInterval(t); };
  }, []);

  /* --------- Cards loader (10m / 1h / EOD) --------- */
  useEffect(() => {
    let stop=false; const ctrl=new AbortController();

    async function loadCards() {
      try {
        let ts = null;
        let arr = [];

        if (cardsSource === "10m") {
          // 1) Try enhanced 10m API
          const apiBase = SECTORCARDS_10M_URL;
          const apiUrl = apiBase + (apiBase.includes("?") ? "&" : "?") + "t=" + Date.now();
          let api = null;
          try {
            api = await fetchJSON(apiUrl, { signal: ctrl.signal });
          } catch (e) {
            console.warn("[RowIndexSectors] sectorcards-10m API error:", e);
          }

          if (api && api.ok && Array.isArray(api.sectorCards)) {
            ts  = api.updated_at || null;
            arr = api.sectorCards.slice();
          } else {
            // 2) Fallback to /live/intraday
            const base = INTRADAY_URL;
            const u = base + (base.includes("?") ? "&" : "?") + "t=" + Date.now();
            const j = await fetchJSON(u, { signal: ctrl.signal });
            ts = j?.sectorsUpdatedAt || j?.updated_at || null;
            arr = Array.isArray(j?.sectorCards) ? j.sectorCards.slice() : [];
            if (!arr.length && Array.isArray(j?.sectors)) arr = j.sectors.slice();
          }
        } else {
          // 1h or EOD — unchanged
          const base = cardsSource === "1h" ? HOURLY_URL : EOD_URL;
          const u = base + (base.includes("?") ? "&" : "?") + "t=" + Date.now();
          const j = await fetchJSON(u, { signal: ctrl.signal });
          ts = j?.sectorsUpdatedAt || j?.updated_at || null;
          arr = Array.isArray(j?.sectorCards) ? j.sectorCards.slice() : [];
          if (!arr.length && Array.isArray(j?.sectors)) arr = j.sectors.slice();
        }

        if (stop) return;

        setCardsTs(ts);

        // Fallback: derive outlook if missing
        const withOutlooks = arr.map(c => {
          const o = c?.outlook || labelOutlook(c?.breadth_pct, c?.momentum_pct);
          return { ...c, outlook: o };
        });

        setCards(withOutlooks);
        setErr(null);
      } catch(e) {
        setErr(String(e?.message || e));
        setCards([]);
        setCardsTs(null);
      }
    }

    loadCards();
    const ms = cardsSource === "eod" ? 5*60_000 : 60_000; // EOD slower
    const t = setInterval(loadCards, ms);
    return ()=>{ stop=true; ctrl.abort(); clearInterval(t); };
  }, [cardsSource]);

  /* --------- /live/hourly → Δ1h (hour-over-hour; 60s) --------- */
  useEffect(() => {
    let stop=false; const ctrl=new AbortController();

    const toMap = (arr=[]) => {
      const m={}; for(const c of arr){ const name = ALIASES[norm(c?.sector||"")] || c?.sector || ""; if(!name) continue;
        const nh=Number(c?.nh??NaN), nl=Number(c?.nl??NaN);
        if(Number.isFinite(nh)&&Number.isFinite(nl)) m[norm(name)] = nh - nl;
      } return m;
    };

    async function load() {
      try{
        const u = HOURLY_URL + (HOURLY_URL.includes("?")?"&":"?") + "t=" + Date.now();
        const j = await fetchJSON(u,{ signal: ctrl.signal });
        if (stop) return;
        const ts = j?.sectorsUpdatedAt || j?.updated_at || null;
        const now = toMap(j?.sectorCards || []);
        const prev = lastHourlyRef.current;

        if (!prev.ts || !prev.map) {
          const zeros = Object.fromEntries(ORDER.map(k => [norm(k), 0]));
          setD1hMap(zeros);
          lastHourlyRef.current = { ts, map: now };
          return;
        }
        if (ts && ts !== prev.ts) {
          const keys = new Set([...Object.keys(now), ...Object.keys(prev.map)]);
          const d={}; for (const k of keys) {
            const a = now[k], b = prev.map[k];
            d[k] = (Number.isFinite(a)&&Number.isFinite(b)) ? +(a - b).toFixed(2) : 0;
          }
          setD1hMap(d);
          lastHourlyRef.current = { ts, map: now };
        }
      }catch(e){ setErr(String(e?.message || e)); }
    }

    load(); const t=setInterval(load,60_000);
    return ()=>{ stop=true; ctrl.abort(); clearInterval(t); };
  }, []);

  // Normalize + order cards
  const view = useMemo(() => {
    const byKey = {};
    for (const c of cards) {
      const canon = ALIASES[norm(c?.sector || "")] || (c?.sector || "");
      byKey[norm(canon)] = c;
    }
    return ORDER.map(name => ({ key:norm(name), name, card: byKey[norm(name)] || null }));
  }, [cards]);

  return (
    <section id="row-4" className="panel index-sectors" aria-label="Index Sectors">
      <div className="panel-head" style={{ alignItems:"center" }}>
        <div className="panel-title">Index Sectors</div>

        {/* timeframe toggle */}
        <div style={{ marginLeft:12, display:"inline-flex", gap:6 }}>
          {["10m","1h","eod"].map(tf => (
            <button key={tf}
              onClick={()=>setCardsSource(tf)}
              style={{
                padding:"4px 8px", borderRadius:6, fontSize:12, fontWeight:700, cursor:"pointer",
                color: cardsSource===tf ? "#0b1220" : "#e5e7eb",
                background: cardsSource===tf ? "#facc15" : "#0b0b0b",
                border: "1px solid #2b2b2b"
              }}>
              {tf.toUpperCase()}
            </button>
          ))}
        </div>

        <div style={{ marginLeft:12, color:"#9ca3af", fontSize:12 }}>
          Δ5m: {pills.stamp5 || "—"} • Δ10m: {pills.stamp10 || "—"} • Cards[{cardsSource}]: {cardsTs || "—"}
        </div>
        <div className="spacer" />
        {err && <div style={{ color:"#fca5a5", fontSize:12 }}>{err}</div>}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(360px, 1fr))", gap:12, marginTop:8 }}>
        {view.map(({ key, name, card }, i) => {
          const pd = pills.sectors?.[key] || pills.sectors?.[name] || {};
          const d5  = (typeof pd.d5m  === "number" && Number.isFinite(pd.d5m))  ? pd.d5m  : null;
          const d10 = (typeof pd.d10m === "number" && Number.isFinite(pd.d10m)) ? pd.d10m : null;
          const d1h = (typeof d1hMap[key] === "number" && Number.isFinite(d1hMap[key])) ? d1hMap[key] : null;

          const breadth  = Number(card?.breadth_pct ?? NaN);
          const momentum = Number(card?.momentum_pct ?? NaN);
          const nh = Number(card?.nh ?? NaN);
          const nl = Number(card?.nl ?? NaN);
          const netNH = (Number.isFinite(nh) && Number.isFinite(nl)) ? nh - nl : null;

          // outlook: use backend value or compute client-side as a safety net
          const badgeText = card?.outlook || labelOutlook(breadth, momentum);
          const tone = toneFor(badgeText);

          return (
            <div key={name || i} className="panel"
              style={{ padding:14, minWidth:360, maxWidth:560, borderRadius:14,
                       border:"1px solid #2b2b2b", background:"#0b0b0c", boxShadow:"0 10px 24px rgba(0,0,0,0.28)" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
                <div className="panel-title small" style={{ color:"#f3f4f6", fontSize:18, fontWeight:900, letterSpacing:"0.3px" }}>
                  {name}
                </div>
                <Badge text={badgeText} tone={tone} />
              </div>

              {/* Pills: Δ5m, Δ10m, Δ1h */}
              <div style={{ display:"flex", gap:10, alignItems:"center", whiteSpace:"nowrap", overflow:"hidden", margin:"0 0 8px 0" }}>
                <Pill label="Δ5m"  value={d5} />
                <Pill label="Δ10m" value={d10} />
                <Pill label="Δ1h"  value={d1h} />
              </div>

              {/* Metrics */}
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
    </section>
  );
}
