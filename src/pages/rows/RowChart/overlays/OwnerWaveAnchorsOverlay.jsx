import { useEffect, useRef } from "react";
import { validatedEngine22WorkingNodeAnchors, currentEngine22DegreeAnchors } from "../engine22WorkingNodeReader";
import {waveNodeDisplayStyle} from "../waveNodePresentation";
import { primaryDisplayCandleOpen } from "../primaryDisplayCandleMapping";
import { checkedDisplayCandleOpen } from "../intermediateMinorReview";
import {assessOwnerNodeAgainstLoadedCandle} from "../ownerNodeCandleAlignment";

// One selected degree at a time, all from the current Engine22 publisher.
export default function OwnerWaveAnchorsOverlay({
  visible=true, chart, priceSeries, degree="PRIMARY", stage="OFF", timeframe="1d",
  visibleWaveDegrees=[],
  sourceBars=[], priceBars=[], pagedCandleOpenAt=null, workingNodes=null,
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
  // Preserve Engine11's audited Primary opens when they match the source
  // event; otherwise use only a genuine currently loaded source candle.
  const candleOpenForNode=a=>{
    const primaryVerified=primaryOnly&&["1d","4h"].includes(timeframe)
      ? primaryDisplayCandleOpen(a,timeframe):null;
    if(Number.isFinite(primaryVerified))return primaryVerified;
    return typeof pagedCandleOpenAt==="function"
      ? pagedCandleOpenAt(a.timeSec)
      : checkedDisplayCandleOpen(a,timeframe,sourceBars);
  };
  const mappedNodeCount=activeNodes.filter(a=>Number.isFinite(candleOpenForNode(a))).length;
  // This is an acceptance diagnostic, not a source for chart pivots.
  // A price outside the bar must be reported, never silently snapped.
  const candleAlignment=activeNodes.reduce((out,a)=>{
    const mapped=candleOpenForNode(a);
    if(!Number.isFinite(mapped))return out;
    const check=assessOwnerNodeAgainstLoadedCandle(a,timeframe,priceBars,mapped);
    if(check==="PRICE_WITHIN_CANDLE")out.priceWithin++;
    else if(check==="PRICE_OUTSIDE_CANDLE")out.priceOutside++;
    else out.priceUnavailable++;
    return out;
  },{priceWithin:0,priceOutside:0,priceUnavailable:0});

  // Keep the per-degree loaded-candle count in the Indicators panel.
  // This is presentation status only; it does not change/source candles.
  useEffect(()=>{
    onNodeStatusChange?.({
      stage:visible?stage:"OFF",mapped:mappedNodeCount,
      total:activeNodes.length,timeframe,
      priceWithin:candleAlignment.priceWithin,
      priceOutside:candleAlignment.priceOutside,
      priceUnavailable:candleAlignment.priceUnavailable,
      sourceAvailable:dynamicSourceAvailable,
      sourceKind:"ENGINE22",
    });
  },[stage,visible,mappedNodeCount,activeNodes.length,timeframe,onNodeStatusChange,
    candleAlignment.priceWithin,candleAlignment.priceOutside,
    candleAlignment.priceUnavailable,dynamicSourceAvailable]);

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
        const mapped=candleOpenForNode(a);
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
        // Two degrees can own the exact same pivot. Keep both source anchors,
        // and give their labels/marker outlines separate presentation lanes.
        const counterpart=(microOnly||submicroOnly)
          ?currentEngine22DegreeAnchors(workingNodes,microOnly?"submicro":"micro")
          :[];
        const sharedPivot=counterpart.some(other=>
          other.timeSec===a.timeSec&&other.price===a.price);
        const node={a,x,y,priceY,anchorIndex,color,classification,labels:[a.label],outOfView,sharedPivot};
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
          ctx.arc(p.x,p.y,activeStyle.markerRadius+
            (p.sharedPivot&&submicroOnly?5:0),0,Math.PI*2);
          // Hollow markers preserve unverified owner research semantics.
          ctx.stroke();
        }
      }

      // Compute the SAME global layout independently on each degree canvas.
      // Otherwise every canvas only sees its own text and overlapping labels
      // from Minor, Micro and Submicro remain invisible to collision checks.
      // Never move owner-approved source pivots; move labels with leader lines.
      const candidateStages=["PRIMARY","INTERMEDIATE","MINOR","MINUTE","SUBMINUTE","MICRO","SUBMICRO"]
        .filter(d=>visibleWaveDegrees.includes(d));
      const candidates=[];
      for(const degreeStage of candidateStages){
        const style=waveNodeDisplayStyle(nodeStyles,degreeStage);
        if(!style.showLabels)continue;
        const type=degreeStage.toLowerCase();
        const nodes=currentEngine22DegreeAnchors(workingNodes,type);
        const samePoint=new Map();
        for(const a of nodes){
          const audited=type==="primary"&&["1d","4h"].includes(timeframe)
            ?primaryDisplayCandleOpen(a,timeframe):null;
          const mapped=Number.isFinite(audited)?audited:
            (typeof pagedCandleOpenAt==="function"?pagedCandleOpenAt(a.timeSec):
              checkedDisplayCandleOpen(a,timeframe,sourceBars));
          if(!Number.isFinite(mapped))continue;
          const x=chart.timeScale().timeToCoordinate(mapped);
          const priceY=priceSeries.priceToCoordinate(a.price);
          if(!Number.isFinite(x)||x<0||x>rect.width)continue;
          const off=!Number.isFinite(priceY)||priceY<14||priceY>rect.height-20;
          const y=off?18:priceY;
          const key=degreeStage+":"+a.timeSec+":"+a.price;
          const existing=samePoint.get(key);
          if(existing){existing.labels.push(a.label);continue;}
          const item={key,degreeStage,a,x,y,labels:[a.label],off,style};
          samePoint.set(key,item);
          candidates.push(item);
        }
      }
      // Canonical order is identical for all overlay canvases, independent
      // of React mount order, paint order, or incoming packet node order.
      candidates.sort((a,b)=>a.x-b.x||a.y-b.y||
        a.degreeStage.localeCompare(b.degreeStage)||a.key.localeCompare(b.key));
      const placed=[];
      const labelBoxes=new Map();
      for(const c of candidates){
        const font=c.style.labelFontPx;
        const isResearch=["MINOR","MINUTE","SUBMINUTE","MICRO","SUBMICRO"].includes(c.degreeStage);
        const label=c.degreeStage+" "+c.labels.join(" / ")+" · "+c.a.price.toFixed(2)+
          (c.off?" [PRICE OFF SCALE]":isResearch?" [RESEARCH]":" [OWNER REVIEW]");
        ctx.font="600 "+font+"px system-ui";
        const w=ctx.measureText(label).width+12;
        const h=font+5;
        let chosen=null;
        // Search alternating vertical and horizontal lanes, prioritizing
        // nearby labels while allowing dense degree clusters to spread out.
        for(let ring=0;ring<=24&&!chosen;ring++){
          const offsets=ring===0?[[0,-12]]:
            [[0,-12-ring*(h+4)],[0,ring*(h+4)+h],
             [-ring*(w*.42+8),-12],[ring*(w*.42+8),-12],
             [-ring*(w*.42+8),ring*(h+4)+h],
             [ring*(w*.42+8),ring*(h+4)+h]];
          for(const [dx,dy] of offsets){
            const x=Math.max(w/2+3,Math.min(rect.width-w/2-3,c.x+dx));
            const y=Math.max(h+3,Math.min(rect.height-4,c.y+dy));
            const box={left:x-w/2,right:x+w/2,top:y-h,bottom:y};
            if(box.left<0||box.right>rect.width)continue;
            if(placed.some(p=>box.left<p.right&&box.right>p.left&&
                 box.top<p.bottom&&box.bottom>p.top))continue;
            chosen={x,y,box,label,color:c.style.color};
            break;
          }
        }
        // Saturated viewport: hide the label rather than overlap another
        // degree; leave its exact point marker and connecting line visible.
        if(chosen){placed.push(chosen.box);labelBoxes.set(c.key,chosen);}
      }
      if(activeStyle.showLabels){
        for(const p of plotted){
          const key=stage+":"+p.a.timeSec+":"+p.a.price;
          const label=labelBoxes.get(key);
          if(!label)continue;
          const font=activeStyle.labelFontPx;
          ctx.font="600 "+font+"px system-ui";
          ctx.textAlign="center";
          ctx.textBaseline="bottom";
          if(Math.abs(label.x-p.x)>5||Math.abs(label.y-(p.y-12))>5){
            ctx.strokeStyle=p.color;
            ctx.lineWidth=1;
            ctx.beginPath();
            ctx.moveTo(p.x,p.y-6);
            ctx.lineTo(label.x,label.y-font-2);
            ctx.stroke();
          }
          ctx.fillStyle=p.color;
          ctx.fillText(label.label,label.x,label.y);
        }
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
    timeframe,sourceBars,pagedCandleOpenAt,workingNodes,visibleWaveDegrees,nodeStyles,activeStyle.color,
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
