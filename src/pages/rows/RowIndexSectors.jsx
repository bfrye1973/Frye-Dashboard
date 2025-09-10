// src/pages/rows/RowIndexSectors.jsx
import React, { useEffect, useRef, useState } from "react";
import { LastUpdated } from "../../components/LastUpdated";

const API = "https://frye-market-backend-1.onrender.com/api/dashboard";

/* --- tone helpers --- */
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

function SectorCard({ sector, outlook, spark }) {
  const tone = toneFor(outlook);
  const arr  = Array.isArray(spark) ? spark : [];
  const first = arr.length ? arr[0] : null;
  const last  = arr.length ? arr[arr.length - 1] : null;
  const delta = (Number.isFinite(last) && Number.isFinite(first) && Math.abs(first) > 1e-6)
    ? ((last - first) / first) * 100 : NaN;

  const arrow =
    !Number.isFinite(delta) ? "→" :
    Math.abs(delta) < 0.5   ? "→" :
    delta > 0               ? "↑" : "↓";

  const deltaClass =
    !Number.isFinite(delta) || Math.abs(delta) < 0.5
      ? "delta delta-flat"
      : delta > 0
      ? "delta delta-up"
      : "delta delta-down";

  return (
    <div className="panel" style={{ padding:10 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div className="panel-title small">{sector || "Sector"}</div>
        <Badge text={outlook || "Neutral"} tone={tone} />
      </div>
      <div className="small" style={{ display:"flex", justifyContent:"space-between", margin:"4px 0 6px 0" }}>
        <span>Last: <strong>{Number.isFinite(last) ? last.toFixed(1) : "—"}</strong></span>
        <span className={deltaClass}>
          {arrow} {Number.isFinite(delta) ? delta.toFixed(1) : "0.0"}%
        </span>
      </div>
      <Sparkline data={arr} />
    </div>
  );
}

/* --- canonical order for stable UI --- */
const ORDER = [
  "tech","materials","healthcare","communication services","real estate",
  "energy","consumer staples","consumer discretionary","financials","utilities","industrials",
];
const norm = (s="") => s.trim().toLowerCase();
const orderKey = (s) => {
  const i = ORDER.indexOf(norm(s));
  return i === -1 ? 999 : i;
};

/* prefer outlook.sectors (11) over sectorCards (3) */
function extractAllSectors(json) {
  const out = json?.outlook || {};
  const obj = out.sectors;
  if (obj && typeof obj === "object" && Object.keys(obj).length > 0) {
    const list = Object.keys(obj).map(k => ({
      sector:  k.split(" ").map(w=>w? w[0].toUpperCase()+w.slice(1):w).join(" "),
      outlook: obj[k]?.outlook ?? "Neutral",
      spark:   Array.isArray(obj[k]?.spark) ? obj[k].spark : [],
    }));
    return list.sort((a,b)=> orderKey(a.sector) - orderKey(b.sector));
  }
  const cards = out.sectorCards;
  if (Array.isArray(cards) && cards.length > 0) {
    return cards.sort((a,b)=> orderKey(a.sector) - orderKey(b.sector));
  }
  return [];
}

export default function RowIndexSectors() {
  const [cards, setCards]   = useState([]);
  const [lastTs, setLastTs] = useState(null);
  const [initial, setInitial] = useState(true);
  const [stale, setStale] = useState(false);
  const timerRef = useRef(null);
  const aliveRef = useRef(true);

  async function fetchOnce() {
    try {
      const r = await fetch(`${API}?t=${Date.now()}`, { cache:"no-store" });
      const d = await r.json();
      if (!aliveRef.current) return;
      setLastTs(d?.meta?.ts || null);
      const list = extractAllSectors(d);
      if (list.length > 0) {
        setCards(list);
        setStale(false);
      } else {
        setStale(true);
      }
    } catch (e) {
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
        {<LastUpdated ts={lastTs} />}
      </div>

      {initial && cards.length === 0 && <div className="small muted">Loading…</div>}
      {!initial && cards.length === 0 && <div className="small muted">No sector data.</div>}
      {stale && cards.length > 0 && <div className="small muted" style={{ marginBottom:8 }}>refreshing…</div>}

      {cards.length > 0 && (
        <div style={{
          display:"grid",
          gridTemplateColumns:"repeat(auto-fill, minmax(220px, 1fr))",
          gap:10, marginTop:8
        }}>
          {cards.map((c, i) => (
            <SectorCard key={c?.sector || i} sector={c?.sector} outlook={c?.outlook} spark={c?.spark} />
          ))}
        </div>
      )}
    </section>
  );
}
