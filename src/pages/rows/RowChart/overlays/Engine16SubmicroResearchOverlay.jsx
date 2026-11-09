import React,{useEffect,useMemo,useRef} from "react";
import {detectSubmicroChartAbc} from "../engine16SubmicroChartResearch";
import {validatedEngine22WorkingNodeAnchors} from "../engine22WorkingNodeReader";

// Non-interactive canvas on the OWNER'S EXISTING Engine2 chart. It never calls
// series.update/setData, changes timescale, writes Engine22, or creates a feed.
export default function Engine16SubmicroResearchOverlay({
  visible=false,chart,priceSeries,bars=[],verified=false,engine22Nodes=null
}){
  const canvasRef=useRef(null);
  const eventsRef=useRef([]);
  const lastFingerprint=useRef("");
  const analysisRef=useRef(null);
  const redrawRef=useRef(null);
  const analysis=useMemo(()=>{
    if(!visible)return null;
    try{return detectSubmicroChartAbc(bars,{contractVerified:verified});}
    catch{return {status:"UNAVAILABLE",reason:"RESEARCH_DETECTOR_ERROR",candidate:null};}
  },[visible,bars,verified]);
  analysisRef.current=analysis;
  const context=useMemo(()=>validatedEngine22WorkingNodeAnchors(engine22Nodes,"submicro"),[engine22Nodes]);
  useEffect(()=>{
    if(!visible||!analysis?.candidate)return;
    const candidate=analysis.candidate;
    const key=[candidate.candidateId,candidate.status,candidate.extreme.time,
      candidate.extreme.price,candidate.knownAtCandle].join("|");
    if(key===lastFingerprint.current)return;
    lastFingerprint.current=key;
    // Session-only visual journal. No hidden persistence / no historical replay claim.
    eventsRef.current=[...eventsRef.current,{key,observedAt:new Date().toISOString(),
      status:candidate.status,candidateId:candidate.candidateId}].slice(-160);
  },[visible,analysis]);

  useEffect(()=>{
    if(!visible||!chart||!priceSeries)return;
    const host=chart.chartElement?.()?.parentElement;
    if(!host)return;
    const canvas=document.createElement("canvas");
    canvas.dataset.engine16Submicro="research-only";
    Object.assign(canvas.style,{position:"absolute",inset:"0",width:"100%",height:"100%",
      pointerEvents:"none",zIndex:"48"});
    host.appendChild(canvas);
    canvasRef.current=canvas;
    let disposed=false,frame=0;
    const draw=()=>{
      frame=0;if(disposed)return;
      const rect=host.getBoundingClientRect();
      if(!rect.width||!rect.height)return;
      const dpr=window.devicePixelRatio||1;
      canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.height*dpr);
      const ctx=canvas.getContext("2d");if(!ctx)return;
      ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,rect.width,rect.height);
      const c=analysisRef.current?.candidate;
      if(!c)return;
      const color=c.direction==="UP"?"#34d399":"#fb7185";
      const at=(time,price)=>({
        x:chart.timeScale().timeToCoordinate(time),
        y:priceSeries.priceToCoordinate(price)
      });
      const points=[["0",c.start],["A",c.A],["B",c.B],
        [c.status==="C_COMPLETION_CANDIDATE"?"C?":"C…",
          {time:c.extreme.time,price:c.extreme.price}]];
      const mapped=points.map(([label,p])=>({label,...at(p.time,p.price)}));
      ctx.lineWidth=1.5;ctx.strokeStyle=color;ctx.setLineDash([5,4]);
      mapped.forEach((p,i)=>{
        if(!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.y<0||p.y>rect.height)return;
        if(i>0&&Number.isFinite(mapped[i-1].x)&&Number.isFinite(mapped[i-1].y)){
          ctx.beginPath();ctx.moveTo(mapped[i-1].x,mapped[i-1].y);
          ctx.lineTo(p.x,p.y);ctx.stroke();
        }
      });
      ctx.setLineDash([]);
      ctx.font="bold 12px system-ui";ctx.fillStyle=color;ctx.textAlign="center";
      for(const p of mapped){
        if(!Number.isFinite(p.x)||!Number.isFinite(p.y)||
          p.x<0||p.x>rect.width||p.y<0||p.y>rect.height)continue;
        ctx.beginPath();ctx.arc(p.x,p.y,3,0,Math.PI*2);ctx.fill();
        ctx.fillText("E16 "+p.label,p.x,Math.max(12,p.y-10));
      }
      for(const t of c.targets.filter(x=>[1,1.272,1.618].includes(x.ratio))){
        const y=priceSeries.priceToCoordinate(t.price);
        if(!Number.isFinite(y)||y<14||y>rect.height-14)continue;
        ctx.strokeStyle="rgba(125,211,252,.6)";ctx.setLineDash([3,5]);
        ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(rect.width,y);ctx.stroke();
        ctx.setLineDash([]);ctx.fillStyle="#7dd3fc";ctx.textAlign="right";
        ctx.fillText("E16 C "+t.ratio+" · "+t.price.toFixed(2),rect.width-12,y-4);
      }
      const invalidY=priceSeries.priceToCoordinate(c.B.price);
      if(Number.isFinite(invalidY)&&invalidY>=12&&invalidY<=rect.height-12){
        ctx.strokeStyle="rgba(251,191,36,.55)";ctx.setLineDash([2,8]);
        ctx.beginPath();ctx.moveTo(0,invalidY);ctx.lineTo(rect.width,invalidY);ctx.stroke();
        ctx.setLineDash([]);
      }
    };
    const schedule=()=>{if(!disposed&&!frame)frame=requestAnimationFrame(draw);};
    redrawRef.current=schedule;
    const ts=chart.timeScale();
    ts.subscribeVisibleTimeRangeChange(schedule);
    ts.subscribeVisibleLogicalRangeChange(schedule);
    const ro=new ResizeObserver(schedule);ro.observe(host);
    schedule();
    return()=>{
      disposed=true;if(frame)cancelAnimationFrame(frame);
      ts.unsubscribeVisibleTimeRangeChange(schedule);
      ts.unsubscribeVisibleLogicalRangeChange(schedule);
      ro.disconnect();canvas.remove();
      if(redrawRef.current===schedule)redrawRef.current=null;
      if(canvasRef.current===canvas)canvasRef.current=null;
    };
  },[visible,chart,priceSeries]);
  useEffect(()=>{redrawRef.current?.();},[analysis]);

  if(!visible)return null;
  const active=analysis?.candidate;
  return <div style={{position:"absolute",right:12,top:12,zIndex:95,
    pointerEvents:"none",maxWidth:300,padding:"6px 9px",border:"1px solid #334155",
    borderRadius:7,background:"rgba(15,23,42,.91)",color:"#e2e8f0",fontSize:11}}>
    <div style={{fontWeight:800,color:"#fbbf24"}}>ENGINE 16 · SUBMICRO · ES 10M · RESEARCH</div>
    <div>{active?active.label+" · "+active.direction:analysis?.reason||"Waiting for candles"}</div>
    <div>Engine22: {context?"Submicro reference available":"Context unavailable / unverified"}</div>
    <div style={{color:"#94a3b8"}}>Provisional only · no trade authority · session events {eventsRef.current.length}</div>
  </div>;
}
