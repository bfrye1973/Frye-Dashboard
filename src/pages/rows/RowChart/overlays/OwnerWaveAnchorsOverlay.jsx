import { useEffect, useRef } from "react";
import { ownerAnchorsForDegree } from "../ownerWaveAnchors";
import { primaryDisplayCandleOpen } from "../primaryDisplayCandleMapping";
import { validatedEngine22WorkingNodeAnchors } from "../engine22WorkingNodeReader";
import { INTERMEDIATE_REVIEW_ANCHORS, MINOR_REVIEW_ANCHORS,
  MINOR_W2_RESEARCH_LEVELS, MINUTE_REVIEW_ANCHORS,
  SUBMINUTE_REVIEW_ANCHORS, MICRO_REVIEW_ANCHORS,
  SUBMICRO_REVIEW_ANCHORS,
  checkedDisplayCandleOpen } from "../intermediateMinorReview";

const DEGREE_COLORS={
  submicro:"#f59e0b",micro:"#22c55e",subminute:"#38bdf8",minute:"#a78bfa",
  minor:"#f472b6",intermediate:"#fb7185",primary:"#facc15"
};

// Owner-directed staged review: only one selected degree visible at a time.
// Primary remains unchanged; Intermediate and Minor are explicitly selected.
export default function OwnerWaveAnchorsOverlay({
  visible=true, chart, priceSeries, degree="PRIMARY", stage="OFF", timeframe="1d",
  sourceBars=[], pagedCandleOpenAt=null, onStageChange, workingNodes=null
}){
  const canvasRef=useRef(null);
  const primaryOnly=degree==="PRIMARY"&&stage==="PRIMARY";
  const intermediateOnly=stage==="INTERMEDIATE";
  const minorOnly=stage==="MINOR";
  const minuteOnly=stage==="MINUTE";
  const subminuteOnly=stage==="SUBMINUTE";
  const microOnly=stage==="MICRO";
  const submicroOnly=stage==="SUBMICRO";
  const stageEnabled=primaryOnly||intermediateOnly||minorOnly||
    minuteOnly||subminuteOnly||microOnly||submicroOnly;
  // Only Micro and Submicro are in initial Engine22 automatic-source
  // acceptance. Other five stages stay unchanged until separately accepted.
  const microFromEngine22=validatedEngine22WorkingNodeAnchors(workingNodes,"micro");
  const submicroFromEngine22=validatedEngine22WorkingNodeAnchors(workingNodes,"submicro");
  const microStageNodes=microFromEngine22??MICRO_REVIEW_ANCHORS;
  const submicroStageNodes=submicroFromEngine22??SUBMICRO_REVIEW_ANCHORS;
  const activeNodes=primaryOnly?ownerAnchorsForDegree(degree):
    intermediateOnly?INTERMEDIATE_REVIEW_ANCHORS:
    minorOnly?MINOR_REVIEW_ANCHORS:
    minuteOnly?MINUTE_REVIEW_ANCHORS:
    subminuteOnly?SUBMINUTE_REVIEW_ANCHORS:
    microOnly?microStageNodes:
    submicroOnly?submicroStageNodes:[];
  const mappedNodeCount=activeNodes.filter(a=>Number.isFinite(
    primaryOnly&&["1d","4h"].includes(timeframe)
      ? primaryDisplayCandleOpen(a,timeframe)
      : typeof pagedCandleOpenAt==="function"
        ? pagedCandleOpenAt(a.timeSec)
        : checkedDisplayCandleOpen(a,timeframe,sourceBars)
  )).length;

  useEffect(()=>{
    if(!visible||!stageEnabled||!chart||!priceSeries)return;
    const host=chart.chartElement?.()?.parentElement || null;
    if(!host)return;

    const canvas=document.createElement("canvas");
    canvas.style.position="absolute";
    canvas.style.inset="0";
    canvas.style.pointerEvents="none";
    canvas.style.zIndex="45";
    host.appendChild(canvas);
    canvasRef.current=canvas;

    const anchors=activeNodes;

    function draw(){
      const rect=host.getBoundingClientRect();
      const dpr=window.devicePixelRatio||1;
      canvas.width=Math.max(1,Math.round(rect.width*dpr));
      canvas.height=Math.max(1,Math.round(rect.height*dpr));
      canvas.style.width=rect.width+"px";
      canvas.style.height=rect.height+"px";
      const ctx=canvas.getContext("2d");
      ctx.setTransform(dpr,0,0,dpr,0,0);
      ctx.clearRect(0,0,rect.width,rect.height);

      const plotted=[];
      const samePivot=new Map();
      for(const a of anchors){
        // X may use ONLY an opening timestamp actually in the chart's
        // source series. Primary has independently audited Daily/4H opens;
        // intraday uses the loaded authentic candle timestamps or pager.
        // Never extrapolate unseen old nodes or change owner event/price.
        const mapped=primaryOnly&&["1d","4h"].includes(timeframe)
          ? primaryDisplayCandleOpen(a,timeframe)
          : typeof pagedCandleOpenAt==="function"
            ? pagedCandleOpenAt(a.timeSec)
            : checkedDisplayCandleOpen(a,timeframe,sourceBars);
        if(!Number.isFinite(mapped))continue;
        const x=chart.timeScale().timeToCoordinate(mapped);
        const priceY=priceSeries.priceToCoordinate(a.price);
        if(!Number.isFinite(x)||x<0||x>rect.width)continue;
        // The five owner prices do not match the original 5m ES source.
        // If the exact owner price is outside the chart's visible scale,
        // show an edge indicator, NEVER a fabricated candle-price pivot.
        const outOfView=!Number.isFinite(priceY)||priceY<14||priceY>rect.height-20;
        const y=outOfView?18:priceY;

        const classification=primaryOnly?"UNVERIFIED PRICE BASIS":
          (a.classification==="OWNER RESEARCH"?"RESEARCH — UNCONFIRMED":"OWNER REVIEW");
        const key=`${a.degree}:${a.timeSec}:${a.price}:${classification}`;
        const existing=samePivot.get(key);
        if(existing){
          existing.labels.push(a.label);
          continue;
        }

        const color=DEGREE_COLORS[a.degree]||"#fbbf24";
        ctx.fillStyle=color;
        ctx.strokeStyle=color;
        ctx.lineWidth=2;
        ctx.beginPath();
        ctx.arc(x,y,5,0,Math.PI*2);
        // Always hollow: owner-provided price has NOT been validated
        // against the corresponding Engine11 unadjusted source OHLC.
        ctx.stroke();
        const node={a,x,y,color,classification,labels:[a.label],outOfView};
        plotted.push(node);
        samePivot.set(key,node);
      }
      for(const p of plotted){
        p.text=`${p.a.degree.toUpperCase()} ${p.labels.join(" / ")} · ${p.a.price.toFixed(2)}`+
          (p.outOfView?" [PRICE OFF SCALE]":
           p.a.classification?.startsWith("CONFLICT")?" [SHEET CONFLICT]":
           p.a.classification?.startsWith("PROVISIONAL")?" [PROVISIONAL]":
           minorOnly||minuteOnly||subminuteOnly||microOnly||submicroOnly?" [RESEARCH]":" [OWNER REVIEW]");
      }

      // Minor W2 research retracement prices. These are levels only:
      // no touch, no trade authority, no claim of a completed W2 pivot.
      if(minorOnly){
        ctx.strokeStyle="#f472b6"; ctx.fillStyle="#f472b6";
        ctx.lineWidth=1; ctx.setLineDash([3,5]);
        for(const level of MINOR_W2_RESEARCH_LEVELS){
          const yy=priceSeries.priceToCoordinate(level.price);
          if(!Number.isFinite(yy)||yy<20||yy>rect.height-20)continue;
          ctx.beginPath();ctx.moveTo(0,yy);ctx.lineTo(rect.width,yy);ctx.stroke();
          ctx.font="600 10px system-ui";
          ctx.textAlign="right";
          ctx.fillText("MINOR W2 "+level.ratio+" · "+level.price.toFixed(2)+" [UNVERIFIED]",
            Math.max(90,rect.width-12),yy-3);
        }
        ctx.setLineDash([]);
      }

      // Collision avoidance moves LABELS only. Exact anchor dots never move.
      ctx.font="600 12px system-ui";
      ctx.textAlign="center";
      ctx.textBaseline="bottom";
      const placed=[];
      const LABEL_H=16, PAD_X=6, STEP=16, MAX_STEPS=10;
      for(const p of plotted.sort((m,n)=>m.y-n.y||m.x-n.x)){
        const width=ctx.measureText(p.text).width+PAD_X*2;
        let labelY=Math.max(14,p.y-10);
        let box=null;
        for(let step=0;step<=MAX_STEPS;step++){
          const direction=step===0?0:(step%2?1:-1);
          const distance=Math.ceil(step/2)*STEP;
          const candidateY=Math.max(14,Math.min(rect.height-4,labelY+direction*distance));
          const candidate={
            left:p.x-width/2,right:p.x+width/2,
            top:candidateY-LABEL_H,bottom:candidateY
          };
          const overlaps=placed.some(q=>
            candidate.left<q.right && candidate.right>q.left &&
            candidate.top<q.bottom && candidate.bottom>q.top
          );
          if(!overlaps){labelY=candidateY;box=candidate;break;}
        }
        if(!box){
          box={left:p.x-width/2,right:p.x+width/2,top:labelY-LABEL_H,bottom:labelY};
        }
        placed.push(box);

        if(Math.abs(labelY-(p.y-10))>4){
          ctx.strokeStyle=p.color;
          ctx.lineWidth=1;
          ctx.beginPath();
          ctx.moveTo(p.x,p.y-6);
          ctx.lineTo(p.x,labelY-LABEL_H+2);
          ctx.stroke();
        }
        ctx.fillStyle=p.color;
        ctx.fillText(p.text,p.x,labelY);
      }
    }

    const ts=chart.timeScale();
    const redraw=()=>requestAnimationFrame(draw);
    ts.subscribeVisibleTimeRangeChange(redraw);
    ts.subscribeVisibleLogicalRangeChange(redraw);
    const ro=new ResizeObserver(redraw);
    ro.observe(host);
    draw();

    return()=>{
      try{ts.unsubscribeVisibleTimeRangeChange(redraw);}catch{}
      try{ts.unsubscribeVisibleLogicalRangeChange(redraw);}catch{}
      try{ro.disconnect();}catch{}
      try{canvas.remove();}catch{}
      canvasRef.current=null;
    };
  },[visible,stageEnabled,primaryOnly,intermediateOnly,minorOnly,
    minuteOnly,subminuteOnly,microOnly,submicroOnly,chart,priceSeries,degree,
    timeframe,sourceBars,pagedCandleOpenAt,workingNodes]);

  if(!visible)return null;

  const showStage=next=>{
    onStageChange?.(next);
    if(chart){
      const ranges={
        PRIMARY:["2020-03-20","2025-05-05"],
        INTERMEDIATE:["2025-03-25","2026-04-15"],
        MINOR:["2026-03-15","2026-11-12"],
        MINUTE:["2026-08-01","2026-11-12"],
        SUBMINUTE:["2026-10-01","2026-11-12"],
        MICRO:["2026-10-15","2026-11-12"],
        SUBMICRO:["2026-11-03","2026-11-12"],
      };
      const range=ranges[next];
      if(range&&["1d","4h"].includes(timeframe)){
        chart.timeScale().setVisibleRange({
          from:Date.parse(range[0]+"T00:00:00Z")/1000,
          to:Date.parse(range[1]+"T00:00:00Z")/1000,
        });
      } else if(range) {
        // For intraday, zoom ONLY to candles already loaded. The 5m/10m
        // pager and regular 1m data often do not contain years-old anchors.
        // Do not force a fake historical x-axis or alter LIVE chart loading.
        const selected=next==="PRIMARY"?ownerAnchorsForDegree("PRIMARY"):
          next==="INTERMEDIATE"?INTERMEDIATE_REVIEW_ANCHORS:
          next==="MINOR"?MINOR_REVIEW_ANCHORS:
          next==="MINUTE"?MINUTE_REVIEW_ANCHORS:
          next==="SUBMINUTE"?SUBMINUTE_REVIEW_ANCHORS:
          next==="MICRO"?microStageNodes:
          next==="SUBMICRO"?submicroStageNodes:[];
        const mapped=selected.map(a=>typeof pagedCandleOpenAt==="function"
          ? pagedCandleOpenAt(a.timeSec)
          : checkedDisplayCandleOpen(a,timeframe,sourceBars))
          .filter(t=>Number.isFinite(t)).sort((a,b)=>a-b);
        if(mapped.length) {
          const seconds=({"1m":60,"5m":300,"10m":600,"15m":900,"30m":1800,"1h":3600})[timeframe]||60;
          chart.timeScale().setVisibleRange({
            from:mapped[0]-seconds*20,
            to:mapped[mapped.length-1]+seconds*20,
          });
        }
      }
    }
  };

  return (
    <div
      aria-label="Elliott Wave nodes - one degree at a time"
      style={{
        position:"absolute",top:10,right:80,zIndex:95,
        display:"flex",alignItems:"center",gap:6,
        padding:"5px 8px",background:"rgba(8,12,24,.92)",
        border:"1px solid #334155",borderRadius:6,
        color:"#e5e7eb",fontSize:11
      }}
    >
      <span style={{fontWeight:800,marginRight:3}}>Wave nodes · 1 degree at a time</span>
      <button type="button" aria-pressed={stage==="OFF"}
        onClick={()=>showStage("OFF")}
        style={{
          background:stage==="OFF"?"#facc15":"#111827",
          color:stage==="OFF"?"#111827":"#d1d5db",
          border:"1px solid #64748b",borderRadius:4,
          padding:"3px 9px",cursor:"pointer"
        }}>Off</button>
      <button type="button" aria-pressed={primaryOnly}
        onClick={()=>showStage("PRIMARY")}
        style={{
          background:primaryOnly?"#facc15":"#111827",
          color:primaryOnly?"#111827":"#d1d5db",
          border:"1px solid #64748b",borderRadius:4,
          padding:"3px 9px",cursor:"pointer"
        }}>Primary (5)</button>
      {[
        ["INTERMEDIATE",intermediateOnly,"Intermediate (3)"],
        ["MINOR",minorOnly,"Minor (2 + Fib)"],
        ["MINUTE",minuteOnly,"Minute (4)"],
        ["SUBMINUTE",subminuteOnly,"Subminute (3)"],
        ["MICRO",microOnly,"Micro (3)"],
        ["SUBMICRO",submicroOnly,"Submicro (3)"],
      ].map(([next,pressed,text])=>(
        <button key={next} type="button" aria-pressed={pressed}
          onClick={()=>showStage(next)}
          style={{
            background:pressed?"#facc15":"#111827",
            color:pressed?"#111827":"#d1d5db",
            border:"1px solid #64748b",borderRadius:4,
            padding:"3px 9px",cursor:"pointer"
          }}>{text}</button>
      ))}
      <span style={{fontSize:10,opacity:.8}}>
        {minorOnly?"Minor W2 unconfirmed · Fib levels RESEARCH":
         minuteOnly?"Minute C low provisional · ABC research":
         subminuteOnly?"Subminute C ending UNKNOWN":
         microOnly?(microFromEngine22?"Micro nodes from Engine22 Strategies · research only":
           "Micro A High conflicts with sheet note · W2 unconfirmed"):
         submicroOnly?(submicroFromEngine22?"Submicro nodes from Engine22 Strategies · research only":
           "Submicro W1/W2 research · W3 blank · source times require real candles"):
         intermediateOnly?"Intermediate W3 active · historical owner review":
         "Other degrees hidden · historical source not modified"}
        {stageEnabled?` · ${mappedNodeCount}/${activeNodes.length} nodes in loaded ${timeframe} history`:""}
        {stageEnabled&&mappedNodeCount===0?
          (submicroOnly?" · No matching Submicro candles loaded":" · Older source candles required"):""}
      </span>
    </div>
  );
}
