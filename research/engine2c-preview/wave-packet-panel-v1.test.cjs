const test=require('node:test');
const assert=require('node:assert/strict');
const panel=require('../../public/engine2c-research/wave-packet-panel-v1.js');
test('missing packet fails closed and never plots',()=>{
 const host={innerHTML:''};
 const controller=panel.createController({host});
 const r=controller.update(null);
 assert.equal(r.ok,false);assert.match(host.innerHTML,/unavailable/i);
});
test('invalid current snapshot rejected',()=>{
 const host={innerHTML:''};
 const controller=panel.createController({host});
 assert.equal(controller.update({strategies:{}}).ok,false);
});
