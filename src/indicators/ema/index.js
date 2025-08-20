// src/indicators/ema/index.js
import { INDICATOR_KIND } from "../shared/indicatorTypes";
import { emaCompute } from "./compute";
import { emaAttach } from "./overlay";
import { emaDefaults } from "./schema";

function makeEMA({ id, label, length, color }) {
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

const EMA10 = makeEMA({ id: "ema10", label: "EMA 10", length: 10, color: "#60a5fa" });
const EMA20 = makeEMA({ id: "ema20", label: "EMA 20", length: 20, color: "#f59e0b" });

const emaIndicators = [EMA10, EMA20];  // <-- ARRAY
export default emaIndicators;
export { makeEMA };
