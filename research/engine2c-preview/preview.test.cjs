// Isolated offline unit tests. Run: node --test research/engine2c-preview/preview.test.cjs
// This harness mocks Canvas/DOM; it is NOT browser T24–T27 acceptance.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
function harness(){
  const elements=new Map();
  const ctx={scale(){},fillRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},setLineDash(){},fillText(){}};
  function el(id){
    if(!elements.has(id)) elements.set(id,{id,value:id==='view'?'UNADJUSTED':id==='frame'?'5m':id==='degree'?'ALL':'',clientWidth:900,clientHeight:450,hidden:false,innerHTML:'',textContent:'',handlers:{},querySelector(){return this.canvas||null;},appendChild(x){this.canvas=x;},addEventListener(n,cb){this.handlers[n]=cb;},setPointerCapture(){}});
    return elements.get(id);
  }
  const document={getElementById:el,createElement:()=>({style:{},setAttribute(){},getContext:()=>ctx})};
  const window={devicePixelRatio:1,ResizeObserver:class{observe(){}}};
  const context={document,window,ResizeObserver:window.ResizeObserver,console,Date,Number,Math,JSON,Set,Promise,Error};
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'app.js'),'utf8'),context,{filename:'app.js'});
  return {api:window.__ENGINE2C_TEST__,el};
}
const frames=['5m','10m','1h','4h','1d','1w','1mo'];
const views=['UNADJUSTED','ADJUSTED_RESEARCH','ACTUAL_CONTRACT'];
function row(i,view='UNADJUSTED',frame='5m'){
  return {researchCandleId:view+'-'+frame+'-'+i,frame,priceBasisVersion:'basis-'+view,sourceContract:'ESZ2026',adjustment:0,adjustmentVersion:'research.v1',timestampNs:String(BigInt(1700000000+i*300)*1000000000n),prices:{open:6000,high:6002,low:5998,close:6001},structuralEligible:false,executionPriceAuthority:false};
}
const page=(rows,view='UNADJUSTED',frame='5m',nextCursor=null)=>({datasetVersion:'dataset-'+view,priceBasisVersion:'basis-'+view,frame,researchOnly:true,structuralEligible:false,executionPriceAuthority:false,rows,nextCursor});
function fixture(){
  const nodes=Object.fromEntries(['SUBMICRO','MICRO','SUBMINUTE','MINUTE','MINOR','INTERMEDIATE','PRIMARY'].map(d=>[d,[]]));
  const ids=Object.keys(nodes);
  for(let i=0;i<40;i++)nodes[ids[i%ids.length]].push({registryNodeId:i===24?'WB-ALL-024':'N'+i,degree:ids[i%ids.length],node:'W'+i,originalRecordedLocalTime:i===24?'2026-03-30T16:00:00':null,originalOwnerCoordinate:{price:i===24?6496:6000,rawDate:'?',rawTime:'?'},ownerEvidenceVisibility:'BLANK_ENDPOINT_LIST_ONLY'});
  const f={handoffVersion:'research-fixture',views:{},fixtures:{},nodeLayers:{degrees:nodes,officialFibonacciLevels:[],officialStructuralLevels:[],withheldFibonacciReferences:Array.from({length:34},(_,i)=>({id:i}))}};
  for(const v of views){f.views[v]={datasetVersion:'dataset-'+v,priceBasisVersion:'basis-'+v,archivedSnapshotOnly:true,officialOverlayEligible:false};f.fixtures[v]={};for(const tf of frames)f.fixtures[v][tf]={firstPage:page([row(0,v,tf),row(1,v,tf)],v,tf,'cursor'),secondRequest:{cursor:'cursor'},secondPage:page([row(-1,v,tf)],v,tf)};}
  return f;
}
test('T27 preliminary: rejects structurally authoritative source and wrong basis',()=>{
  const {api}=harness();const f=fixture();assert.equal(api.checkHandoff(f),f);api.state.handoff=f;
  assert.doesNotThrow(()=>api.validatePage(f.fixtures.UNADJUSTED['5m'].firstPage));
  assert.throws(()=>api.validatePage({...page([row(0)]),priceBasisVersion:'wrong'}),/Incompatible/);
  assert.throws(()=>api.validatePage({...page([row(0)]),structuralEligible:true}),/Incompatible/);
});
test('T24 preliminary: nanosecond rows sort, deduplicate and preserve an anchor when older pages prepend',()=>{
  const {api}=harness();api.state.handoff=fixture();
  api.appendPage(page([row(0),row(1)]),'first');assert.equal(api.state.rows.length,2);
  api.state.offset=1;
  api.appendPage(page([row(-1),row(0)]),'older');
  assert.deepEqual(Array.from(api.state.rows.map(r=>r.researchCandleId)),['UNADJUSTED-5m--1','UNADJUSTED-5m-0','UNADJUSTED-5m-1']);
  assert.equal(api.state.offset,2);
});
test('T25 preliminary: degree changes preserve candles and viewport; view changes invalidate old context',()=>{
  const {api,el}=harness();api.state.handoff=fixture();api.appendPage(page([row(0),row(1)]),'first');
  const generation=api.state.generation;api.state.offset=1;
  el('degree').value='MINOR';api.choose();
  assert.equal(api.state.rows.length,2);assert.equal(api.state.offset,1);assert.equal(api.state.generation,generation+1);
  el('view').value='ACTUAL_CONTRACT';api.choose();assert.equal(api.state.rows.length,0);
});
test('T25: repeated view/frame changes reject a prior page identity',()=>{
  const {api,el}=harness();api.state.handoff=fixture();
  api.appendPage(page([row(0)]),'first');
  el('view').value='ADJUSTED_RESEARCH';api.choose();
  assert.throws(()=>api.validatePage(page([row(0)])),/Incompatible/);
  el('frame').value='10m';api.choose();
  assert.throws(()=>api.validatePage(page([row(0,'ADJUSTED_RESEARCH','5m')],'ADJUSTED_RESEARCH','5m')),/Incompatible/);
});
test('T27: all 21 source view/frame combinations enforce explicit research authority',()=>{
  const {api,el}=harness();const f=fixture();api.state.handoff=f;
  for(const view of views)for(const frame of frames){
    el('view').value=view;el('frame').value=frame;api.choose();
    assert.doesNotThrow(()=>api.validatePage(f.fixtures[view][frame].firstPage));
  }
  assert.equal(f.nodeLayers.withheldFibonacciReferences.length,34);
  assert.equal(f.nodeLayers.officialFibonacciLevels.length,0);
});
test('T26 preliminary: 25,000-row storage bound with distinct identities',()=>{
  const {api}=harness();api.state.handoff=fixture();
  api.appendPage(page(Array.from({length:25010},(_,i)=>row(i))),'big');
  assert.equal(api.state.rows.length,25000);assert.equal(api.state.identities.size,25000);
  assert.equal(api.state.rows[0].researchCandleId,'UNADJUSTED-5m-10');
});
