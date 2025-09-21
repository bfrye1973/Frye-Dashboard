// src/api/signals.js
import { USE_MOCK, apiUrl, jsonGet } from "./base";

async function getMocks() {
  const mod = await import("../pages/rows/RowStrategies/mocks/mockSignals.js");
  return mod.mockSignals;
}

export async function fetchSignals(strategy) {
  if (USE_MOCK) {
    const mockSignals = await getMocks();
    return mockSignals[strategy] || { timestamp: new Date().toISOString(), strategy, items: [] };
  }
  const url = apiUrl(`/signals?strategy=${encodeURIComponent(strategy)}&limit=200`);
  return jsonGet(url);
}
