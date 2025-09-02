// src/components/GaugeCluster.jsx
// Ferrari Dashboard — R8.6 (layout stable + numerals-first ticks + sparklines)

import React from "react";
import { useDashboardPoll } from "../lib/dashboardApi";

/* helpers */
function timeAgo(ts){
  try{
    const t = new Date(ts).getTime();
    const s = Math.floor((Date.now()-t)/1000);
    if(s<60) return `${s}s ago`;
    const m = Math.floor(s/60);
    if(m<60) return `${m}m ago`;
    return `${Math.floor(m/60)}h ago`;
  }catch{ return "—"; }
}
function freshnessColor(ts){
  try{
    const t = new Date(ts).getTime();
    const mins = (Date.now()-t)/60000;
    if(mins<15) return "#22c55e";
    if(mins<60) return "#f59e0b";
    return "#ef4444";
  }catch{ return "#6b7280"; }
}

const Panel = ({ title, children, className = "" }) => (
  <div className={`panel ${className}`}>
    {title ? (
      <div className="panel-head">
        <div className="panel-title">{title}</div>
      </div>
    ) : null}
    {children}
  </div>
);

const Pill = ({ label, state = "off", icon = "" }) => (
  <span className={`light ${state}`} aria-label={`${label}: ${state}`}>
    <span className="light-icon" role="img" aria-hidden>{icon}</span>
    <span className="light-text">{label}</span>
  </span>
);

export default function GaugeCluster(){
  const { data, loading, error, refresh } = useDashboardPoll(5000);
  const ts = data?.meta?.ts || null;
  const color = freshnessColor(ts);

  const s = data?.signals || {};
  const mapSig = (sig)=>
    !sig || !sig.active ? "off" :
    String(sig.severity||"info").toLowerCase()==="danger" ? "danger" :
    String(sig.severity).toLowerCase()==="warn" ? "warn" : "ok";

  const squeeze = String(data?.odometers?.squeeze || "none");
  const squeezeState =
    squeeze==="firingDown" ? "danger" :
    squeeze==="firingUp"   ? "ok"     :
    squeeze==="on"         ? "warn"   : "off";

  const lights = [
    {label:"Breakout",       state:mapSig(s.sigBreakout),      icon:"📈"},
    {label:"Squeeze",        state:squeezeState,               icon:"⏳"},
    {label:"Overextended",   state:mapSig(s.sigOverheat),      icon:"🚀"},
    {label:"Distribution",   state:mapSig(s.sigDistribution),  icon:"📉"},
    {label:"Divergence",     state:mapSig(s.sigDivergence),    icon:"↔️"},
    {label:"Risk Alert",     state:mapSig(s.sigOverheat),      icon:"⚡"},
    {label:"Liquidity Weak", state:mapSig(s.sigLowLiquidity),  icon:"💧"},
    {label:"Turbo",          state:mapSig(s.sigTurbo),         icon:"⚡"},
  ];

  return (
    <div className="cluster">
      {/* Header */}
      <div className="panel" style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div>
          <div style={{fontWeight:700}}>Ferrari Trading Cluster</div>
          <div className="small muted">Live from /api/dashboard</div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <span className="build-chip">BUILD R8.6</span>
          <div className="tag" style={{border:`1px solid ${color}`,display:"flex",gap:8,alignItems:"center",borderRadius:8,padding:"4px 8px"}}>
            <span style={{width:8,height:8,borderRadius:999,background:color,boxShadow:`0 0 8px ${color}`}}/>
            <span className="small">{ts ? `Updated ${timeAgo(ts)}` : "—"}</span>
          </div>
          <button className="btn" onClick={refresh} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {loading && !data ? <div className="panel">Loading…</div> : null}
      {error ? <div className="panel">Error: {String(error)}</div> : null}
      {!data && !loading && !error ? <div className="panel">No data</div> : null}

      {data ? (
        <>
          {/* Gauges (centered cockpit) */}
          <Panel title="Gauges" className="carbon-fiber">
            <div className="cockpit-center">
              <div className="cockpit">
                {/* Left 2×2 minis */}
                <div className="left-stack">
                  <MiniGauge label="WATER" value={data.gauges?.waterTemp} unit="°F" />
                  <MiniGauge label="OIL"   value={data.gauges?.oilPsi}    unit="psi" />
                  <MiniGauge label="FUEL"  value={data.gauges?.fuelPct}   unit="%" />
                  <MiniGauge label="ALT"   value="—" />
                </div>

                {/* Center tach (yellow) */}
                <div className="center-tach">
                  <BigGauge theme="tach" label="RPM" value={data.gauges?.rpm} withLogo />
                </div>

                {/* Right speedo (red) */}
                <div className="right-speed">
                  <BigGauge theme="speed" label="SPEED" value={data.gauges?.speed} />
                </div>
              </div>
            </div>
          </Panel>

          {/* Engine Lights */}
          <Panel title="Engine Lights">
            <div className="lights">
              {lights.map((L,i)=>(<Pill key={`${L.label}-${i}`} label={L.label} state={L.state} icon={L.icon}/>))}
            </div>
          </Panel>

          {/* Odometers */}
          <Panel title="Odometers">
            <div className="odos">
              <Odometer label="Breadth"  value={data.odometers?.breadthOdometer} />
              <Odometer label="Momentum" value={data.odometers?.momentumOdometer} />
              <Odometer label="Squeeze"  value={String(data.odometers?.squeeze ?? "—")} />
            </div>
          </Panel>

          {/* Sectors (spark lines restored) */}
          <Panel title="Sectors">
            <div className="sectors-grid">
              {(data.outlook?.sectorCards || []).map((c, i) => (
                <div key={i} className="sector-card">
                  <div className="sector-head">
                    <div className="sector-name">{c.sector}</div>
                    <span className="tag">{c.outlook}</span>
                  </div>
                  <Spark values={c.spark || []} />
                </div>
              ))}
            </div>
          </Panel>
        </>
      ) : null}
    </div>
  );
}

/* ===== Components ===== */

function BigGauge({ theme="tach", label, value=0, withLogo=false }){
  const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
  const t=(clamp(value,-1000,1000)+1000)/2000;
  const angle=-130 + t*260; // -130..+130

  const isTach = theme==="tach";
  const face = isTach ? "#ffdd00" : "#c21a1a";

  // ---- Numerals-first tick alignment ----
  const START=-120, END=120, SWEEP=END-START, MAJOR_COUNT=10;

  // Numerals (10 labels) define where majors go
  const numerals = isTach
    ? Array.from({length:10},(_,i)=>i+1)           // 1..10
    : Array.from({length:10},(_,i)=>(i+1)*20);     // 20..200

  // Major angles from numerals (equal spacing across sweep)
  const majorAngles = numerals.map((_, idx) => START + (idx/(MAJOR_COUNT-1))*SWEEP);

  // Build ticks: majors + 4 minors between each pair (46 total)
  const ticks = [];
  for(let k=0;k<majorAngles.length;k++){
    ticks.push({ angle: majorAngles[k], major:true });
    if(k<majorAngles.length-1){
      const step = (majorAngles[k+1]-majorAngles[k])/5; // 5 segments → 4 minors
      for(let j=1;j<=4;j++) ticks.push({ angle: majorAngles[k] + j*step, major:false });
    }
  }

  // Numeral placement: same major angles
  const numeralRadius = 77;
  const toXY = (deg) => {
    const rad = (deg - 90) * Math.PI/180;
    return { x: 100 + numeralRadius*Math.cos(rad), y: 100 + numeralRadius*Math.sin(rad) };
  };

  return (
    <div className={`fg-wrap ${isTach?"gauge--tach":"gauge--speed"}`}>
      <div className="gauge-face" style={{background:face}}>
        <div className="ring"/>

        {/* Ticks */}
        <div className="ticks">
          {ticks.map((tk,i)=>(<Tick key={i} angle={tk.angle} major={tk.major}/>))}
        </div>

        {/* Tach redline */}
        {isTach ? <div className="redline-arc" aria-hidden/> : null}

        {/* Numerals */}
        <svg className="dial-numerals" viewBox="0 0 200 200" aria-hidden>
          {numerals.map((num,idx)=>{ const {x,y}=toXY(majorAngles[idx]); return (
            <text key={idx} x={x} y={y} className={`numeral ${isTach?"tach":"speed"}`}
              textAnchor="middle" dominantBaseline="central">{num}</text>
          );})}
        </svg>

        {/* Needle / hub / glass */}
        <div className="needle" style={{transform:`rotate(${angle}deg)`}}/>
        <div className="hub"/>
        <div className="glass"/>

        {/* Branding arcs (tach only) */}
        {withLogo ? (
          <svg className="logo-ring" viewBox="0 0 220 220" aria-hidden>
            <defs>
              <path id="ringPath" d="M110,10 a100,100 0 1,1 0,200 a100,100 0 1,1 0,-200"/>
              <path id="ringPathBottom" d="M110,210 a100,100 0 1,1 0,-200 a100,100 0 1,1 0,200"/>
            </defs>
            <text className="logo-top"><textPath href="#ringPath" startOffset="50%" textAnchor="middle">REDLINE TRADING</textPath></text>
            <text className="logo-bottom"><textPath href="#ringPathBottom" startOffset="50%" textAnchor="middle">POWERED BY AI</textPath></text>
          </svg>
        ) : null}
      </div>
      <div className="fg-title">{label}</div>
    </div>
  );
}

function Tick({angle,major}){
  return <div className={`tick ${major?"major":""}`} style={{transform:`rotate(${angle}deg)`}}/>;
}

function MiniGauge({label,value,unit}){
  return (
    <div className="mini">
      <div className="mini-face"><div className="mini-needle"/><div className="mini-hub"/></div>
      <div className="mini-value">{value??"—"}{unit||""}</div>
      <div className="mini-title">{label}</div>
    </div>
  );
}

function Odometer({label,value}){
  return (
    <div className="odo">
      <div className="odo-label">{label}</div>
      <div className="odo-value">{value??"—"}</div>
    </div>
  );
}

/* Sparkline component (SVG) */
function Spark({ values=[] }){
  if(!values || values.length<2) return <div className="sector-spark">(no data)</div>;
  const min = Math.min(...values), max = Math.max(...values);
  const W=180, H=36;
  const norm = v => (max-min ? (v-min)/(max-min) : 0.5);
  const pts = values.map((v,i)=>{
    const x = (i/(values.length-1))*(W-8)+4;
    const y = (1-norm(v))*(H-8)+4;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} width={W} height={H}>
      <polyline className="spark-line" fill="none" strokeWidth="2" points={pts} />
    </svg>
  );
}
