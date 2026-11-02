import test from "node:test";
import assert from "node:assert/strict";
import { normalizeEngine22FibPacket } from "../src/pages/rows/RowChart/engine22FibDisplayPacket.js";

const expected = [7724,7668,7628,7577.25,7521.25];
function fixture() {
  return { authorizedWorkingStructure: {
    schema:"engine22.authorizedWorkingStructure.v1", mode:"READ_ONLY", noExecution:true,
    publicationRevision:5, degrees: Object.fromEntries(
      ["primary","intermediate","minor","minute","micro"].map(degree => [degree, {
        available:true, sourcePath:degree === "micro"
          ? "currentWavelength.degrees.micro.ownerMicroCDownOct31" : "degreeStates."+degree,
        modelVersion:"test-model", levels:(degree === "micro" ? expected : [7800]).map((price,i)=>({
          label:String(i+1),price,status:"WATCH"
        }))
      }])
    )
  }};
}
test("five independently available ES Fib degrees",()=>{
  const p=normalizeEngine22FibPacket(fixture());
  assert.equal(Object.keys(p.degrees).length,5);
  for(const degree of ["primary","intermediate","minor","minute","micro"])
    assert.equal(p.degrees[degree].available,true);
  assert.deepEqual(p.degrees.micro.levels.map(x=>x.price),expected);
});
test("no fabricated prices when authorization is missing",()=>{
  const p=normalizeEngine22FibPacket({});
  assert(Object.values(p.degrees).every(x=>!x.available&&x.levels.length===0));
});
test("updated authorized levels flow through without hardcoded prices",()=>{
  const f=fixture();
  f.authorizedWorkingStructure.degrees.micro.levels[0].price=7723.75;
  assert.equal(normalizeEngine22FibPacket(f).degrees.micro.levels[0].price,7723.75);
});
test("reject unavailable degree without disturbing other degrees",()=>{
  const f=fixture();
  f.authorizedWorkingStructure.degrees.minor.available=false;
  const p=normalizeEngine22FibPacket(f);
  assert.equal(p.degrees.minor.available,false);
  assert.equal(p.degrees.micro.available,true);
});
