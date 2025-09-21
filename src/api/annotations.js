import { USE_MOCK, apiUrl, jsonGet } from "./base";
import { mockAnnotations } from "../pages/rows/RowStrategies/mocks/mockAnnotations";


export async function fetchAnnotations({ symbol, strategy, tf }) {
if (USE_MOCK) return mockAnnotations({ symbol, strategy, tf });
const qs = new URLSearchParams({ symbol, strategy, tf }).toString();
return jsonGet(apiUrl(`/annotations?${qs}`));
}
