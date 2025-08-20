// src/indicators/index.js
import emaIndicators from "./ema";
import volumeIndicators from "./volume";
import moneyFlowIndicators from "./moneyFlow";

// Merge all indicator registries into one flat array
const indicators = [
  ...emaIndicators,
  ...volumeIndicators,
  ...moneyFlowIndicators,
];

export default indicators;
