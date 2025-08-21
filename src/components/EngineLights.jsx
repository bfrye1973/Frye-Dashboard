// src/components/EngineLights.jsx
import React from "react";
import { LIGHTS_META } from "../logic/engineLightRules";

const colors = { off:"#334155", info:"#38bdf8", warn:"#f59e0b", alert:"#ef4444", good:"#22c55e" };

export default function EngineLights({ lights = {}, onClick }) {
  const ids = Object.keys(LIGHTS_META);
  return (
    <div style={wrap}>
      {ids.map((id) => {
        const meta = LIGHTS_META[id];
        const obj  = lights[id] || {};
        const state = obj.state || "off";
        return (
          <div key={id} style={{...pill, borderColor: colors[state]}} onClick={()=>onClick?.(id)} title={meta.label}>
            <span style={{ color: colors[state], marginRight: 6 }}>{meta.icon}</span>
            <span>{meta.label}</span>
          </div>
        );
      })}
    </div>
  );
}

const wrap = { display:"flex", gap:8, flexWrap:"wrap", padding:"8px 10px", border:"1px solid #1f2a44", borderRadius:12, background:"#0e1526", marginBottom:8 };
const pill = { display:"flex", alignItems:"center", gap:4, padding:"4px 8px", border:"1px solid", borderRadius:999, cursor:"default", fontSize:12 };
