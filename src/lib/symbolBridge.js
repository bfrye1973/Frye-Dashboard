// src/lib/symbolBridge.js
// A tiny global bridge so any UI control can set/get the chart symbol/timeframe.
// LiveLWChart subscribes to these changes.

const EVT_SYMBOL = "chart:setSymbol";
const EVT_TF = "chart:setTimeframe";

function setSymbol(symbol) {
  const s = String(symbol || "").trim().toUpperCase() || "SPY";
  window.__CHART_SYMBOL__ = s;
  window.dispatchEvent(new CustomEvent(EVT_SYMBOL, { detail: s }));
}

function getSymbol() {
  return (window.__CHART_SYMBOL__ || "SPY").toUpperCase();
}

function setTimeframe(tf) {
  const t = String(tf || "").trim();
  window.__CHART_TIMEFRAME__ = t;
  window.dispatchEvent(new CustomEvent(EVT_TF, { detail: t }));
}

function getTimeframe() {
  return window.__CHART_TIMEFRAME__ || "1D";
}

export const symbolBridge = {
  setSymbol,
  getSymbol,
  setTimeframe,
  getTimeframe,
  EVT_SYMBOL,
  EVT_TF,
};

// Expose helpers for quick manual testing in DevTools:
if (typeof window !== "undefined") {
  window.setChartSymbol = setSymbol;       // e.g., setChartSymbol("IWM")
  window.setChartTf = setTimeframe;        // e.g., setChartTf("1H")
}
