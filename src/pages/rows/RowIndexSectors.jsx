// src/pages/rows/RowIndexSectors.jsx
import React, { useEffect, useRef, useState } from "react";
import { LastUpdated } from "../../components/LastUpdated";

const API = "https://frye-market-backend-1.onrender.com/api/dashboard";

/* --- badge helpers --- */
const toneFor = (o) => {
  if (!o) return "info";
  const s = String(o).toLowerCase();
  if (s.startsWith("bull")) return "ok";
  if (s.startsWith("bear")) return "danger";
  return "warn";
};
function Badge({ text, tone = "info" }) {
  const map = {
    ok:    { bg:"#064e3b", fg:"#d1fae5", bd:"#065f46" },
    warn:  { bg:"#5b4508", fg:"#fde68a", bd:"#a16207" },
    danger:{ bg:"#7f1d1d", fg:"#fecaca", bd:"#b91c1c" },
    info:  { bg:"#0b1220", fg:"#93c5fd", bd:"#334155" },
  }[tone] || { bg:"#0b1220", fg:"#93c5fd", bd:"#334155" };
  return (
    <span style={{
      padding:"4px 8px", borderRadius:8, fontSize:12, fontWeight:700,
      background:map.bg, color:map.fg, border:`1px solid ${map.bd}`
    }}>
      {text}
    </span>
  );
}

/* --- sparkline --- */
function Sparkline({ data = [], width = 160, height = 36 }) {
  if (!Array.isArray(data) || data.length < 2) return <div className="small muted">no data</div>;
  const min = Math.min(...data), max = Math.max(...data);
  const span = (max - min) || 1;
  const stepX = width / (data.length - 1);
  const d = data.map((v,i) => {
    const x = i * stepX;
    const y = height - ((v - min) / span) * height;
    return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <path d={d} fill="none" stroke="#60a5fa" strokeWidth="2" />
    </svg>
  );
}

/* --- card --- */
function SectorCard({ sector, outlook, spark, last, deltaPct }) {
  const tone = toneFor(outlook);
  // prefer provided last/deltaPct; else derive from spark; else show 0
  let _last = Number.isFinite(last) ? last : null;
  let _deltaPct = Number.isFinite(deltaPct) ? deltaPct : null;

  if ((_last === null || _deltaPct === null) && Array.isArray(spark) && spark.length >= 2) {
    const first = Number(spark[0]) || 0;
    const lst   = Number(spark[spark.length - 1]) || 0;
    const base  = Math.abs(first) > 1e-6 ? Math.abs(first) : 1;
    _last = _last === null ? lst : _last;
    _deltaPct = _deltaPct === null ? ((lst - first) / base) * 100 : _deltaPct;
  }

  if (_last === null) _last = 0;
  if (_deltaPct === null) _deltaPct = 0;

  const arrow =
    Math.abs(_deltaPct) < 0.5 ? "→" :
    _deltaPct > 0             ? "↑" : "↓";

  const deltaClass =
    Math.abs(_deltaPct) < 0.5 ? "delta delta-flat" :
    _deltaPct > 0             ? "delta delta-up"   : "delta delta-down";

  return (
    <div className="panel" style={{ padding:10 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div className="panel-title small">{sector || "Sector"}</div>
        <Badge text={outlook || "Neutral"} tone={tone} />
      </div>
      <div className="small" style={{ display:"flex", justifyContent:"space-between", margin:"4px 0 6px 0" }}>
        <span>Last: <strong>{Number.isFinite(_last) ? _last.toFixed(1) : "—"}</strong></span>
        <span className={deltaClass}>{arrow} {Number.isFinite(_deltaPct) ? _deltaPct.toFixed(1) : "0.0"}%</span>
      </div>
      <Sparkline data={Array.isArray(spark) ? spark : []} />
    </div>
  );
}

/* --- prefer outlook.sectorCards (has numbers), else compute from outlook.sectors --- */
const ORDER = [
  "tech","materials","healthcare","communication services","real estate",
  "energy","consumer staples","consumer discretionary","financials","utilities","industrials",
];
const norm = (s="") => s.trim().toLowerCase();
const orderKey = (s) => {
  const i = ORDER.indexOf(norm(s));
  return i === -1 ? 999 : i;
};
function titleCase(name="") {
  return name.split(" ").map(w => w ? w[0].toUpperCase()+w.slice(1) : w).join(" ");
}

function fromSectorCards(json){
  const arr = json?.outlook?.sectorCards;
  if (!Array.isArray(arr)) return [];
  return arr.map(c => ({
    sector: c?.sector ?? "",
    outlook: c?.outlook ?? "Neutral",
    spark: Array.isArray(c?.spark) ? c.spark : [],
    last: Number(c?.last ?? c?.value ?? NaN),
    deltaPct: Number(c?.deltaPct ?? c?.pct ?? c?.changePct ?? NaN),
  })).sort((a,b) => orderKey(a.sector) - orderKey(b.sector));
}

function fromSectors(json){
  const obj = json?.outlook?.sectors;
  if (!obj || typeof obj !== "object") return [];
  const list = Object.keys(obj).map(k => {
    const sec = obj[k] || {};
    const nh = Number(sec?.nh ?? 0);
    const nl = Number(sec?.nl ?? 0);
    const netNH = Number(sec?.netNH ?? (nh - nl));
    const denom = nh + nl;
    const pct = denom > 0 ? (netNH / denom) * 100 : 0;
    return {
      sector:  titleCase(k),
      outlook: sec?.outlook ?? (netNH > 0 ? "Bullish" : netNH < 0 ? "Bearish" : "Neutral"),
      spark:   Array.isArray(sec?.spark) ? sec.spark : [],
      last:    netNH,
      deltaPct: pct
    };
  });
  return list.sort((a,b) => orderKey(a.sector) - orderKey(b.sector));
}

export default function RowIndexSectors() {
  const [cards, setCards]   = useState([]);
  const [lastTs, setLastTs] = useState(null);
  const [initial, setInitial] = useState(true);
  const [stale, setStale] = useState(false);
  const aliveRef = useRef(true);
  const timerRef = useRef(null);

  async function fetchOnce() {
    try {
      const r = await fetch(`${API}?t=${Date.now()}`, { cache:"no-store" });
      const d = await r.json();
      if (!aliveRef.current) return;

      setLastTs(d?.meta?.ts || d?.updated_at || null);

      // prefer sectorCards (has numbers); else compute from sectors
      let list = fromSectorCards(d);
      if (list.length === 0) list = fromSectors(d);

      if (list.length > 0) {
        setCards(list);
        setStale(false);
      } else {
        setStale(true);
      }
    } catch {
      if (aliveRef.current) setStale(true);
    } finally {
      if (aliveRef.current) setInitial(false);
    }
  }

  useEffect(() => {
    fetchOnce();
    timerRef.current = setInterval(fetchOnce, 5000);
    return () => { aliveRef.current = false; if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  return (
    <section id="row-4" className="panel index-sectors" aria-label="Index Sectors">
      <div className="panel-head">
        <div className="panel-title">Index Sectors</div>
        <div className="spacer" />
        <LastUpdated ts={lastTs} />
      </div>

      {initial && cards.length === 0 && <div className="small muted">Loading…</div>}
      {!initial && cards.length === 0 && <div className="small muted">No sector data.</div>}
      {stale && cards.length > 0 && <div className="small muted" style={{ marginBottom:8 }}>refreshing…</div>}

      {cards.length > 0 && (
        <div style={{
          display:"grid",
          gridTemplateColumns:"repeat(auto-fill, minmax(220px, 1fr))
