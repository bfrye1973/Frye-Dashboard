/* Explicit owner-research Fibonacci visualization.
 * NOT official Engine22 plotting; no order/permission output.
 * Copies published level prices exactly; never calculates new levels.
 */
(function(root){
'use strict';
const DEGREES=['submicro','micro','subminute','minute','minor','intermediate','primary'];
const numeric=x=>typeof x==='number'&&Number.isFinite(x);
function collect(packet,prefs,degree='ALL'){
 if(packet?.schema!=='engine22.chartAnchors.v1'||packet?.authority!=='ENGINE22'||packet?.noExecution!==true)return [];
 const result=[];
 for(const d of DEGREES){
  if(degree!=='ALL'&&degree.toLowerCase()!==d)continue;
  const item=packet.degrees?.[d],setting=prefs?.[d];
  if(!item?.available||setting?.visible===false||setting?.fibs===false)continue;
  for(const group of item.fibGroups||[])if(setting?.fibGroups?.[group.groupId]!==false)
   for(const level of group.levels||[])if(numeric(level.price))result.push({degree:d,group:group.groupId,level,setting});
  for(const scenario of item.scenarios||[]){
   if(setting?.scenarios?.[scenario.scenarioId]===false)continue;
   for(const group of scenario.fibGroups||[])
    for(const level of group.levels||[])if(numeric(level.price))result.push({degree:d,group:scenario.scenarioId+' '+group.groupId,level,setting});
  }
 }
 return result;
}
function draw({ctx,packet,prefs,degree='ALL',plot,enabled=false}={}){
 if(!enabled)return {drawn:0,reason:'OWNER_RESEARCH_FIBS_DISABLED'};
 if(!ctx||!plot||!(plot.hi>plot.lo))return {drawn:0,reason:'INVALID_CHART_CONTEXT'};
 const items=collect(packet,prefs,degree);let drawn=0;
 ctx.save();
 try{
  ctx.beginPath();ctx.rect(plot.left,plot.top,plot.right-plot.left,plot.bottom-plot.top);ctx.clip();
  for(const x of items){
   const y=plot.top+(plot.hi-x.level.price)*(plot.bottom-plot.top)/(plot.hi-plot.lo);
   if(y<plot.top||y>plot.bottom)continue;
   const color=/^#[0-9a-fA-F]{6}$/.test(x.setting?.color||'')?x.setting.color:'#fbbf24';
   ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=x.setting?.lineWidth||2;
   ctx.setLineDash([4,5]);ctx.beginPath();ctx.moveTo(plot.left,y);ctx.lineTo(plot.right,y);ctx.stroke();ctx.setLineDash([]);
   ctx.font=(x.setting?.fontSize||12)+'px system-ui';ctx.textAlign='left';
   ctx.fillText(x.degree.toUpperCase()+' '+x.group+' '+String(x.level.label||x.level.key||'')+' '+x.level.price.toFixed(2)+' WORKING RESEARCH',plot.left+5,Math.max(plot.top+11,y-6));
   drawn++;
  }
 }finally{ctx.restore();}
 return {drawn,reason:'ENGINE22_OWNER_RESEARCH_NOT_CERTIFIED'};
}
const API={collect,draw};
if(typeof module!=='undefined'&&module.exports)module.exports=API;
if(root)root.Engine2DResearchFibOverlay=API;
})(typeof window!=='undefined'?window:null);
