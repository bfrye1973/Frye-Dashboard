// src/indicators/srBreaks/index.js
import { INDICATOR_KIND } from "../shared/indicatorTypes";   // NOTE: ../shared (not ../../shared)
import { srDefaults } from "./schema";
import { srCompute } from "./compute";
import { srAttach } from "./overlay";

const SRBREAKS = {
  id: "sr_breaks",
  label: "Support/Resistance Breaks",
  kind: INDICATOR_KIND.OVERLAY, // draw on price pane
  defaults: srDefaults,
  compute: (candles, inputs) => srCompute(candles, { ...srDefaults, ...(inputs || {}) }),
  attach: (chartApi, seriesMap, result, inputs) =>
    srAttach(chartApi, seriesMap, result, { ...srDefaults, ...(inputs || {}) }),
};

// export as ARRAY for the master registry flattener
const srBreaksIndicators = [SRBREAKS];
export default srBreaksIndicators;
