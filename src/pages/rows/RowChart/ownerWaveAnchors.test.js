import {
  OWNER_WAVE_ANCHORS,
  OWNER_RESEARCH_WAVE_ANCHORS,
  ALL_OWNER_WAVE_ANCHORS,
  ownerAnchorsForDegree,
} from "./ownerWaveAnchors";

test("retains every existing historical anchor and adds only dated research nodes",()=>{
  expect(OWNER_WAVE_ANCHORS).toHaveLength(24);
  expect(OWNER_RESEARCH_WAVE_ANCHORS).toHaveLength(15);
  expect(ALL_OWNER_WAVE_ANCHORS).toHaveLength(39);
  expect(ALL_OWNER_WAVE_ANCHORS.slice(0,24)).toEqual(OWNER_WAVE_ANCHORS);
  expect(new Set(ALL_OWNER_WAVE_ANCHORS.map(n=>n.id)).size).toBe(39);
  expect(OWNER_RESEARCH_WAVE_ANCHORS.every(n=>n.classification==="RESEARCH")).toBe(true);
  expect(OWNER_RESEARCH_WAVE_ANCHORS.every(n=>
    Number.isFinite(n.timeSec)&&Number.isFinite(n.price)&&
    Number.isInteger(n.price*4))).toBe(true);
});

test("all seven Elliott Wave degrees remain available on the existing chart",()=>{
  expect([...new Set(ownerAnchorsForDegree("ALL").map(n=>n.degree))].sort()).toEqual([
    "primary","intermediate","minor","minute","subminute","micro","submicro",
  ].sort());
  for(const degree of ["primary","intermediate","minor","minute","subminute","micro","submicro"]){
    expect(ownerAnchorsForDegree(degree).length).toBeGreaterThan(0);
    expect(ownerAnchorsForDegree(degree).every(n=>n.degree===degree)).toBe(true);
  }
});

test("corrected Micro W1 high uses exactly Nov6 07:50 Arizona at 7469.25",()=>{
  const node=ownerAnchorsForDegree("micro").find(n=>n.label==="W1 ending high");
  expect(node).toMatchObject({
    date:"2026-11-06",time:"07:50",price:7469.25,
    classification:"RESEARCH",sourceRow:"Micro W1-W2 Proposed!3",
  });
  expect(node.timeSec).toBe(Date.parse("2026-11-06T14:50:00Z")/1000);
  // The owner did NOT correct the different Submicro A node.
  const separate=ownerAnchorsForDegree("submicro").find(n=>n.label==="A starting high");
  expect(separate.price).toBe(7469.75);
  expect(separate.timeSec).toBe(node.timeSec);
});

test("no unverified wave endings or UNKNOWN timestamps become plotted dots",()=>{
  const unknown=[
    ["minor","W2 observed low candidate"],
    ["subminute","C ending low"],
    ["micro","W2 developing low"],
    ["submicro","C ending low"],
  ];
  for(const [degree,label] of unknown){
    expect(ownerAnchorsForDegree(degree).some(n=>n.label===label)).toBe(false);
  }
  expect(ownerAnchorsForDegree("minute").find(n=>n.label==="C observed low candidate")
    .classification).toBe("RESEARCH");
});

test("two owner-supplied Aug14 highs preserve distinct Arizona timestamps",()=>{
  const minor=ownerAnchorsForDegree("minor").find(n=>n.label==="W1 ending high");
  const minute=ownerAnchorsForDegree("minute").find(n=>n.label==="A starting high");
  expect(minor.timeSec).toBe(Date.parse("2026-08-14T10:00:00Z")/1000);
  expect(minute.timeSec).toBe(Date.parse("2026-08-14T14:00:00Z")/1000);
  expect(minor.timeSec).not.toBe(minute.timeSec);
});
