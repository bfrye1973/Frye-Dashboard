// src/pages/tradeInvestigator/investigatorClient.js
// Engine 12 Trade Investigator: browser client. READ-ONLY.
//
// The backend access key is NEVER in this bundle and never typed here.
// The owner pastes a one-time pairing code (issued server-side from the
// Render Shell); it is exchanged for a short-lived, read-only, origin-bound
// session token. The token lives only in this module's memory: never
// localStorage, sessionStorage, cookies, or URLs. A reload clears it.

let sessionToken = "";
let sessionExpiresAt = null;

function env(name) {
  try {
    return String((process.env && process.env[name]) || "").trim();
  } catch {
    return "";
  }
}

export function normalizeApiBase(x) {
  const raw = String(x || "").trim();
  if (!raw) return "https://frye-market-backend-1.onrender.com";
  return raw.replace(/\/+$/, "").replace(/\/api\/v1$/i, "").replace(/\/api$/i, "");
}

export const INVESTIGATOR_API_BASE = normalizeApiBase(
  env("REACT_APP_TRADE_INVESTIGATOR_API_BASE") || env("REACT_APP_API_BASE")
);

const ENDPOINT = INVESTIGATOR_API_BASE + "/api/v1/trade-investigator";
const TOKEN_RE = /^[A-Za-z0-9_-]{40,128}$/;

export const STRATEGIES = [
  "intraday_scalp@10m",
  "subminute_scalp@10m",
  "minor_swing@1h",
  "intermediate_long@4h",
  "primary_position@1d",
];

export function hasSession() {
  return !!sessionToken && (!sessionExpiresAt || Date.parse(sessionExpiresAt) > Date.now());
}
export function sessionExpiry() {
  return sessionExpiresAt;
}
export function clearSession() {
  sessionToken = "";
  sessionExpiresAt = null;
}

export async function redeemPairingCode(pairingCode, { fetchImpl = fetch } = {}) {
  const code = String(pairingCode || "").trim();
  if (code.length < 20 || code.length > 128) throw new Error("PAIRING_CODE_INVALID");
  const res = await fetchImpl(ENDPOINT + "/session/redeem", {
    method: "POST",
    cache: "no-store",
    credentials: "omit",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ pairingCode: code }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !TOKEN_RE.test(String(body.accessToken || ""))) {
    throw new Error(body.error || "PAIRING_REJECTED_" + res.status);
  }
  sessionToken = body.accessToken;
  sessionExpiresAt = body.expiresAt || null;
  return { expiresAt: sessionExpiresAt };
}

export async function revokeSession({ fetchImpl = fetch } = {}) {
  const token = sessionToken;
  clearSession();
  if (!token) return;
  try {
    await fetchImpl(ENDPOINT + "/session/revoke", {
      method: "POST",
      cache: "no-store",
      credentials: "omit",
      headers: { Authorization: "Bearer " + token },
    });
  } catch {
    /* local session already cleared */
  }
}

/** Archived Replay times for a date (existing public read-only route). */
export async function fetchArchivedTimes(date, { fetchImpl = fetch } = {}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
  try {
    const res = await fetchImpl(INVESTIGATOR_API_BASE + "/api/v1/replay/es/times?date=" + date, {
      cache: "no-store",
      credentials: "omit",
    });
    if (!res.ok) return [];
    const body = await res.json();
    const list = Array.isArray(body) ? body : body.times || body.items || [];
    return list.map((x) => String(x?.time ?? x).replace(":", "")).filter((t) => /^\d{4}$/.test(t)).sort();
  } catch {
    return [];
  }
}

export function buildQuery({ date, time, strategyId, candidateId, planId, tradeId }) {
  const q = new URLSearchParams({ date, time, strategyId });
  if (candidateId) q.set("candidateId", candidateId.trim());
  if (planId) q.set("planId", planId.trim());
  if (tradeId) q.set("tradeId", tradeId.trim());
  return q.toString();
}

export async function investigate(params, { fetchImpl = fetch } = {}) {
  if (!hasSession()) throw new Error("SESSION_REQUIRED");
  const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
  const res = await fetchImpl(ENDPOINT + "?" + buildQuery(params), {
    cache: "no-store",
    credentials: "omit",
    headers: { Accept: "application/json", Authorization: "Bearer " + sessionToken },
  });
  const body = await res.json().catch(() => ({ ok: false, error: "INVALID_JSON" }));
  const ms = Math.round(((typeof performance !== "undefined" ? performance.now() : Date.now()) - t0) * 10) / 10;
  if (res.status === 401) clearSession();
  return { status: res.status, body, roundTripMs: ms, serverTiming: res.headers?.get?.("server-timing") || null };
}
