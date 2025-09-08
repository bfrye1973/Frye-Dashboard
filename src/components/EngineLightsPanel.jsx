// src/components/EngineLightsPanel.jsx
import React from "react";
import { useDashboardPoll } from "../lib/dashboardApi";

export default function EngineLightsPanel() {
  const { data } = useDashboardPoll(5000);
  const working = data || null;
  const signals = working?.signals || {};

  const order = [
    "sigBreakout",
    "sigOverextended",
    "sigRiskAlert",
    "sigDivergence",
    "sigDistribution",
    "sigLowLiquidity",
    "sigOverheat",
    "sigTurbo",
  ];
  const icons = {
    sigBreakout: "📈", sigOverextended: "🚀", sigRiskAlert:"⚡",
    sigDivergence:"↔️", sigDistribution:"📉", sigLowLiquidity:"💧", sigOverheat:"⏳", sigTurbo:"⚡",
  };
  const labels = {
    sigBreakout:"Breakout", sigOverextended:"Overextended", sigRiskAlert:"Risk Alert",
    sigDivergence:"Divergence", sigDistribution:"Distribution", sigLowLiquidity:"Liquidity Weak", sigOverheat:"Squeeze", sigTurbo:"Turbo",
  };

  const active = order.map(k => ({ key:k, sig:signals[k] })).filter(x => x.sig && x.sig.active);

  return (
    <section className="panel" style={panel}>
      <div className="panel-head"><div className="panel-title">Engine Lights</div></div>
      {active.length === 0 ? (
        <div className="small muted">(No active signals)</div>
      ) : (
        <div style={{ display:"flex", flexWrap:"wrap", gap:10 }}>
          {active.map(({key}) => (
            <span key={key}
              style={{ display:"inline-flex", gap:6, alignItems:"center",
                       padding:"4px 8px", borderRadius:999, border:"1px solid #334155",
                       background:"#0b1220", color:"#e5e7eb", fontSize:12 }}>
              <span role="img" aria-hidden>{icons[key]}</span>
              <span>{labels[key]}</span>
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
const panel = { border:"1px solid #1f2a44", borderRadius:12, padding:10, background:"#0e1526" };
