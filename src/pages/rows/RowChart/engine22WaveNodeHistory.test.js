import {
  WAVE_DEGREES, classifyNodeRecord, createWaveNodeHistoryReader,
  verifiedNodeForChart, sameOriginWaveNodeProxy, fetchWaveNodePageFromProxy,
} from "./engine22WaveNodeHistory";

const basis="price-basis:04ec3639248269336f8df3626c6c9a3eb119ac18cbc39429addbbb2f24d22b15";
const record={
  nodeId:"n1",waveId:"w1",countId:"count1",degree:"primary",
  publicationRevision:1,sourceRevision:1,modelVersion:"engine22.v1",
  label:"W4 END",marketAtUtc:"2025-04-09T14:00:00Z",
  publishedAtUtc:"2026-11-08T18:20:00Z",esPrice:5182,
  contractSymbol:"ESM2025",priceBasisId:basis,
  approvalStatus:"OWNER_APPROVED",lifecycle:"CONFIRMED",
  plotAllowed:false,
};
const page=(nextRevision,records,hasMore=false)=>({
  schema:"engine22.chartNodeHistoryPage.v1",readOnly:true,noExecution:true,
  historicalAsOfSupported:false,afterRevision:nextRevision-1,
  nextRevision,hasMore,records,
});

test("all seven degrees retained in a fixed view order",()=>{
  expect(WAVE_DEGREES).toEqual([
    "primary","intermediate","minor","minute","subminute","micro","submicro",
  ]);
});

test("backend plotAllowed false always blocks even exact approved timestamps",()=>{
  expect(verifiedNodeForChart(record,{chartPriceBasisId:basis,historicalAsOfSupported:true})).toBe(null);
  expect(verifiedNodeForChart({...record,plotAllowed:true},{chartPriceBasisId:basis,historicalAsOfSupported:false})).toBe(null);
  expect(verifiedNodeForChart({...record,plotAllowed:true,marketAtUtc:null},{chartPriceBasisId:basis,historicalAsOfSupported:true})).toBe(null);
  expect(verifiedNodeForChart({...record,plotAllowed:true,priceBasisId:"wrong"},{chartPriceBasisId:basis,historicalAsOfSupported:true})).toBe(null);
});

test("verified node is mapped to chart seconds with original identity and price",()=>{
  const n=verifiedNodeForChart({...record,plotAllowed:true},{chartPriceBasisId:basis,historicalAsOfSupported:true});
  expect(n).toMatchObject({
    id:"n1",degree:"primary",label:"W4 END",price:5182,
    timeSec:Math.floor(Date.parse("2025-04-09T14:00:00Z")/1000),
    waveId:"w1",countId:"count1",
  });
  expect(classifyNodeRecord(record)).toBe("approved");
  expect(classifyNodeRecord({...record,approvalStatus:"RESEARCH"})).toBe("research");
  expect(classifyNodeRecord({...record,lifecycle:"SUPERSEDED"})).toBe("superseded");
});

test("incremental polling replays missing revisions and preserves original status",async()=>{
  const pages=[
    page(1,[record],true),
    page(2,[],true), // empty node publication still advances cursor
    page(3,[{...record,publicationRevision:3,sourceRevision:2,
      approvalStatus:"SUPERSEDED",lifecycle:"SUPERSEDED",plotAllowed:false}],false),
    page(3,[],false),
  ];
  const calls=[],updates=[];
  const reader=createWaveNodeHistoryReader({
    getPage:async args=>{calls.push(args);return pages.shift();},
    onUpdate:s=>updates.push(s),
  });
  const first=await reader.refresh();
  expect(first.cursor).toBe(3);
  expect(first.events).toHaveLength(2);
  expect(first.events[0].approvalStatus).toBe("OWNER_APPROVED");
  expect(first.events[1].approvalStatus).toBe("SUPERSEDED");
  const second=await reader.refresh();
  expect(second.events).toHaveLength(2);
  expect(calls.map(x=>x.afterRevision)).toEqual([0,1,2,3]);
  expect(updates).toHaveLength(1);
  reader.close();
});

test("reader blocks invalid schema, non-advancing cursor, and invalid records",async()=>{
  const invalid=createWaveNodeHistoryReader({getPage:async()=>({schema:"wrong"})});
  await expect(invalid.refresh()).rejects.toThrow(/CONTRACT_MISMATCH/);
  const stuck=createWaveNodeHistoryReader({getPage:async()=>page(0,[],true)});
  await expect(stuck.refresh()).rejects.toThrow(/CURSOR_STALLED/);
  const missing=createWaveNodeHistoryReader({getPage:async()=>page(1,[{publicationRevision:1}])});
  await expect(missing.refresh()).rejects.toThrow(/INVALID_RECORD/);
});

test("same-origin owner proxy only; never send a browser bearer secret",async()=>{
  const origin="https://frye-dashboard.onrender.com";
  expect(sameOriginWaveNodeProxy("/api/engine22/wave-history/nodes",origin))
    .toBe(origin+"/api/engine22/wave-history/nodes");
  expect(sameOriginWaveNodeProxy("https://frye-market-backend-1.onrender.com/api/engine22/wave-history/nodes",origin)).toBe(null);
  expect(sameOriginWaveNodeProxy("/api/engine22/wave-history/nodes?token=secret",origin)).toBe(null);
  const fetcher=jest.fn(async()=>({ok:true,json:async()=>page(0,[])}));
  await fetchWaveNodePageFromProxy(origin+"/api/engine22/wave-history/nodes",{
    fetcher,afterRevision:3,limit:50,
  });
  const [url,init]=fetcher.mock.calls[0];
  expect(url).toContain("afterRevision=3");
  expect(init.credentials).toBe("same-origin");
  expect(init.headers.Authorization).toBeUndefined();
});
