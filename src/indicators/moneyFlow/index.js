// src/indicators/moneyFlow/profile/index.js
import { INDICATOR_KIND } from "../../shared/indicatorTypes";  // ✅ two ../
import { mfpDefaults } from "./schema";
import { mfpCompute } from "./compute";
import { mfpAttach } from "./overlay";

const MFP = {
  id: "mfp",
  label: "Money Flow Profile",
  kind: INDICATOR_KIND.OVERLAY,   // draw on price pane
  defaults: mfpDefaults,
  compute: (candles, inputs) =>
    mfpCompute(candles, { ...mfpDefaults, ...(inputs || {}) }),
  attach: (chartApi, seriesMap, result, inputs) =>
    mfpAttach(chartApi, seriesMap, result, { ...mfpDefaults, ...(inputs || {}) }),
};

export default MFP;
