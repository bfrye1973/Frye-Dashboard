import React, { useEffect, useMemo, useState } from "react";

function env(name, fb = "") {
  try {
    if (typeof process !== "undefined" && process.env && name in process.env) {
      return String(process.env[name] || "").trim();
    }
  } catch {}
  return fb;
}

function normalizeApiBase(x) {
  const raw = String(x || "").trim();
  if (!raw) return "https://frye-market-backend-1.onrender.com";
  let out = raw.replace(/\/+$/, "");
  out = out.replace(/\/api\/v1$/i, "");
  out = out.replace(/\/api$/i, "");
  return out;
}

const API_BASE = normalizeApiBase(env("REACT_APP_API_BASE", ""));

async function fetchJson(url, opts = {}) {
  const res = await fetch(url, { cache: "no-store", ...opts });
  const text = await res.text();
  try { return JSON.parse(text); } catch { return null; }
}

export default function StrategiesFull() {
  const qs = useMemo(() => new URLSearchParams(window.location.search), []);
  const symbol = (qs.get("symbol") || "SPY").toUpperCase();

  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let alive = true;
    async function pull() {
      try {
        setErr(null);
        const url = `${API_BASE}/api/v1/dashboard-snapshot?symbol=${encodeURIComponent(symbol)}&includeContext=1&t=${Date.now()}`;
        const j = await fetchJson(url);
        if (alive) setData(j);
      } catch (e) {
        if (alive) setErr(String(e?.message || e));
      }
    }
    pull();
    const id = setInterval(pull, 15000);
    return () => { alive = false; clearInterval(id); };
  }, [symbol]);

  return (
    <div style={{ background: "#05070b", minHeight: "100vh", padding: 14, color: "#e5e7eb" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontWeight: 900, fontSize: 18 }}>Full Strategies — {symbol}</div>
        <button
          onClick={() => window.close()}
          style={{ background: "#111827", color: "#e5e7eb", border: "1px solid #243244", borderRadius: 10, padding: "6px 10px", fontWeight: 900, cursor: "pointer" }}
        >
          Close Tab
        </button>
      </div>

      {err && <div style={{ color: "#fca5a5", fontWeight: 900 }}>{err}</div>}
      {!data && !err && <div style={{ color: "#9ca3af" }}>Loading…</div>}

      {data?.strategies && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
          {Object.entries(data.strategies).map(([strategyId, obj]) => (
            <pre key={strategyId} style={{
              background: "#0b0f17",
              border: "1px solid #233044",
              borderRadius: 12,
              padding: 12,
              overflow: "auto",
              minHeight: 420,
              fontSize: 12
            }}>
{strategyId}
{"\n\n"}
{JSON.stringify(obj, null, 2)}
            </pre>
          ))}
        </div>
      )}
    </div>
  );
}
