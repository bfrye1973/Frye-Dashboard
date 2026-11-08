import { useEffect, useRef, useState } from "react";
import { ownerAnchorsForDegree } from "../ownerWaveAnchors";

const DEGREE_COLORS={
  submicro:"#f59e0b",micro:"#22c55e",subminute:"#38bdf8",minute:"#a78bfa",
  minor:"#f472b6",intermediate:"#fb7185",primary:"#facc15"
};

// Owner-directed staged review: clear all anchor dots by default.
// Stage 1 permits ONLY Primary. Other degrees stay stored but unmounted.
export default function OwnerWaveAnchorsOverlay({
  visible=true, chart, priceSeries, degree="PRIMARY"
}){
  const canvasRef=useRef(null);
  const [stage,setStage]=useState("OFF");
  const primaryOnly=degree==="PRIMARY"&&stage==="PRIMARY";

  useEffect(()=>{
    if(!visible||!primaryOnly||!chart||!priceSeries)return;
    const host=chart.chartElement?.()?.parentElement || null;
    if(!host)return;

    const canvas=document.createElement("canvas");
    canvas.style.position="absolute";
    canvas.style.inset="0";
    canvas.style.pointerEvents="none";
    canvas.style.zIndex="45";
    host.appendChild(canvas);
    canvasRef.current=canvas;

    const anchors=ownerAnchorsForDegree(degree);

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
        // Use only the exact owner timestamp; never snap to a nearby candle.
        const x=chart.timeScale().timeToCoordinate(a.timeSec);
        const y=priceSeries.priceToCoordinate(a.price);
        if(!Number.isFinite(x)||!Number.isFinite(y))continue;
        if(x<0||x>rect.width||y<0||y>rect.height)continue;

        const classification=a.classification==="RESEARCH"?"RESEARCH":"HISTORICAL";
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
        if(classification==="RESEARCH"){
          // Hollow marker means owner-provided research, NOT approved count.
          ctx.stroke();
        }else{
          ctx.fill();
          ctx.strokeStyle="#0b0b14";
          ctx.stroke();
        }

        const node={a,x,y,color,classification,labels:[a.label]};
        plotted.push(node);
        samePivot.set(key,node);
      }
      for(const p of plotted){
        p.text=`${p.a.degree.toUpperCase()} ${p.labels.join(" / ")} @ ${p.a.price.toFixed(2)}`+
          (p.classification==="RESEARCH"?" [RESEARCH]":"");
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
  },[visible,primaryOnly,chart,priceSeries,degree]);

  if(!visible)return null;

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
      <span style={{fontWeight:800,marginRight:3}}>Wave nodes · 1/7</span>
      <button type="button" aria-pressed={!primaryOnly}
        onClick={()=>setStage("OFF")}
        style={{
          background:!primaryOnly?"#facc15":"#111827",
          color:!primaryOnly?"#111827":"#d1d5db",
          border:"1px solid #64748b",borderRadius:4,
          padding:"3px 9px",cursor:"pointer"
        }}>Off</button>
      <button type="button" aria-pressed={primaryOnly}
        onClick={()=>setStage("PRIMARY")}
        style={{
          background:primaryOnly?"#facc15":"#111827",
          color:primaryOnly?"#111827":"#d1d5db",
          border:"1px solid #64748b",borderRadius:4,
          padding:"3px 9px",cursor:"pointer"
        }}>Primary (5)</button>
      <span style={{fontSize:10,opacity:.8}}>Other 6 degrees hidden</span>
    </div>
  );
}
