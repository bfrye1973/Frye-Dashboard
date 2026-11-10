import React,{useEffect,useRef,useState} from "react";

// Engine 18 is an independent, read-only research overlay. It never mutates
// Engine 11 candles, Engine 22 Elliott nodes or the Lightweight Charts series.
const FEED="https://frye-engine18-liquidity-research.onrender.com/api/engine18/liquidity-zones";
const SCHEMA="engine18.chartLiquidityDemo.v1";
const MAX_AGE_MS=15000;
export function validateEngine18ChartZones(packet,now=Date.now()){
  if(!packet||packet.schema!==SCHEMA||packet.symbol!=="XCME:ES.Z26"||
     packet.available!==true||packet.executionEligible!==false||
     packet.displayOnly!==true||packet.mode!=="DEMO_RESEARCH_ONLY"||
     packet.level!==2||!Array.isArray(packet.zones)||
     !Number.isSafeInteger(packet.asOfUnixMs)||
     now-packet.asOfUnixMs<0||now-packet.asOfUnixMs>MAX_AGE_MS)
     return [];
  const seen=new Set(),out=[];
  for(const zone of packet.zones){
    const side=zone?.side,price=zone?.price,size=zone?.visibleContracts;
    if(!["BID","ASK"].includes(side)||typeof price!=="number"||
       !Number.isFinite(price)||price<=0||Math.abs(price*4-Math.round(price*4))>1e-8||
       !Number.isSafeInteger(size)||size<=0)continue;
    const key=side+":"+price;
    if(seen.has(key))continue;seen.add(key);
    out.push({side,price,visibleContracts:size,
      observedInImages:zone.observedInImages||0});
    if(out.length>=8)break;
  }
  return out;
}

export default function Engine18LiquidityZonesOverlay({visible=false,chart=null,priceSeries=null,symbol="ES"}){
  const [packet,setPacket]=useState(null);
  const [status,setStatus]=useState("WAITING");
  const canvasRef=useRef(null);
  const drawRef=useRef(null);
  const packetRef=useRef(null);
  packetRef.current=packet;
  // Poll only while the owner has explicitly enabled this experimental layer.
  useEffect(()=>{
    if(!visible||symbol!=="ES"){setPacket(null);setStatus("OFF");return;}
    let cancelled=false;
    const update=async()=>{
      try{
        const response=await fetch(FEED,{cache:"no-store"});
        if(!response.ok)throw Error("FEED_UNAVAILABLE");
        const next=await response.json();
        if(cancelled)return;
        setPacket(next);
        setStatus(next?.available===true?"DEMO RESEARCH":"AWAITING VALID DEPTH");
      }catch{
        if(!cancelled){setPacket(null);setStatus("FEED NOT AUTHORIZED / UNAVAILABLE");}
      }
    };
    update();const timer=setInterval(update,5000);
    return()=>{cancelled=true;clearInterval(timer);};
  },[visible,symbol]);
  const zones=validateEngine18ChartZones(packet);
  useEffect(()=>{drawRef.current?.();},[packet,visible]);
  useEffect(()=>{
    if(!visible||symbol!=="ES"||!chart||!priceSeries)return;
    const host=chart.chartElement?.()?.parentElement;
    if(!host)return;
    const canvas=document.createElement("canvas");
    canvas.dataset.engine18Liquidity="demo-only";
    Object.assign(canvas.style,{position:"absolute",inset:"0",width:"100%",
      height:"100%",pointerEvents:"none",zIndex:"43"});
    host.appendChild(canvas);canvasRef.current=canvas;
    let frame=0,disposed=false;
    const draw=()=>{
      frame=0;if(disposed)return;
      const rect=host.getBoundingClientRect();
      if(!rect.width||!rect.height)return;
      const dpr=window.devicePixelRatio||1;
      canvas.width=Math.max(1,Math.round(rect.width*dpr));
      canvas.height=Math.max(1,Math.round(rect.height*dpr));
      const ctx=canvas.getContext("2d");if(!ctx)return;
      ctx.setTransform(dpr,0,0,dpr,0,0);
      ctx.clearRect(0,0,rect.width,rect.height);
      // Quiet guide lines only; detailed prices and sizes live in one clean
      // legend away from the right price scale and Elliott labels.
      const active=validateEngine18ChartZones(packetRef.current).slice(0,5);
      const occupied=[];
      for(const z of active){
        const y=priceSeries.priceToCoordinate(z.price);
        if(!Number.isFinite(y)||y<20||y>rect.height-25)continue;
        if(occupied.some(prev=>Math.abs(prev-y)<7))continue;
        occupied.push(y);
        const color=z.side==="BID"?"#34d399":"#fb7185";
        ctx.strokeStyle=color;ctx.globalAlpha=.45;ctx.lineWidth=1;
        ctx.setLineDash([4,7]);ctx.beginPath();
        ctx.moveTo(0,y);ctx.lineTo(rect.width-8,y);ctx.stroke();
      }
      ctx.setLineDash([]);ctx.globalAlpha=1;
    };
    const schedule=()=>{if(!disposed&&!frame)frame=requestAnimationFrame(draw);};
    drawRef.current=schedule;
    const ts=chart.timeScale();
    ts.subscribeVisibleLogicalRangeChange(schedule);
    ts.subscribeVisibleTimeRangeChange(schedule);
    const ro=new ResizeObserver(schedule);ro.observe(host);
    schedule();
    return()=>{
      disposed=true;if(frame)cancelAnimationFrame(frame);
      ts.unsubscribeVisibleLogicalRangeChange(schedule);
      ts.unsubscribeVisibleTimeRangeChange(schedule);
      ro.disconnect();canvas.remove();
      if(canvasRef.current===canvas)canvasRef.current=null;
      if(drawRef.current===schedule)drawRef.current=null;
    };
  },[visible,symbol,chart,priceSeries]);
  if(!visible||symbol!=="ES")return null;
  return <div data-engine18-liquidity-legend="true"
    style={{position:"absolute",top:76,left:60,zIndex:87,
      color:"#e2e8f0",background:"rgba(10,18,31,.94)",border:"1px solid #475569",
      borderRadius:8,padding:"9px 11px",fontSize:11,pointerEvents:"none",
      width:210,maxWidth:"calc(100% - 130px)",boxShadow:"0 4px 14px rgba(0,0,0,.4)"}}>
    <div style={{fontWeight:800,color:"#fbbf24",letterSpacing:".3px"}}>
      E18 LIQUIDITY · DEMO L2
    </div>
    <div style={{color:"#94a3b8",marginTop:3,marginBottom:5}}>
      {status} · Research only
    </div>
    {zones.length===0?<div style={{color:"#cbd5e1"}}>No verified recent zones</div>:
      zones.slice(0,5).map(z=><div key={z.side+":"+z.price}
        style={{display:"flex",justifyContent:"space-between",alignItems:"center",
          gap:8,padding:"3px 0",borderTop:"1px solid rgba(148,163,184,.15)",
          fontVariantNumeric:"tabular-nums"}}>
        <span style={{color:z.side==="BID"?"#34d399":"#fb7185",fontWeight:800}}>
          {z.side==="BID"?"BUY":"SELL"}
        </span>
        <span style={{color:"#f8fafc"}}>{z.price.toFixed(2)}</span>
        <span style={{color:"#cbd5e1"}}>{z.visibleContracts} ct</span>
      </div>)}
    <div style={{color:"#94a3b8",fontSize:10,marginTop:5}}>
      Data tier unverified · Not trade signals
    </div>
  </div>;
}
