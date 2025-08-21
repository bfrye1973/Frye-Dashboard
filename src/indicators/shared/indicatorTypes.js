// src/indicators/shared/indicatorTypes.js
// Central indicator IDs AND kinds so legacy imports work everywhere.

// Some indicators import this named export:
export const INDICATOR_KIND = {
  OVERLAY: "OVERLAY",   // draws on the price pane
  SEPARATE: "SEPARATE", // draws in its own pane
};

// Most code uses the specific ids below; keep them consistent:
const indicatorTypes = {
  EMA10: "ema10",
  EMA20: "ema20",
  MFP:   "mfp",    // Money Flow Profile
  SR:    "sr",     // Support / Resistance
  SWING: "swing",  // Swing Points & Liquidity
};

export default indicatorTypes;
