import {WAVE_NODE_DEGREES} from "./waveNodePresentation";

// Presentation-layer toggles only. Wave nodes still come from the existing
// Engine22 Strategies packet. No source prices/times/history are changed.
export const DEFAULT_VISIBLE_WAVE_DEGREES=Object.freeze([
  "PRIMARY","INTERMEDIATE","SUBMICRO",
]);
const allowed=new Set(WAVE_NODE_DEGREES.map(([degree])=>degree));
export function toggleVisibleWaveDegree(previous,degree,on){
  const active=Array.isArray(previous)?previous.filter(d=>allowed.has(d)):[];
  if(!allowed.has(degree))return active;
  return on?(active.includes(degree)?active:[...active,degree])
    :active.filter(d=>d!==degree);
}
