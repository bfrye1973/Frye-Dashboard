import React from "react";
setGranularity={replay.setGranularity}
ts={replay.ts}
setTs={replay.setTs}
loadIndex={getReplayIndex}
index={index}
setIndex={setIndex}
loading={loadingIdx}
/>
</div>
</div>


{/* Layouts by view mode (unchanged) */}
{mode === ViewModes.METER_TILES && (
<MeterTilesLayout
breadth={breadth} momentum={momentum} squeezeIntra={squeezeIntra}
squeezeDaily={squeezeDaily} liquidity={liquidity} volatility={volatility}
meterValue={meterValue}
bBreadth={bBreadth} bMomentum={bMomentum} bSqueezeIn={bSqueezeIn}
bSqueezeDy={bSqueezeDy} bLiquidity={bLiquidity} bVol={bVol}
/>
)}


{mode === ViewModes.TRAFFIC && (
<TrafficLightsLayout
breadth={breadth} momentum={momentum} squeezeIntra={squeezeIntra}
squeezeDaily={squeezeDaily} liquidity={liquidity} volatility={volatility}
/>
)}


{mode === ViewModes.ARROWS && (
<ArrowScorecardsLayout
breadth={{ value: breadth, base: bBreadth }}
momentum={{ value: momentum, base: bMomentum }}
squeezeIntra={{ value: squeezeIntra, base: bSqueezeIn }}
squeezeDaily={{ value: squeezeDaily, base: bSqueezeDy }}
liquidity={{ value: liquidity, base: bLiquidity }}
volatility={{ value: volatility, base: bVol }}
meterValue={meterValue}
/>
)}


{/* Optional tiny status line */}
<div className="text-xs" style={{ color:"#9ca3af", marginTop:6 }}>
{replay.on ? (loadingSnap ? "Loading snapshot…" : (ts ? `Snapshot: ${fmtIso(ts)}` : "Replay ready")) : (ts ? `Updated ${fmtIso(ts)}` : "")}
</div>
</section>
);
}


// ====== your existing layout components & Legend remain unchanged below ======
function MeterTilesLayout({ breadth, momentum, squeezeIntra, squeezeDaily, liquidity, volatility, meterValue, bBreadth, bMomentum, bSqueezeIn, bSqueezeDy, bLiquidity, bVol }){ /* ...unchanged... */ return (
<div style={{ display:"grid", gridTemplateColumns:"1fr auto 1fr", alignItems:"center", gap:12, marginTop:6 }}>
<div style={{ display:'flex', gap:12, maxWidth:420, width:'100%', alignItems:'center', justifyContent:'space-between' }}>
<Stoplight label="Breadth" value={breadth} baseline={bBreadth} />
<Stoplight label="Momentum" value={momentum} baseline={bMomentum} />
<Stoplight label="Intraday Squeeze" value={squeezeIntra} baseline={bSqueezeIn} />
</div>
<div style={{ display:"flex", alignItems:"center", gap:16 }}>
<Stoplight label="Overall Market Indicator" value={meterValue} baseline={meterValue} size={110} />
<Stoplight label="Daily Squeeze" value={squeezeDaily} baseline={bSqueezeDy} />
</div>
<div style={{ display:"flex", gap:12, justifyContent:"flex-end" }}>
<Stoplight label="Liquidity" value={liquidity} baseline={bLiquidity} unit="" />
<Stoplight label="Volatility" value={volatility} baseline={bVol} />
</div>
</div>
); }


function TrafficLightsLayout({ breadth, momentum, squeezeIntra, squeezeDaily, liquidity, volatility }){ /* ...unchanged... */ return (
<div style={{ display:"flex", gap:12, flexWrap:"wrap", marginTop:6 }}>
<Stoplight label="Breadth" value={breadth} baseline={null} />
<Stoplight label="Momentum" value={momentum} baseline={null} />
<Stoplight label="Intraday Squeeze" value={squeezeIntra} baseline={null} />
<Stoplight label="Daily Squeeze" value={squeezeDaily} baseline={null} />
<Stoplight label="Liquidity" value={liquidity} baseline={null} unit="" />
<Stoplight label="Volatility" value={volatility} baseline={null} />
</div>
); }


function ArrowScorecardsLayout({ breadth, momentum, squeezeIntra, squeezeDaily, liquidity, volatility, meterValue }){ /* ...unchanged... */ return (
<div style={{ display:"flex", gap:12, flexWrap:"wrap", marginTop:6 }}>
{(()=>{ const Card=({ title, value, base })=>{ const v=Number.isFinite(value)?value:NaN; const d=Number.isFinite(value)&&Number.isFinite(base)?value-base:NaN; const arrow=!Number.isFinite(d)?"→":d>0?"↑":d<0?"↓":"→"; const tone=Number.isFinite(v)?toneFor(v):"info"; const border={ ok:"#22c55e", warn:"#fbbf24", danger:"#ef4444", info:"#475569" }[tone]; return (<div style={{border:`1px solid ${border}`, borderRadius:12, padding:"10px 12px", minWidth:160, background:"#0f1113"}}><div style={{ color:"#9ca3af", fontSize:12 }}>{title}</div><div style={{ color:"#e5e7eb", fontWeight:800, fontSize:18 }}>{pct(v)}%</div><div style={{ color:"#cbd5e1", fontSize:12, marginTop:2 }}>{arrow} {Number.isFinite(d)?d.toFixed(1):"0.0"}%</div></div>);}; return (<>
<Card title="Market Meter" value={meterValue} base={50} />
<Card title="Breadth" value={breadth.value} base={breadth.base} />
<Card title="Momentum" value={momentum.value} base={momentum.base} />
<Card title="Intraday Squeeze" value={squeezeIntra.value} base={squeezeIntra.base} />
<Card title="Daily Squeeze" value={squeezeDaily.value} base={squeezeDaily.base} />
<Card title="Liquidity" value={liquidity.value} base={liquidity.base} />
<Card title="Volatility" value={volatility.value} base={volatility.base} />
</>); })()}
</div>
); }


// Legend components (copied from your original file, unchanged)
function LegendModal({ onClose, children }) { /* ...unchanged from your version... */
React.useEffect(()=>{ const onKey=(e)=> e.key==="Escape" && onClose?.(); window.addEventListener("keydown", onKey); return ()=> window.removeEventListener("keydown", onKey); },[onClose]);
return (<div role="dialog" aria-modal="true" onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:50 }}>
<div onClick={(e)=>e.stopPropagation()} style={{ width:"min(860px, 92vw)", background:"#0b0b0c", border:"1px solid #2b2b2b", borderRadius:12, padding:16, boxShadow:"0 10px 30px rgba(0,0,0,0.35)" }}>{children}<div style={{ display:"flex", justifyContent:"flex-end", marginTop:12 }}><button onClick={onClose} style={{ background:"#eab308", color:"#111827", border:"none", borderRadius:8, padding:"8px 12px", fontWeight:700, cursor:"pointer" }}>Close</button></div></div>
</div>);
}
function LegendContent(){ /* ...unchanged from your version... */ return (<div><div style={{ color: "#e5e7eb", margin: "6px 0 8px", fontSize: 16, fontWeight: 700 }}>Market Meter — Gauge Legend (with Examples)</div> {/* elided for brevity; keep your existing LegendContent here */}</div>); }
