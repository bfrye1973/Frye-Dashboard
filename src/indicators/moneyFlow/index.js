// src/indicators/moneyFlow/index.js
import MFP from "./profile"; // Money Flow Profile overlay
import CMF from "./cmf";     // Chaikin Money Flow (pane)
import MFI from "./mfi";     // MFI oscillator (pane) — keep or remove later

const moneyFlowIndicators = [MFP, CMF, MFI];  // <-- ARRAY
export default moneyFlowIndicators;

