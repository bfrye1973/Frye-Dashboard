// src/api/signals.js
import { USE_MOCK, apiUrl, jsonGet } from "./base";

// Lazy import of mocks so prod builds don't include them unless needed
async function getMocks() {
  const mod = await import("../pages/rows/RowStrategies/mocks/mockSignals.js");
  return mod.mockSignals;
}

/**
 * Fetch strategy signals.
 * - When VITE_USE_MOCK=1, returns in-memory mock data.
 * - Otherwise GETs /api/v1/signals?strategy=...&limit=200
 */
export async function fetchSignals(strategy) {
  if (USE_MOCK) {
    const mockSignals = await getMocks();
    return mockSignals[strategy] || { timestamp: new Date().toISOString(), strategy, items: [] };
  }
  const url = apiUrl(`/signals?strategy=${encodeURIComponent(strategy)}&limit=200`);
  return jsonGet(url);
}
