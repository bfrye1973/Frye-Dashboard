// src/pages/rows/RowIndexSectors.jsx
import React, { useEffect, useRef, useState } from "react";

const API = "https://frye-market-backend-1.onrender.com/api/dashboard"; // direct backend

/* ----- tone helpers ----- */
const toneFor = (o) => {
  if (!o) return "info";
  const s = String(o).toLowerCase();
  if (s.startsWith("bull")) return "ok";
  if (s.startsWith("bear")) return "danger";
  return "warn"; // neutral / mixed
};

function Badge({ text, tone = "info" }) {
  const map = {
    ok:    { bg:"#064e3b", fg:"#d1fae5", bd:"#065f46" },
    warn:  { bg:"#5b4508", fg:"#fde68a", bd:"#a16207" },
    danger:{ bg:"#7f1d1d", fg:"#fecaca", bd:"#b91c1c" },
    info:  { bg:"#0b1220", fg:"#93c5fd", bd:"#334155" },
  }[tone] || { bg:"#0b1220", fg:"#93c5fd", bd:"#334155" };

  return (
    <span
      style={{
        padding:"4px 8px", borderRadius:8, fontSize:12, fontWeight:700,
        background:map.bg, color:map.fg, border:`1px solid ${map.bd}`
      }}
    >
      {text}
    </span>
  );
}

/* ---- tiny sparkline ---- */
function Sparkline({ data = [], width = 160, height = 36 }) {
  if (!Array.isArray(data) || data.length < 2) return <div className="small muted">no data</div>;
  const min = Math.min(...data), max = Math.max(...data);
  const span = (max - min) || 1;
  const stepX = width / (data.length - 1);
  const d = data.map((v,i)=>{
    const x=i*stepX, y=height-((v-min)/span)*height;
    return `${i===0?"M":"L"}${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <path d={d} fill="none" stroke="#60a5fa" strokeWidth="2" />
    </svg>
  );
}

/* ---- sector card with inline numbers ---- */
function SectorCard({ sector, outlook, spark }) {
  const tone = toneFor(outlook);
  const arr = Array.isArray(spark) ? spark : [];
  const first = arr.length > 0 ? arr[0] : null;
  const last  = arr.length > 0 ? arr[arr.length - 1] : null;

  const deltaAbs  = (Number.isFinite(last) && Number.isFinite(first)) ? (last - first) : NaN;
  const deltaPct  = (Number.isFinite(deltaAbs) && Math.abs(first) > 1e-6) ? (deltaAbs / first) * 100 : NaN;

  const arrow = !Number.isFinite(deltaPct)
    ? "→" : Math.abs(deltaPct) < 0.5
    ? "→" : deltaPct > 0
    ? "↑" : "↓";

  const deltaClass =
    !Number.isFinite(deltaPct) || Math.abs(deltaPct) < 0.5
      ? "delta delta-flat"
      : deltaPct > 0
      ? "delta delta-up"
      : "delta delta-down";

  return (
    <div className="panel" style={{ padding:10 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div className="panel-title small">{sector || "Sector"}</div>
        <Badge text={outlook || "Neutral"} tone={tone} />
      </div>

      {/* inline stats (keeps row slim) */}
      <div className="small" style={{ display:"flex", justifyContent:"space-between", margin:"4px 0 6px 0" }}>
        <span>Last: <strong>{Number.isFinite(last) ? last.toFixed(1) : "—"}</strong></span>
        <span className={deltaClass}>{arrow} {Number.isFinite(deltaPct) ? deltaPct.toFixed(1) : "0.0"}%</span>
      </div>

      <Sparkline data={arr} />
    </div>
  );
}

/* ---- preferred order for stable layout ---- */
const ORDER = [
  "tech","materials","healthcare","communication services","real estate",
  "energy","consumer staples","consumer discretionary","financials","utilities","industrials",
];
const keyNorm = (s="") => String(s).trim().toLowerCase();
function sortByPreferred(cards=[]) {
  return [...cards].sort((a,b)=>{
    const ia = ORDER.indexOf(keyNorm(a?.sector));
    const ib = ORDER.indexOf(keyNorm(b?.sector));
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });
}

/* ---- prefer outlook.sectors (11) over sectorCards (3) ---- */
function extractAllSectors(dash) {
  const obj = dash?.outlook?.sectors;
  if (obj && typeof obj === "object" && Object.keys(obj).length > 0) {
    const list = Object.keys(obj).map(k => ({
      sector:  k,
      outlook: obj[k]?.outlook ?? "Neutral",
      spark:   Array.isArray(obj[k]?.spark) ? obj[k].spark : [],
    }));
    return sortByPreferred(list);
  }
  const cards = dash?.outlook?.sectorCards;
  if (Array.isArray(cards) && cards.length > 0) {
    return sortByPreferred(cards);
  }
  return [];
}

/* ---- Row 4: direct fetch + last-good (no flicker) ---- */
export default function RowIndexSectors() {
  const [cards, setCards] = useState([]);
  const [initial, setInitial] = useState(true);
  const [stale, setStale] = useState(false);
  const [error, setError] = useState(null);
  const t = useRef(null), live = useRef(true);

  async function loadOnce() {
    try {
      const r = await fetch(`${API}?t=${Date.now()}`, { cache:"no-store" });
      const d = await r.json();
      if (!live.current) return;
      const list = extractAllSectors(d);
      if (list.length > 0) {
        setCards(list);
        setStale(false);
        setError(null);
      }
    } catch (e) {
      if (live.current) setError(e);
    } finally {
      if (live.current) setInitial(false);
    }
  }
  async function refresh() {
    try {
      const r = await fetch(`${API}?t=${Date.now()}`, { cache:"no-store" });
      const d = await r.json();
      if (!live.current) return;
      const list = extractAllSectors(d);
      if (list.length > 0) {
        setCards(list);
        setStale(false);
      } else {
        setStale(true); // keep last-good
      }
    } catch {
      if (live.current) setStale(true);
    }
  }

  useEffect(() => {
    loadOnce();
    t.current = setInterval(refresh, 5000);
    return () => { live.current = false; if (t.current) clearInterval(t.current); };
  }, []);

  return (
    <section id="row-4" className="panel index-sectors" aria-label="Index Sectors">
      <div className="panel-head">
        <div className="panel-title">Index Sectors</div>
        <div className="spacer" />
        {stale && cards.length > 0 && <span className="small muted">refreshing…</span>}
      </div>

      {/* initial states */}
      {initial && cards.length === 0 && <div className="small muted">Loading…</div>}
      {error   && cards.length === 0 && <div className="small muted">Failed to load sectors.</div>}
      {!initial && !error && cards.length === 0 && (
        <div className="small muted">No sector data.</div>
      )}

      {/* last-good list (stable, no flicker) */}
      {cards.length > 0 && (
        <div style={{
          display:"grid",
          gridTemplateColumns:"repeat(auto-fill, minmax(220px, 1fr))",
          gap:10, marginTop:10
        }}>
          {cards.map((c, i) => (
            <SectorCard key={c?.sector || i} sector={c?.sector} outlook={c?.outlook} spark={c?.spark} />
          ))}
        </div>
      )}
    </section>
  );
}
