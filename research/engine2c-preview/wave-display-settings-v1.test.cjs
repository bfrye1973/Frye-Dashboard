const test=require('node:test');
const assert=require('node:assert/strict');
const s=require('../../public/engine2c-research/wave-display-settings-v1.js');
test('all seven degrees have independent defaults',()=>{
 const x=s.defaults();assert.equal(Object.keys(x).length,7);
 x.micro.color='#000000';assert.notEqual(x.subminute.color,x.micro.color);
});
test('settings persist safely and invalid settings are rejected',()=>{
 const data=new Map(),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};
 const x=s.defaults();x.micro.fontSize=19;x.subminute.fibGroups.WICK=false;x.submicro.scenarios.OPTION_2_A_DOWN_B_UP_PENDING=false;
 assert.equal(s.write(storage,x),true);
 const y=s.read(storage);assert.equal(y.micro.fontSize,19);
 assert.equal(y.subminute.fibGroups.WICK,false);
 assert.equal(y.subminute.fibGroups.BODY,true);
 assert.equal(y.submicro.scenarios.OPTION_2_A_DOWN_B_UP_PENDING,false);
 assert.equal(y.submicro.scenarios.OPTION_1_ABC_C_DOWN,true);
 const bad=s.normalize({micro:{color:'javascript:alert(1)',fontSize:999,lineWidth:-5}});
 assert.equal(bad.micro.color,s.defaults().micro.color);
 assert.equal(bad.micro.fontSize,24);assert.equal(bad.micro.lineWidth,1);
});
test('visibility and style preferences never authorize plotting',()=>{
 const x=s.defaults();x.primary.visible=false;
 assert.equal(x.primary.visible,false);
 assert.equal('plotAllowed' in x.primary,false);
});
