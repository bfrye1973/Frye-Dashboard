/* Engine2D isolated development: read-only Engine22 packet presentation.
   Accepts an explicitly selected JSON test fixture, never fetches secrets.
   Does not render any chart geometry or promote a provisional Fib to official. */
(function(root){
'use strict';
const api=()=>root?.Engine2DChartAnchorsV1;
const esc=s=>String(s==null?'—':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function createController({host,storage,view=()=> 'UNADJUSTED',degree=()=> 'ALL'}={}){
 let packet=null,revision=null,hash=null;
 function update(next){
  const p=api()?.packetFromSnapshot(next)||next?.chartAnchors||next;
  const checked=api()?.validate(p);
  if(!checked?.ok){packet=null;revision=null;hash=null;if(root)root.__ENGINE2D_CURRENT_CHART_PACKET__=null;render();root?.dispatchEvent?.(new Event('engine2d-packet-change'));return {ok:false,reason:checked?.reason||'CONSUMER_NOT_LOADED'};}
  const nextHash=p.chartContractFingerprint||null;
  const changed=revision!==p.selectionRevision||hash!==nextHash;
  packet=p;revision=p.selectionRevision;hash=nextHash;if(root)root.__ENGINE2D_CURRENT_CHART_PACKET__=p;render();root?.dispatchEvent?.(new Event('engine2d-packet-change'));
  return {ok:true,changed,revision,hash,plotAllowed:false};
 }
 function render(){
  if(!host)return;
  const gate=api()?.plotGate(packet,view());
  const prefs=root?.Engine2DWaveDisplaySettings?.read(storage);
  if(!packet){host.innerHTML='<p>Engine 22 current wave packet unavailable. No chart overlays plotted.</p>';return;}
  const selected=degree()==='ALL'?Object.keys(packet.degrees):[String(degree()).toLowerCase()];
  const allowed=selected.filter(d=>prefs?.[d]?.visible!==false);
  const rows=allowed.map(d=>{
   const item=packet.degrees[d];if(!item)return '';
   const scenario=(item.scenarios||[]).filter(s=>prefs?.[d]?.scenarios?.[s.scenarioId]!==false);
   const groups=(item.fibGroups||[]).filter(g=>prefs?.[d]?.fibs!==false&&prefs?.[d]?.fibGroups?.[g.groupId]!==false);
   const subGroups=scenario.map(s=>esc(s.scenarioId)+' ('+(s.fibGroups||[]).length+' Fib groups)').join('; ');
   const fibNames=groups.map(g=>esc(g.groupId)+' ('+(g.levels||[]).length+' levels)').join(', ');
   return '<li><b>'+esc(d.toUpperCase())+'</b>: '+esc(item.activeWave)+' '+esc(item.direction)+
    ' · '+esc(item.lifecycleStatus)+' · '+(prefs?.[d]?.anchors===false?0:(item.anchors||[]).length)+' anchor records'+
    ' · Fib: '+(fibNames||'none')+' · Scenarios: '+(subGroups||'none')+
    ' · Missing: '+esc((item.missingEvidence||[]).join(', ')||'none')+'</li>';
  }).join('');
  host.innerHTML='<p><b>Engine 22 working revision '+esc(revision)+'</b> · '+esc(packet.selectionApprovalReference)+
    ' · Chart plotting: <b>WITHHELD</b> ('+esc(gate?.reason||'UNAVAILABLE')+')'+
    ' · Not a historical prediction</p><ul>'+rows+'</ul>';
 }
 return {update,render,getPacket:()=>packet,getRevision:()=>revision};
}
function mount(host,storage,options={}){
 const controller=createController({host:host?.querySelector('[data-packet-details]'),storage,...options});
 const picker=host?.querySelector('[data-packet-file]');
 picker?.addEventListener('change',async e=>{
  const file=e.target.files?.[0];if(!file)return;
  try{
   if(file.size>8*1024*1024)throw Error('FILE_TOO_LARGE');
   const parsed=JSON.parse(await file.text());
   const result=controller.update(parsed);
   if(!result.ok)throw Error(result.reason);
   host.querySelector('[data-packet-status]').textContent='Local development packet accepted. No plotting authorized.';
  }catch(error){
   controller.update(null);
   host.querySelector('[data-packet-status]').textContent='Packet rejected: '+String(error.message||error);
  }
 });
 return controller;
}
const API={createController,mount};
if(typeof module!=='undefined'&&module.exports)module.exports=API;
if(root)root.Engine2DWavePacketPanel=API;
})(typeof window!=='undefined'?window:null);
