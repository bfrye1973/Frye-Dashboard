// src/services/gauges.js
// Fetch Momentum & Breadth gauges from backend OR published Google Sheet CSV.

function parseNumber(x) {
  const n = Number(String(x ?? "").replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = lines[0].split(",").map(h => h.trim());

  const wanted = {
    date: headers.findIndex(h => /^date$/i.test(h)),
    group: headers.findIndex(h => /^group$/i.test(h)),
    momentum: headers.findIndex(h => /^momentum$/i.test(h)),
    breadth: headers.findIndex(h => /^breadth$/i.test(h)),
    index: headers.findIndex(h => /^index$/i.test(h)), // optional
  };

  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map(s => s.trim());
    if (!cols.length) continue;
    out.push({
      date: wanted.date >= 0 ? cols[wanted.date] : "",
      group: wanted.group >= 0 ? cols[wanted.group] : "",
      momentum: wanted.momentum >= 0 ? parseNumber(cols[wanted.momentum]) : 0,
      breadth: wanted.breadth >= 0 ? parseNumber(cols[wanted.breadth]) : 0,
      index: wanted.index >= 0 ? cols[wanted.index] : "",
    });
  }
  return out;
}

export async function getGauges(index = "SPY") {
  const API_BASE = (typeof window !== "undefined" && window.__API_BASE__) || "";
  const CSV_URL  = (typeof window !== "undefined" && window.__GAUGES_URL__) || "";

  if (API_BASE) {
    try {
      const res = await fetch(`${API_BASE}/api/v1/gauges?index=${encodeURIComponent(index)}`, { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json) && json.length) return json;
      }
    } catch {}
  }

  if (CSV_URL) {
    try {
      const res = await fetch(CSV_URL, { cache: "no-store" });
      const text = await res.text();
      const all = parseCSV(text);
      const rows = all.filter(r => !r.index || r.index.toUpperCase() === index.toUpperCase());
      return rows;
    } catch {}
  }

  return [];
}
