import React from "react";
import { mapGran } from "./replayApi";


function fmtIso(ts){ try{ return new Date(ts).toLocaleString(); } catch { return ts; } }


export default function ReplayControls({ on, setOn, granularity, setGranularity, ts, setTs, loadIndex, index, setIndex, loading }){
return (
<div style={{ display:"flex", alignItems:"center", gap:8 }}>
<button
onClick={()=> setOn(!on)}
style={{
background:on?"#3b3a16":"#0b0b0b", color:on?"#fde68a":"#e5e7eb",
border:"1px solid #2b2b2b", borderRadius:8, padding:"6px 10px", fontWeight:700, cursor:"pointer"
}}
title="Toggle Replay Mode"
>{on?"Replay: ON":"Replay: OFF"}</button>


<select
value={granularity}
onChange={async (e)=>{
const g = e.target.value; setGranularity(g);
if (on) { setIndex([]); setTs(""); try{ const items = await loadIndex(g); setIndex(items); } catch {} }
}}
disabled={!on}
style={{ background:"#0b0b0b", color:"#e5e7eb", border:"1px solid #2b2b2b", borderRadius:8, padding:"6px 8px" }}
title="Replay granularity"
>
<option value="10min">10m</option>
<option value="1h">1h</option>
<option value="1d">1d</option>
</select>


<select
value={ts || ""}
onChange={(e)=> setTs(e.target.value)}
disabled={!on || loading || (index?.length||0)===0}
style={{ minWidth:260, background:"#0b0b0b", color:"#e5e7eb", border:"1px solid #2b2b2b", borderRadius:8, padding:"6px 8px" }}
title={`Replay timestamp (${mapGran(granularity)})`}
>
{!on && <option value="">(Replay off)</option>}
{on && loading && <option value="">Loading…</option>}
{on && !loading && (index?.length||0)===0 && <option value="">No snapshots</option>}
{on && !loading && (index?.length||0)>0 && (
<>
<option value="">Select time…</option>
{index.map((o)=> <option key={o.ts} value={o.ts}>{fmtIso(o.ts)}</option>)}
</>
)}
</select>
</div>
);
}
