// src/pages/rows/RowIndexSectors.jsx
import React, { useEffect, useRef, useState } from "react";
import { useDashboardPoll } from "../../lib/dashboardApi";

const toneFor = (o) => {
  if (!o) return "info";
  const s = String(o).toLowerCase();
  if (s.startsWith("bull")) return "ok";
  if (s.startsWith("bear")) return "danger";
  return "warn";
};

function Badge({ text, tone="info" }) {
  const map = {
    ok:{bg:"#064e3b",fg:"#d1fae5",bd:"#065f46"},
    warn:{bg:"#5b4508",fg:"#fde68a",bd:"#a16207"},
    danger:{bg:"#7f1d1d",fg:"#fecaca",bd:"#b91c1c"},
    info:{bg:"#0b1220",fg:"#93c5fd",bd:"#334155"}
  }[tone] || {bg:"#0b1220",fg:"#93c5fd",bd:"#334155"};
  return (
    <span style={{padding:"4px 8px",borderRadius:8,fontSize:12,fontWeight:700,
      background:map.bg,color:map.fg,border:`1px solid ${map.bd}`}}>
      {text}
    </span>
  );
}

function Sparkline({ data=[], width=160, height=36 }) {
  if (!Array.isArray(data) || data.length < 2) return <div className="small muted">no data</div>;
  const min = Math.min(...data), max = Math.max(...data), span = (max - min) || 1;
  const stepX = width / (data.length - 1);
  const d = data.map((v,i)=>{
    const x=i*stepX, y=height-((v-min)/span)*height;
    return `${i===0?"M":"L"}${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
  return <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
    <path d={d} fill="none" stroke="#60a5fa" strokeWidth="2" />
  </svg>;
}

function SectorCard({ sector, outlook, spark }) {
  const tone = toneFor(outlook);
  return (
    <div className="panel" style={{ padding:10 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
        <div className="panel-title small">{sector || "Sector"}</div>
        <Badge text={outlook || "Neutral"} tone={tone} />
      </div>
      <Sparkline data={Array.isArray(spark) ? spark : []} />
    </div>
  );
}

export default function RowIndexSectors() {
  const { data, loading, error } = useDashboardPoll?.(5000) ?? { data:null, loading:false, error:null };

  const [cards, setCards] = useState([]);        // last-good cards we render
  const [stale, setStale] = useState(false);     // true if last poll returned empty
  const firstGoodRef = useRef(false);

  useEffect(() => {
    // current polled array (can be empty)
    const polled = data?.outlook?.sectorCards;

    // first meaningful payload
    if (!firstGoodRef.current) {
      if (Array.isArray(polled) && polled.length > 0) {
        setCards(polled);
        setStale(false);
        firstGoodRef.current = true;
      }
      // if first payload is empty or undefined, do nothing (keep placeholder)
      return;
    }

    // after first-good: only replace when non-empty; keep last-good on empty
    if (Array.isArray(polled)) {
      if (polled.length > 0) {
        setCards(polled);
        setStale(false);
      } else {
        setStale(true); // show 'refreshing…' but render previous cards
      }
    }
  }, [data]);

  return (
    <section id="row-4" className="panel index-sectors" aria-label="Index Sectors">
      <div className="panel-head">
        <div className="panel-title">Index Sectors</div>
        <div className="spacer" />
        {stale && cards.length > 0 && <span className="small muted">refreshing…</span>}
      </div>

      {/* initial states */}
      {!firstGoodRef.current && loading && <div className="small muted">Loading…</div>}
      {!firstGoodRef.current && error   && <div className="small muted">Failed to load sectors.</div>}
      {!firstGoodRef.current && !loading && !error && (!cards || cards.length === 0) && (
        <div className="small muted">No sector data.</div>
      )}

      {/* last-good always (prevents flicker) */}
      {Array.isArray(cards) && cards.length > 0 && (
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
