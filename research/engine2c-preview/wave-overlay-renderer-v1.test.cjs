const test=require('node:test');
const assert=require('node:assert/strict');
const renderer=require('../../public/engine2c-research/wave-overlay-renderer-v1.js');
const settings=require('../../public/engine2c-research/wave-display-settings-v1.js');
const packet={degrees:{
 submicro:{available:true,scenarios:[
  {scenarioId:'OPTION_1_ABC_C_DOWN',fibGroups:[{groupId:'ONE',levels:[{price:7700}]}],anchors:[]},
  {scenarioId:'OPTION_2_A_DOWN_B_UP_PENDING',fibGroups:[{groupId:'TWO',levels:[{price:7800}]}],anchors:[]}
 ],fibGroups:[],anchors:[]},
 subminute:{available:true,scenarios:[],fibGroups:[{groupId:'WICK',levels:[{price:7600}]},{groupId:'BODY',levels:[{price:7650}]}],anchors:[]}
}};
test('no drawing without approved Engine22 plot gate',()=>{
 let calls=0;const ctx={save(){calls++},restore(){}};
 const r=renderer.draw({ctx,packet,view:'UNADJUSTED',plotGate:()=>({allowed:false,reason:'ENGINE22_PLOT_NOT_AUTHORIZED'})});
 assert.equal(r.drawn,0);assert.equal(calls,0);
});
test('independent scenario and Fib group toggles',()=>{
 const prefs=settings.defaults();
 prefs.submicro.scenarios.OPTION_2_A_DOWN_B_UP_PENDING=false;
 prefs.subminute.fibGroups.BODY=false;
 const groups=renderer.collect(packet,prefs,'ALL');
 assert.equal(groups.find(x=>x.degree==='submicro').groups.length,1);
 assert.equal(groups.find(x=>x.degree==='subminute').groups.length,1);
 assert.equal(groups.find(x=>x.degree==='subminute').groups[0].groupId,'WICK');
});
test('degree visibility removes only selected degree',()=>{
 const prefs=settings.defaults();prefs.micro.visible=false;
 assert.equal(renderer.collect(packet,prefs,'MICRO').length,0);
 assert.equal(renderer.collect(packet,prefs,'SUBMINUTE').length,1);
});
