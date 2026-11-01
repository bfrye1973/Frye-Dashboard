import { useEffect, useRef } from "react";
import { ownerAnchorsForDegree } from "../ownerWaveAnchors";

const DEGREE_COLORS={
  submicro:"#f59e0b",micro:"#22c55e",subminute:"#38bdf8",minute:"#a78bfa",
  minor:"#f472b6",intermediate:"#fb7185",primary:"#facc15"
};

export default function OwnerWaveAnchorsOverlay({
  visible=true, chart, priceSeries, degree="ALL"
}){
  const refs=useRef([]);
  useEffect(()=>{
    for(const x of refs.current){try{x.series?.setMarkers?.([]);}catch{}}
    refs.current=[];
    if(!visible||!chart||!priceSeries)return;
    const anchors=ownerAnchorsForDegree(degree);
    // Lightweight Charts markers require a chart time. Preserve owner price
    // separately with a horizontal price line; never snap the owner price.
    const markers=anchors
      .filter(a=>Number.isFinite(a.timeSec))
      .sort((a,b)=>a.timeSec-b.timeSec)
      .map(a=>({
        time:a.timeSec,
        position:"aboveBar",
        color:DEGREE_COLORS[a.degree]||"#fbbf24",
        shape:"circle",
        text:`${a.degree.toUpperCase()} ${a.label} @ ${a.price.toFixed(2)}`
      }));
    try{priceSeries.setMarkers(markers);}catch{}
    const lines=[];
    for(const a of anchors){
      try{
        const line=priceSeries.createPriceLine({
          price:a.price,
          color:DEGREE_COLORS[a.degree]||"#fbbf24",
          lineWidth:1,
          lineStyle:2,
          axisLabelVisible:false,
          title:`${a.degree.toUpperCase()} ${a.label} ${a.price.toFixed(2)} OWNER`
        });
        lines.push(line);
      }catch{}
    }
    refs.current=[{series:priceSeries,lines}];
    return()=>{
      try{priceSeries.setMarkers([]);}catch{}
      for(const line of lines){try{priceSeries.removePriceLine(line);}catch{}}
      refs.current=[];
    };
  },[visible,chart,priceSeries,degree]);
  return null;
}
