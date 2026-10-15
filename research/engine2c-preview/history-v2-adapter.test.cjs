const {test}=require('node:test');
const assert=require('node:assert/strict');
const {PINS,validatePage,createLoader}=require('./history-v2-adapter.js');
const view='ACTUAL_CONTRACT',frame='10m',pin=PINS[view];
const row=i=>({researchCandleId:'auth-'+i,frame,priceBasisVersion:pin.basis,sourceContract:'ESZ2026',adjustment:0,timestampUtc:new Date(1790000000000-i*600000).toISOString(),prices:{open:6000,high:6002,low:5998,close:6001},structuralEligible:false,executionPriceAuthority:false});
const page=(ids,cursor,next)=>({datasetVersion:pin.dataset,priceBasisVersion:pin.basis,frame,direction:'DESC',researchOnly:true,structuralEligible:false,executionPriceAuthority:false,requestCursor:cursor,nextCursor:next,rows:ids.map(row)});
test('T27: rejects mixed basis, execution authority and archive contract',()=>{
 assert.doesNotThrow(()=>validatePage(page([1],null,'c1'),view,frame,null));
 assert.throws(()=>validatePage({...page([1],null,'c1'),priceBasisVersion:'other'},view,frame,null));
 assert.throws(()=>validatePage({...page([1],null,'c1'),rows:[{...row(1),sourceContract:'ESU2026'}]},view,frame,null));
 assert.throws(()=>validatePage({...page([1],null,'c1'),executionPriceAuthority:true},view,frame,null));
});
test('T24: older pinned pages and terminal cursor never restart',async()=>{
 const called=[];const loader=createLoader(async request=>{called.push(request.cursor);return request.cursor===null?page([1,2],null,'c1'):page([3],'c1',null)});
 const session=loader.configure(view,frame);
 assert.equal((await session.next()).rows.length,2);
 assert.equal((await session.next()).rows.length,1);
 assert.equal(await session.next(),null);
 assert.deepEqual(called,[null,'c1']);
});
test('T25: view selection invalidates responses from previous generations',async()=>{
 let resolveOld;
 const loader=createLoader(args=>args.view==='UNADJUSTED'?new Promise(r=>resolveOld=r):Promise.resolve(page([1],null,null)));
 const old=loader.configure('UNADJUSTED','10m');const pending=old.next();
 const next=loader.configure(view,frame);await next.next();
 resolveOld({bad:true});
 assert.equal(await pending,null);
});
test('T24: cursor loop fails closed',async()=>{
 const loader=createLoader(async a=>page([1],a.cursor,'loop'));
 const s=loader.configure(view,frame);await s.next();
 await assert.rejects(()=>s.next(),/CURSOR_NOT_ADVANCING/);
});
