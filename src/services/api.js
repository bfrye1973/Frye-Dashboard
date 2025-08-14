// src/index.js
import "./main.jsx";
// --- Quote helper (append to end of src/services/api.js) ---
const API_BASE_URL =
  (typeof process !== "undefined" && process.env && (
    process.env.API_BASE_URL ||
    process.env.REACT_APP_API_BASE_URL ||
    process.env.VITE_API_BASE_URL
  )) ||
  "https://frye-market-backend-1.onrender.com";

export async function getQuote(symbol) {
  const url = `${API_BASE_URL}/api/v1/quotes?symbol=${encodeURIComponent(symbol)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
