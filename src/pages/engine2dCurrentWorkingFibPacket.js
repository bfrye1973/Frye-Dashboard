// Read-only adapter for Engine22's ALREADY DEPLOYED authorized working structure.
// Copies source Fibonacci prices without recalculation. Research-only; not an official certificate.
const ORDER=["submicro","micro","subminute","minute","minor","intermediate","primary"];
const clone=x=>x==null?null:JSON.parse(JSON.stringify(x));
export function currentEngine22ResearchPacket(strategy){
  const auth=strategy?.authorizedWorkingStructure;
  if(auth?.schema!=="engine22.authorizedWorkingStructure.v1"||auth.mode!=="READ_ONLY")return null;
  const degrees={};
  for(const degree of ORDER){
    const s=auth.degrees?.[degree];
    const path=s?.sourcePath;
    const model=typeof path==="string"&&/^(currentWavelength|degreeStates)\.[a-zA-Z0-9_.]+$/.test(path)
      ?path.split(".").reduce((v,k)=>v?.[k],{currentWavelength:strategy.currentWavelength,degreeStates:strategy.degreeStates}):null;
    const consistent=s?.available===true&&model&&(!s.modelVersion||model.version===s.modelVersion)&&(!s.activeWave||model.activeWave===s.activeWave);
    const d={available:Boolean(consistent),activeWave:s?.activeWave??null,direction:s?.direction??null,
      lifecycleStatus:s?.stage??null,modelVersion:s?.modelVersion??null,
      anchors:[],fibGroups:[],scenarios:[],missingEvidence:consistent?[]:["SOURCE_MODEL_UNAVAILABLE_OR_CONFLICTING"]};
    if(consistent){
      if(Array.isArray(s.levels)&&s.levels.length)d.fibGroups.push({groupId:"SELECTED",levels:clone(s.levels)});
      else if(Array.isArray(model.levels)&&model.levels.length)d.fibGroups.push({groupId:"SELECTED",levels:clone(model.levels)});
      if(degree==="subminute"&&model.fibReferences){
        d.fibGroups=[];
        for(const method of ["wick","body"]){
          const levels=model.fibReferences?.[method]?.levels;
          if(Array.isArray(levels))d.fibGroups.push({groupId:method.toUpperCase(),levels:clone(levels)});
        }
      }
      if(degree==="submicro"){
        d.fibGroups=[];
        for(const [key,id] of [["option1","OPTION_1_ABC_C_DOWN"],["option2","OPTION_2_A_DOWN_B_UP_PENDING"]]){
          if(model[key])d.scenarios.push({scenarioId:id,fibGroups:[{groupId:key.toUpperCase(),levels:clone(model[key].levels||[])}],anchors:[]});
        }
      }
    }
    degrees[degree]=d;
  }
  return {schema:"engine22.chartAnchors.v1",authority:"ENGINE22",mode:"READ_ONLY",
    available:true,selectionRevision:auth.publicationRevision,
    selectionApprovalReference:auth.selectionApprovalReference,
    chartContractFingerprint:auth.evidenceFingerprint,
    priceBasis:"UNVERIFIED",chartCompatibility:"WITHHELD_PENDING_VERIFICATION",
    plotAllowed:false,historicalAsOfSupported:false,noExecution:true,degrees};
}
