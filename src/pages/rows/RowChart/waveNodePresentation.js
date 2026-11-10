// Presentation settings ONLY. Elliott Wave identity, price, timestamp,
// validation and revisions remain owned by Engine22 and the existing overlay.
export const WAVE_NODE_DEGREES=Object.freeze([
  ["PRIMARY","Primary","#facc15"],
  ["INTERMEDIATE","Intermediate","#fb7185"],
  ["MINOR","Minor","#f472b6"],
  ["MINUTE","Minute","#a78bfa"],
  ["SUBMINUTE","Subminute","#38bdf8"],
  ["MICRO","Micro","#22c55e"],
  ["SUBMICRO","Submicro","#f59e0b"],
]);

export const createDefaultWaveNodeStyles=()=>Object.fromEntries(
  WAVE_NODE_DEGREES.map(([degree,,color])=>[degree,{
    color,lineColor:color,showDots:true,showLabels:true,
    showLines:false,markerRadius:5,labelFontPx:16,lineWidth:2,
  }])
);

const clamp=(n,min,max,fallback)=>
  Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback;
const hex=v=>typeof v==="string"&&/^#[a-fA-F0-9]{6}$/.test(v);
export function waveNodeDisplayStyle(styles,degree){
  const defaults=createDefaultWaveNodeStyles()[degree]||
    {color:"#fbbf24",lineColor:"#fbbf24",showDots:true,
      showLabels:true,showLines:false,markerRadius:5,labelFontPx:16,lineWidth:2};
  const actual=styles?.[degree]||{};
  return {
    color:hex(actual.color)?actual.color:defaults.color,
    lineColor:hex(actual.lineColor)?actual.lineColor:defaults.lineColor,
    showDots:actual.showDots!==false,
    showLabels:actual.showLabels!==false,
    showLines:actual.showLines===true,
    markerRadius:clamp(actual.markerRadius,2,12,defaults.markerRadius),
    labelFontPx:clamp(actual.labelFontPx,12,28,defaults.labelFontPx),
    lineWidth:clamp(actual.lineWidth,1,8,defaults.lineWidth),
  };
}
