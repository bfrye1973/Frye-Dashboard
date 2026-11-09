// Engine 2: strictly read-only Engine22 Strategy node snapshot validation.
// Does not calculate pivots, alter ES prices, confirm a count, or fetch candles.
export const ENGINE22_WORKING_NODES_SCHEMA="engine22.workingWaveNodes.v1";
const ALLOWED=new Set(["micro","submicro"]);
const validUtc=v=>typeof v==="string" &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(v) &&
  Number.isFinite(Date.parse(v));
const esTick=v=>typeof v==="number"&&Number.isFinite(v)&&v>0 &&
  Math.abs(v*4-Math.round(v*4))<1e-8;

export function validatedEngine22WorkingNodeAnchors(packet,degree){
  if(!packet||packet.schema!==ENGINE22_WORKING_NODES_SCHEMA ||
     packet.authority!=="ENGINE22"||packet.available!==true ||
     packet.symbol!=="ES"||packet.readOnly!==true||packet.noExecution!==true||
     packet.ownerCountPromotion!==false ||
     typeof packet.fingerprint!=="string"||!packet.fingerprint||
     !ALLOWED.has(degree)) return null; // Null means the new backend isn't available.
  const section=packet.degrees?.[degree];
  if(!section||section.degree!==degree||!Array.isArray(section.nodes))return null;
  const ids=new Set();
  const out=[];
  for(const n of section.nodes){
    if(n.degree!==degree||n.approvalStatus!=="RESEARCH" ||
       n.selectedForResearchDisplay!==true||
       !n.sourcePath?.startsWith("currentWavelength.degrees."+degree+".")||
       typeof n.nodeId!=="string"||!n.nodeId||
       typeof n.modelVersion!=="string"||!n.modelVersion||
       typeof n.sourceRevision!=="string"||!n.sourceRevision||
       typeof n.label!=="string"||!n.label ||
       typeof n.priceBasisStatus!=="string"||
       !esTick(n.price)||!validUtc(n.marketAtUtc)||
       n.presentationAllowed!==true||n.plotAllowed!==false||
       n.noExecution!==true||n.waveCompletionConfirmed!==false)
       continue; // Research may be incomplete; missing points are never invented.
    if(ids.has(n.nodeId))continue;
    ids.add(n.nodeId);
    out.push({
      id:n.nodeId,degree,label:n.label,
      date:n.marketAtUtc.slice(0,10),time:null,
      price:n.price,timeSec:Math.floor(Date.parse(n.marketAtUtc)/1000),
      classification:"OWNER RESEARCH",
      modelVersion:n.modelVersion,sourcePath:n.sourcePath,
      sourceRevision:n.sourceRevision,
      source:"ENGINE22_STRATEGY_SNAPSHOT",
      ownerMarketAtUtc:n.marketAtUtc,
      reviewOnly:true,executionEligible:false,
    });
  }
  return out;
}

export function waveNodeFeedChanged(current,next){
  return Boolean(next?.schema===ENGINE22_WORKING_NODES_SCHEMA &&
    next?.authority==="ENGINE22"&&next?.available===true &&
    typeof next.fingerprint==="string"&&next.fingerprint &&
    next.fingerprint!==current?.fingerprint);
}
