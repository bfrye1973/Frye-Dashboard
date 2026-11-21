// Engine 2F: read-only, owner-authorized ES Fibonacci display adapter.
// No Fibonacci math, model selection heuristics, or trading authority.
// The backend authorized selection owns current model identity and price updates.
const DEGREES = ["primary", "intermediate", "minor", "minute", "subminute", "micro", "submicro"];

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
    // Current Engine22 Strategies-card research model determines the live Fib
    // family. Never retain W4/C projections after the owner advances to W5/W2.
    // These levels are copied verbatim from Engine22; no Fibonacci math here.
    let currentResearch=null;
    const current=strategy?.currentWavelength?.degrees?.[degree];
    if(degree==="micro"||degree==="submicro"){
      const model=degree==="micro"
        ?current?.ownerMicroW3Nov9ReclassifiedResearch
        :current?.ownerSubmicroW3Nov9InternalResearch;
      const activeWave=String(model?.activeWave||"").toUpperCase();
      const sourceTable=degree==="micro"?{
        W4:["w4RetracementLevels","MICRO_W4_DOWN_RETRACEMENT_RESEARCH"],
        W5:["w5UpExtensionLevels","MICRO_W5_UP_EXTENSION_RESEARCH"],
      }:{
        C:["cDownExtensionLevels","SUBMICRO_C_DOWN_EXTENSION_RESEARCH"],
        W1:["w1PriorCorrectionRetracementLevels","SUBMICRO_W1_PRIOR_CORRECTION_RETRACEMENT_REFERENCE"],
        W2:["w2DownRetracementLevels","SUBMICRO_W2_DOWN_RETRACEMENT_RESEARCH"],
      };
      const chosen=sourceTable[activeWave];
      const sourceLevels=chosen&&model?.[chosen[0]];
      const valid= model?.degree===degree &&
        model?.selectionStatus==="RESEARCH_ONLY" &&
        typeof model?.version==="string" && model.version.length>0 &&
        Array.isArray(sourceLevels)&&sourceLevels.length>0&&
        sourceLevels.every(l=>
          l?.levelType===chosen[1] &&
          ["WATCH","TOUCHED"].includes(l.status) &&
          Number.isFinite(l.price)&&l.price>0&&
          Math.abs(l.price*4-Math.round(l.price*4))<1e-8&&
          Number.isFinite(l.ratio));
      // No selected/current projection means no lines, never canonical fallback
      // to a historically authorized but different wave count.
      levels=valid?sourceLevels.map(l=>({
        ratio:String(l.label??l.ratio),price:l.price,status:l.status,
        provisional:l.provisional===true,
      })):[];
      if(valid)currentResearch={
        sourcePath:"currentWavelength.degrees."+degree+
          (degree==="micro"?".ownerMicroW3Nov9ReclassifiedResearch":
            ".ownerSubmicroW3Nov9InternalResearch")+"."+chosen[0],
        modelVersion:model.version,activeWave,direction:model.direction,
      };
    }
    // For canonical degrees also reject a selected Fib packet when the
    // Strategy-card working state and authorized active wave disagree.
    const cardState=strategy?.degreeStates?.[degree];
    if(degree!=="micro"&&degree!=="submicro"&&cardState?.activeWave&&
       d?.activeWave&&String(cardState.activeWave).toUpperCase()!==
         String(d.activeWave).toUpperCase())levels=[];
    degrees[degree] = {
      degree, available: Boolean(valid && levels.length > 0),
      sourcePath: currentResearch?.sourcePath ?? d?.sourcePath ?? null,
      modelVersion: currentResearch?.modelVersion ?? d?.modelVersion ?? null,
      activeWave: currentResearch?.activeWave ?? d?.activeWave ?? null,
      direction: currentResearch?.direction ?? d?.direction ?? null,
      levels,
    };
  }
  return { schema: "engine2f.fibDisplay.v1", publicationRevision: valid ? authorized.publicationRevision : null, degrees };
}
