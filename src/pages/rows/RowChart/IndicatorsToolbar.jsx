// src/pages/rows/RowChart/IndicatorsToolbar.jsx
// Engine 17 + Premarket Fib controls

import React from "react";
import {WAVE_NODE_DEGREES,waveNodeDisplayStyle} from "./waveNodePresentation";

function ColorInput({ value, onChange }) {
  return (
    <input
      type="color"
      value={value || "#ffd54a"}
      onChange={(e) => onChange?.(e.target.value)}
      style={{
        width: 34,
        height: 22,
        border: "1px solid #2b2b2b",
        background: "transparent",
        borderRadius: 6,
        cursor: "pointer",
      }}
      title="Pick color"
    />
  );
}

function Slider({ min, max, step, value, onChange }) {
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange?.(Number(e.target.value))}
      style={{ width: "100%" }}
    />
  );
}

function SettingsBlock({ styleObj, onPatch }) {
  const s = styleObj || {};

  const color = s.color || "#ffd54a";
  const fontPx = Number.isFinite(s.fontPx) ? s.fontPx : 18;
  const lineWidth = Number.isFinite(s.lineWidth) ? s.lineWidth : 3;


  return (
    <div
      style={{
        marginTop: 8,
        width: 300,
        background: "#0b0b0b",
        border: "1px solid #2b2b2b",
        borderRadius: 10,
        padding: 10,
      }}
    >
      <div style={{ color: "#9ca3af", fontSize: 12, fontWeight: 800, marginBottom: 8 }}>
        Fib Visuals
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "95px 1fr",
          alignItems: "center",
          gap: 10,
          marginBottom: 10,
        }}
      >
        <div style={{ color: "#9ca3af", fontSize: 12 }}>Color</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ColorInput value={color} onChange={(v) => onPatch?.({ color: v })} />
          <span style={{ color: "#9ca3af", fontSize: 12 }}>{color}</span>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "95px 1fr",
          gap: 10,
          marginBottom: 10,
        }}
      >
        <div style={{ color: "#9ca3af", fontSize: 12 }}>Font</div>
        <div>
          <Slider min={10} max={64} step={1} value={fontPx} onChange={(v) => onPatch?.({ fontPx: v })} />
          <div style={{ color: "#9ca3af", fontSize: 12, marginTop: 4 }}>{fontPx}px</div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "95px 1fr",
          gap: 10,
          marginBottom: 10,
        }}
      >
        <div style={{ color: "#9ca3af", fontSize: 12 }}>Line</div>
        <div>
          <Slider min={1} max={12} step={0.5} value={lineWidth} onChange={(v) => onPatch?.({ lineWidth: v })} />
          <div style={{ color: "#9ca3af", fontSize: 12, marginTop: 4 }}>{lineWidth}px</div>
        </div>
      </div>

      <div style={{fontSize:11,color:"#94a3b8",marginTop:8}}>
        Engine 22 published WATCH lines only. This control never creates Elliott Wave nodes.
      </div>
    </div>
  );
}

// Chart wave anchors are not Fibonacci projections. Keep selection and
// cosmetics independent from all Fib (degree) toggles and Engine22 decisions.
function WaveNodeRow({degree,label,selected,styleObj,onSelect,onStylePatch, fibEnabled,fibStyle,onFibToggle,onFibStylePatch}){
  const s=waveNodeDisplayStyle({[degree]:styleObj},degree);
  return (
    <div style={{
      border:"1px solid #272f3d",borderRadius:6,padding:"5px 7px",
      background:selected?"#1c2737":"#101216"
    }}>
      <label style={{display:"flex",alignItems:"center",gap:7,cursor:"pointer",fontSize:12}}>
        <input type="checkbox" aria-label={label+" wave nodes"}
          checked={selected} onChange={e=>onSelect?.(e.target.checked)}/>
        <span style={{fontWeight:selected?800:600}}>{label}</span>
        {selected?<span style={{marginLeft:"auto",fontSize:10,color:"#facc15"}}>On</span>:null}
      </label>
      <div style={{marginLeft:20,marginTop:6,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
        <label style={{display:"flex",alignItems:"center",gap:7,fontSize:13,fontWeight:700}}>
          <input type="checkbox" aria-label={degree+" Fibonacci extensions"}
            checked={!!fibEnabled} onChange={e=>onFibToggle?.(e.target.checked)}/>
          Fib extensions (Engine 22)
        </label>
        <details>
          <summary style={{fontSize:11,color:"#cbd5e1",cursor:"pointer"}}>
            ⚙ Fib appearance
          </summary>
          <SettingsBlock styleObj={fibStyle} onPatch={onFibStylePatch}/>
        </details>
      </div>
      <details style={{marginLeft:20,marginTop:3}}>
        <summary style={{fontSize:11,color:"#cbd5e1",cursor:"pointer"}}>
          ⚙ Node &amp; line appearance
        </summary>
        <div style={{padding:"7px 2px",display:"grid",gap:9,fontSize:12}}>
          <label style={{display:"flex",gap:7,alignItems:"center"}}>
            <input type="checkbox" checked={s.showDots}
              onChange={e=>onStylePatch({showDots:e.target.checked})}/>
            Show pivot dots
          </label>
          <label style={{display:"flex",gap:7,alignItems:"center"}}>
            <input type="checkbox" checked={s.showLabels}
              onChange={e=>onStylePatch({showLabels:e.target.checked})}/>
            Show wave labels &amp; prices
          </label>
          <label style={{display:"flex",gap:7,alignItems:"center"}}>
            <input type="checkbox" checked={s.showLines}
              onChange={e=>onStylePatch({showLines:e.target.checked})}/>
            Connect verified source anchors
          </label>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
            <span>Node / label color</span>
            <ColorInput value={s.color} onChange={color=>onStylePatch({color})}/>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
            <span>Connecting line color</span>
            <ColorInput value={s.lineColor} onChange={lineColor=>onStylePatch({lineColor})}/>
          </div>
          <label style={{display:"grid",gap:3}}>
            <span>Pivot dot size: {s.markerRadius}px radius</span>
            <Slider min={2} max={12} step={1} value={s.markerRadius}
              onChange={markerRadius=>onStylePatch({markerRadius})}/>
          </label>
          <label style={{display:"grid",gap:3}}>
            <span>Label size: {s.labelFontPx}px</span>
            <Slider min={12} max={28} step={1} value={s.labelFontPx}
              onChange={labelFontPx=>onStylePatch({labelFontPx})}/>
          </label>
          <label style={{display:"grid",gap:3}}>
            <span>Line thickness: {s.lineWidth}px</span>
            <Slider min={1} max={8} step={0.5} value={s.lineWidth}
              onChange={lineWidth=>onStylePatch({lineWidth})}/>
          </label>
          <div style={{fontSize:10,color:"#94a3b8"}}>
            Only confirmed source-candle positions are connected. Fib targets are separate.
          </div>
        </div>
      </details>
    </div>
  );
}

export default function IndicatorsToolbar({
  showEma = true,
  ema10 = true,
  ema20 = true,
  ema50 = true,
  ema200 = true,
  volume = true,

  institutionalZonesAuto = false,
  smzShelvesAuto = false,

  fibPrimary = false,
  fibIntermediate = false,
  fibMinor = false,
  fibMinute = false,
  fibMicro = false,
  fibSubminute = false,
  fibSubmicro = false,
  fibSubmicroScenario = "option1",
  fibSubminuteScenario = "wick",

  fibPrimaryStyle,
  fibIntermediateStyle,
  fibMinorStyle,
  fibMinuteStyle,
  fibMicroStyle,
  fibSubminuteStyle,
  fibSubmicroStyle, 

  engine17Overlay = true,
  engine17Timeline = true,
  engine17Badges = true,
  engine17StateOverlay = true,
  engine17Signals = true,
  engine17TriggerLine = true,
  engine17DebugPanel = false,

  engine23BehaviorCard = true,

  engine26TradeGeometryTool = false,

  engine25CompositeOverlay = true,
  engine25Timeline = false,

  engine29CrossMarketPanel = false,
  engine18LiquidityZones = false,
  
  showPremarketFibs = false,

  waveNodeDegrees = [],
  waveNodeStyles = {},
  waveNodeStatuses = {},
  waveNodeCounts = {},
  waveNodeHistoryCursor = 0,
  waveNodeHistoricalRevisionCount = 0,
  onWaveNodeDegreeToggle,
  onWaveNodeHideAll,
  onWaveNodeStylePatch,

  onChange,
  onReset,
}) {
  const divider = <div style={{ height: 1, background: "#2b2b2b", margin: "10px 0" }} />;

  const wrap = (children) => (
    <div
      style={{
        position: "absolute",
        zIndex: 5,
        marginTop: 6,
        background: "#111",
        border: "1px solid #2b2b2b",
        borderRadius: 8,
        padding: 10,
        minWidth: 420,
        maxHeight: "calc(100vh - 190px)",
        overflowY: "auto",
        overscrollBehavior: "contain",
        color: "#e5e7eb",
        boxShadow: "0 6px 24px rgba(0,0,0,0.35)",
      }}
    >
      {children}
    </div>
  );

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "8px 12px",
        borderBottom: "1px solid #2b2b2b",
        background: "#0f0f0f",
      }}
    >
      <label style={{ color: "#9ca3af", fontWeight: 600 }}>Indicators</label>

      <div style={{ position: "relative" }}>
        <details>
          <summary
            style={{
              listStyle: "none",
              cursor: "pointer",
              color: "#e5e7eb",
              background: "#0b0b0b",
              border: "1px solid #2b2b2b",
              padding: "6px 10px",
              borderRadius: 8,
              userSelect: "none",
            }}
          >
            Indicators ▾
          </summary>

          {wrap(
            <>
              <div style={{color:"#facc15",fontSize:12,fontWeight:800,margin:"5px 0 4px"}}>
                Engine 2 — Elliott Wave Nodes
              </div>
              <div style={{fontSize:11,color:"#94a3b8",marginBottom:7}}>
                Turn wave nodes and Engine 22 Fibonacci extensions on/off independently for each degree.
              </div>
              <div style={{display:"grid",gap:5}}>
                <button type="button" onClick={()=>onWaveNodeHideAll?.()}
                  style={{background:"#111827",color:"#e5e7eb",border:"1px solid #475569",
                    borderRadius:5,padding:6,cursor:"pointer",textAlign:"left"}}>
                  Off — hide all wave nodes
                </button>
                {WAVE_NODE_DEGREES.map(([degree,label])=>(
                  <WaveNodeRow
                    key={degree}
                    degree={degree}
                    label={Number.isInteger(waveNodeCounts[degree])
                      ?label+" ("+waveNodeCounts[degree]+")":label}
                    selected={waveNodeDegrees.includes(degree)}
                    styleObj={waveNodeStyles[degree]}
                    onSelect={checked=>onWaveNodeDegreeToggle?.(degree,checked)}
                    onStylePatch={patch=>onWaveNodeStylePatch?.(degree,patch)}
                    fibEnabled={({
                      PRIMARY:fibPrimary,INTERMEDIATE:fibIntermediate,MINOR:fibMinor,
                      MINUTE:fibMinute,SUBMINUTE:fibSubminute,
                      MICRO:fibMicro,SUBMICRO:fibSubmicro,
                    })[degree]}
                    fibStyle={({
                      PRIMARY:fibPrimaryStyle,INTERMEDIATE:fibIntermediateStyle,
                      MINOR:fibMinorStyle,MINUTE:fibMinuteStyle,
                      SUBMINUTE:fibSubminuteStyle,MICRO:fibMicroStyle,
                      SUBMICRO:fibSubmicroStyle,
                    })[degree]}
                    onFibToggle={enabled=>onChange?.({
                      [({PRIMARY:"fibPrimary",INTERMEDIATE:"fibIntermediate",MINOR:"fibMinor",
                         MINUTE:"fibMinute",SUBMINUTE:"fibSubminute",MICRO:"fibMicro",
                         SUBMICRO:"fibSubmicro"})[degree]]:enabled
                    })}
                    onFibStylePatch={patch=>{
                      const property=({
                        PRIMARY:"fibPrimaryStyle",INTERMEDIATE:"fibIntermediateStyle",
                        MINOR:"fibMinorStyle",MINUTE:"fibMinuteStyle",
                        SUBMINUTE:"fibSubminuteStyle",MICRO:"fibMicroStyle",
                        SUBMICRO:"fibSubmicroStyle",
                      })[degree];
                      const previous=({
                        PRIMARY:fibPrimaryStyle,INTERMEDIATE:fibIntermediateStyle,
                        MINOR:fibMinorStyle,MINUTE:fibMinuteStyle,
                        SUBMINUTE:fibSubminuteStyle,MICRO:fibMicroStyle,
                        SUBMICRO:fibSubmicroStyle,
                      })[degree];
                      onChange?.({[property]:{...(previous||{}),...patch}});
                    }}
                  />
                ))}
              </div>
              {WAVE_NODE_DEGREES.filter(([degree])=>waveNodeDegrees.includes(degree))
                .map(([degree,label])=>{
                  const status=waveNodeStatuses[degree];
                  if(!status)return null;
                  return <div key={degree} style={{marginTop:7,
                    color:status.sourceAvailable===false?"#fbbf24":"#94a3b8",fontSize:11}}>
                    <strong>{label}:</strong>{" "}
                    {status.sourceAvailable===false
                      ?"Engine 22 unavailable — no old nodes shown"
                      :<>{status.mapped}/{status.total} source nodes match loaded{" "}
                        {status.timeframe} candles
                        {status.mapped===0?" · Historical candles may be required":""}
                        {status.mapped>0&&
                          <div style={{marginTop:3,color:status.priceOutside>0?"#fbbf24":"#94a3b8"}}>
                            Price/candle: {status.priceWithin||0} within{" · "}
                            {status.priceOutside||0} outside{" · "}
                            {status.priceUnavailable||0} OHLC unavailable
                          </div>}
                      </>}
                  </div>;
                })}
              {waveNodeHistoryCursor>0?(
                <div style={{marginTop:4,color:"#94a3b8",fontSize:10}}>
                  Engine 22 history revision {waveNodeHistoryCursor}
                  {" · "}{waveNodeHistoricalRevisionCount} stored revision events
                </div>
              ):null}
              <div style={{marginTop:5,color:"#94a3b8",fontSize:10}}>
                Degree counts come from the current Engine 22 Strategies feed.
                Zero-node degrees remain empty; old spreadsheet anchors are never substituted.
              </div>

              {divider}

              <div style={{color:"#fbbf24",fontSize:12,fontWeight:800,margin:"6px 0"}}>
                Engine 18 — Liquidity Intelligence (Demo)
              </div>
              <label style={{display:"flex",alignItems:"center",gap:7,fontSize:12}}>
                <input type="checkbox" checked={!!engine18LiquidityZones}
                  onChange={e=>onChange?.({engine18LiquidityZones:e.target.checked})}/>
                Liquidity Zones (Level 2 · test)
              </label>
              <div style={{fontSize:10,color:"#94a3b8",marginTop:4}}>
                Experimental ES visible depth · price levels only when feed is fresh and approved for display.
                Read-only. No hidden stops or Level 3 claims.
              </div>
              {divider}

              <div style={{ color: "#9ca3af", fontSize: 12, margin: "6px 0 4px" }}>EMA</div>

              <label>
                <input
                  type="checkbox"
                  checked={!!showEma}
                  onChange={(e) => onChange?.({ showEma: e.target.checked })}
                />{" "}
                Enable EMA
              </label>

              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
                <label>
                  <input
                    type="checkbox"
                    checked={!!ema10}
                    onChange={(e) => onChange?.({ ema10: e.target.checked })}
                  />{" "}
                  EMA 10
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={!!ema20}
                    onChange={(e) => onChange?.({ ema20: e.target.checked })}
                  />{" "}
                  EMA 20
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={!!ema50}
                    onChange={(e) => onChange?.({ ema50: e.target.checked })}
                  />{" "}
                  EMA 50
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={!!ema200}
                    onChange={(e) => onChange?.({ ema200: e.target.checked })}
                 />{" "}
                 EMA 200
               </label>
              </div>

              {divider}

              <div style={{ color: "#9ca3af", fontSize: 12, margin: "6px 0 4px" }}>Volume</div>

              <label>
                <input
                  type="checkbox"
                  checked={!!volume}
                  onChange={(e) => onChange?.({ volume: e.target.checked })}
                />{" "}
                Show Volume Histogram
              </label>

              {divider}

              <div style={{ color: "#9ca3af", fontSize: 12, margin: "6px 0 4px" }}>SMZ Overlays</div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label>
                  <input
                    type="checkbox"
                    checked={!!institutionalZonesAuto}
                    onChange={(e) =>
                      onChange?.({ institutionalZonesAuto: e.target.checked })
                    }
                  />{" "}
                  Institutional Zones (auto)
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={!!smzShelvesAuto}
                    onChange={(e) => onChange?.({ smzShelvesAuto: e.target.checked })}
                  />{" "}
                  Acc/Dist Shelves (auto)
                </label>
              </div>

              {divider}

              <div style={{ color: "#9ca3af", fontSize: 12, margin: "6px 0 8px" }}>
                Engine 17 — Snapshot Truth
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                <label>
                  <input
                    type="checkbox"
                    checked={!!engine17Overlay}
                    onChange={(e) => onChange?.({ engine17Overlay: e.target.checked })}
                  />{" "}
                  Enable Engine 17
                </label>

                <label>
                  <input
                    type="checkbox"
                    checked={!!engine17StateOverlay}
                    onChange={(e) => onChange?.({ engine17StateOverlay: e.target.checked })}
                  />{" "}
                  State Overlay
                </label>

                <label>
                  <input
                    type="checkbox"
                    checked={!!engine17Timeline}
                    onChange={(e) => onChange?.({ engine17Timeline: e.target.checked })}
                  />{" "}
                  Decision Timeline
                </label>

                <label>
                  <input
                    type="checkbox"
                    checked={!!engine23BehaviorCard}
                    onChange={(e) => onChange?.({ engine23BehaviorCard: e.target.checked })}
                  />{" "}
                  Engine 23 — Wave Behavior Read
                </label>

                <label>
                  <input
                    type="checkbox"
                    checked={!!engine17Badges}
                    onChange={(e) => onChange?.({ engine17Badges: e.target.checked })}
                  />{" "}
                  Top-Right Pills
                </label>

                <label>
                  <input
                    type="checkbox"
                    checked={!!engine17Signals}
                    onChange={(e) => onChange?.({ engine17Signals: e.target.checked })}
                  />{" "}
                  Signal Markers
                </label>

                <label>
                  <input
                    type="checkbox"
                    checked={!!engine17TriggerLine}
                    onChange={(e) => onChange?.({ engine17TriggerLine: e.target.checked })}
                  />{" "}
                  Trigger Line
                </label>

                <label>
                  <input
                    type="checkbox"
                    checked={!!engine17DebugPanel}
                    onChange={(e) => onChange?.({ engine17DebugPanel: e.target.checked })}
                  />{" "}
                  Debug Panel (Raw vs Composed)
                </label>
              </div>

              {divider}

              <div style={{ color: "#9ca3af", fontSize: 12, margin: "6px 0 8px" }}>
                Engine 26 — Trade Geometry
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                <label>
                  <input
                    type="checkbox"
                    checked={!!engine26TradeGeometryTool}
                    onChange={(e) =>
                      onChange?.({ engine26TradeGeometryTool: e.target.checked })
                    }
                  />{" "}
                  Trade Geometry Tool
                </label>
              </div>

              {divider}

              <div style={{ color: "#9ca3af", fontSize: 12, margin: "6px 0 8px" }}>
                Engine 25 — Market Health
              </div>

                <div style={{ display: "grid", gap: 6 }}>
                  <label>
                    <input
                      type="checkbox"
                      checked={!!engine25CompositeOverlay}
                      onChange={(e) =>
                        onChange?.({ engine25CompositeOverlay: e.target.checked })
                      }
                    />{" "}
                    Composite Overlay
                  </label>

                  <label>
                    <input
                      type="checkbox"
                      checked={!!engine25Timeline}
                      onChange={(e) =>
                        onChange?.({ engine25Timeline: e.target.checked })
                      }
                    />{" "}
                    Market Health Timeline
                  </label>
                </div>

                {divider}

                <div style={{ color: "#9ca3af", fontSize: 12, margin: "6px 0 8px" }}>
                  Engine 29 — Cross-Market Stress
                </div>

                <div style={{ display: "grid", gap: 6 }}>
                  <label>
                    <input
                      type="checkbox"
                      checked={!!engine29CrossMarketPanel}
                      onChange={(e) =>
                        onChange?.({ engine29CrossMarketPanel: e.target.checked })
                      }
                    />{" "}
                    Cross-Market Stress Window
                  </label>
                </div>

                {divider}

                <div style={{ color: "#9ca3af", fontSize: 12, margin: "6px 0 8px" }}>
                  Premarket Fibs
                </div>

              <div style={{ display: "grid", gap: 6 }}>
                <label>
                  <input
                    type="checkbox"
                    checked={!!showPremarketFibs}
                    onChange={(e) => onChange?.({ showPremarketFibs: e.target.checked })}
                  />{" "}
                  Premarket Fibs (raw E16)
                </label>
              </div>

              {divider}

              <div style={{fontSize:11,color:"#94a3b8",margin:"6px 0"}}>
                Elliott Wave Fib controls are now beside each wave degree above.
                No legacy node or Fibonacci source is drawn here.
              </div>

              {divider}

              <button
                type="button"
                onClick={() => onReset?.()}
                style={{
                  width: "100%",
                  background: "#0b0b0b",
                  color: "#e5e7eb",
                  border: "1px solid #2b2b2b",
                  borderRadius: 8,
                  padding: "6px 10px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
                title="Reset to defaults"
              >
                Reset to Defaults
              </button>
            </>
          )}
        </details>
      </div>
    </div>
  );
}
