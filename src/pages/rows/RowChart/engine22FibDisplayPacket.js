// Engine 2F: read-only, owner-authorized ES Fibonacci display adapter.
// No Fibonacci math, model selection heuristics, or trading authority.
// The backend authorized selection owns current model identity and price updates.
const DEGREES = ["primary", "intermediate", "minor", "minute", "micro", "submicro"];

export function normalizeEngine22FibPacket(strategy, scenarioSelections = {}) {
  const authorized = strategy?.authorizedWorkingStructure;
  const valid = authorized?.schema === "engine22.authorizedWorkingStructure.v1" &&
    authorized?.mode === "READ_ONLY" && authorized?.noExecution === true &&
    Number.isInteger(authorized?.publicationRevision);
  const degrees = {};
  for (const degree of DEGREES) {
    const d = valid ? authorized?.degrees?.[degree] : null;
    let levels = d?.available === true && Array.isArray(d.levels)
      ? d.levels.map((level, i) => ({
          ratio: String(level?.label ?? level?.ratio ?? level?.key ?? i + 1),
          price: Number(level?.price),
          status: level?.status ?? null,
        })).filter(level => Number.isFinite(level.price) && level.price > 0)
      : [];
    // The owner-approved Submicro selection explicitly contains TWO alternatives.
    // Keep their labels and prices distinct; never combine them into one wave count.
    if (degree === "submicro" && valid && d?.available === true &&
        d?.sourcePath === "currentWavelength.degrees.submicro.submicroCompare" &&
        d?.modelVersion === "engine22.submicroCompareNov1.v1") {
      const selected = strategy?.currentWavelength?.degrees?.submicro?.submicroCompare;
      if (selected?.version === d.modelVersion &&
          selected?.activeWave === d.activeWave &&
          selected?.direction === d.direction) {
        const choice = scenarioSelections.submicro || "option1";
        levels = (choice === "both" ? ["option1","option2"] : [choice]).flatMap(option => {
          const group = selected[option];
          return Array.isArray(group?.levels) ? group.levels.map((level,i)=>({
            ratio: `${option.toUpperCase()} ${String(level?.label ?? level?.ratio ?? i+1)}`,
            price: Number(level?.price),
            status: level?.status ?? null,
          })).filter(level=>Number.isFinite(level.price)&&level.price>0) : [];
        });
      }
    }
    if (degree === "subminute" && valid && d?.available === true &&
        d?.sourcePath === "currentWavelength.degrees.subminute.ownerSubminuteCDownOct31" &&
        d?.modelVersion === "engine22.subminuteCDownOct31OwnerWorking.v1") {
      const model = strategy?.currentWavelength?.degrees?.subminute?.ownerSubminuteCDownOct31;
      if (model?.version === d.modelVersion && model?.activeWave === d.activeWave &&
          model?.direction === d.direction) {
        const choice = scenarioSelections.subminute || "wick";
        levels = (choice === "both" ? ["wick","body"] : [choice]).flatMap(method => {
          const group = model.fibReferences?.[method];
          return Array.isArray(group?.levels) ? group.levels.map((level,i)=>({
            ratio: method.toUpperCase() + " " + String(level?.label ?? level?.ratio ?? i+1),
            price: Number(level?.price), status: level?.status ?? null
          })).filter(level=>Number.isFinite(level.price)&&level.price>0) : [];
        });
      }
    }
    // Engine22's Nov 10 research Fib projections accompany the current
    // workingWaveNodes chart snapshot, while authorizedWorkingStructure may
    // still identify an older canonical count. These are WATCH display-only
    // projections, never replacement approvals or broker signals.
    if(valid && (degree==="micro"||degree==="submicro")){
      const current=strategy?.currentWavelength?.degrees?.[degree];
      const model=degree==="micro"
        ?current?.ownerMicroW3Nov9ReclassifiedResearch
        :current?.ownerSubmicroW3Nov9InternalResearch;
      const expected=degree==="micro"
        ?"engine22.ownerMicroW3Nov9ReclassifiedResearch.v1"
        :"engine22.ownerSubmicroW3Nov9InternalResearch.v1";
      const sourceLevels=degree==="micro"
        ?model?.w4RetracementLevels:model?.cDownExtensionLevels;
      const sourceAnchors=model?.anchors;
      const validAnchors=degree==="micro"
        ?sourceAnchors?.w3High===7600&&sourceAnchors?.w2Low===7362
        :sourceAnchors?.aHigh===7600&&sourceAnchors?.aLow===7507.25&&sourceAnchors?.bHigh===7566;
      if(model?.version===expected&&model?.degree===degree&&
         model?.selectionStatus==="RESEARCH_ONLY"&&validAnchors&&
         Array.isArray(sourceLevels)&&sourceLevels.length===6&&
         sourceLevels.every(l=>l?.status==="WATCH"&&l?.provisional===true&&
           Number.isFinite(l?.price)&&l.price>0&&
           Number.isFinite(l?.ratio)&&
           (degree==="micro"?l.levelType==="MICRO_W4_DOWN_RETRACEMENT_RESEARCH":
              l.levelType==="SUBMICRO_C_DOWN_EXTENSION_RESEARCH"))){
        levels=sourceLevels.map(l=>({
          ratio:String(l.label??l.ratio),price:l.price,
          status:"WATCH",provisional:true,
        }));
      }
    }
    degrees[degree] = {
      degree, available: Boolean(d?.available === true && levels.length > 0),
      sourcePath: d?.sourcePath ?? null,
      modelVersion: d?.modelVersion ?? null,
      activeWave: d?.activeWave ?? null,
      direction: d?.direction ?? null,
      levels,
    };
  }
  return { schema: "engine2f.fibDisplay.v1", publicationRevision: valid ? authorized.publicationRevision : null, degrees };
}
