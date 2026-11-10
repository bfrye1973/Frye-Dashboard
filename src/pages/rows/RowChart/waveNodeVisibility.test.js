import {DEFAULT_VISIBLE_WAVE_DEGREES,toggleVisibleWaveDegree} from "./waveNodeVisibility";

test("Primary Intermediate and Submicro start on together for owner review",()=>{
  expect(DEFAULT_VISIBLE_WAVE_DEGREES).toEqual([
    "PRIMARY","INTERMEDIATE","SUBMICRO"
  ]);
  expect(new Set(DEFAULT_VISIBLE_WAVE_DEGREES).size).toBe(3);
});

test("turning Intermediate off retains Primary and Submicro",()=>{
  const original=[...DEFAULT_VISIBLE_WAVE_DEGREES];
  const after=toggleVisibleWaveDegree(original,"INTERMEDIATE",false);
  expect(after).toEqual(["PRIMARY","SUBMICRO"]);
  expect(original).toEqual(["PRIMARY","INTERMEDIATE","SUBMICRO"]);
});

test("toggling a degree on twice never duplicates its overlay",()=>{
  const original=[...DEFAULT_VISIBLE_WAVE_DEGREES];
  expect(toggleVisibleWaveDegree(original,"PRIMARY",true)).toEqual(original);
  const withMinor=toggleVisibleWaveDegree(original,"MINOR",true);
  expect(withMinor).toEqual([...original,"MINOR"]);
  expect(toggleVisibleWaveDegree(withMinor,"MINOR",true)).toEqual(withMinor);
});

test("independent toggles cannot enable a nonexistent Engine22 degree",()=>{
  const initial=[...DEFAULT_VISIBLE_WAVE_DEGREES];
  expect(toggleVisibleWaveDegree(initial,"NOT_A_DEGREE",true)).toEqual(initial);
  expect(toggleVisibleWaveDegree(initial,"",true)).toEqual(initial);
  expect(toggleVisibleWaveDegree(initial,"SUBMICRO",false))
   .toEqual(["PRIMARY","INTERMEDIATE"]);
  expect(toggleVisibleWaveDegree([],"PRIMARY",true)).toEqual(["PRIMARY"]);
});
