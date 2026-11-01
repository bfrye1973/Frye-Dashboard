const test=require('node:test');
const assert=require('node:assert/strict');
const owner=require('../../public/engine2c-research/owner-anchors-v1.js');
test('all 24 owner pivots preserved across seven degrees',()=>{
 assert.equal(owner.anchors.length,24);
 assert.deepEqual([...new Set(owner.anchors.map(x=>x.degree))],['submicro','micro','subminute','minute','minor','intermediate','primary']);
 assert.equal(owner.anchors.find(x=>x.degree==='subminute'&&x.label==='A High').price,7908.25);
 assert.equal(owner.anchors.find(x=>x.degree==='primary'&&x.label==='W4 ending low').price,5182);
 assert.equal(owner.anchors.every(x=>x.status==='OWNER_APPROVED_RESEARCH'&&x.executionAuthority===false),true);
});
test('Arizona wall clock converted without modifying owner prices',()=>{
 assert.equal(owner.anchors[0].timestampUtc,'2026-10-26T08:00:00.000Z');
 assert.equal(owner.anchors[0].price,7660);
});
test('independent degree filtering',()=>{
 assert.equal(owner.grouped('SUBMICRO').length,3);
 assert.equal(owner.grouped('MICRO').length,3);
 assert.equal(owner.grouped('MINOR').length,5);
});
