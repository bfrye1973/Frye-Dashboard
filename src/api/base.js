// src/api/base.js — works in CRA (react-scripts) and Vite

function env(key, fallback = undefined) {
  // Vite: import.meta.env.VITE_*
  const vite =
    typeof import.meta !== "undefined" &&
    import.meta.env &&
    Object.prototype.hasOwnProperty.call(import.meta.env, key)
      ? import.meta.env[key]
      : undefined;

  // CRA: process.env.REACT_APP_*
  const cra =
    typeof process !== "undefined" &&
    process.env &&
    Object.prototype.hasOwnProperty.call(process.env, key)
      ? process.env[key]
      : undefined;

  return vite ?? cra ?? fallback;
}

const API_BASE = env("VITE_API_BASE", env("REACT_APP_API_BASE", "/api/v1"));
const USE_MOCK_STR = env("VITE_USE_MOCK", env("REACT_APP_USE_MOCK", "0"));

export const USE_MOCK = String(USE_MOCK_STR) === "1";
export const apiUrl = (path) => `${API_BASE}${path}`;

export async function jsonGet(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} for ${url} :: ${text}`);
  }
  return res.json();
}
