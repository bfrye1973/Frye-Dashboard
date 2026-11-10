import {
  WAVE_NODE_DEGREES,createDefaultWaveNodeStyles,waveNodeDisplayStyle,
} from "./waveNodePresentation";

test("seven degrees each have independent colors and lines OFF by default",()=>{
 const defaults=createDefaultWaveNodeStyles();
 expect(WAVE_NODE_DEGREES.map(([degree])=>degree)).toEqual([
  "PRIMARY","INTERMEDIATE","MINOR","MINUTE","SUBMINUTE","MICRO","SUBMICRO"
 ]);
 expect(Object.keys(defaults)).toHaveLength(7);
 expect(new Set(Object.values(defaults).map(x=>x.color)).size).toBe(7);
 for(const degree of Object.keys(defaults)){
  const style=waveNodeDisplayStyle(defaults,degree);
  expect(style.showDots).toBe(true);
  expect(style.showLabels).toBe(true);
  expect(style.showLines).toBe(false);
  expect(style.markerRadius).toBe(5);
  expect(style.labelFontPx).toBe(16);
 }
});

test("changing the line/color/width on one degree cannot affect another",()=>{
 const settings=createDefaultWaveNodeStyles();
 const beforePrimary=waveNodeDisplayStyle(settings,"PRIMARY");
 const next={...settings,SUBMICRO:{...settings.SUBMICRO,
  color:"#112233",lineColor:"#445566",showLines:true,
  lineWidth:4.5,labelFontPx:18,markerRadius:8
 }};
 expect(waveNodeDisplayStyle(next,"SUBMICRO")).toMatchObject({
  color:"#112233",lineColor:"#445566",showLines:true,
  lineWidth:4.5,labelFontPx:18,markerRadius:8
 });
 expect(waveNodeDisplayStyle(next,"PRIMARY")).toEqual(beforePrimary);
 expect(settings.SUBMICRO.showLines).toBe(false);
});

test("malformed style values cannot create invalid canvas widths or colors",()=>{
 const style=waveNodeDisplayStyle({
  MICRO:{color:"red",lineColor:"bad",lineWidth:100,
    labelFontPx:-50,markerRadius:100,showDots:false,showLabels:false,
    showLines:true}
 },"MICRO");
 expect(style.color).toBe("#22c55e");
 expect(style.lineColor).toBe("#22c55e");
 expect(style.lineWidth).toBe(8);
 expect(style.labelFontPx).toBe(12);
 expect(style.markerRadius).toBe(12);
 expect(style.showDots).toBe(false);
 expect(style.showLabels).toBe(false);
 expect(style.showLines).toBe(true);
});
