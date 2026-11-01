const assert=require('node:assert/strict');
const test=require('node:test');
const api=require('../../public/engine2c-research/chart-anchors-consumer-v1.js');
const ORDER=['submicro','micro','subminute','minute','minor','intermediate','primary'];
const sample=()=>({
 schema:'engine22.chartAnchors.v1',authority:'ENGINE22',mode:'READ_ONLY',noExecution:true,
 available:true,plotAllowed:false,historicalAsOfSupported:false,selectionRevision:5,
 priceBasis:'UNVERIFIED',chartCompatibility:'WITHHELD_PENDING_VERIFICATION',
 degrees:Object.fromEntries(ORDER.map(degree=>[degree,{
  degree,available:true,activeWave:degree==='submicro'?'ALTERNATIVES':'C',
  direction:'DOWN',lifecycleStatus:'DEVELOPING_CANDIDATE',
  anchors:[],fibGroups:[],scenarios:[],missingEvidence:[]
 }]))
});
test('missing and unknown publication fail closed',()=>{
 assert.equal(api.validate(null).ok,false);
 assert.equal(api.validate({...sample(),schema:'other'}).ok,false);
 assert.equal(api.validate({...sample(),degrees:{}}).ok,false);
 assert.equal(api.plotGate(null,'UNADJUSTED').allowed,false);
});
test('current Engine22 working publisher is informative but never plotted',()=>{
 const p=sample();
 assert.equal(api.validate(p).ok,true);
 assert.equal(api.plotGate(p,'ACTUAL_CONTRACT').reason,'ENGINE22_PLOT_NOT_AUTHORIZED');
 assert.equal(api.summarize(p).degrees.length,7);
 assert.match(api.render(p),/No chart coordinates plotted/);
});
test('keep independent alternatives and separate wick and body groups',()=>{
 const p=sample();
 p.degrees.submicro.scenarios=[
  {scenarioId:'OPTION_1_ABC_C_DOWN',anchors:[{price:1}],fibGroups:[{groupId:'OPTION_1',levels:[{price:2}]}]},
  {scenarioId:'OPTION_2_A_DOWN_B_UP_PENDING',anchors:[{price:3}],fibGroups:[{groupId:'OPTION_2',levels:[{price:4}]}]}
 ];
 p.degrees.subminute.fibGroups=[{groupId:'WICK',levels:[{price:5}]},{groupId:'BODY',levels:[{price:6}]}];
 const submicro=api.summarize(p,'SUBMICRO').degrees[0],subminute=api.summarize(p,'SUBMINUTE').degrees[0];
 assert.equal(submicro.scenarios.length,2);
 assert.notEqual(submicro.scenarios[0].fibGroups,submicro.scenarios[1].fibGroups);
 assert.deepEqual(subminute.fibGroups.map(x=>x.groupId),['WICK','BODY']);
 assert.equal(api.plotGate(p,'UNADJUSTED').allowed,false);
});
test('even a forged plotting flag cannot bypass historical and basis requirements',()=>{
 const p=sample();p.plotAllowed=true;
 assert.equal(api.plotGate(p,'UNADJUSTED').reason,'HISTORICAL_AS_OF_UNAVAILABLE');
 p.historicalAsOfSupported=true;
 assert.equal(api.plotGate(p,'UNADJUSTED').reason,'ANCHOR_PRICE_BASIS_UNVERIFIED');
 p.chartCompatibility='VERIFIED';p.priceBasis='VERIFIED';
 assert.equal(api.plotGate(p,'UNADJUSTED').reason,'PRICE_BASIS_VERSION_MISMATCH');
});
test('extract only chartAnchors field from existing strategy snapshot',()=>{
 const p=sample();
 assert.equal(api.packetFromSnapshot({strategies:{'intraday_scalp@10m':{engine22WaveStrategy:{chartAnchors:p}}}}),p);
 assert.equal(api.packetFromSnapshot({}),null);
});
