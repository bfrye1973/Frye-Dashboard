import {engine16FibLevelsFromStrategyCard} from "./engine16Engine22CardFibs";

const makeCard=()=>({
  authorizedWorkingStructure:{
    schema:"engine22.authorizedWorkingStructure.v1",mode:"READ_ONLY",
    noExecution:true,publicationRevision:7,
    degrees:{submicro:{degree:"submicro",available:true,
      sourcePath:"currentWavelength.degrees.submicro.ownerSelectedC",
      modelVersion:"owner-v7",activeWave:"C",direction:"UP",
      parentDegree:"micro",parentWave:"W2",
      levels:[{label:"0.618",price:7572.25,status:"WATCH"},
        {label:"1.000",price:7605.5,status:"WATCH"}]}}
  },
  currentWavelength:{degrees:{submicro:{}}}
});
test("reads exact owner-selected Engine22 prices, ratios, and provenance without Fibonacci math",()=>{
  const a=makeCard();
  const result=engine16FibLevelsFromStrategyCard(a);
  expect(result.available).toBe(true);
  expect(result.sourceEngine).toBe("ENGINE22");
  expect(result.publicationRevision).toBe(7);
  expect(result.sourcePath).toBe("currentWavelength.degrees.submicro.ownerSelectedC");
  expect(result.modelVersion).toBe("owner-v7");
  expect(result.direction).toBe("UP");
  expect(result.levels).toEqual([
    {label:"0.618",price:7572.25,status:"WATCH"},
    {label:"1.000",price:7605.5,status:"WATCH"}
  ]);
});
test("does not turn an Engine22 C DOWN ladder into a bullish Engine16 target",()=>{
  const a=makeCard();
  a.authorizedWorkingStructure.degrees.submicro.direction="DOWN";
  a.authorizedWorkingStructure.degrees.submicro.levels[0].price=7420.25;
  const result=engine16FibLevelsFromStrategyCard(a);
  expect(result.direction).toBe("DOWN");
  expect(result.levels[0].price).toBe(7420.25);
  expect(result.labelKind).toBe("OWNER_SELECTED_WORKING_LEVELS_NOT_ENGINE16_TARGETS");
});
test("missing or invalid authority fails closed instead of inventing Fib levels",()=>{
  expect(engine16FibLevelsFromStrategyCard({}).available).toBe(false);
  const a=makeCard();a.authorizedWorkingStructure.noExecution=false;
  expect(engine16FibLevelsFromStrategyCard(a).levels).toEqual([]);
  expect(engine16FibLevelsFromStrategyCard(a).reason).toBe("ENGINE22_SUBMICRO_FIB_SOURCE_UNAVAILABLE");
});
test("scenario alternatives use the same selected source card, not a merged ladder",()=>{
  const a=makeCard();
  const d=a.authorizedWorkingStructure.degrees.submicro;
  d.sourcePath="currentWavelength.degrees.submicro.submicroCompare";
  d.modelVersion="engine22.submicroCompareNov1.v1";
  a.currentWavelength.degrees.submicro.submicroCompare={
    version:d.modelVersion,activeWave:"C",direction:"UP",
    option1:{levels:[{label:"0.618",price:7400,status:"WATCH"}]},
    option2:{levels:[{label:"1.618",price:7800,status:"WATCH"}]}
  };
  expect(engine16FibLevelsFromStrategyCard({...a,submicroScenario:"option1"}).levels)
    .toEqual([{label:"OPTION1 0.618",price:7400,status:"WATCH"}]);
  expect(engine16FibLevelsFromStrategyCard({...a,submicroScenario:"option2"}).levels)
    .toEqual([{label:"OPTION2 1.618",price:7800,status:"WATCH"}]);
});
