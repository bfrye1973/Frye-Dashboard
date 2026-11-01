/* Owner-supplied coordinates, November 1, 2026.
 * Immutable research annotations; NOT Engine22 official chartAnchors and no execution authority.
 * Exact owner prices and Arizona wall-clock timestamps; no candle snapping.
 */
(function(root){
'use strict';
const TZ='America/Phoenix',YEAR=2026;
const raw=[
['submicro','A Low','2026-10-26','01:00',7660.00],
['submicro','A High','2026-10-21','11:00',7810.50],
['submicro','B high','2026-10-28','13:00',7819.50],
['micro','A High','2026-10-21','11:00',7810.50],
['micro','A Low','2026-10-26','01:00',7660.00],
['micro','B high','2026-10-28','13:00',7819.50],
['subminute','A High','2026-08-13','06:00',7908.25],
['subminute','A Low','2026-09-16','11:00',7575.00],
['subminute','B high','2026-10-06','09:00',7895.50],
['minute','W1 starting low','2026-07-30','12:30',7412.50],
['minute','W1 ending high','2026-08-13','06:00',7906.25],
['minor','W1 starting low','2026-03-30','17:00',6417.00],
['minor','W1 ending high','2026-04-10','08:00',6948.75],
['minor','W2 ending low','2026-04-12','15:00',6829.00],
['minor','W3 ending high','2026-06-02','19:00',7694.25],
['minor','W4 ending low','2026-07-29','13:30',7398.00],
['intermediate','W1 starting low','2025-04-08','07:00',5188.50],
['intermediate','W1 ending high','2026-01-28','10:00',7151.00],
['intermediate','W2 ending low','2026-03-30','03:00',6407.00],
['primary','W1 starting low','2020-04-02','08:00',3200.00],
['primary','W1 ending high','2022-01-05','10:00',5620.00],
['primary','W2 ending low','2022-10-12','09:00',4306.00],
['primary','W3 ending high','2025-02-20','09:00',6487.00],
['primary','W4 ending low','2025-04-09','07:00',5182.00]
];
const anchors=Object.freeze(raw.map(([degree,label,date,time,price],i)=>Object.freeze({
 id:'OWNER-'+String(i+1).padStart(2,'0'),degree,label,date,time,price,timezone:TZ,
 timestampUtc:new Date(date+'T'+time+':00-07:00').toISOString(),source:'OWNER_PROVIDED_2026_11_01',
 status:'OWNER_APPROVED_RESEARCH',executionAuthority:false
})));
const grouped=degree=>anchors.filter(a=>degree==='ALL'||a.degree===String(degree).toLowerCase());
function draw({ctx,visible,plot,degree='ALL',prefs}={}){
 if(!ctx||!visible?.length||!plot||!(plot.hi>plot.lo))return {drawn:0,reason:'NO_CHART_CONTEXT'};
 const start=Date.parse(visible[0].timestampUtc||'')||nsMs(visible[0].timestampNs);
 const end=Date.parse(visible[visible.length-1].timestampUtc||'')||nsMs(visible[visible.length-1].timestampNs);
 if(!Number.isFinite(start)||!Number.isFinite(end))return {drawn:0,reason:'NO_CANDLE_TIME'};
 const width=plot.right-plot.left,height=plot.bottom-plot.top;
 const ts=visible.map(r=>nsMs(r.timestampNs));
 let drawn=0;
 ctx.save();
 try{
  ctx.beginPath();ctx.rect(plot.left,plot.top,width,height);ctx.clip();
  for(const a of grouped(degree)){
   const setting=prefs?.[a.degree];if(setting?.visible===false||setting?.anchors===false)continue;
   const at=Date.parse(a.timestampUtc);if(at<start||at>end)continue;
   const idx=ts.findIndex(t=>t>=at);if(idx<0)continue;
   const prior=Math.max(0,idx-1),left=ts[prior],right=ts[idx];
   if(!Number.isFinite(left)||!Number.isFinite(right))continue;
   // Time position only; no price snapping or historical OHLC adjustment.
   const fraction=idx===0?0:right===left?idx:prior+(at-left)/(right-left);
   const x=plot.left+(fraction+.5)*width/visible.length;
   const y=plot.top+(plot.hi-a.price)*height/(plot.hi-plot.lo);
   if(y<plot.top||y>plot.bottom)continue;
   const color=/^#[0-9a-fA-F]{6}$/.test(setting?.color||'')?setting.color:'#fbbf24';
   ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=setting?.lineWidth||2;
   ctx.setLineDash([3,3]);ctx.beginPath();ctx.moveTo(x-7,y);ctx.lineTo(x+7,y);ctx.moveTo(x,y-7);ctx.lineTo(x,y+7);ctx.stroke();ctx.setLineDash([]);
   ctx.font=(setting?.fontSize||12)+'px system-ui';
   ctx.textAlign='left';ctx.fillText(a.degree.toUpperCase()+' '+a.label+' '+a.price.toFixed(2)+' OWNER',x+8,Math.max(plot.top+12,y-10));
   drawn++;
  }
  // Connect only chronological owner-supplied pivots within the visible window.
  // Missing endpoints remain absent; these are research annotations, not forecasts.
  for(const degreeName of [...new Set(grouped(degree).map(a=>a.degree))]){
   const setting=prefs?.[degreeName];
   if(setting?.visible===false||setting?.anchors===false)continue;
   const points=grouped(degreeName).filter(a=>Date.parse(a.timestampUtc)>=start&&Date.parse(a.timestampUtc)<=end)
     .sort((a,b)=>Date.parse(a.timestampUtc)-Date.parse(b.timestampUtc));
   if(points.length<2)continue;
   ctx.strokeStyle=/^#[0-9a-fA-F]{6}$/.test(setting?.color||'')?setting.color:'#fbbf24';
   ctx.lineWidth=setting?.lineWidth||2;ctx.setLineDash([5,5]);
   let previous=null;
   for(const a of points){
    const at=Date.parse(a.timestampUtc),idx=ts.findIndex(t=>t>=at);
    if(idx<0){previous=null;continue;}
    const prior=Math.max(0,idx-1),left=ts[prior],right=ts[idx];
    if(!Number.isFinite(left)||!Number.isFinite(right)){previous=null;continue;}
    const fraction=idx===0?0:right===left?idx:prior+(at-left)/(right-left);
    const x=plot.left+(fraction+.5)*width/visible.length;
    const y=plot.top+(plot.hi-a.price)*height/(plot.hi-plot.lo);
    if(y<plot.top||y>plot.bottom){previous=null;continue;}
    if(previous){ctx.beginPath();ctx.moveTo(previous.x,previous.y);ctx.lineTo(x,y);ctx.stroke();}
    previous={x,y};
   }
   ctx.setLineDash([]);
  }
 }finally{ctx.restore();}
 return {drawn,reason:'OWNER_RESEARCH_ONLY'};
}
function nsMs(ns){
 const s=String(ns||'');
 if(/^\d{15,}$/.test(s))return Number(s.slice(0,-6));
 if(/^\d{10}$/.test(s))return Number(s)*1000;
 return Date.parse(s);
}
const API={anchors,grouped,draw};
if(typeof module!=='undefined'&&module.exports)module.exports=API;
if(root)root.Engine2DOwnerAnchors=API;
})(typeof window!=='undefined'?window:null);
