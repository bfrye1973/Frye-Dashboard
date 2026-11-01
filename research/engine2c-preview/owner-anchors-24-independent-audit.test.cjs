const test=require('node:test');
const assert=require('node:assert/strict');
const owner=require('../../public/engine2c-research/owner-anchors-v1.js');
// Independent owner transcription, 2026-11-01; do not derive expected values from code under test.
const expected=[
['submicro','A Low','2026-10-26','01:00',7660],['submicro','A High','2026-10-21','11:00',7810.5],['submicro','B high','2026-10-28','13:00',7819.5],
['micro','A High','2026-10-21','11:00',7810.5],['micro','A Low','2026-10-26','01:00',7660],['micro','B high','2026-10-28','13:00',7819.5],
['subminute','A High','2026-08-13','06:00',7908.25],['subminute','A Low','2026-09-16','11:00',7575],['subminute','B high','2026-10-06','09:00',7895.5],
['minute','W1 starting low','2026-07-30','12:30',7412.5],['minute','W1 ending high','2026-08-13','06:00',7906.25],
['minor','W1 starting low','2026-03-30','17:00',6417],['minor','W1 ending high','2026-04-10','08:00',6948.75],['minor','W2 ending low','2026-04-12','15:00',6829],['minor','W3 ending high','2026-06-02','19:00',7694.25],['minor','W4 ending low','2026-07-29','13:30',7398],
['intermediate','W1 starting low','2025-04-08','07:00',5188.5],['intermediate','W1 ending high','2026-01-28','10:00',7151],['intermediate','W2 ending low','2026-03-30','03:00',6407],
['primary','W1 starting low','2020-04-02','08:00',3200],['primary','W1 ending high','2022-01-05','10:00',5620],['primary','W2 ending low','2022-10-12','09:00',4306],['primary','W3 ending high','2025-02-20','09:00',6487],['primary','W4 ending low','2025-04-09','07:00',5182]
];
test('all 24 original owner values match, in order, with no replacement',()=>{
 assert.equal(owner.anchors.length,24);
 assert.deepEqual(owner.anchors.map(a=>[a.degree,a.label,a.date,a.time,a.price]),expected);
});
test('all 24 Arizona wall times convert to exact UTC offset with no DST changes',()=>{
 for(const a of owner.anchors){
  const expectedUTC=new Date(a.date+'T'+a.time+':00-07:00').toISOString();
  assert.equal(a.timestampUtc,expectedUTC,a.id);
  assert.equal(a.timezone,'America/Phoenix');
 }
});
test('seven degree grouping and missing active endpoints remain absent',()=>{
 assert.deepEqual(Object.fromEntries(['submicro','micro','subminute','minute','minor','intermediate','primary'].map(d=>[d,owner.grouped(d).length])),{
  submicro:3,micro:3,subminute:3,minute:2,minor:5,intermediate:3,primary:5
 });
 assert.equal(owner.anchors.some(a=>a.price==null),false);
 assert.equal(owner.anchors.some(a=>a.label==='W5 active'||a.label==='W3 active'),false);
});
test('all 24 source coordinates can be drawn independently with matching synthetic candle times',()=>{
 const calls={cross:0,text:0};
 const ctx={save(){},restore(){},beginPath(){},rect(){},clip(){},setLineDash(){},moveTo(){},lineTo(){},stroke(){calls.cross++},fillText(){calls.text++}};
 const visible=owner.anchors.map(a=>({timestampNs:String(Date.parse(a.timestampUtc)*1000000)})).sort((a,b)=>Number(BigInt(a.timestampNs)-BigInt(b.timestampNs)));
 const result=owner.draw({ctx,visible,plot:{left:50,right:950,top:20,bottom:700,lo:3000,hi:8200},degree:'ALL'});
 assert.equal(result.drawn,24);
 assert.equal(calls.text,24);
});
