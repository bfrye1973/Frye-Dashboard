// Engine16 consumes exactly the owner-selected Engine22 Strategies Fibonacci levels.
// This module does NO Fibonacci mathematics, no wave count selection and no fallbacks.
import {normalizeEngine22FibPacket} from "./engine22FibDisplayPacket";

export function engine16FibLevelsFromStrategyCard({
  authorizedWorkingStructure,currentWavelength,submicroScenario="option1"
}={}) {
  const packet=normalizeEngine22FibPacket(
    {authorizedWorkingStructure,currentWavelength},
    {submicro:submicroScenario}
  );
  const node=packet.degrees?.submicro;
  if(!node?.available || !Array.isArray(node.levels) || !node.levels.length) {
    return {available:false,reason:"ENGINE22_SUBMICRO_FIB_SOURCE_UNAVAILABLE",
      levels:[],sourceEngine:"ENGINE22",degree:"submicro",readOnly:true};
  }
  // The chart is an automatic ABC research model. Do not misrepresent an Engine22
  // parent W2 or C-down level as an endorsed bullish C projection.
  const selection=authorizedWorkingStructure.degrees?.submicro;
  return {
    available:true,sourceEngine:"ENGINE22",degree:"submicro",
    activeWave:node.activeWave ?? null,direction:node.direction ?? null,
    sourcePath:node.sourcePath,modelVersion:node.modelVersion,
    publicationRevision:packet.publicationRevision,
    parentDegree:selection?.parentDegree ?? null,parentWave:selection?.parentWave ?? null,
    labelKind:"OWNER_SELECTED_WORKING_LEVELS_NOT_ENGINE16_TARGETS",
    levels:node.levels.map(l=>({label:l.ratio,price:l.price,status:l.status ?? null})),
    readOnly:true
  };
}
