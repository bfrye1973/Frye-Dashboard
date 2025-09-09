// src/pages/rows/RowIndexSectors.jsx
import React from "react";
import { useDashboardPoll } from "../../lib/dashboardApi"; // same hook used elsewhere

/* ---------- tiny helpers ---------- */
function toneFor(outlook) {
  if (!outlook) return "info";
  const o = String(outlook).toLowerCase();
  if (o.startsWith("bull")) return "ok";
  if (o.startsWith("bear")) return "danger";
  return "warn"; // neutral / mixed
}

function Badge({ text, tone = "info" }) {
  const palette = {
    ok:    { bg:"#064e3b", fg:"#d1fae5", bd:"#065f46" },
    warn:  { bg:"#5b4508", fg:"#fde68a", bd:"#a16207" },
    danger:{ bg:"#7f1d1d", fg:"#fecaca", bd:"#b91c1c" },
    info:  { bg:"#0b1220", fg:"#93c5fd", bd:"#334155" },
  }[tone] || { bg:"#0b1220", fg:"#93c5fd", bd:"#334155" };
  return (
    <span style={{
      padding:"4px 8px", borderRadius:8, fontSize:12, fontWeight:700,
      background:palette.bg, color:palette.fg, border:`1px solid ${palette.bd}`
    }}>
      {text}
    </span>
  );
}

/* render a tiny sparkline from an array of numbers */
function Sparkline({ data = [], width = 160, height = 36 }) {
  if (!Array.isArray(data) || data.length < 2) {
    return <div className="small muted">no data</div>;
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = (max - min) || 1;
  const stepX = width / (data.length - 1);

  const d = data.map((v, i) => {
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
  return (
    <div className="panel" style={{ padding:10 }}>
      <div style={{
        display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8
      }}>
        <div className="panel-title small">{sector || "Sector"}</div>
        <Badge text={outlook || "Neutral"} tone={tone} />
      </div>
      <Sparkline data={spark} />
    </div>
  );
}

/* ---------- Row 4: Index Sectors ---------- */
export default function RowIndexSectors() {
  const { data, loading, error } = useDashboardPoll?.(5000) ?? { data:null, loading:false, error:null };
  const cards = data?.outlook?.sectorCards ?? [];

  return (
    <section id="row-4" className="panel index-sectors" aria-label="Index Sectors">
      <div className="panel-head">
        <div className="panel-title">Index Sectors</div>
      </div>

      {error && <div className="small muted">Failed to load sectors.</div>}
      {loading && <div className="small muted">Loading…</div>}
      {!loading && cards.length === 0 && (
        <div className="small muted">Sectors table/cards will render here.</div>
      )}

      {cards.length > 0 && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(220px, 1fr))", gap:10, marginTop:10 }}>
          {cards.map((c, i) => (
            <SectorCard key={i} sector={c.sector} outlook={c.outlook} spark={c.spark} />
          ))}
        </div>
      )}
    </section>
  );
}
