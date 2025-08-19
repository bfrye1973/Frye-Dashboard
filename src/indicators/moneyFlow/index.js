// Collect and export Money Flow indicators (MFI, CMF)
import MFI from "./mfi";
import CMF from "./cmf";

export const MONEY_FLOW_INDICATORS = [MFI, CMF];

export const MONEY_FLOW_MAP = MONEY_FLOW_INDICATORS.reduce((acc, ind) => {
  acc[ind.id] = ind;
  return acc;
}, {});

