// Engine 2E — read-only display of Engine 22 owner-authorized Fib levels.
// No Fibonacci math, no wave transitions, no execution authority.
export default function Engine22AuthorizedFibOverlay({
  chart, priceSeries, chartContainer, enabled=false, degree="minor",
  authorizedWorkingStructure=null, style={}
}){
  if(!chart||!priceSeries||!chartContainer)return {seed(){},update(){},destroy(){}};
  let canvas=null,raf=null,disposed=false;
  const ts=chart.timeScale();
  const color=style.color||"#22c55e";
  const fontPx=Number.isFinite(style.fontPx)?style.fontPx:16;
  const lineWidth=Number.isFinite(style.lineWidth)?style.lineWidth:3;

  function levels(){
    const packet=authorizedWorkingStructure;
    if(packet?.schema!=="engine22.authorizedWorkingStructure.v1"||
       packet?.mode!=="READ_ONLY"||packet?.noExecution!==true)return [];
    const d=packet?.degrees?.[String(degree).toLowerCase()];
    if(d?.available!==true||!Array.isArray(d?.levels))return [];
    return d.levels.map((x,i)=>{
      const price=Number(x?.price ?? x?.value ?? x?.level);
      const label=String(x?.label ?? x?.ratio ?? x?.name ?? x?.id ?? `L${i+1}`);
      return {price,label,status:x?.status??null};
    }).filter(x=>Number.isFinite(x.price));
  }
  function ensure(){
    if(canvas)return canvas;
    canvas=document.createElement("canvas");
    canvas.style.position="absolute";canvas.style.inset="0";
    canvas.style.width="100%";canvas.style.height="100%";
    canvas.style.pointerEvents="none";canvas.style.zIndex="80";
    canvas.setAttribute("data-engine22-authorized-fib",String(degree));
    chartContainer.appendChild(canvas);return canvas;
  }
  function draw(){
    if(disposed)return;
    const ls=enabled?levels():[];
    if(!ls.length){try{canvas?.remove();}catch{} canvas=null;return;}
    const c=ensure(),rect=chartContainer.getBoundingClientRect(),dpr=window.devicePixelRatio||1;
    c.width=Math.max(1,Math.floor(rect.width*dpr));c.height=Math.max(1,Math.floor(rect.height*dpr));
    const ctx=c.getContext("2d");ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,rect.width,rect.height);
    ctx.font=`700 ${fontPx}px system-ui`;ctx.textBaseline="middle";
    for(const l of ls){
      const y=priceSeries.priceToCoordinate(l.price);
      if(!Number.isFinite(y))continue;
      ctx.strokeStyle=color;ctx.lineWidth=lineWidth;ctx.setLineDash([12,8]);
      ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(rect.width,y);ctx.stroke();
      const text=`ENGINE 22 ${String(degree).toUpperCase()} ${l.label}  ${l.price.toFixed(2)}`;
      const w=ctx.measureText(text).width+18,x=Math.max(8,rect.width-w-85);
      ctx.fillStyle="rgba(0,0,0,.76)";ctx.fillRect(x,y-12,w,24);
      ctx.fillStyle=color;ctx.fillText(text,x+9,y);
    }
  }
  const schedule=()=>{if(raf)cancelAnimationFrame(raf);raf=requestAnimationFrame(draw);};
  const ro=new ResizeObserver(schedule);ro.observe(chartContainer);
  ts.subscribeVisibleTimeRangeChange(schedule);
  return {
    seed(){schedule();},update(){schedule();},
    destroy(){disposed=true;if(raf)cancelAnimationFrame(raf);try{ro.disconnect();}catch{}try{ts.unsubscribeVisibleTimeRangeChange(schedule);}catch{}try{canvas?.remove();}catch{}canvas=null;}
  };
}
