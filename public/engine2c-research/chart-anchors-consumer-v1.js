/* Engine 2D — isolated, read-only consumer of Engine 22 chartAnchors v1.
 * No Elliott Wave or Fibonacci calculations. No current-packet historical backfill.
 * Current contract is plotAllowed:false, so this module never draws chart geometry.
 */
(() => {
  'use strict';
  const ORDER=['submicro','micro','subminute','minute','minor','intermediate','primary'];
  const BASIS={
    UNADJUSTED:'price-basis:fcbfa10815555415c8afdfddbbc28a96a4f42207db162a0db853b549546b3908',
    ADJUSTED_RESEARCH:'price-basis:94b25a5e2dc04574a59966c369243300d205a50527800b63876641a6023e9f63',
    ACTUAL_CONTRACT:'price-basis:757ed82449f97edfea282111a163ffa04681ba188242fd17034ff9cb91410623'
  };
  const valid=x=>x&&typeof x==='object'&&!Array.isArray(x);
  const safe=v=>String(v==null?'—':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const packetFromSnapshot=s=>s?.strategies?.['intraday_scalp@10m']?.engine22WaveStrategy?.chartAnchors??null;
  function validate(p) {
    if(!valid(p)) return {ok:false,reason:'ENGINE22_CHART_ANCHORS_UNAVAILABLE'};
    if(p.schema!=='engine22.chartAnchors.v1'||p.authority!=='ENGINE22'||p.mode!=='READ_ONLY'||p.noExecution!==true)
      return {ok:false,reason:'ENGINE22_CHART_ANCHORS_SCHEMA_MISMATCH'};
    if(p.available!==true||!valid(p.degrees)||!ORDER.every(d=>valid(p.degrees[d])))
      return {ok:false,reason:'ENGINE22_CHART_ANCHORS_INCOMPLETE'};
    return {ok:true,reason:'ENGINE22_CHART_ANCHORS_READ_ONLY'};
  }
  function plotGate(p,view) {
    const check=validate(p);
    if(!check.ok) return {allowed:false,reason:check.reason};
    if(p.plotAllowed!==true)return {allowed:false,reason:'ENGINE22_PLOT_NOT_AUTHORIZED'};
    if(p.historicalAsOfSupported!==true)return {allowed:false,reason:'HISTORICAL_AS_OF_UNAVAILABLE'};
    if(p.chartCompatibility!=='VERIFIED'||p.priceBasis!=='VERIFIED')
      return {allowed:false,reason:'ANCHOR_PRICE_BASIS_UNVERIFIED'};
    if(p.priceBasisIds?.[view]!==BASIS[view])return {allowed:false,reason:'PRICE_BASIS_VERSION_MISMATCH'};
    // Future plotting requires additional per-anchor contract and timestamp verification.
    // Deliberately no geometry renderer in v1.
    return {allowed:false,reason:'ENGINE2D_COORDINATE_ACCEPTANCE_PENDING'};
  }
  function summarize(p,degree='ALL',view='UNADJUSTED'){
    const chk=validate(p),gate=plotGate(p,view);
    if(!chk.ok)return {available:false,reason:chk.reason,plotAllowed:false,plotReason:gate.reason,degrees:[]};
    const keys=degree==='ALL'?ORDER:[String(degree).toLowerCase()];
    const rows=keys.filter(k=>ORDER.includes(k)).map(k=>{
      const d=p.degrees[k];
      return {degree:k,available:d.available===true,wave:d.activeWave??null,direction:d.direction??null,
        lifecycle:d.lifecycleStatus??null,model:d.modelVersion??null,
        anchors:Array.isArray(d.anchors)?d.anchors:[],
        fibGroups:Array.isArray(d.fibGroups)?d.fibGroups:[],
        scenarios:Array.isArray(d.scenarios)?d.scenarios:[],
        missingEvidence:Array.isArray(d.missingEvidence)?d.missingEvidence:[],
        reviewBoundary:d.reviewBoundary??null,officialInvalidation:d.officialInvalidation??null};
    });
    return {available:true,revision:p.selectionRevision??null,plotAllowed:false,plotReason:gate.reason,
      historicalAsOfSupported:p.historicalAsOfSupported===true,degrees:rows};
  }
  function render(p,{degree='ALL',view='UNADJUSTED'}={}){
    const data=summarize(p,degree,view);
    if(!data.available)return '<p>Engine 22 chart anchors unavailable: '+safe(data.reason)+'. No overlays plotted.</p>';
    const row=d=>{
      const groups=d.fibGroups.map(g=>safe(g.groupId)+' ('+((g.levels||[]).length)+' levels)').join(', ');
      const scenarios=d.scenarios.map(s=>safe(s.scenarioId)+': '+(s.anchors||[]).length+' anchors, '+(s.fibGroups||[]).length+' Fib groups').join('; ');
      const anchors=d.anchors.map(a=>safe(a.waveLabel)+': '+safe(a.price)+' @ '+safe(a.localTime)+' ['+safe(a.timestampStatus)+']').join('; ');
      return '<li><b>'+safe(d.degree.toUpperCase())+'</b> · '+safe(d.wave)+' '+safe(d.direction)+' · '+safe(d.lifecycle)+
        '<div>Model: '+safe(d.model)+'</div><div>Anchors: '+(anchors||'not available')+'</div>'+
        '<div>Fib groups: '+(groups||'none')+'</div><div>Scenarios: '+(scenarios||'none')+'</div>'+
        '<div>Review boundary: '+safe(d.reviewBoundary?.price??'not available')+
        ' (not a trade stop); official invalidation: '+safe(d.officialInvalidation?.status??'not available')+'</div>'+
        '<div>Missing evidence: '+safe(d.missingEvidence.join(', ')||'none reported')+'</div></li>';
    };
    return '<p>Engine 22 selection revision '+safe(data.revision)+
      ' · RESEARCH ONLY · <b>No chart coordinates plotted</b> · '+safe(data.plotReason)+
      ' · Not historical point-in-time evidence</p><ol>'+data.degrees.map(row).join('')+'</ol>';
  }
  const API=Object.freeze({packetFromSnapshot,validate,plotGate,summarize,render});
  if(typeof window!=='undefined')window.Engine2DChartAnchorsV1=API;
  if(typeof module!=='undefined'&&module.exports)module.exports=API;
})();