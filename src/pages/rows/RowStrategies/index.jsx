// src/pages/rows/RowStrategies/index.jsx
// Alignment Scalper — Sensitive Mode: 6-universe, 4/6 trigger, Δ gate (0.5/0.5), RiskOn soft.
// Adds: Journal entries + optional alert webhook when gate becomes READY.
// CRA-safe, compact UI, wired tabs.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSelection } from "../../../context/ModeContext";
import { addJournalEntry } from "../../../lib/journal";

/* ========== CRA-safe env helpers ========== */
function getEnv(name, fallback = "") {
  try { if (typeof process !== "undefined" && process.env && name in process.env) { return String(process.env[name] || "").trim(); } } catch {}
  return fallback;
}
function getBackendBase() {
  const envBase = getEnv("REACT_APP_API_BASE", "");
  return (envBase || "https://frye-market-backend-1.onrender.com").replace(/\/+$/, "");
}
function getSandboxUrl() { return getEnv("REACT_APP_INTRADAY_SANDBOX_URL", ""); }
function getAlertWebhook() { return getEnv("REACT_APP_ALERT_WEBHOOK_URL", ""); }
function nowIso() { return new Date().toISOString(); }

/* ========== Config / thresholds (Sensitive Mode) ========== */
const CANON = ["SPY", "QQQ", "IWM", "MDY", "DIA", "I:VIX"]; // 6 instruments
const ALIGN_THRESHOLD = 4;           // 4-of-6 immediate
const GREEN_TH = +0.5;               // Δ gate loosened to 0.5 / 0.5
const STALE_MINUTES = 12;            // Δ staleness guard

export default function RowStrategies() {
  const { selection, setSelection } = useSelection();

  // pulls
  const [alignRes, setAlignRes] = useState({ status: "mock", data: null, base: "" });
  const [deltaRes, setDeltaRes] = useState({ ok: false, stale: true, market: null, at: null, url: "" });

  /* ---- Alignment feed ---- */
  useEffect(() => {
    let alive = true;
    const base = getBackendBase();
    async function pull() {
      const url = `${base}/api/signals?strategy=alignment&limit=1&t=${Date.now()}`;
      try {
        const r = await fetch(url, { cache: "no-store", headers: { "Cache-Control": "no-store" } });
        if (!r.ok) throw new Error("HTTP " + r.status);
        const data = await r.json();
        if (!alive) return;
        setAlignRes({ status: String(data?.status ?? "live"), data, base });
      } catch {
        if (!alive) return;
        const ts = new Date(Math.floor(Date.now() / 600000) * 600000).toISOString();
        setAlignRes({
          status: "mock(error)",
          data: { signal: { members: { SPY:{ok:true}, QQQ:{ok:true}, IWM:{ok:true}, MDY:{ok:true}, DIA:{ok:false}, "I:VIX":{ok:true} }, liquidity_ok: null, timestamp: ts } },
          base
        });
      }
    }
    pull();
    const id = setInterval(pull, 30000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  /* ---- Sandbox deltas ---- */
  useEffect(() => {
    let alive = true;
    const url = getSandboxUrl();
    if (!url) { setDeltaRes({ ok:false, stale:true, market:null, at:null, url:"" }); return; }
    async function pull() {
      try {
        const r = await fetch(`${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}`, { cache:"no-store", headers:{ "Cache-Control":"no-store" } });
        if (!r.ok) throw new Error("HTTP " + r.status);
        const j = await r.json();
        const at = j?.deltasUpdatedAt || j?.updated_at || null;
        const market = j?.deltas?.market || null;
        const stale = (() => {
          if (!at) return true;
          const diffMin = (Date.now() - new Date(at).getTime())/60000;
          return !(diffMin>=0) || diffMin > STALE_MINUTES;
        })();
        if (!alive) return;
        setDeltaRes({ ok:!!market, stale, market, at, url });
      } catch {
        if (!alive) return;
        setDeltaRes({ ok:false, stale:true, market:null, at:null, url });
      }
    }
    pull();
    const id = setInterval(pull, 300000); // ~5m
    return () => { alive = false; clearInterval(id); };
  }, []);

  /* ---- Normalize + Decision (Δ gate soft RiskOn) ---- */
  const prevGate = useRef(false);
  const view = useMemo(() => {
    const status = alignRes.status || "mock";
    const data = alignRes.data;

    let sig = null;
    if (Array.isArray(data?.items) && data.items.length) sig = data.items[0];
    else if (data?.signal) sig = data.signal;
    else if (data?.direction || data?.members) sig = data;

    const members = sig?.members || {};
    const ts = sig?.timestamp || null;

    const effective = {
      SPY: members["SPY"],
      QQQ: members["QQQ"],
      IWM: members["IWM"],
      MDY: members["MDY"],
      DIA: members["DIA"] || members["I:DJI"], // legacy
      "I:VIX": members["I:VIX"] || members["VIX"],
    };

    let confirm = 0; const failing = [];
    CANON.forEach(k => { const ok = !!(effective[k] && effective[k].ok === true); if (ok) confirm++; else failing.push(k); });

    const liquidityRaw = ("liquidity_ok" in (sig||{})) ? sig.liquidity_ok : null;
    const liquidityState = (liq => liq===true ? "ok" : (liq===false ? "no" : "neutral"))(liquidityRaw);

    const dm = deltaRes.market;  // { dBreadthPct, dMomentumPct, riskOnPct }
    const accelOk = !!(deltaRes.ok && !deltaRes.stale &&
      typeof dm?.dBreadthPct === "number" && dm.dBreadthPct >= GREEN_TH &&
      typeof dm?.dMomentumPct === "number" && dm.dMomentumPct >= GREEN_TH
    );
    const riskOn = (typeof dm?.riskOnPct === "number") ? dm.riskOnPct : null;

    const triggered = confirm >= ALIGN_THRESHOLD;

    // Sensitive mode: Δ gate required; RiskOn = SOFT (warn only)
    let gateReady = false; let gateWhy = "";
    if (!triggered) { gateReady=false; gateWhy = `need ≥${ALIGN_THRESHOLD}/${CANON.length}`; }
    else if (deltaRes.stale) { gateReady=true; gateWhy = "staleΔ: ignore"; }  // ignore stale (no block, no bonus)
    else if (!accelOk) { gateReady=false; gateWhy = "ΔAccel < 0.5/0.5"; }
    else { gateReady=true; gateWhy = (riskOn!==null && riskOn<=-1.0) ? "READY — RiskOn red (soft)" : "ready"; }

    const baseScore = Math.round((confirm / CANON.length) * 100);
    const bonusLiq  = (liquidityState==="ok") ? 10 : 0;
    const bonusΔ    = (!deltaRes.stale && accelOk) ? 20 : 0;
    const conf = Math.max(0, Math.min(100, baseScore + bonusLiq + bonusΔ));

    const statePill = triggered ? "Triggered" : "Flat";
    const tone = triggered ? "ok" : "muted";
    const last = ts ? (triggered ? `LONG • ${fmtHHMM(ts)}` : `— • ${fmtHHMM(ts)}`) : "—";

    return {
      key: `${status}-${ts || nowIso()}-${confirm}-${liquidityState}-${accelOk ? 1 : 0}`,
      status, confirm, total: CANON.length,
      liquidityState, accelOk, score: conf, tone, statePill, last,
      failing: triggered ? [] : failing,
      gateReady, gateWhy,
      dBreadth: dm?.dBreadthPct ?? null, dMomentum: dm?.dMomentumPct ?? null, riskOn
    };
  }, [alignRes, deltaRes]);

  /* ---- On READY edge: journal + optional alert ---- */
  useEffect(() => {
    if (view.gateReady && !prevGate.current) {
      const ts = new Date().toISOString();
      // Journal both SPY and QQQ so you can test entries immediately
      ["SPY","QQQ"].forEach(sym => {
        addJournalEntry({
          ts, strategy:"alignment", symbol: sym, tf:"10m",
          info: {
            confirm:`${view.confirm}/${view.total}`,
            dBreadth:view.dBreadth, dMomentum:view.dMomentum, riskOn:view.riskOn,
            note: view.gateWhy
          }
        });
      });
      // Optional alert webhook -> set REACT_APP_ALERT_WEBHOOK_URL to enable
      const hook = getAlertWebhook();
      if (hook) {
        try {
          fetch(hook, {
            method:"POST",
            headers:{ "Content-Type":"application/json" },
            body: JSON.stringify({
              ts, strategy:"alignment", symbols:["SPY","QQQ"], timeframe:"10m",
              gate:"READY", confirm:`${view.confirm}/${view.total}`,
              dBreadth:view.dBreadth, dMomentum:view.dMomentum, riskOn:view.riskOn,
              msg:`Alignment READY ${view.confirm}/${view.total} • Δ(${fmtNum(view.dBreadth)}/${fmtNum(view.dMomentum)}) ${view.riskOn!==null?`• RiskOn ${fmtNum(view.riskOn)}`:""}`
            })
          }).catch(()=>{});
        } catch {}
      }
    }
    prevGate.current = view.gateReady;
  }, [view.gateReady, view.confirm, view.total, view.dBreadth, view.dMomentum, view.riskOn, view.gateWhy]);

  /* ---- Tabs ---- */
  const tabs = [
    { k:"SPY", sym:"SPY" },
    { k:"QQQ", sym:"QQQ" },
    { k:"IWM", sym:"IWM" },
    { k:"MDY", sym:"MDY" },
    { k:"DIA", sym:"DIA" },
    { k:"VIX", sym:"I:VIX" }, // added VIX tab
  ];
  function load(sym) { setSelection({ symbol: sym, timeframe: "10m", strategy: "alignment" }); }

  /* ---- UI ---- */
  return (
    <div key={view.key} style={S.wrap}>
      <Card
        title="SPY/QQQ Index-Alignment Scalper"
        timeframe="10m"
        rightPills={[
          { text: alignRes.status === "live" ? "LIVE" : "MOCK", tone: alignRes.status === "live" ? "live" : "muted" },
          { text: `${view.statePill} (${view.confirm}/${view.total})`, tone: view.tone },
        ]}
        score={view.score}
        last={view.last}
        pl="—"
        footNote={view.failing.length ? ("Failing: " + view.failing.join(", ")) : ""}
      >
        {/* 3 checks */}
        <div style={S.checks}>
          <Check ok={view.confirm >= ALIGN_THRESHOLD} label={`Alignment ≥${ALIGN_THRESHOLD}/${CANON.length}`} />
          <Check ok={false} neutral={true} label="Liquidity (pending)" />
          <Check ok={view.accelOk} label="Δ Accel (5m)" tip={deltaRes.stale ? "stale" : ""} />
        </div>

        {/* Gate line */}
        <div style={S.gateRow}>
          <span style={view.gateReady ? S.gateOk : S.gateNo}>
            {view.gateReady ? "READY" : "BLOCKED"}
          </span>
          <span style={S.gateWhy}>{view.gateWhy}</span>
        </div>

        {/* Selected + Tabs */}
        <div style={S.selRow}>
          <span style={S.selKey}>Selected:</span>
          <span style={S.selVal}>{(selection?.symbol || "—")} • {(selection?.timeframe || "—")}</span>
        </div>
        <div style={S.tabRow}>
          {tabs.map(t => {
            const active = selection?.symbol === t.sym && selection?.timeframe === "10m";
            return (
              <button key={t.k} type="button" onClick={()=>load(t.sym)}
                style={{ ...S.tab, ...(active ? S.tabActive : null) }} aria-pressed={!!active} title={`Load ${t.k} (10m)`}>
                {t.k}
              </button>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

/* ---------- subcomponents ---------- */
function Check({ ok, label, tip, neutral }) {
  const style = neutral ? S.chkNeutral : ok ? S.chkOk : S.chkNo;
  return (
    <div style={S.chk}>
      <span style={style}>{neutral ? "•" : ok ? "✓" : "•"}</span>
      <span>{label}{tip ? ` — ${tip}` : ""}</span>
    </div>
  );
}

function Card(props) {
  const pct = Math.max(0, Math.min(100, props.score || 0));
  return (
    <div style={S.card}>
      <div style={S.head}>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <div style={S.title}>{props.title}</div>
          <span style={S.badge}>{props.timeframe}</span>
        </div>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
          {props.rightPills.map((p,i)=><span key={i} style={{ ...S.pill, ...toneStyles(p.tone).pill }}>{p.text}</span>)}
        </div>
      </div>

      <div style={S.scoreRow}>
        <div style={S.scoreLabel}>Score</div>
        <div style={S.progress}><div style={{ ...S.progressFill, width: `${pct}%` }} /></div>
        <div style={S.scoreVal}>{pct}</div>
      </div>

      <div style={S.metaRow}>
        <div><span style={S.metaKey}>Last:</span> {props.last}</div>
        <div><span style={S.plKey}>P/L Today:</span> {props.pl}</div>
      </div>

      {props.children}
    </div>
  );
}

/* ---------- utils & styles ---------- */
function fmtHHMM(iso) {
  try { if (!iso) return "—"; const d=new Date(iso); return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`; }
  catch { return "—"; }
}
function fmtNum(v){ return (typeof v==="number") ? (v>0?`+${v.toFixed(1)}`:v.toFixed(1)) : "—"; }

const S = {
  wrap: { display:"grid", gridTemplateColumns:"repeat(3, minmax(0,1fr))", gap:10 },

  card: { background:"#101010", border:"1px solid #262626", borderRadius:10, padding:10, color:"#e5e7eb",
          display:"flex", flexDirection:"column", gap:8, minHeight:110 },

  head: { display:"flex", alignItems:"center", justifyContent:"space-between", gap:6 },
  title:{ fontWeight:700, fontSize:14, lineHeight:"16px" },
  badge:{ background:"#0b0b0b", border:"1px solid #2b2b2b", color:"#9ca3af", fontSize:10, padding:"1px 6px", borderRadius:999, fontWeight:700 },
  pill: { fontSize:10, padding:"2px 8px", borderRadius:999, border:"1px solid #2b2b2b", fontWeight:700, lineHeight:"14px" },

  scoreRow:{ display:"grid", gridTemplateColumns:"44px 1fr 28px", alignItems:"center", gap:6 },
  scoreLabel:{ color:"#9ca3af", fontSize:10 },
  progress:{ background:"#1f2937", borderRadius:6, height:6, overflow:"hidden", border:"1px solid #334155" },
  progressFill:{ height:"100%", background:"linear-gradient(90deg,#22c55e 0%,#84cc16 40%,#f59e0b 70%,#ef4444 100%)" },
  scoreVal:{ textAlign:"right", fontWeight:700, fontSize:12 },

  metaRow:{ display:"grid", gridTemplateColumns:"1fr auto", gap:6, fontSize:11, color:"#cbd5e1" },
  metaKey:{ color:"#9ca3af", marginRight:4, fontWeight:600 },
  plKey:{ color:"#9ca3af", marginRight:4, fontWeight:600 },

  checks:{ display:"flex", gap:10, flexWrap:"wrap", marginTop:2 },
  chk:{ display:"flex", alignItems:"center", gap:6, fontSize:11 },
  chkOk:{ color:"#86efac", fontWeight:900 },
  chkNo:{ color:"#94a3b8", fontWeight:900 },
  chkNeutral:{ color:"#9ca3af", fontWeight:900 },

  gateRow:{ display:"flex", alignItems:"center", gap:8, marginTop:4, fontSize:11 },
  gateOk:{ background:"#06220f", color:"#86efac", border:"1px solid #166534", borderRadius:999, padding:"2px 8px", fontWeight:900 },
  gateNo:{ background:"#1b1409", color:"#fca5a5", border:"1px solid #7f1d1d", borderRadius:999, padding:"2px 8px", fontWeight:900 },
  gateWhy:{ color:"#94a3b8" },

  selRow:{ display:"flex", alignItems:"center", gap:6, marginTop:2, fontSize:11 },
  selKey:{ color:"#9ca3af" },
  selVal:{ fontWeight:700 },

  tabRow:{ display:"flex", gap:6, flexWrap:"wrap", marginTop:4 },
  tab:{ background:"#141414", color:"#cbd5e1", border:"1px solid #2a2a2a", borderRadius:7, padding:"3px 6px", fontSize:10, fontWeight:700, cursor:"pointer" },
  tabActive:{ background:"#1f2937", color:"#e5e7eb", border:"1px solid #3b82f6", boxShadow:"0 0 0 1px #3b82f6 inset" },
};

function toneStyles(kind) {
  switch (kind) {
    case "live": return { pill: { background:"#06220f", color:"#86efac", borderColor:"#166534" } };
    case "info": return { pill: { background:"#0b1220", color:"#93c5fd", borderColor:"#1e3a8a" } };
    case "warn": return { pill: { background:"#1b1409", color:"#fbbf24", borderColor:"#92400e" } };
    case "ok":   return { pill: { background:"#07140d", color:"#86efac", borderColor:"#166534" } };
    default:     return { pill: { background:"#0b0b0b", color:"#94a3b8", borderColor:"#2b2b2b" } };
  }
}
