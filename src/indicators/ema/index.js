import { INDICATOR_KIND } from "../shared/indicatorTypes";
import { emaCompute } from "./compute";
import { emaAttach } from "./overlay";
import { emaDefaults } from "./schema";

// A small factory so we can create EMA10/EMA20 from the same code
export function makeEMA({ id, label, length, color }) {
  return {
    id,
    label,
    kind: INDICATOR_KIND.OVERLAY,
    defaults: { ...emaDefaults, length, color, id },
    compute: (candles, inputs) => emaCompute(candles, { ...emaDefaults, ...inputs, length }),
    attach: (chartApi, seriesMap, result, inputs) =>
      emaAttach(chartApi, seriesMap, result, { ...emaDefaults, ...inputs, id, color }),
  };
}

const EMA = { makeEMA };
export default EMA;
