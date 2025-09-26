// src/pages/rows/RowStrategies/index.jsx
// Alignment Scalper — 6-universe, 4/6 trigger (immediate), Δ gate (0.5/0.5 sensitive),
// RiskOn soft. Adds: LIVE/STALE/ERROR dot + Trigger Log pull-down (today).
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSelection } from "../../../context/ModeContext";
import LiveDot from "../../../components/LiveDot";

/* ---------- env helpers ---------- */
function env(name, fb=""){ try{ if(typeof process!=="undefined"&&process.env&&name in process.env){return String(process.env[name]||"").trim();}}catch{} return fb; }
const API_BASE = env("REACT_APP_API_BASE","https://frye-market-backend-1.onrender.com");
const SANDBOX   = env("REACT_APP_INTRADAY_SANDBOX_URL","");

/* ---------- config ---------- */
const CANON = ["SPY","QQQ","IWM","MDY","DIA","I:VIX"];
const ALIGN_THRESHOLD = 4;      // 4 of 6
const DELTA_TH = 0.5;           // sensitive ±0.5
const STALE_MIN = 12;           // Δ stale if >12m
const LIVE_ALIGN_MAX_SEC = 90;  // alignment fetch considered fresh if within 90s

/* ---------- utilities ---------- */
const nowIso = ()=>new Date().toISOString();
function toET(iso){ try{ return new Date(iso).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit", timeZone:"America/New_York"});} catch{return "—";} }
function minutesAgo(iso){ if(!iso) return Infinity; const ms=Date.now() - new Date(iso).getTime(); return ms/60000; }
function fmt(v){ return typeof v==="number" ? (v>0?`+${v.toFixed(1)}`:v.toFixed(1)) : "—"; }
function keyForToday(){ const d=new Date(); const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,"0"); const day=String(d.getDate()).padStart(2,"0"); return `align_triggers_${y}${m}${day}`;}
function loadLog(){ try{ const j=localStorage.getItem(keyForToday()); return j?JSON.parse(j):[];}catch{return [];} }
function saveLog(items){ try{ localStorage.setItem(keyForToday(), JSON.stringify(items.slice(0,200)));}catch{} }

/* ---------- component ---------- */
export default function RowStrategies(){
  const { selection, setSelection } = useSelection();

  // alignment fetch
  const [alignRes, setAlignRes] = useState({ status:"mock", data:null, err:null, lastFetch:null });
  // Δ sandbox
  const [deltaRes, setDeltaRes] = useState({ ok:false, stale:true, market:null, at:null, err:null, lastFetch:null });

  // Trigger Log UI
  const [logOpen, setLogOpen] = useState(false);
  const [log, setLog] = useState(loadLog());

  /* ---- pull alignment every 30s ---- */
  useEffect(()=>{ let alive=true;
    async function pull(){
      const url=`${API_BASE}/api/signals?strategy=alignment&limit=1&t=${Date.now()}`;
      try{
        const r=await fetch(url, { cache:"no-store", headers:{ "Cache-Control":"no-store" }});
        const j=await r.json();
        if(!alive) return;
        setAlignRes({ status:String(j?.status??"live"), data:j, err:null, lastFetch:nowIso() });
      }catch(e){
        if(!alive) return;
        setAlignRes(a=>({ ...a, err:String(e?.message||e), lastFetch:nowIso() }));
      }
    }
    pull(); const id=setInterval(pull, 30_000); return ()=>{alive=false;clearInterval(id);};
  },[]);

  /* ---- pull sandbox deltas every ~5m ---- */
  useEffect(()=>{ let alive=true;
    if(!SANDBOX){ setDeltaRes({ ok:false, stale:true, market:null, at:null, err:"SANDBOX_URL missing", lastFetch:nowIso() }); return; }
    async function pull(){
      try{
        const r=await fetch(`${SANDBOX}${SANDBOX.includes("?")?"&":"?"}t=${Date.now()}`,{ cache:"no-store", headers:{ "Cache-Control":"no-store" }});
        const j=await r.json();
        if(!alive) return;
        const at = j?.deltasUpdatedAt || j?.updated_at || null;
        const stale = minutesAgo(at) > STALE_MIN;
        setDeltaRes({ ok:!!j?.deltas?.market, stale, market:j?.deltas?.market||null, at, err:null, lastFetch:nowIso() });
      }catch(e){
        if(!alive) return;
        setDeltaRes({ ok:false, stale:true, market:null, at:null, err:String(e?.message||e), lastFetch:nowIso() });
      }
    }
    pull(); const id=setInterval(pull, 300_000); return ()=>{alive=false; clearInterval(id);};
  },[]);

  /* ---- normalize alignment ---- */
  const view = useMemo(()=>{
    const status = alignRes.status || "mock";
    // accept {items:[signal]}, {signal}, or single signal
    let sig=null; const d=alignRes.data;
    if(Array.isArray(d?.items)&&d.items.length) sig=d.items[0]; else if(d?.signal) sig=d.signal; else if(d?.direction||d?.members) sig=d;

    const ts = sig?.timestamp || null;
    const members = sig?.members || {};
    const eff = { SPY:members["SPY"], QQQ:members["QQQ"], IWM:members["IWM"], MDY:members["MDY"], DIA:members["DIA"]||members["I:DJI"], "I:VIX":members["I:VIX"]||members["VIX"] };

    let confirm=0; const failing=[];
    CANON.forEach(k=>{ const ok=!!(eff[k]&&eff[k].ok===true); if(ok) confirm++; else failing.push(k); });

    // Δ accel (sensitive)
    const dm = deltaRes.market || {};
    const accelOk = !!(!deltaRes.stale && typeof dm.dBreadthPct==="number" && typeof dm.dMomentumPct==="number" && dm.dBreadthPct>=DELTA_TH && dm.dMomentumPct>=DELTA_TH);

    // RiskOn soft (warn only)
    const riskOn = (typeof dm.riskOnPct==="number") ? dm.riskOnPct : null;

    const triggered = confirm >= ALIGN_THRESHOLD;
    const baseScore = Math.round((confirm / CANON.length) * 100);
    const score = Math.min(100, baseScore + (accelOk ? 20 : 0));

    const lastAlignmentAt = ts;
    const lastAlignmentFetch = alignRes.lastFetch;
    const lastDeltaAt = deltaRes.at;
    const lastDeltaFetch = deltaRes.lastFetch;

    // live dot: green if alignment fetch fresh (≤90s) AND Δ not stale; yellow if either stale; red if recent fetch error
    const alignFresh = minutesAgo(lastAlignmentFetch) <= (LIVE_ALIGN_MAX_SEC/60);
    const liveStatus = alignRes.err ? "red" : (!alignFresh || deltaRes.stale ? "yellow" : "green");
    const liveTip =
      `Alignment fetch: ${lastAlignmentFetch?toET(lastAlignmentFetch):"—"} ET` +
      ` • Δ5m: ${lastDeltaAt?toET(lastDeltaAt):"—"} ET (${deltaRes.stale?"STALE": "LIVE"})`;

    return {
      status, confirm, score, triggered, accelOk, riskOn,
      failing: triggered ? [] : failing,
      liveStatus, liveTip,
      lastAlignmentAt, lastAlignmentFetch, lastDeltaAt
    };
  },[alignRes, deltaRes]);

  /* ---- Trigger Log: log READY + Triggered edge ---- */
  const prevGate = useRef(false);
  useEffect(()=>{
    const gateReady = view.triggered && (view.accelOk || deltaRes.stale); // sensitive mode: accel required unless stale (ignore stale)
    if(gateReady && !prevGate.current){
      const entry = {
        id: `${Date.now()}-${Math.random()}`,
        ts: new Date().toISOString(),
        side: "long",                // fill with real direction when available
        confirm: `${view.confirm}/${CANON.length}`,
        score: view.score,
        symbols: ["SPY","QQQ"],
        dBreadth: deltaRes.market?.dBreadthPct ?? null,
        dMomentum: deltaRes.market?.dMomentumPct ?? null,
        riskOn: deltaRes.market?.riskOnPct ?? null,
        note: deltaRes.stale ? "staleΔ: ignore" : "ready"
      };
      const next=[entry, ...loadLog()];
      saveLog(next); setLog(next);
    }
    prevGate.current = gateReady;
  },[view.triggered, view.accelOk, deltaRes.stale]);

  /* ---- UI ---- */
  const tabs = [
    { k:"SPY", sym:"SPY" }, { k:"QQQ", sym:"QQQ" }, { k:"IWM", sym:"IWM" },
    { k:"MDY", sym:"MDY" }, { k:"DIA", sym:"DIA" }, { k:"VIX", sym:"I:VIX" },
  ];
  function load(sym){ setSelection({ symbol:sym, timeframe:"10m", strategy:"alignment" }); }

  return (
    <div style={{ display:"grid", gridTemplateColumns:"repeat(3, minmax(0,1fr))", gap:10 }}>
      <Card
        title="SPY/QQQ Index-Alignment Scalper"
        timeframe="10m"
        rightPills={[
          { text: (alignRes.status==="live"?"LIVE":"MOCK"), tone:(alignRes.status==="live"?"live":"muted") },
          { text: `${view.triggered?"Triggered":"Flat"} (${view.confirm}/${CANON.length})`, tone:(view.triggered?"ok":"muted") },
        ]}
        score={view.score}
        last={view.lastAlignmentAt ? `${toET(view.lastAlignmentAt)} ET` : "—"}
        extraRight={<LiveDot status={view.liveStatus} tip={view.liveTip}/>}
      >
        {/* checks */}
        <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginTop:2, fontSize:11 }}>
          <Check ok={view.confirm >= ALIGN_THRESHOLD} label={`Alignment ≥${ALIGN_THRESHOLD}/${CANON.length}`} />
          <Check neutral={true} ok={false} label="Liquidity (pending)" />
          <Check ok={view.accelOk} label="Δ Accel (5m)" tip={deltaRes.stale?"stale":""} />
        </div>

        {/* Gate line + Trigger Log pill */}
        <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:4, fontSize:11 }}>
          <span style={view.triggered ? styles.gateOk : styles.gateNo}>
            {view.triggered ? "Triggered" : "Flat"}
          </span>
          <span style={{ color:"#94a3b8" }}>
            {view.accelOk ? "READY" : deltaRes.stale ? "READY — staleΔ: ignore" : "BLOCKED — ΔAccel"}
            { (view.riskOn!==null) ? ` • RiskOn ${fmt(view.riskOn)} (soft)` : "" }
          </span>

          <button onClick={()=>setLogOpen(v=>!v)} style={styles.logBtn}>
            Triggers: {log.length}
          </button>
        </div>

        {/* Selected readout */}
        <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:2, fontSize:11 }}>
          <span style={{ color:"#9ca3af" }}>Selected:</span>
          <span style={{ fontWeight:700 }}>{selection?.symbol || "—"} • {selection?.timeframe || "—"}</span>
        </div>

        {/* tabs */}
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginTop:4 }}>
          {tabs.map(t=>{
            const active = selection?.symbol===t.sym && selection?.timeframe==="10m";
            return (
              <button key={t.k} onClick={()=>load(t.sym)} style={{ ...styles.tab, ...(active?styles.tabActive:null) }} title={`Load ${t.k} (10m)`}>{t.k}</button>
            );
          })}
        </div>

        {/* Trigger Log panel */}
        {logOpen && (
          <div style={styles.logPanel}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
              <b>Today’s Triggers</b>
              <div style={{ display:"flex", gap:6 }}>
                <button style={styles.logMini} onClick={()=>{ localStorage.removeItem(keyForToday()); setLog([]); }}>Clear</button>
                <button style={styles.logMini} onClick={()=>{
                  const rows = log.map(e=>[toET(e.ts), e.side, e.confirm, e.score, e.symbols.join("&"), e.dBreadth, e.dMomentum, e.riskOn, e.note].join(","));
                  navigator.clipboard.writeText(["timeET,side,confirm,score,symbols,dBreadth,dMomentum,riskOn,note", ...rows].join("\n"));
                }}>Copy CSV</button>
              </div>
            </div>
            {log.length===0 ? <div style={{ color:"#9ca3af" }}>No entries yet.</div> :
              <div style={{ maxHeight:180, overflow:"auto", display:"grid", gap:6 }}>
                {log.map(e=>(
                  <div key={e.id} style={styles.logItem}>
                    <div style={{ display:"flex", justifyContent:"space-between" }}>
                      <div><b>{toET(e.ts)} ET</b> • {e.side.toUpperCase()} • {e.confirm} • Score {e.score}</div>
                      <div style={{ color:"#9ca3af" }}>{e.symbols.join(" & ")}</div>
                    </div>
                    <div style={{ fontSize:12, color:"#cbd5e1" }}>
                      Δ({fmt(e.dBreadth)}/{fmt(e.dMomentum)}){e.riskOn!==null?` • RiskOn ${fmt(e.riskOn)}`:""} • {e.note}
                    </div>
                  </div>
                ))}
              </div>
            }
          </div>
        )}
      </Card>
    </div>
  );
}

/* ---------- subcomponents & styles ---------- */
function Check({ ok, label, tip, neutral }) {
  const style = neutral ? styles.chkNeutral : ok ? styles.chkOk : styles.chkNo;
  return (
    <div style={styles.chk}>
      <span style={style}>{neutral ? "•" : ok ? "✓" : "•"}</span>
      <span>{label}{tip ? ` — ${tip}` : ""}</span>
    </div>
  );
}

function Card({ title, timeframe, rightPills=[], score=0, last="—", children, extraRight=null }) {
  const pct = Math.max(0, Math.min(100, score));
  return (
    <div style={styles.card}>
      <div style={styles.head}>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <div style={styles.title}>{title}</div>
          <span style={styles.badge}>{timeframe}</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
          {rightPills.map((p,i)=><span key={i} style={{ ...styles.pill, ...toneStyles(p.tone).pill }}>{p.text}</span>)}
          {extraRight}
        </div>
      </div>

      <div style={styles.scoreRow}>
        <div style={styles.scoreLabel}>Score</div>
        <div style={styles.progress}><div style={{ ...styles.progressFill, width:`${pct}%` }} /></div>
        <div style={styles.scoreVal}>{pct}</div>
      </div>

      <div style={styles.metaRow}>
        <div><span style={styles.metaKey}>Last:</span> {last}</div>
        <div><span style={styles.metaKey}>P/L Today:</span> —</div>
      </div>

      {children}
    </div>
  );
}

const styles = {
  card:{ background:"#101010", border:"1px solid #262626", borderRadius:10, padding:10, color:"#e5e7eb",
         display:"flex", flexDirection:"column", gap:8, minHeight:110 },
  head:{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:6 },
  title:{ fontWeight:700, fontSize:14, lineHeight:"16px" },
  badge:{ background:"#0b0b0b", border:"1px solid #2b2b2b", color:"#9ca3af", fontSize:10, padding:"1px 6px", borderRadius:999, fontWeight:700 },
  pill:{ fontSize:10, padding:"2px 8px", borderRadius:999, border:"1px solid #2b2b2b", fontWeight:700, lineHeight:"14px" },

  scoreRow:{ display:"grid", gridTemplateColumns:"44px 1fr 28px", alignItems:"center", gap:6 },
  scoreLabel:{ color:"#9ca3af", fontSize:10 },
  progress:{ background:"#1f2937", borderRadius:6, height:6, overflow:"hidden", border:"1px solid #334155" },
  progressFill:{ height:"100%", background:"linear-gradient(90deg,#22c55e 0%,#84cc16 40%,#f59e0b 70%,#ef4444 100%)" },
  scoreVal:{ textAlign:"right", fontWeight:700, fontSize:12 },
  metaRow:{ display:"grid", gridTemplateColumns:"1fr auto", gap:6, fontSize:11, color:"#cbd5e1" },
  metaKey:{ color:"#9ca3af", marginRight:4, fontWeight:600 },

  chk:{ display:"flex", alignItems:"center", gap:6, fontSize:11 },
  chkOk:{ color:"#86efac", fontWeight:900 },
  chkNo:{ color:"#94a3b8", fontWeight:900 },
  chkNeutral:{ color:"#9ca3af", fontWeight:900 },

  gateOk:{ background:"#06220f", color:"#86efac", border:"1px solid #166534", borderRadius:999, padding:"2px 8px", fontWeight:900 },
  gateNo:{ background:"#1b1409", color:"#fca5a5", border:"1px solid #7f1d1d", borderRadius:999, padding:"2px 8px", fontWeight:900 },

  tab:{ background:"#141414", color:"#cbd5e1", border:"1px solid #2a2a2a", borderRadius:7, padding:"3px 6px", fontSize:10, fontWeight:700, cursor:"pointer" },
  tabActive:{ background:"#1f2937", color:"#e5e7eb", border:"1px solid #3b82f6", boxShadow:"0 0 0 1px #3b82f6 inset" },

  logBtn:{ marginLeft:"auto", background:"#0b0b0b", color:"#e5e7eb", border:"1px solid #2b2b2b", borderRadius:8, padding:"2px 8px", fontWeight:700, fontSize:11, cursor:"pointer" },
  logPanel:{ marginTop:8, padding:8, background:"#0f172a", border:"1px solid #1e293b", borderRadius:10 },
  logItem:{ background:"#0b0b0b", border:"1px solid #1f2937", borderRadius:8, padding:8 },
  logMini:{ background:"#0b0b0b", color:"#e5e7eb", border:"1px solid #2b2b2b", borderRadius:6, padding:"2px 6px", fontWeight:700, fontSize:11, cursor:"pointer" },
};

function toneStyles(kind){
  switch(kind){
    case "live": return { pill:{ background:"#06220f", color:"#86efac", borderColor:"#166534" } };
    case "info": return { pill:{ background:"#0b1220", color:"#93c5fd", borderColor:"#1e3a8a" } };
    case "warn": return { pill:{ background:"#1b1409", color:"#fbbf24", borderColor:"#92400e" } };
    case "ok":   return { pill:{ background:"#07140d", color:"#86efac", borderColor:"#166534" } };
    default:     return { pill:{ background:"#0b0b0b", color:"#94a3b8", borderColor:"#2b2b2b" } };
  }
}
