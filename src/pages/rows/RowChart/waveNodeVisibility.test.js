import {DEFAULT_VISIBLE_WAVE_DEGREES,toggleVisibleWaveDegree} from "./waveNodeVisibility";

test("Primary Intermediate Minor Micro and Submicro start on together for owner review",()=>{
  expect(DEFAULT_VISIBLE_WAVE_DEGREES).toEqual([
    "PRIMARY","INTERMEDIATE","MINOR","MICRO","SUBMICRO"
  ]);
  expect(new Set(DEFAULT_VISIBLE_WAVE_DEGREES).size).toBe(5);
});

test("turning Intermediate off retains Primary and Submicro",()=>{
  const original=[...DEFAULT_VISIBLE_WAVE_DEGREES];
  const after=toggleVisibleWaveDegree(original,"INTERMEDIATE",false);
  expect(after).toEqual(["PRIMARY","MINOR","MICRO","SUBMICRO"]);
  expect(original).toEqual(["PRIMARY","INTERMEDIATE","SUBMICRO"]);
});

test("toggling a degree on twice never duplicates its overlay",()=>{
  const original=[...DEFAULT_VISIBLE_WAVE_DEGREES];
  expect(toggleVisibleWaveDegree(original,"PRIMARY",true)).toEqual(original);
  const noMinor=toggleVisibleWaveDegree(original,"MINOR",false);
  const withMinor=toggleVisibleWaveDegree(noMinor,"MINOR",true);
  expect(withMinor).toEqual(["PRIMARY","INTERMEDIATE","MICRO","SUBMICRO","MINOR"]);
  expect(toggleVisibleWaveDegree(withMinor,"MINOR",true)).toEqual(withMinor);
});

test("independent toggles cannot enable a nonexistent Engine22 degree",()=>{
  const initial=[...DEFAULT_VISIBLE_WAVE_DEGREES];
  expect(toggleVisibleWaveDegree(initial,"NOT_A_DEGREE",true)).toEqual(initial);
  expect(toggleVisibleWaveDegree(initial,"",true)).toEqual(initial);
  expect(toggleVisibleWaveDegree(initial,"SUBMICRO",false))
   .toEqual(["PRIMARY","INTERMEDIATE","MINOR","MICRO"]);
  expect(toggleVisibleWaveDegree([],"PRIMARY",true)).toEqual(["PRIMARY"]);
});
