const test=require('node:test');
const assert=require('node:assert/strict');
const fib=require('../../public/engine2c-research/research-fib-overlay-v1.js');
const settings=require('../../public/engine2c-research/wave-display-settings-v1.js');
const p={schema:'engine22.chartAnchors.v1',authority:'ENGINE22',noExecution:true,plotAllowed:false,degrees:{
 subminute:{available:true,fibGroups:[{groupId:'WICK',levels:[{price:7700}]},{groupId:'BODY',levels:[{price:7750}]}],scenarios:[]},
 submicro:{available:true,fibGroups:[],scenarios:[{scenarioId:'OPTION_1_ABC_C_DOWN',fibGroups:[{groupId:'O1',levels:[{price:7600}]}]},{scenarioId:'OPTION_2_A_DOWN_B_UP_PENDING',fibGroups:[{groupId:'O2',levels:[{price:7800}]}]}]}
}};
test('owner research Fib extraction copies source values even with official plot gate false',()=>{
 const levels=fib.collect(p,settings.defaults());
 assert.deepEqual(levels.map(x=>x.level.price),[7600,7800,7700,7750]);
 assert.equal(p.plotAllowed,false);
});
test('research layer disabled by default',()=>{
 const r=fib.draw({enabled:false});
 assert.equal(r.drawn,0);
});
test('separate submicro options and subminute methods',()=>{
 const s=settings.defaults();s.submicro.scenarios.OPTION_2_A_DOWN_B_UP_PENDING=false;s.subminute.fibGroups.BODY=false;
 assert.deepEqual(fib.collect(p,s).map(x=>x.level.price),[7600,7700]);
});
test('invalid source is rejected',()=>assert.deepEqual(fib.collect({...p,authority:'OTHER'},settings.defaults()),[]));
