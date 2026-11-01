/* Engine 2D: Engine22-only Fib and anchor canvas renderer.
 * No Fibonacci computation; no historical hindsight; fails closed on uncertified basis.
 */
(function(root){
'use strict';
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const parseTime=x=>typeof x==='string'&&Number.isFinite(Date.parse(x))?Date.parse(x):NaN;
const VALID=['submicro','micro','subminute','minute','minor','intermediate','primary'];
function collect(packet,prefs,degree){
 const out=[];
 for(const d of VALID){
  if(degree!=='ALL'&&degree.toLowerCase()!==d)continue;
  const item=packet.degrees?.[d],setting=prefs?.[d];
  if(!item?.available||setting?.visible===false)continue;
  const groups=[];
  if(setting?.fibs!==false)for(const g of item.fibGroups||[])if(setting?.fibGroups?.[g.groupId]!==false)groups.push(g);
  for(const s of item.scenarios||[]){
   if(setting?.scenarios?.[s.scenarioId]===false)continue;
   if(setting?.fibs!==false)for(const g of s.fibGroups||[])groups.push({...g,groupId:s.scenarioId+' / '+g.groupId});
  }
  const anchors=setting?.anchors===false?[]:[...(item.anchors||[]),...(item.scenarios||[]).filter(s=>setting?.scenarios?.[s.scenarioId]!==false).flatMap(s=>s.anchors||[])];
  out.push({degree:d,groups,anchors,setting});
 }
 return out;
}
function draw({ctx,packet,view,degree='ALL',prefs,plot,visible,first,last,frameSeconds,plotGate}={}){
 const gate=plotGate?.(packet,view);
 if(gate?.allowed!==true)return {drawn:0,reason:gate?.reason||'NOT_AUTHORIZED'};
 if(!ctx||!packet||!plot||!Array.isArray(visible)||!visible.length)return {drawn:0,reason:'MISSING_CHART_CONTEXT'};
 if(!finite(plot.lo)||!finite(plot.hi)||plot.hi<=plot.lo)return {drawn:0,reason:'INVALID_PRICE_SCALE'};
 if(!Number.isFinite(first)||!Number.isFinite(last)||first>last)return {drawn:0,reason:'INVALID_TIME_SCALE'};
 let drawn=0;
 const y=price=>plot.top+(plot.hi-price)*(plot.bottom-plot.top)/(plot.hi-plot.lo);
 const width=plot.right-plot.left;
 const rows=collect(packet,prefs,degree);
 ctx.save();
 try{
  ctx.beginPath();ctx.rect(plot.left,plot.top,width,plot.bottom-plot.top);ctx.clip();
  for(const item of rows){
   const color=/^#[0-9a-fA-F]{6}$/.test(item.setting?.color||'')?item.setting.color:'#f59e0b';
   ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=Math.min(6,Math.max(1,item.setting?.lineWidth||2));
   ctx.font=Math.min(24,Math.max(9,item.setting?.fontSize||12))+'px system-ui';
   ctx.textAlign='left';
   for(const group of item.groups)for(const level of group.levels||[]){
    if(!finite(level.price))continue;
    const yp=y(level.price);if(yp<plot.top||yp>plot.bottom)continue;
    ctx.setLineDash([7,4]);ctx.beginPath();ctx.moveTo(plot.left,yp);ctx.lineTo(plot.right,yp);ctx.stroke();
    ctx.fillText(item.degree+' '+group.groupId+' '+String(level.label||level.key||'')+' '+level.price.toFixed(2),plot.left+6,Math.max(plot.top+10,yp-5));drawn++;
   }
   ctx.setLineDash([]);
   for(const a of item.anchors){
    if(!finite(a.price)||!a.marketEventTimeUtc||a.timestampStatus==='UNVERIFIED')continue;
    const ts=parseTime(a.marketEventTimeUtc);
    if(!Number.isFinite(ts)||ts<first||ts>last)continue;
    // No fabricated pivot candle position: place only on a matching actual bar timestamp.
    const i=visible.findIndex(r=>parseTime(r.timestampUtc)===ts);
    if(i<0)continue;
    const yp=y(a.price),xp=plot.left+(i+.5)*width/visible.length;
    if(yp<plot.top||yp>plot.bottom)continue;
    ctx.beginPath();ctx.arc(xp,yp,4,0,Math.PI*2);ctx.fill();
    ctx.fillText(item.degree+' '+a.waveLabel,xp+7,yp-8);drawn++;
   }
  }
 }finally{ctx.restore();}
 return {drawn,reason:drawn?'DRAWN':'NO_ELIGIBLE_VISIBLE_LEVELS'};
}
const API={collect,draw};
if(typeof module!=='undefined'&&module.exports)module.exports=API;
if(root)root.Engine2DWaveOverlayRenderer=API;
})(typeof window!=='undefined'?window:null);
