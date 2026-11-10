import { useEffect, useRef } from "react";
import { validatedEngine22WorkingNodeAnchors, currentEngine22DegreeAnchors } from "../engine22WorkingNodeReader";
import {waveNodeDisplayStyle} from "../waveNodePresentation";
import { primaryDisplayCandleOpen } from "../primaryDisplayCandleMapping";
import { checkedDisplayCandleOpen } from "../intermediateMinorReview";

// One selected degree at a time, all from the current Engine22 publisher.
export default function OwnerWaveAnchorsOverlay({
  visible=true, chart, priceSeries, degree="PRIMARY", stage="OFF", timeframe="1d",
  sourceBars=[], pagedCandleOpenAt=null, workingNodes=null,
  nodeStyles={}, onNodeStatusChange=null
}){
  const canvasRef=useRef(null);
  const priorStageRef=useRef(stage);
  const activeStyle=waveNodeDisplayStyle(nodeStyles,stage);
  const primaryOnly=degree==="PRIMARY"&&stage==="PRIMARY";
  const intermediateOnly=stage==="INTERMEDIATE";
  const minorOnly=stage==="MINOR";
  const minuteOnly=stage==="MINUTE";
  const subminuteOnly=stage==="SUBMINUTE";
  const microOnly=stage==="MICRO";
  const submicroOnly=stage==="SUBMICRO";
  const stageEnabled=primaryOnly||intermediateOnly||minorOnly||
    minuteOnly||subminuteOnly||microOnly||submicroOnly;
  // All seven chart degrees now consume the same Engine22 Strategy-card feed.
  // Missing/invalid degree publications fail closed; archived sheet coordinates
  // never masquerade as current nodes. Release only with seven-degree backend.
  const selectedDegree=stageEnabled?stage.toLowerCase():null;
  const dynamicSourceAvailable=selectedDegree
    ? validatedEngine22WorkingNodeAnchors(workingNodes,selectedDegree)!==null
    : true;
  const activeNodes=selectedDegree
    ? currentEngine22DegreeAnchors(workingNodes,selectedDegree)
    : [];
  const mappedNodeCount=activeNodes.filter(a=>Number.isFinite(
    primaryOnly&&["1d","4h"].includes(timeframe)
      ? primaryDisplayCandleOpen(a,timeframe)
      : typeof pagedCandleOpenAt==="function"
        ? pagedCandleOpenAt(a.timeSec)
        : checkedDisplayCandleOpen(a,timeframe,sourceBars)
  )).length;

  // Keep the per-degree loaded-candle count in the Indicators panel.
  // This is presentation status only; it does not change/source candles.
  useEffect(()=>{
    onNodeStatusChange?.({
      stage:visible?stage:"OFF",mapped:mappedNodeCount,
      total:activeNodes.length,timeframe,
      sourceAvailable:dynamicSourceAvailable,
      sourceKind:"ENGINE22",
    });
  },[stage,visible,mappedNodeCount,activeNodes.length,timeframe,onNodeStatusChange,
    dynamicSourceAvailable]);

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
      for(const [anchorIndex,a] of anchors.entries()){
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

        const color=activeStyle.color;
        // Exact source position is always retained. Marker visibility is
        // only a drawing preference; it never creates another node.
        const node={a,x,y,priceY,anchorIndex,color,classification,labels:[a.label],outOfView};
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

      // Optional owner-requested wave connectors. Connect ONLY adjacent
      // valid source anchors when both corresponding genuine candle opens
      // are loaded; never bridge missing nodes or invent projection points.
      if(activeStyle.showLines){
        const ordered=[...plotted].sort((a,b)=>a.anchorIndex-b.anchorIndex);
        ctx.setLineDash([]);
        ctx.strokeStyle=activeStyle.lineColor;
        ctx.lineWidth=activeStyle.lineWidth;
        for(let i=1;i<ordered.length;i++){
          const prev=ordered[i-1],next=ordered[i];
          if(next.anchorIndex!==prev.anchorIndex+1||
             prev.outOfView||next.outOfView)continue;
          ctx.beginPath();
          ctx.moveTo(prev.x,prev.priceY);
          ctx.lineTo(next.x,next.priceY);
          ctx.stroke();
        }
      }

      if(activeStyle.showDots){
        ctx.strokeStyle=activeStyle.color;
        ctx.lineWidth=2;
        for(const p of plotted){
          ctx.beginPath();
          ctx.arc(p.x,p.y,activeStyle.markerRadius,0,Math.PI*2);
          // Hollow markers preserve unverified owner research semantics.
          ctx.stroke();
        }
      }

      // Collision avoidance moves LABELS only. Exact anchor dots never move.
      ctx.font=`600 ${activeStyle.labelFontPx}px system-ui`;
      ctx.textAlign="center";
      ctx.textBaseline="bottom";
      const placed=[];
      const LABEL_H=activeStyle.labelFontPx+4, PAD_X=6, STEP=LABEL_H, MAX_STEPS=10;
      if(activeStyle.showLabels)for(const p of plotted.sort((m,n)=>m.y-n.y||m.x-n.x)){
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
    timeframe,sourceBars,pagedCandleOpenAt,workingNodes,activeStyle.color,
    activeStyle.lineColor,activeStyle.showDots,activeStyle.showLines,
    activeStyle.showLabels,activeStyle.markerRadius,activeStyle.labelFontPx,
    activeStyle.lineWidth]);

  // The original degree selection used to focus the relevant source
  // period. Preserve that behavior after moving controls to Indicators.
  const focusStage=next=>{
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
        const selected=currentEngine22DegreeAnchors(workingNodes,next.toLowerCase());
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

  useEffect(()=>{
    if(priorStageRef.current===stage)return;
    priorStageRef.current=stage;
    if(visible&&stage!=="OFF")focusStage(stage);
    // Focus only when degree changes, never when LIVE candles update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[stage,visible]);

  return null;
}
