// src/components/GaugesPanel.jsx
import React, { useEffect, useMemo, useState } from "react";
import { getGauges } from "../services/gauges";

const IDX = ["SPY","QQQ","MDY","IWM"];

export default function GaugesPanel({ defaultIndex = "SPY" }) {
  const [index, setIndex] = useState(defaultIndex);
  const [rows, setRows]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true); setErr("");
      try {
        const data = await getGauges(index);
        if (!alive) return;
        setRows(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!alive) return;
        setErr(String(e?.message || "fetch error"));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [index]);

  const sorted = useMemo(() => {
    return [...rows].sort((a,b) => Math.abs(b.momentum) - Math.abs(a.momentum));
  }, [rows]);

  return (
    <div style={panel}>
      <div style={hdr}>
        <div style={{display:"flex", gap:8, alignItems:"center"}}>
          <strong style={{fontSize:14}}>Market Gauges</strong>
          <select value={index} onChange={e=>setIndex(e.target.value)} style={select}>
            {IDX.map(x => <option key={x} value={x}>{x}</option>)}
          </select>
        </div>
        {loading ? <span style={dim}>loading…</span> : err ? <span style={errTxt}>{err}</span> : null}
      </div>

      <div style={{display:"grid", gridTemplateColumns:"minmax(160px, 1fr) 1fr 1fr", gap:"6px 12px", alignItems:"center"}}>
        <div style={th}>Group</div>
        <div style={th}>Momentum</div>
        <div style={th}>Breadth</div>

        {sorted.map((r, i) => (
          <React.Fragment key={r.group + i}>
            <div style={cellLeft}>{r.group}</div>
            <Gauge value={Number(r.momentum||0)} max={1000} />
            <Gauge value={Number(r.breadth||0)}  max={1000} />
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

function Gauge({ value = 0, max = 1000 }) {
  const v = Number(value) || 0;
  const cap = Math.max(1, Math.abs(max));
  const pct = Math.max(0, Math.min(1, Math.abs(v) / cap));
  const w = Math.round(pct * 100);
  const color = v >= 0 ? "#16a34a" : "#dc2626";
  return (
    <div style={gWrap}>
      <div style={{...gBar, width: `${w}%`, background: color}} />
      <div style={gNum}>{v.toLocaleString()}</div>
    </div>
  );
}

// styles
const panel = { border:"1px solid #1f2a44", borderRadius:12, padding:12, background:"#0e1526", marginBottom:12 };
const hdr = { display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 };
const select = { padding:"4px 8px", borderRadius:8, border:"1px solid #334155", background:"#0b1220", color:"#e5e7eb", fontSize:12, outline:"none" };
const dim = { fontSize:12, opacity:0.7 };
const errTxt = { fontSize:12, color:"#ef4444" };
const th = { fontSize:12, opacity:0.8, borderBottom:"1px solid #1f2a44", paddingBottom:4 };
const cellLeft = { fontSize:12 };
const gWrap = { position:"relative", height:18, background:"#0b1220", border:"1px solid #334155", borderRadius:6 };
const gBar  = { position:"absolute", left:0, top:0, bottom:0, borderRadius:6 };
const gNum  = { position:"absolute", right:6, top:"50%", transform:"translateY(-50%)", fontSize:11, opacity:0.9 };
