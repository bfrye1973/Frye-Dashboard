const API_BASE = import.meta.env.VITE_API_BASE || "/api/v1";
export const USE_MOCK = String(import.meta.env.VITE_USE_MOCK || "0") === "1";
export const apiUrl = (path) => `${API_BASE}${path}`;

export async function jsonGet(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}
