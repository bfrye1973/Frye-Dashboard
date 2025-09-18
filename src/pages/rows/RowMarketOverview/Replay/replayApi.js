const API = (typeof window !== "undefined" && (window.__API_BASE__ || "")) || process.env.REACT_APP_API_URL || "";


export async function getReplayIndex(gran) {
const q = new URLSearchParams({ granularity: mapGran(gran), t: String(Date.now()) }).toString();
const r = await fetch(`${API}/api/replay/index?${q}`, { cache: "no-store" });
if (!r.ok) throw new Error("index failed");
const j = await r.json();
return Array.isArray(j?.items) ? j.items : [];
}


export async function getReplaySnapshot(gran, ts) {
const q = new URLSearchParams({ granularity: mapGran(gran), ts, t: String(Date.now()) }).toString();
const r = await fetch(`${API}/api/replay/at?${q}`, { cache: "no-store" });
if (!r.ok) throw new Error("snapshot failed");
return await r.json();
}


export function mapGran(gran) {
if (gran === "10min" || gran === "10m") return "10min";
if (gran === "1h") return "hourly";
if (gran === "1d") return "eod";
return "10min";
}
