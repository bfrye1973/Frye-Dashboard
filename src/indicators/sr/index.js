// src/indicators/shared/indicatorTypes.js
// Central list of indicator IDs AND kinds so legacy imports work.

// Some indicators import this:
//   import { INDICATOR_KIND } from "../shared/indicatorTypes";
export const INDICATOR_KIND = {
  OVERLAY: "OVERLAY",   // draws on the price pane
  SEPARATE: "SEPARATE", // draws in its own pane (oscillators etc.)
};

// Most code will use the specific ids below; keep them in one place:
const indicatorTypes = {
  EMA10: "ema10",
  EMA20: "ema20",
  MFP:   "mfp",    // Money Flow Profile
  SR:    "sr",     // Support / Resistance
  SWING: "swing",  // Swing Points & Liquidity
};

export default indicatorTypes;
