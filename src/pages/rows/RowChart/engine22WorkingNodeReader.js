// Engine 2: strictly read-only Engine22 Strategy node snapshot validation.
// Does not calculate pivots, alter ES prices, confirm a count, or fetch candles.
export const ENGINE22_WORKING_NODES_SCHEMA="engine22.workingWaveNodes.v1";
export const ENGINE22_NODE_DEGREES=Object.freeze(["primary","intermediate","minor","minute","subminute","micro","submicro"]);
const ALLOWED=new Set(ENGINE22_NODE_DEGREES);
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
       !(n.sourcePath?.startsWith("currentWavelength.degrees."+degree+".")||
         (["primary","intermediate","minor"].includes(degree)&&n.sourcePath==="degreeStates."+degree))||
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
    // Keep the owner's original Arizona event time alongside the UTC
    // timestamp that maps to Engine11's real candle opening.
    const arizona=typeof n.ownerArizonaTime==="string"
      ? /^(\d{4}-\d{2}-\d{2}) ([01]\d|2[0-3]):([0-5]\d) AZ$/.exec(n.ownerArizonaTime)
      : null;
    out.push({
      id:n.nodeId,degree,label:n.label,
      date:arizona?.[1]??n.marketAtUtc.slice(0,10),
      time:arizona?arizona[2]+":"+arizona[3]:null,
      ownerArizonaTime:n.ownerArizonaTime??null,
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

// A missing or unverified Engine22 source always fails closed. No archived
// owner-sheet anchors may be substituted for current seven-degree nodes.
export function currentEngine22DegreeAnchors(packet,degree){
  if(!ALLOWED.has(degree))return [];
  const nodes=validatedEngine22WorkingNodeAnchors(packet,degree)??[];
  // The owner-revised Submicro ABC correction supersedes the earlier
  // internal W1/W2 research *display*, not those immutable source records.
  // Only apply this presentation rule when the complete ABC handoff is
  // published from the same selected Engine22 model. Partial ABC updates
  // fail safely to the original publisher-selected node set.
  if(degree==="submicro"){
    const abc=["A starting high","A ending low","B ending high"];
    const models=new Map();
    for(const n of nodes){
      const key=n.sourcePath+"|"+n.modelVersion;
      if(!models.has(key))models.set(key,new Set());
      models.get(key).add(n.label);
    }
    const activeModels=new Set([...models].filter(([,labels])=>
      abc.every(label=>labels.has(label))).map(([key])=>key));
    if(activeModels.size)return nodes.filter(n=>{
      const key=n.sourcePath+"|"+n.modelVersion;
      return !activeModels.has(key)||!(n.label.startsWith("W1 ")||n.label.startsWith("W2 "));
    });
  }
  return nodes;
}
// Compatibility export for existing chart consumers; identical source contract.
export function currentEngine22MicroSubmicroAnchors(packet,degree){
  return degree==="micro"||degree==="submicro"
    ? currentEngine22DegreeAnchors(packet,degree):[];
}
