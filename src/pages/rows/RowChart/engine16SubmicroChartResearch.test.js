import {detectSubmicroChartAbc,ENGINE16_SUBMICRO_CHART_SCHEMA} from "./engine16SubmicroChartResearch";
const rows=[
  [110,113,108,111],[111,112,107,109],[109,111,100,103],
  [103,112,102,110],[110,118,109,117],[117,125,115,123],
  [120,122,113,116],[116,119,108,110],[110,115,106,108],
  [108,112,104,107],[107,116,105,114],[114,122,111,120],
  [120,127,117,124],[124,131,121,124],[126,129,119,122],
  [122,124,116,118]
];
const bars=rows.map(([open,high,low,close],i)=>({
  time:1794182400+i*600,open,high,low,close
}));
const run=(input=bars,params={})=>detectSubmicroChartAbc(input,{contractVerified:true,...params});
test("fails closed when physical chart feed is not verified",()=>{
  const x=detectSubmicroChartAbc(bars,{contractVerified:false});
  expect(x.status).toBe("UNAVAILABLE");
  expect(x.reason).toBe("CONTRACT_NOT_VERIFIED");
  expect(x.candidate).toBeNull();
});
test("finds 0/A/B before completed C with source candle times and three-anchor Fib",()=>{
  const x=run();
  expect(x.schema).toBe(ENGINE16_SUBMICRO_CHART_SCHEMA);
  expect(x.candidate).toBeTruthy();
  expect(x.candidate.direction).toBe("UP");
  expect(x.candidate.start.price).toBe(100);
  expect(x.candidate.A.price).toBe(125);
  expect(x.candidate.B.price).toBe(104);
  expect(x.candidate.targets.find(t=>t.ratio===1).price).toBe(129);
  expect(x.candidate.orthodoxSubdivisionsVerified).toBe(false);
  expect(x.alternatives[0].sharedPivotId).toBe(x.candidate.B.id);
});
test("C? only after qualifying CLOSED successor; extension cancels endpoint only",()=>{
  const withoutReversal=run(bars.slice(0,14));
  expect(withoutReversal.candidate.status).toBe("C_DEVELOPING");
  const withReversal=run();
  expect(withReversal.candidate.status).toBe("C_COMPLETION_CANDIDATE");
  expect(withReversal.candidate.cCompletionEvidence.reversalCandle).toBe(bars[14].time);
  const extending=run([...bars.slice(0,15),{...bars[15],high:140,close:133}]);
  expect(extending.candidate.status).toBe("C_DEVELOPING");
  expect(extending.candidate.extreme.price).toBe(140);
  expect(extending.candidate.structuralInvalidation.status).toBe("UNKNOWN");
});
test("latest forming candle never contributes to right-hand pivot confirmation",()=>{
  const first=run(bars);
  const extended=run([...bars.slice(0,15),{...bars[15],high:140,close:133}]);
  expect(extended.candidate.B).toEqual(first.candidate.B);
  expect(first.candidate.knownAtCandle).toBeLessThan(bars.at(-1).time);
});
test("strict no fabricated candle on duplicate, unordered or malformed source",()=>{
  expect(run([...bars.slice(0,-1),{...bars.at(-1),time:bars.at(-2).time}]).status).toBe("UNAVAILABLE");
  expect(run([...bars.slice(0,-1),{...bars.at(-1),low:999}]).status).toBe("UNAVAILABLE");
  expect(run(bars.slice(0,6)).status).toBe("UNAVAILABLE");
});
