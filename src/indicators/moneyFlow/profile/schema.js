// src/indicators/moneyFlow/profile/schema.js
export const mfpDefaults = {
  lookback: 250,     // bars to analyze
  bins: 24,          // number of price buckets
  // Side profile bars
  showSides: true,          // draw left(red)/right(green) bars near pane edges
  sideWidthPct: 0.18,       // max width (inside pane) as % of pane width
  sideOpacity: 0.28,
  // Major zones (full-width horizontal blocks)
  showZones: true,          // draw the most significant red/green zones
  zonesCount: 1,            // how many zones per side (1 = the dominant zone)
  zoneOpacity: 0.12,        // fill opacity of zones
  // Colors
  posColor: "#22c55e",      // accumulation (green)
  negColor: "#ef4444",      // distribution (red)
  // Layout
  innerMargin: 10           // px padding from both left/right edges of pane
};
