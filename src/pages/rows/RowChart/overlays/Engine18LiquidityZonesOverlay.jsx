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
      observedInImages:Number.isSafeInteger(zone.observedInImages)?
        zone.observedInImages:0,
      // Optional backend source-side evidence; legacy packet shape unchanged.
      // Repeated 5-second HTTP polls cannot fabricate this elapsed duration.
      ...(Number.isSafeInteger(zone.observedPersistenceMs)&&zone.observedPersistenceMs>=0?
        {observedPersistenceMs:zone.observedPersistenceMs}:{}),
      ...(zone.coverageState==="IN_COVERAGE"?
        {coverageState:"IN_COVERAGE"}:{})});
    if(out.length>=8)break;
  }
  return out;
}

// Two BUY and two SELL levels, independent of market direction.
export function selectEngine18TestZones(zones){
  const list=Array.isArray(zones)?zones:[];
  const strongest=side=>list.filter(z=>z.side===side)
    .sort((a,b)=>b.visibleContracts-a.visibleContracts||
      b.observedInImages-a.observedInImages||a.price-b.price).slice(0,2);
  return [...strongest("ASK"),...strongest("BID")];
}

// Only promote a newly arrived price after it appears in two *distinct*
// fresh market snapshots. Existing approved prices stay as long as they
// remain in the latest valid book; missing prices are removed immediately
// rather than showing ghost resting orders. This avoids re-ranking churn.
export function advanceEngine18StableLevels(previous,packet,now=Date.now()){
 const fresh=validateEngine18ChartZones(packet,now);
 const asOf=packet?.asOfUnixMs;
 if(!fresh.length)return {zones:[],seen:{},asOf:null};
 const prior=previous||{zones:[],seen:{},asOf:null};
 if(asOf===prior.asOf)return prior;
 const byKey=new Map(fresh.map(z=>[z.side+":"+z.price,z]));
 const seen={};
 for(const [key,z] of byKey){
   const earlier=prior.seen?.[key];
   seen[key]={count:earlier?Math.min(2,earlier.count+1):1,
     price:z.price,side:z.side};
 }
 const held=prior.zones.filter(z=>byKey.has(z.side+":"+z.price))
   .map(z=>byKey.get(z.side+":"+z.price));
 const heldKeys=new Set(held.map(z=>z.side+":"+z.price));
 const newcomers=fresh.filter(z=>seen[z.side+":"+z.price].count>=2 &&
    !heldKeys.has(z.side+":"+z.price));
 return {zones:selectEngine18TestZones([...held,...newcomers]),
   seen,asOf};
}

// Anchor observation prices rather than re-ranking the current moving MBP-10
// window every 5 seconds. LAST_SEEN explicitly means UNKNOWN currently, not a
// resting order, cancellation, or validated institutional liquidity zone.
export function describeEngine18NoCandidate(packet){
 const reason=packet?.diagnostics?.noCandidateReason??packet?.reason;
 const messages={
  NO_VALID_DEPTH:'No valid depth images',
  INSUFFICIENT_OBSERVATIONS:'Awaiting distinct book observations',
  INSUFFICIENT_PRICE_OBSERVATIONS:'Not enough repeated observations at one price',
  INSUFFICIENT_COVERED_ELAPSED_TIME:'Levels have not remained visible long enough',
  NO_REPEATED_DISPLAYED_CONCENTRATION:'No repeatedly strong displayed depth',
  QUALIFIED_LEVELS_NOT_IN_CURRENT_BOOK:'Past observations left the visible depth window',
  CURRENT_PRICE_STREAK_TOO_SHORT:'Current level persistence or strength not established',
  CANDIDATES_EXPIRED_OR_OUTSIDE_WINDOW:'Earlier depth evidence expired',
  STALE_OR_UNVERIFIED_DEMO_DEPTH:'Recent verified depth unavailable'
 };
 return Object.prototype.hasOwnProperty.call(messages,reason)?messages[reason]:
   'No currently qualified depth observations';
}
export const ENGINE18_ANCHOR_MIN_MS=30000;
export const ENGINE18_LAST_SEEN_MS=180000;
export function advanceEngine18AnchoredObservations(previous,packet,now=Date.now()){
 const fresh=validateEngine18ChartZones(packet,now);
 const empty={asOf:null,tracked:{},zones:[]};
 if(!packet||packet.available!==true||!Number.isSafeInteger(packet.asOfUnixMs)||
    packet.asOfUnixMs>now||now-packet.asOfUnixMs>MAX_AGE_MS)return empty;
 const prior=previous||empty;
 const asOf=packet.asOfUnixMs;
 if(asOf===prior.asOf)return prior; // A repeated poll is not new evidence.
 const old=prior.tracked||{},tracked={},current=new Set();
 for(const z of fresh){
  const key=z.side+":"+z.price;
  current.add(key);
  const earlier=old[key];
  // A gap resets accumulation, but previously qualified price history remains
  // only as an explicitly historical observation until its expiry.
  const continuous=earlier && asOf-earlier.lastSeenMs>=0 &&
    asOf-earlier.lastSeenMs<=15000;
  const firstSeenMs=continuous?earlier.firstSeenMs:asOf;
  const count=continuous?earlier.count+1:1;
  const backendQualified=z.coverageState==="IN_COVERAGE"&&
    z.observedInImages>=3&&
    z.observedPersistenceMs>=ENGINE18_ANCHOR_MIN_MS;
  const qualified=!!earlier?.qualified||backendQualified||
    (count>=3&&asOf-firstSeenMs>=ENGINE18_ANCHOR_MIN_MS);
  tracked[key]={...z,firstSeenMs,count,lastSeenMs:asOf,qualified,
    status:"OBSERVED",anchorAtMs:earlier?.anchorAtMs||(qualified?asOf:null)};
 }
 for(const [key,z] of Object.entries(old)){
  if(current.has(key)||!z.qualified||!Number.isSafeInteger(z.lastSeenMs))continue;
  if(asOf-z.lastSeenMs>=0 && asOf-z.lastSeenMs<=ENGINE18_LAST_SEEN_MS){
   tracked[key]={...z,status:"LAST_SEEN"}; // Never claim still resting.
  }
 }
 // Carry previously displayed anchor prices in their original order; never
 // replace them with a stronger level as the current market moves.
 const selected=[];
 const take=z=>{
  if(!z?.qualified)return;
  if(selected.filter(x=>x.side===z.side).length>=2)return;
  if(!selected.some(x=>x.side===z.side&&x.price===z.price))selected.push(z);
 };
 for(const z of prior.zones||[])take(tracked[z.side+":"+z.price]);
 const newAnchors=Object.values(tracked).filter(z=>z.qualified)
  .sort((a,b)=>(b.visibleContracts-a.visibleContracts)||
    a.anchorAtMs-b.anchorAtMs);
 for(const z of newAnchors)take(z);
 return {asOf,tracked,zones:selected};
}

export default function Engine18LiquidityZonesOverlay({visible=false,chart=null,priceSeries=null,symbol="ES"}){
  const [packet,setPacket]=useState(null);
  const [stable,setStable]=useState({zones:[],tracked:{},asOf:null});
  const stableRef=useRef({zones:[],tracked:{},asOf:null});
  const [status,setStatus]=useState("WAITING");
  const canvasRef=useRef(null);
  const drawRef=useRef(null);
  const packetRef=useRef(null);
  packetRef.current=stable.zones;
  // Poll only while the owner has explicitly enabled this experimental layer.
  useEffect(()=>{
    if(!visible||symbol!=="ES"){setPacket(null);setStable({zones:[],tracked:{},asOf:null});
      stableRef.current={zones:[],tracked:{},asOf:null};setStatus("OFF");return;}
    let cancelled=false;
    const update=async()=>{
      try{
        const response=await fetch(FEED,{cache:"no-store"});
        if(!response.ok)throw Error("FEED_UNAVAILABLE");
        const next=await response.json();
        if(cancelled)return;
        setPacket(next);
        const updated=advanceEngine18AnchoredObservations(stableRef.current,next);
        stableRef.current=updated;setStable(updated);
        setStatus(next?.available===true?"PRICE-ANCHORED OBSERVATIONS":"AWAITING VALID DEPTH");
      }catch{
        if(!cancelled){setPacket(null);stableRef.current={zones:[],seen:{},asOf:null};
          setStable(stableRef.current);setStatus("FEED NOT AUTHORIZED / UNAVAILABLE");}
      }
    };
    update();const timer=setInterval(update,5000);
    return()=>{cancelled=true;clearInterval(timer);};
  },[visible,symbol]);
  const zones=stable.zones;
  useEffect(()=>{drawRef.current?.();},[stable,visible]);
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
      // Bold, readily visible research guides. Price labels live inside
      // chart plot, not on top of the right-axis price ticks.
      const active=packetRef.current||[];
      const occupied=[];
      for(const z of active){
        const y=priceSeries.priceToCoordinate(z.price);
        if(!Number.isFinite(y)||y<24||y>rect.height-26)continue;
        if(occupied.some(prev=>Math.abs(prev-y)<12))continue;
        occupied.push(y);
        const buy=z.side==="BID";
        const color=buy?"#4ade80":"#fb7185";
        ctx.strokeStyle=z.status==="LAST_SEEN"?"#94a3b8":color;
        ctx.globalAlpha=z.status==="LAST_SEEN"?.6:.97;
        ctx.lineWidth=z.status==="LAST_SEEN"?1.5:3;
        ctx.setLineDash(z.status==="LAST_SEEN"?[3,9]:[13,7]);ctx.beginPath();
        ctx.moveTo(0,y);ctx.lineTo(rect.width-10,y);ctx.stroke();
        ctx.setLineDash([]);ctx.globalAlpha=1;
        // Opaque price markers, consistently inside the plot rather than
        // cramped against the exchange price scale.
        const label=z.status==="LAST_SEEN"
          ?"LAST SEEN "+z.price.toFixed(2)+" · NOT CURRENT"
          :(buy?"BID ":"ASK ")+z.price.toFixed(2)+" · "+z.visibleContracts+" ct";
        ctx.font="800 13px system-ui";
        const width=Math.ceil(ctx.measureText(label).width)+20;
        const x=Math.max(8,Math.min(rect.width-width-20,rect.width-width-65));
        const labelY=Math.max(5,Math.min(rect.height-25,y-26));
        ctx.fillStyle="rgba(9,15,27,.98)";
        ctx.fillRect(x,labelY,width,23);
        ctx.strokeStyle=z.status==="LAST_SEEN"?"#94a3b8":color;ctx.lineWidth=2;
        ctx.strokeRect(x+1,labelY+1,width-2,21);
        ctx.fillStyle=z.status==="LAST_SEEN"?"#cbd5e1":color;
        ctx.textAlign="left";ctx.textBaseline="middle";
        ctx.fillText(label,x+10,labelY+11.5);
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
    style={{position:"absolute",top:14,left:70,zIndex:110,
      color:"#e2e8f0",background:"rgba(10,18,31,.94)",border:"1px solid #475569",
      borderRadius:8,padding:"12px 14px",fontSize:14,pointerEvents:"none",
      width:270,maxWidth:"calc(100% - 145px)",boxShadow:"0 4px 14px rgba(0,0,0,.4)"}}>
    <div style={{fontWeight:800,color:"#fbbf24",letterSpacing:".3px"}}>
      E18 OBSERVED DEPTH · MAX 2 BID / 2 ASK
    </div>
    <div style={{color:"#94a3b8",marginTop:3,marginBottom:5}}>
      {status} · Research only · 30s observation gate
    </div>
    {zones.length===0?<div style={{color:"#cbd5e1"}}>{describeEngine18NoCandidate(packet)}</div>:
      zones.map(z=><div key={z.side+":"+z.price}
        style={{display:"flex",justifyContent:"space-between",alignItems:"center",
          gap:9,padding:"6px 0",borderTop:"1px solid rgba(148,163,184,.25)",
          fontVariantNumeric:"tabular-nums"}}>
        <span style={{color:z.status==="LAST_SEEN"?"#94a3b8":
          z.side==="BID"?"#34d399":"#fb7185",fontWeight:800}}>
          {z.status==="LAST_SEEN"?"LAST SEEN":z.side}
        </span>
        <span style={{color:"#f8fafc"}}>{z.price.toFixed(2)}</span>
        <span style={{color:"#cbd5e1"}}>{z.status==="LAST_SEEN"?"UNVERIFIED":z.visibleContracts+" ct"}</span>
      </div>)}
    <div style={{color:"#94a3b8",fontSize:10,marginTop:5}}>
      Demo MBP-10 · Last seen ≠ currently resting · No trade signals
    </div>
  </div>;
}
