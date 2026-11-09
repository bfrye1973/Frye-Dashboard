import {
  HISTORY_SCHEMA,createEngine22RevisionHistoryReader,fetchOwnerWaveHistoryPage,
  engine22HistoryAvailableFromSnapshot,
} from "./engine22RevisionHistoryReader";
const node=(revision,publicationRevision,price,plotAllowed=false)=>({
  nodeId:"micro-w1",sourceRevision:revision,publicationRevision,
  esPrice:price,marketAtUtc:"2026-11-06T14:40:00.000Z",
  approvalStatus:"RESEARCH",plotAllowed,
});
const page=(afterRevision,nextRevision,records=[],hasMore=false)=>({
  schema:HISTORY_SCHEMA,readOnly:true,
  afterRevision,nextRevision,hasMore,records
});

test("historical node revisions are append-only; full cursor replay after disconnection",async()=>{
 const queue=[
   page(0,1,[node(1,1,7469)],true),
   page(1,2,[],true),
   page(2,3,[node(2,3,7469.25)],false),
   page(3,3,[],false),
 ];
 const calls=[],updates=[];
 const reader=createEngine22RevisionHistoryReader({
   getPage:async args=>{calls.push(args);return queue.shift()},
   onUpdate:v=>updates.push(v)
 });
 const state=await reader.catchUp();
 expect(state.cursor).toBe(3);
 expect(state.records.map(n=>n.esPrice)).toEqual([7469,7469.25]);
 expect(state.records.map(n=>n.sourceRevision)).toEqual([1,2]);
 expect((await reader.catchUp()).records).toHaveLength(2);
 expect(calls.map(x=>x.afterRevision)).toEqual([0,1,2,3]);
 expect(updates).toHaveLength(1);
 reader.close();
});

test("server approval field is retained without client promotion",async()=>{
 const r=createEngine22RevisionHistoryReader({
  getPage:async ()=>page(0,1,[node(1,1,7469.25,true)])
 });
 const state=await r.catchUp();
 expect(state.records[0].plotAllowed).toBe(true);
 expect(state.records[0].approvalStatus).toBe("RESEARCH");
 r.close();
});

test("reject missing, stale or corrupt cursors and node revisions",async()=>{
 for(const response of [
   {...page(0,0,[],true)},
   {...page(0,1,[]),schema:"unknown"},
   {...page(0,1,[node(1,2,7469)])},
   {...page(0,1,[{nodeId:"no-revision",publicationRevision:1,plotAllowed:false}])},
 ]){
  const r=createEngine22RevisionHistoryReader({getPage:async()=>response});
  await expect(r.catchUp()).rejects.toThrow();
  r.close();
 }
});

test("network fetch uses only owner research credential, no private history bearer token",async()=>{
 const fake=jest.fn(async()=>({ok:true,json:async()=>page(0,0,[])}));
 const v=await fetchOwnerWaveHistoryPage({
   ownerKey:"owner-test-key",afterRevision:8,limit:50,fetcher:fake
 });
 expect(v.schema).toBe(HISTORY_SCHEMA);
 const [url,request]=fake.mock.calls[0];
 expect(url).toBe("https://frye-market-backend-1.onrender.com/api/engine22/wave-history/nodes?afterRevision=8&limit=50");
 expect(request.headers["x-engine2c-access"]).toBe("owner-test-key");
 expect(request.headers.Authorization).toBeUndefined();
 expect(request.credentials).toBe("omit");
 expect(request.cache).toBe("no-store");
 await expect(fetchOwnerWaveHistoryPage({ownerKey:null,fetcher:fake}))
   .rejects.toThrow(/OWNER_ACCESS_REQUIRED/);
});

test("history catch-up is gated on actual backend strategy sibling, never nested wave display",()=>{
 const snap={strategies:{"intraday_scalp@10m":{
   engine22WaveStrategy:{workingWaveNodes:{fingerprint:"research-revision-a"},
     engine22WaveHistory:{available:true}},
   engine22WaveHistory:{available:false}
 }}};
 expect(engine22HistoryAvailableFromSnapshot(snap)).toBe(false);
 snap.strategies["intraday_scalp@10m"].engine22WaveHistory.available=true;
 expect(engine22HistoryAvailableFromSnapshot(snap)).toBe(true);
 delete snap.strategies["intraday_scalp@10m"].engine22WaveHistory;
 expect(engine22HistoryAvailableFromSnapshot(snap)).toBe(false);
 expect(engine22HistoryAvailableFromSnapshot(null)).toBe(false);
});
