// src/indicators/moneyFlow/index.js
import MFP from "./profile";   // ✅ Money Flow Profile
import CMF from "./cmf";       // ✅ Chaikin Money Flow
import MFI from "./mfi";       // ✅ Money Flow Index oscillator

// Registry of all money flow–related indicators
const moneyFlowIndicators = [MFP, CMF, MFI];

export default moneyFlowIndicators;
