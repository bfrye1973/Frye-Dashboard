// src/pages/rows/RowIndexSectors.jsx
import React from "react";
import { LastUpdated } from "../../components/LastUpdated";
import { useDashboardPoll } from "../../lib/dashboardApi";

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
  const arr  = Array.isArray(spark) ? spark : [];

  // prefer API-provided numbers; fall back to spark math; finally 0s
  let _last = Number.isFinite(last) ? last : null;
  let _deltaPct = Number.isFinite(deltaPct) ? deltaPct : null;

  if ((_last === null || _deltaPct === null) && arr.length >= 2) {
    const first = Number(arr[0]) || 0;
    const lst   = Number(arr[arr.length - 1]) || 0;
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
      <Sparkline data={arr} />
    </div>
  );
}

/* --- render --- */
export default function RowIndexSectors() {
  // ✅ dynamic cadence (same as overview row)
  const { data, loading, error } = useDashboardPoll?.("dynamic") ?? { data:null, loading:false, error:null };
  const ts = data?.meta?.ts || null;

  // Prefer backend-normalized sectorCards (includes last/deltaPct + aliases)
  const cards = Array.isArray(data?.outlook?.sectorCards) ? data.outlook.sectorCards : [];

  return (
    <section id="row-4" className="panel index-sectors" aria-label="Index Sectors">
      <div className="panel-head">
        <div className="panel-title">Index Sectors</div>
        <div className="spacer" />
        <LastUpdated ts={ts} />
      </div>

      {!data && loading && <div className="small muted">Loading…</div>}
      {error && <div className="small muted">Failed to load sectors.</div>}

      {Array.isArray(cards) && cards.length > 0 ? (
        <div style={{
          display:"grid",
          gridTemplateColumns:"repeat(auto-fill, minmax(220px, 1fr))",
          gap:10, marginTop:8
        }}>
          {cards.map((c, i) => (
            <SectorCard
              key={c?.sector || i}
              sector={c?.sector}
              outlook={c?.outlook}
              spark={c?.spark}
              last={Number.isFinite(c?.last) ? c.last : (Number.isFinite(c?.value) ? c.value : null)}
              deltaPct={Number.isFinite(c?.deltaPct) ? c.deltaPct : (Number.isFinite(c?.pct) ? c.pct : (Number.isFinite(c?.changePct) ? c.changePct : null))}
            />
          ))}
        </div>
      ) : (
        !loading && <div className="small muted">No sector data.</div>
      )}
    </section>
  );
}
