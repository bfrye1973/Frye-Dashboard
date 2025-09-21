import { USE_MOCK, apiUrl, jsonGet } from "./base";
import { mockSignals } from "../pages/rows/RowStrategies/mocks/mockSignals";


export async function fetchSignals(strategy) {
if (USE_MOCK) return mockSignals[strategy];
return jsonGet(apiUrl(`/signals?strategy=${encodeURIComponent(strategy)}&limit=200`));
}
