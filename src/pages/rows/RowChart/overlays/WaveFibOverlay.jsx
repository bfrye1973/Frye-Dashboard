// Engine 2B — read-only v1 chart renderer. No Elliott or Fibonacci calculations.
const API_BASE = (typeof window !== "undefined" && window.__API_BASE__) ||
  (typeof process !== "undefined" && process.env?.REACT_APP_API_BASE) ||
  "https://frye-market-backend-1.onrender.com";
const POLL_MS = 30000;
const PRICE = x => Number.isFinite(Number(x)) ? Number(x) : null;
const DEGREE_NAMES = ["primary", "intermediate", "minor", "minute", "micro"];
const cache = new Map();
function fetchOverlay(symbol) {
  const key = String(symbol || "ES").toUpperCase();
  let entry = cache.get(key);
  if (entry?.pending) return entry.pending;
  const headers = { accept: "application/json" };
  if (entry?.etag) headers["If-None-Match"] = entry.etag;
  const pending = fetch(`${String(API_BASE).replace(/\/+$/, "")}/api/v1/engine2/chart-overlays/v1?symbol=${encodeURIComponent(key)}`, {
    headers, cache: "no-cache",
  }).then(async response => {
    if (response.status === 304 && entry?.data) return entry.data;
    if (!response.ok) throw new Error(`ENGINE2_OVERLAY_HTTP_${response.status}`);
    const data = await response.json();
    if (data?.schemaVersion !== "engine2.chartOverlays.v1" || data?.symbol !== key || !data.degrees)
      throw new Error("INVALID_ENGINE2_OVERLAY_CONTRACT");
    cache.set(key, { data, etag: response.headers.get("ETag"), fetchedAt: Date.now() });
    return data;
  }).finally(() => {
    const current = cache.get(key);
    if (current?.pending === pending) cache.set(key, { ...current, pending: null });
  });
  cache.set(key, { ...(entry || {}), pending });
  return pending;
}
function timeSec(value) {
  if (typeof value === "number") return value > 1e12 ? Math.floor(value / 1000) : value;
  if (typeof value !== "string" || !value.trim()) return null;
  // Chart projection only: backend must ultimately publish verified UTC timestamps.
  const raw = value.trim();
  if (/^\d{10,13}$/.test(raw)) return timeSec(Number(raw));
  const iso = raw.includes("T") ? raw : raw.replace(" ", "T");
  const withZone = /(?:Z|[+-]\d\d:\d\d)$/.test(iso) ? iso : iso + "-07:00";
  const parsed = Date.parse(withZone);
  return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : null;
}
export default function WaveFibOverlay({chart, priceSeries, chartContainer, symbol="ES",
  degree="minute", enabled=false, style={}}) {
  if (!chart || !priceSeries || !chartContainer || !enabled) return {seed(){},update(){},destroy(){}};
  const selected = String(degree).toLowerCase();
  if (!DEGREE_NAMES.includes(selected)) return {seed(){},update(){},destroy(){}};
  let canvas, timer, raf, disposed=false, payload=null, bars=[];
  const ts=chart.timeScale();
  const color=style.color || "#ffd54a";
  const font=Math.max(11,Math.min(22,Number(style.fontPx)||14));
  const width=Math.max(1,Number(style.lineWidth)||2);
  function resize() {
    if (!canvas) return;
    const r=chartContainer.getBoundingClientRect(), dpr=window.devicePixelRatio||1;
    canvas.width=Math.max(1,Math.round(r.width*dpr));
    canvas.height=Math.max(1,Math.round(r.height*dpr));
  }
  function ensure() {
    if (canvas) return;
    canvas=document.createElement("canvas");
    canvas.dataset.engine2bDegree=selected;
    Object.assign(canvas.style,{position:"absolute",inset:"0",width:"100%",height:"100%",pointerEvents:"none",zIndex:"80"});
    chartContainer.appendChild(canvas);
    resize();
  }
  function draw() {
    if (disposed) return;
    const block=payload?.degrees?.[selected];
    if (!block) return;
    ensure();
    resize();
    const ctx=canvas.getContext("2d");
    if (!ctx) return;
    const dpr=window.devicePixelRatio||1, h=canvas.height/dpr, w=canvas.width/dpr;
    ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.font=`${font}px system-ui, sans-serif`;
    const label=(text,x,y,tint=color)=>{
      ctx.fillStyle="rgba(5,8,15,.83)";
      const textWidth=ctx.measureText(text).width;
      const px=Math.max(2,Math.min(w-textWidth-14,x));
      const py=Math.max(2,Math.min(h-24,y-14));
      ctx.fillRect(px,py,textWidth+12,22);
      ctx.fillStyle=tint;ctx.fillText(text,px+6,py+16);
    };
    if (!block.drawable) {
      label(`${selected.toUpperCase()} unavailable: ${block.reason || "NO_DATA"}`,8,26,"#fbbf24");
      return;
    }
    for (const line of block.lines || []) {
      const price=PRICE(line.price);
      if (price===null) continue;
      const y=priceSeries.priceToCoordinate(price);
      if (!Number.isFinite(y)) continue;
      if (y<0 || y>h) continue; // offscreen indicators come in later phase.
      ctx.strokeStyle=color;ctx.lineWidth=width;ctx.setLineDash(line.kind==="INVALIDATION"?[7,5]:[13,6]);
      ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();ctx.setLineDash([]);
      label(`${selected.toUpperCase()} ${line.label || line.key}: ${price.toFixed(2)}`,Math.max(4,w*.38),y);
    }
    const points=[];
    for (const mark of block.marks || []) {
      const p=PRICE(mark.price), t=timeSec(mark.time);
      if (p==null || t==null) continue;
      const nearest=bars.reduce((best,b)=>Math.abs(Number(b.time)-t)<Math.abs(Number(best)-t)?Number(b.time):best,t);
      const x=ts.timeToCoordinate(nearest), y=priceSeries.priceToCoordinate(p);
      if (!Number.isFinite(x)||!Number.isFinite(y)) continue;
      if (x<0 || x>w || y<0 || y>h) continue;
      points.push({x,y,t,name:mark.label,status:mark.status});
    }
    points.sort((a,b)=>a.t-b.t);
    if (points.length>1) {
      ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();
      points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();
    }
    for (const p of points) {
      ctx.strokeStyle=color;ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y,6,0,2*Math.PI);ctx.stroke();
      label(`${selected.toUpperCase()} ${p.name}${p.status?" ("+p.status+")":""}`,p.x+9,p.y-8);
    }
  }
  function schedule() {if(disposed)return;if(raf)cancelAnimationFrame(raf);raf=requestAnimationFrame(draw);}
  function refresh() {fetchOverlay(symbol).then(data=>{if(disposed)return;payload=data;schedule();}).catch(err=>{if(disposed)return;payload={degrees:{[selected]:{drawable:false,reason:err.message}}};schedule();});}
  function seed(nextBars) {bars=Array.isArray(nextBars)?nextBars:[];refresh();timer=setInterval(refresh,POLL_MS);}
  function update(bar) {if(bar?.time && (!bars.length||bar.time>bars[bars.length-1].time)) {bars.push(bar);if(bars.length>8000)bars=bars.slice(-8000);}schedule();}
  function onResize(){schedule();}
  window.addEventListener("resize",onResize);
  ts.subscribeVisibleTimeRangeChange(schedule);
  return {seed,update,destroy(){
    disposed=true;if(timer)clearInterval(timer);if(raf)cancelAnimationFrame(raf);
    window.removeEventListener("resize",onResize);
    try{ts.unsubscribeVisibleTimeRangeChange(schedule);}catch{}
    if(canvas)canvas.remove();canvas=null;payload=null;bars=[];
  }};
}
