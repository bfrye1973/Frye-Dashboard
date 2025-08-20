import moneyFlowIndicators from "./moneyFlow";
import emaIndicators from "./ema";
import volumeIndicators from "./volume";
import srBreaksIndicators from "./srBreaks";   // ✅ NEW

function asArray(maybeArr) {
  return Array.isArray(maybeArr) ? maybeArr : [maybeArr];
}

export const INDICATORS = [
  ...asArray(moneyFlowIndicators),
  ...asArray(emaIndicators),
  ...asArray(volumeIndicators),
  ...asArray(srBreaksIndicators),   // ✅ include here
];
