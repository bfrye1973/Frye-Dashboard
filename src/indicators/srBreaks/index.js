import srBreaksIndicators from "./srBreaks";

export const INDICATORS = [
  ...asArray(moneyFlowIndicators),
  ...asArray(emaIndicators),
  ...asArray(volumeIndicators),
  ...asArray(srBreaksIndicators),  // add here
];

