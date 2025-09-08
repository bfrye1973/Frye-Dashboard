// src/components/SectorsGrid.jsx
import React from "react";
import { useDashboardPoll } from "../lib/dashboardApi";

export default function SectorsGrid() {
  const { data } = useDashboardPoll(5000);
  const working = data || null;
  const sectors = working?.outlook?.sectorCards || working?.sectorCards || [];

  return (
    <section className="panel" style={panel}>
      <div className="panel-head"><div className="panel-title">Index Sectors</div></div>
      {sectors.length === 0 ? (
        <div className="small muted">(No sector data)</div>
      ) : (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:10 }}>
          {sectors.map((s, i) => (
            <div key={`${s?.sector || i}-${i}`} className="panel" style={card}>
              <div style={{ fontWeight:700, marginBottom:4 }}>{s?.sector || "Sector"}</div>
              <div className="small muted" style={{ marginBottom:6 }}>{s?.outlook || s?.label || "—"}</div>
              <div className="small muted" style={{ opacity:.75 }}>(spark)</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

const panel = { border:"1px solid #1f2a44", borderRadius:12, padding:10, background:"#0e1526" };
const card  = { border:"1px solid #1f2a44", borderRadius:10, padding:8, background:"#0b1220" };
