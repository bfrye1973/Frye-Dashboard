import React, {useEffect, useMemo, useRef, useState} from "react";
import {
  WAVE_DEGREES, classifyNodeRecord, createWaveNodeHistoryReader,
  sameOriginWaveNodeProxy, fetchWaveNodePageFromProxy, verifiedNodeForChart,
} from "../engine22WaveNodeHistory";
import {ENGINE11_CONTINUOUS_UNADJUSTED_2020PLUS} from "../engine11HistoricalAdapter";

const COLORS = {
  primary:"#facc15", intermediate:"#fb7185", minor:"#f472b6",
  minute:"#a78bfa", subminute:"#38bdf8", micro:"#22c55e", submicro:"#f59e0b",
};
const VIEWS = ["approved", "research", "superseded"];
const checkedAll = Object.fromEntries(WAVE_DEGREES.map(d=>[d,true]));
const initialCategory = {approved:true,research:true,superseded:true};

// Reuses the EXISTING ES chart's timeScale and priceSeries. Overlay-only.
export default function Engine22WaveNodeHistoryLayer({chart, priceSeries, visible=true}) {
  const [snapshot,setSnapshot] = useState({cursor:0,events:[],historicalAsOfSupported:false});
  const [error,setError] = useState(null);
  const [degrees,setDegrees] = useState(checkedAll);
  const [categories,setCategories] = useState(initialCategory);
  const canvasRef = useRef(null);
  const rawEndpoint = typeof window === "undefined" ? "" :
    (window.__ENGINE22_WAVE_HISTORY_PROXY__ || process.env.REACT_APP_ENGINE22_WAVE_HISTORY_PROXY || "");
  const endpoint = typeof window === "undefined" ? null :
    sameOriginWaveNodeProxy(rawEndpoint,window.location.origin);
  const enabled = Boolean(visible && endpoint);

  // No backend token in browser. The owner-authenticated same-origin proxy
  // is configured separately once Engine 22's draft backend is released.
  useEffect(()=>{
    if(!enabled)return;
    let disposed=false;
    const controller=new AbortController();
    const reader=createWaveNodeHistoryReader({
      getPage:({afterRevision,limit})=>fetchWaveNodePageFromProxy(endpoint,{
        afterRevision,limit,signal:controller.signal,
      }),
      onUpdate: next=>{if(!disposed)setSnapshot(next);},
    });
    const poll=()=>reader.refresh().catch(err=>{
      if(!disposed)setError(String(err?.message||err));
    });
    poll();
    const interval=setInterval(()=>{
      if(typeof document==="undefined"||!document.hidden)poll();
    },30000);
    const onFocus=()=>{if(!document.hidden)poll();};
    document.addEventListener("visibilitychange",onFocus);
    return ()=>{
      disposed=true;
      controller.abort();
      reader.close();
      clearInterval(interval);
      document.removeEventListener("visibilitychange",onFocus);
    };
  },[enabled,endpoint]);

  const counts=useMemo(()=>{
    const result={approved:0,research:0,superseded:0};
    for(const record of snapshot.events)result[classifyNodeRecord(record)]++;
    return result;
  },[snapshot.events]);

  const points=useMemo(()=>snapshot.events
    .filter(record=>degrees[record.degree]&&categories[classifyNodeRecord(record)])
    .map(record=>verifiedNodeForChart(record,{
      chartPriceBasisId:ENGINE11_CONTINUOUS_UNADJUSTED_2020PLUS.priceBasisVersion,
      historicalAsOfSupported:snapshot.historicalAsOfSupported,
    }))
    .filter(Boolean),[snapshot,degrees,categories]);

  useEffect(()=>{
    if(!enabled||!chart||!priceSeries||points.length===0)return;
    const host=chart.chartElement?.()?.parentElement;
    if(!host)return;
    const canvas=document.createElement("canvas");
    canvas.style.cssText="position:absolute;inset:0;pointer-events:none;z-index:44";
    host.appendChild(canvas);
    canvasRef.current=canvas;
    let raf=0;
    const draw=()=>{
      const rect=host.getBoundingClientRect(),ratio=window.devicePixelRatio||1;
      canvas.width=Math.max(1,Math.round(rect.width*ratio));
      canvas.height=Math.max(1,Math.round(rect.height*ratio));
      canvas.style.width=rect.width+"px";
      canvas.style.height=rect.height+"px";
      const context=canvas.getContext("2d");
      if(!context)return;
      context.setTransform(ratio,0,0,ratio,0,0);
      context.clearRect(0,0,rect.width,rect.height);
      context.textBaseline="bottom";
      context.font="600 11px system-ui";
      for(const p of points) {
        const x=chart.timeScale().timeToCoordinate(p.timeSec);
        const y=priceSeries.priceToCoordinate(p.price);
        if(!Number.isFinite(x)||!Number.isFinite(y)||
           x<0||x>rect.width||y<0||y>rect.height)continue;
        const color=COLORS[p.degree]||"#ddd";
        const status=classifyNodeRecord(p);
        context.strokeStyle=color;
        context.fillStyle=color;
        context.beginPath();
        context.arc(x,y,4,0,Math.PI*2);
        if(status==="research")context.stroke();else context.fill();
        context.fillText(p.degree.toUpperCase()+" "+p.label+" ("+status+")",x+7,y-7);
      }
    };
    const redraw=()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(draw);};
    const timescale=chart.timeScale();
    timescale.subscribeVisibleLogicalRangeChange(redraw);
    const ro=new ResizeObserver(redraw);
    ro.observe(host);
    redraw();
    return()=>{
      cancelAnimationFrame(raf);
      timescale.unsubscribeVisibleLogicalRangeChange(redraw);
      ro.disconnect();
      canvas.remove();
      canvasRef.current=null;
    };
  },[enabled,chart,priceSeries,points]);

  if(!enabled)return null;
  return <div style={{
    position:"absolute",bottom:12,left:55,zIndex:96,
    maxWidth:"min(650px, 88%)",background:"rgba(8,12,24,.91)",
    padding:"8px 10px",borderRadius:8,color:"#ddd",fontSize:11,
  }}>
    <div style={{fontWeight:800}}>Engine 22 Wave History · revision {snapshot.cursor}</div>
    <div style={{display:"flex",flexWrap:"wrap",gap:8,marginTop:5}}>
      {WAVE_DEGREES.map(degree=><label key={degree} style={{color:COLORS[degree]}}>
        <input type="checkbox" checked={degrees[degree]} onChange={e=>
          setDegrees(p=>({...p,[degree]:e.target.checked}))}/> {degree}
      </label>)}
    </div>
    <div style={{display:"flex",gap:8,marginTop:5}}>
      {VIEWS.map(category=><label key={category}>
        <input type="checkbox" checked={categories[category]} onChange={e=>
          setCategories(p=>({...p,[category]:e.target.checked}))}/>
        {category} {counts[category]}
      </label>)}
    </div>
    <div style={{opacity:.78,marginTop:4}}>
      {points.length} verified plot coordinates · unverified records remain in history
      {error?" · Feed unavailable: "+error:""}
    </div>
  </div>;
}
