// src/pages/rows/RowIndexSectors.jsx
// v6.1 — Stable pills from /live/pills + full cards from /live/intraday

import React, { useEffect, useMemo, useRef, useState } from "react";

/* ------------------------------ ENV URLs ------------------------------ */
const PILLS_URL     = (process.env.REACT_APP_PILLS_URL     || "https://frye-market-backend-1.onrender.com/live/pills").replace(/\/+$/,"");
const INTRADAY_URL  = (process.env.REACT_APP_INTRADAY_URL  || "https://frye-market-backend-1.onrender.com/live/intraday").replace(/\/+$/,"");

/* ------------------------------- helpers ------------------------------- */
const norm = (s="") => s.trim().toLowerCase();
const ORDER = [
  "information technology","materials","health care","communication services",
  "real estate","energy","consumer staples","consumer discretionary",
  "financials","utilities","industrials",
];
const orderKey = (name="") => {
  const i = ORDER.indexOf(norm(name)); return i === -1 ? 999 : i;
};
const ALIASES = {
  healthcare:"health care","health-care":"health care","health care":"health care",
  "info tech":"information technology","technology":"information technology","tech":"information technology",
  communications:"communication services","comm services":"communication services","telecom":"communication services",
  staples:"consumer staples","discretionary":"consumer discretionary",
  finance:"financials","industry":"industrials","reit":"real estate","reits":"real estate",
};
const toneFor = (o) => {
  const s=String(o||"").toLowerCase();
  if (s.startsWith("bull")) return "ok";
  if (s.startsWith("bear")) return "danger";
  if (s.startsWith("neut")) return "warn";
  return "info";
};
function Badge({ text, tone="info" }) {
  const map={
    ok:{bg:"#22c55e",fg:"#0b1220",bd:"#16a34a"},
    warn:{bg:"#facc15",fg:"#111827",bd:"#ca8a04"},
    danger:{bg:"#ef4444",fg:"#fee2e2",bd:"#b91c1c"},
    info:{bg:"#0b1220",fg:"#93c5fd",bd:"#334155"},
  }[tone] || {bg:"#0b0f17",fg:"#93c5fd",bd:"#334155"};
  return <span style={{padding:"4px 10px",borderRadius:10,fontSize:13,fontWeight:800,background:map.bg,color:map.fg,border:`1px solid ${map.bd}`}}>{text}</span>;
}
function Pill({ label, value }) {
  const ok = typeof value==="number" && Number.isFinite(value);
  const v = ok ? Number(value) : null;
  const tone  = ok ? (v>0?"#22c55e":v<0?"#ef4444":"#9ca3af") : "#9ca3af";
  const arrow = ok ? (v>0?"▲":v<0?"▼":"→") : "—";
  const text  = ok ? v.toFixed(2) : "—";
  return (
    <span title={`${label}: ${ok? (v>=0?"+":"")+v.toFixed(2) : "—"}`}
      style={{display:"inline-flex",alignItems:"center",gap:8,borderRadius:10,padding:"3px 10px",
              fontSize:14,fontWeight:800,background:"#0b0f17",color:tone,border:`1px solid ${tone}33`,whiteSpace:"nowrap"}}>
      {label}: {arrow} {ok && v>=0 ? "+" : ""}{text}
    </span>
  );
}
async function fetchJSON(url, opts={}) {
  const r = await fetch(url,{ cache:"no-store", ...opts });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
  return r.json();
}

/* -------------------------------- Main -------------------------------- */
export default function RowIndexSectors() {
  // pills payload
  const [pills, setPills] = useState({ stamp5:null, stamp10:null, sectors:{} });
  // intraday cards payload
  const [cardsTs, setCardsTs] = useState(null);
  const [cards, setCards] = useState([]);
  const [err, setErr] = useState(null);

  // stamps to prevent flicker
  const last5Ref = useRef(null);
  const last10Ref = useRef(null);

  /* --------- poll /live/pills (Δ5m, Δ10m from backend; 30s) --------- */
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
      }catch(e){ setErr(String(e?.message || e)); }
    }
    load(); const t=setInterval(load,30_000);
    return ()=>{ stop=true; ctrl.abort(); clearInterval(t); };
  }, []);

  /* --------- poll /live/intraday (cards; 60s) --------- */
  useEffect(() => {
    let stop=false; const ctrl=new AbortController();
    async function load() {
      try{
        const u = INTRADAY_URL + (INTRADAY_URL.includes("?")?"&":"?") + "t=" + Date.now();
        const j = await fetchJSON(u,{ signal: ctrl.signal });
        if (stop) return;
        const ts = j?.sectorsUpdatedAt || j?.updated_at || null;
        const arr = Array.isArray(j?.sectorCards) ? j.sectorCards.slice() : [];
        setCardsTs(ts); setCards(arr);
      }catch(e){ setErr(String(e?.message || e)); }
    }
    load(); const t=setInterval(load,60_000);
    return ()=>{ stop=true; ctrl.abort(); clearInterval(t); };
  }, []);

  // normalize + order cards
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
        <div style={{ marginLeft:8, color:"#9ca3af", fontSize:12 }}>
          Δ5m last: {pills.stamp5 || "—"} • Δ10m last: {pills.stamp10 || "—"} • Cards: {cardsTs || "—"}
        </div>
        <div className="spacer" />
        {err && <div style={{ color:"#fca5a5", fontSize:12 }}>{err}</div>}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(360px, 1fr))", gap:12, marginTop:8 }}>
        {view.map(({ key, name, card }, i) => {
          // pills
          const pd = pills.sectors?.[key] || pills.sectors?.[name] || {};
          const d5  = (typeof pd.d5m  === "number" && Number.isFinite(pd.d5m))  ? pd.d5m  : null;
          const d10 = (typeof pd.d10m === "number" && Number.isFinite(pd.d10m)) ? pd.d10m : null;

          // card metrics
          const breadth  = Number(card?.breadth_pct ?? NaN);
          const momentum = Number(card?.momentum_pct ?? NaN);
          const nh = Number(card?.nh ?? NaN);
          const nl = Number(card?.nl ?? NaN);
          const netNH = (Number.isFinite(nh) && Number.isFinite(nl)) ? nh - nl : null;
          const tone = toneFor(card?.outlook);

          return (
            <div key={name || i} className="panel"
              style={{ padding:14, minWidth:360, maxWidth:560, borderRadius:14,
                       border:"1px solid #2b2b2b", background:"#0b0b0c", boxShadow:"0 10px 24px rgba(0,0,0,0.28)" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
                <div className="panel-title small" style={{ color:"#f3f4f6", fontSize:18, fontWeight:900, letterSpacing:"0.3px" }}>
                  {name}
                </div>
                <Badge text={card?.outlook || "Neutral"} tone={tone} />
              </div>

              {/* Pills */}
              <div style={{ display:"grid", gridTemplateRows:"auto", rowGap:6, margin:"0 0 8px 0" }}>
                <div style={{ display:"flex", gap:10, alignItems:"center", whiteSpace:"nowrap", overflow:"hidden" }}>
                  <Pill label="Δ5m"  value={d5} />
                  <Pill label="Δ10m" value={d10} />
                </div>
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
