// src/pages/rows/RowIndexSectors.jsx
import React, { useEffect, useRef, useState } from "react";
import { fetchDashboard } from "../../lib/dashboardApi"; // direct fetch (no hook)

const POLL_MS = 5000;

/* ---------- helpers ---------- */
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

/* sparkline */
function Sparkline({ data=[], width=160, height=36 }) {
  if (!Array.isArray(data) || data.length < 2) {
    return <div className="small muted">no data</div>;
  }
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

function SectorCard({ sector, outlook, spark }) {
  const tone = toneFor(outlook);
  return (
    <div className="panel" style={{ padding:10 }}>
      <div style={{
        display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8
      }}>
        <div className="panel-title small">{sector || "Sector"}</div>
        <Badge text={outlook || "Neutral"} tone={tone} />
      </div>
      <Sparkline data={Array.isArray(spark) ? spark : []} />
    </div>
  );
}

/* normalize to [{sector, outlook, spark}] from various payload shapes */
function extractSectorCards(raw){
  const direct = raw?.outlook?.sectorCards ?? raw?.sectorCards;
  if (Array.isArray(direct)) return direct;

  // legacy mapping: outlook.sectors = { Tech:{outlook:"Bullish", spark:[...] }, ... }
  const legacy = raw?.outlook?.sectors;
  if (legacy && typeof legacy === "object") {
    return Object.keys(legacy).map(k => ({
      sector: k,
      outlook: legacy[k]?.outlook ?? "Neutral",
      spark: legacy[k]?.spark ?? []
    }));
  }
  return []; // nothing found
}

/* ---------- Row 4 with a private poller (stale-while-revalidate) ---------- */
export default function RowIndexSectors() {
  const [cards, setCards] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [stale, setStale] = useState(false);
  const [error, setError] = useState(null);
  const timerRef = useRef(null);
  const aliveRef = useRef(true);

  useEffect(() => {
    async function loadOnce() {
      try {
        const d = await fetchDashboard();
        const next = extractSectorCards(d);
        if (!aliveRef.current) return;
        if (Array.isArray(next) && next.length > 0) {
          setCards(next);
          setStale(false);
          setError(null);
        } else {
          // keep nothing on first load, show placeholder
          setStale(false);
        }
      } catch (e) {
        if (!aliveRef.current) return;
        setError(e);
      } finally {
        if (aliveRef.current) setInitialLoading(false);
      }
    }

    async function refresh() {
      try {
        const d = await fetchDashboard();
        const next = extractSectorCards(d);
        if (!aliveRef.current) return;

        if (Array.isArray(next) && next.length > 0) {
          setCards(next);
          setStale(false);
        } else {
          // momentary empty → keep last-good and mark stale (prevents flicker)
          setStale(true);
        }
      } catch {
        // network error → keep last-good, mark stale
        if (aliveRef.current) setStale(true);
      }
    }

    // initial load
    loadOnce();

    // poller
    timerRef.current = setInterval(refresh, POLL_MS);
    return () => {
      aliveRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return (
    <section id="row-4" className="panel index-sectors" aria-label="Index Sectors">
      <div className="panel-head">
        <div className="panel-title">Index Sectors</div>
        <div className="spacer" />
        {stale && cards.length > 0 && <span className="small muted">refreshing…</span>}
      </div>

      {/* initial states */}
      {initialLoading && cards.length === 0 && <div className="small muted">Loading…</div>}
      {error && cards.length === 0 && <div className="small muted">Failed to load sectors.</div>}
      {!initialLoading && cards.length === 0 && !error && (
        <div className="small muted">No sector data.</div>
      )}

      {/* last-good always (prevents disappear/flicker) */}
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
