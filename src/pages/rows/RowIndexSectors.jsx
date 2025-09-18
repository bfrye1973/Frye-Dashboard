// src/pages/rows/RowIndexSectors.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { LastUpdated } from "../../components/LastUpdated";
import { useDashboardPoll } from "../../lib/dashboardApi";

const API = (typeof window !== "undefined" && (window.__API_BASE__ || "")) || "https://frye-market-backend-1.onrender.com";

/* ------------------------------- UI helpers ------------------------------- */

const norm = (s="") => s.trim().toLowerCase();

const ALIASES = {
  "tech": "information technology",
  "information technology": "information technology",
  "materials": "materials",
  "healthcare": "healthcare",
  "communication services": "communication services",
  "real estate": "real estate",
  "energy": "energy",
  "consumer staples": "consumer staples",
  "consumer discretionary": "consumer discretionary",
  "financials": "financials",
  "utilities": "utilities",
  "industrials": "industrials",
};

const ORDER = [
  "tech","materials","healthcare","communication services","real estate",
  "energy","consumer staples","consumer discretionary","financials","utilities","industrials",
];

const orderKey = (s) => {
  const i = ORDER.indexOf(norm(s));
  return i === -1 ? 999 : i;
};

const toneFor = (o) => {
  if (!o) return "info";
  const s = String(o).toLowerCase();
  if (s.startsWith("bull")) return "ok";
  if (s.startsWith("bear")) return "danger";
  return "warn";
};

function Badge({ text, tone = "info" }) {
  const map = {
    ok:    { bg:"#22c55e", fg:"#0b1220", bd:"#16a34a" },     // bright green
    warn:  { bg:"#facc15", fg:"#111827", bd:"#ca8a04" },     // bright yellow
    danger:{ bg:"#ef4444", fg:"#fee2e2", bd:"#b91c1c" },     // bright red
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

function DeltaPill({ label, value }) {
  if (value == null || !Number.isFinite(value)) return null;
  const v = Number(value);
  const tone = v > 0 ? "#22c55e" : v < 0 ? "#ef4444" : "#9ca3af";
  const arrow = v > 0 ? "▲" : v < 0 ? "▼" : "→";
  return (
    <span title={`${label}: ${v >= 0 ? "+" : ""}${v.toFixed(1)}%`}
      style={{
        display:"inline-flex", alignItems:"center", gap:4,
        borderRadius:8, padding:"2px 6px", fontSize:11, fontWeight:700,
        background:"#0b0f17", color:tone, border:`1px solid ${tone}33`
      }}
    >
      <span style={{
        width:32, height:10, borderRadius:6, background:tone,
        display:"inline-block"
      }} />
      <span>{label}: {arrow} {v >= 0 ? "+" : ""}{v.toFixed(1)}%</span>
    </span>
  );
}

/* Compact sparkline (shorter height to save vertical space) */
function Sparkline({ data = [], width = 160, height = 28 }) {
  if (!Array.isArray(data) || data.length < 2) return <div className="small muted"> </div>;
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

/* Card */
function SectorCard({ sector, outlook, spark, last, deltaPct, d10m, d1h, d1d }) {
  const tone = toneFor(outlook);
  const arr  = Array.isArray(spark) ? spark : [];

  // Prefer provided last/deltaPct; fallback to spark math; finally 0
  let _last = Number.isFinite(last) ? last : null;
  let _tilt = Number.isFinite(deltaPct) ? deltaPct : null;
  if ((_last === null || _tilt === null) && arr.length >= 2) {
    const first = Number(arr[0]) || 0;
    const lst   = Number(arr[arr.length - 1]) || 0;
    const base  = Math.abs(first) > 1e-6 ? Math.abs(first) : 1;
    _last = _last === null ? lst : _last;
    _tilt = _tilt === null ? ((lst - first) / base) * 100 : _tilt;
  }
  if (_last === null) _last = 0;
  if (_tilt === null) _tilt = 0;

  const arrow =
    Math.abs(_tilt) < 0.5 ? "→" :
    _tilt > 0             ? "↑" : "↓";
  const tiltColor =
    _tilt > 0 ? "#22c55e" : _tilt < 0 ? "#ef4444" : "#9ca3af";

  return (
    <div className="panel" style={{ padding:8 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div className="panel-title small">{sector || "Sector"}</div>
        <Badge text={outlook || "Neutral"} tone={tone} />
      </div>

      {/* Deltas row */}
      <div style={{ display:"flex", gap:6, flexWrap:"wrap", margin:"4px 0 4px 0" }}>
        {Number.isFinite(d10m) && <DeltaPill label="Δ10m" value={d10m} />}
        {Number.isFinite(d1h)  && <DeltaPill label="Δ1h"  value={d1h}  />}
        {Number.isFinite(d1d)  && <DeltaPill label="Δ1d"  value={d1d}  />}
      </div>

      {/* Net NH + Breadth Tilt */}
      <div className="small" style={{ display:"flex", justifyContent:"space-between", margin:"2px 0 4px 0" }}>
        <span>Net NH: <strong>{Number.isFinite(_last) ? _last.toFixed(0) : "—"}</strong></span>
        <span style={{ color:tiltColor, fontWeight:700 }}>
          Breadth Tilt: {arrow} {Number.isFinite(_tilt) ? ( (_tilt>=0?"+":"") + _tilt.toFixed(1) + "%") : "0.0%"}
        </span>
      </div>

      <Sparkline data={arr} />
    </div>
  );
}

/* -------------------------- Snapshot helpers (10m/1d) -------------------------- */

async function fetchJSON(url) {
  const r = await fetch(url, { cache:"no-store" });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return await r.json();
}

function buildSectorLastMap(snapshot) {
  const cards = snapshot?.outlook?.sectorCards || snapshot?.sectorCards || [];
  const out = {};
  for (const c of cards) {
    const name = norm(c?.sector || "");
    const val = Number(c?.last ?? c?.value ?? NaN);
    if (name && Number.isFinite(val)) out[name] = val;
  }
  return out;
}

async function computeDeltaFromReplay(granularity /* '10min' | 'eod' */) {
  try {
    const idx = await fetchJSON(`${API}/api/replay/index?granularity=${encodeURIComponent(granularity)}&t=${Date.now()}`);
    const items = Array.isArray(idx?.items) ? idx.items : [];
    if (items.length < 2) return {};
    const tsA = items[0]?.ts;
    const tsB = items[1]?.ts;
    if (!tsA || !tsB) return {};
    const [snapA, snapB] = await Promise.all([
      fetchJSON(`${API}/api/replay/at?granularity=${granularity}&ts=${encodeURIComponent(tsA)}&t=${Date.now()}`),
      fetchJSON(`${API}/api/replay/at?granularity=${granularity}&ts=${encodeURIComponent(tsB)}&t=${Date.now()}`)
    ]);
    const mapA = buildSectorLastMap(snapA);
    const mapB = buildSectorLastMap(snapB);
    const out = {};
    const keys = new Set([...Object.keys(mapA), ...Object.keys(mapB)]);
    for (const k of keys) {
      const a = mapA[k]; const b = mapB[k];
      if (Number.isFinite(a) && Number.isFinite(b)) out[k] = a - b; // change in Net NH
    }
    return out;
  } catch {
    return {};
  }
}

/* ------------------------------- Legend content ------------------------------- */

function Pill({ color }) {
  return <span style={{
    width:34, height:12, borderRadius:12, background:color,
    display:"inline-block", border:"1px solid rgba(255,255,255,0.1)", marginRight:8
  }} />;
}

function IndexSectorsLegendContent(){
  return (
    <div>
      <div style={{ color:"#f9fafb", fontSize:14, fontWeight:800, marginBottom:8 }}>
        Index Sectors — Legend
      </div>

      {/* Outlook */}
      <div style={{ color:"#e5e7eb", fontSize:13, fontWeight:700, marginTop:6 }}>Outlook</div>
      <div style={{ color:"#d1d5db", fontSize:12 }}>
        Sector trend bias from breadth: <b>Bullish</b> (NH&gt;NL), <b>Neutral</b> (mixed), <b>Bearish</b> (NL&gt;NH).
      </div>
      <div style={{ display:"flex", gap:12, margin:"6px 0 6px 0", alignItems:"center" }}>
        <Pill color="#22c55e" /> <span style={{color:"#e5e7eb",fontWeight:700,fontSize:12}}>Bullish</span>
        <Pill color="#facc15" /> <span style={{color:"#e5e7eb",fontWeight:700,fontSize:12}}>Neutral</span>
        <Pill color="#ef4444" /> <span style={{color:"#e5e7eb",fontWeight:700,fontSize:12}}>Bearish</span>
      </div>

      {/* Net NH + Breadth Tilt */}
      <div style={{ color:"#e5e7eb", fontSize:13, fontWeight:700, marginTop:6 }}>Net NH & Breadth Tilt</div>
      <div style={{ color:"#d1d5db", fontSize:12 }}>
        <b>Net NH</b> = New Highs − New Lows (participation strength).<br/>
        <b>Breadth Tilt</b> = how tilted NH vs NL is in % terms (positive = more NH).
      </div>
      <div style={{ color:"#f9fafb", fontSize:12, marginTop:2, marginLeft:8 }}>
        Example: Net NH <b>22</b>, Breadth Tilt <b>+25%</b> → sector participation leaning bullish.
      </div>

      {/* Deltas */}
      <div style={{ color:"#e5e7eb", fontSize:13, fontWeight:700, marginTop:8 }}>Deltas</div>
      <div style={{ color:"#d1d5db", fontSize:12 }}>Short-, intraday-, and daily changes in Net NH.</div>

      <div style={{ color:"#cbd5e1", fontSize:12, marginTop:6 }}><b>Δ10m</b> — short-term change since last update.</div>
      <div style={{ display:"flex", gap:12, margin:"4px 0 2px 0", alignItems:"center" }}>
        <Pill color="#22c55e" /> <span style={{color:"#e5e7eb",fontWeight:700,fontSize:12}}>Positive</span>
        <Pill color="#facc15" /> <span style={{color:"#e5e7eb",fontWeight:700,fontSize:12}}>Flat</span>
        <Pill color="#ef4444" /> <span style={{color:"#e5e7eb",fontWeight:700,fontSize:12}}>Negative</span>
      </div>

      <div style={{ color:"#cbd5e1", fontSize:12, marginTop:8 }}><b>Δ1h</b> — hour-over-hour change (from trend endpoint).</div>
      <div style={{ display:"flex", gap:12, margin:"4px 0 2px 0", alignItems:"center" }}>
        <Pill color="#22c55e" /> <span style={{color:"#e5e7eb",fontWeight:700,fontSize:12}}>Positive</span>
        <Pill color="#facc15" /> <span style={{color:"#e5e7eb",fontWeight:700,fontSize:12}}>Flat</span>
        <Pill color="#ef4444" /> <span style={{color:"#e5e7eb",fontWeight:700,fontSize:12}}>Negative</span>
      </div>

      <div style={{ color:"#cbd5e1", fontSize:12, marginTop:8 }}><b>Δ1d</b> — change vs prior close (from EOD snapshots).</div>
      <div style={{ display:"flex", gap:12, margin:"4px 0 2px 0", alignItems:"center" }}>
        <Pill color="#22c55e" /> <span style={{color:"#e5e7eb",fontWeight:700,fontSize:12}}>Positive</span>
        <Pill color="#facc15" /> <span style={{color:"#e5e7eb",fontWeight:700,fontSize:12}}>Flat</span>
        <Pill color="#ef4444" /> <span style={{color:"#e5e7eb",fontWeight:700,fontSize:12}}>Negative</span>
      </div>
    </div>
  );
}

/* -------------------------- Data builders (cards) -------------------------- */

function fromSectorCards(json){
  const arr = json?.outlook?.sectorCards;
  if (!Array.isArray(arr)) return [];
  return arr.map(c => ({
    sector: c?.sector ?? "",
    outlook: c?.outlook ?? "Neutral",
    spark: Array.isArray(c?.spark) ? c.spark : [],
    last: Number(c?.last ?? c?.value ?? NaN),
    deltaPct: Number(c?.deltaPct ?? c?.pct ?? c?.changePct ?? NaN),
  })).sort((a,b) => orderKey(a.sector) - orderKey(b.sector));
}

function fromSectors(json){
  const obj = json?.outlook?.sectors;
  if (!obj || typeof obj !== "object") return [];
  const list = Object.keys(obj).map((k) => {
    const sec = obj[k] || {};
    const nh = Number(sec?.nh ?? 0);
    const nl = Number(sec?.nl ?? 0);
    const netNH = Number(sec?.netNH ?? (nh - nl));
    const denom = nh + nl;
    const pct = denom > 0 ? (netNH / denom) * 100 : 0;
    const title = k.split(" ").map(w => w ? (w[0].toUpperCase()+w.slice(1)) : w).join(" ");
    return {
      sector:  title,
      outlook: sec?.outlook ?? (netNH > 0 ? "Bullish" : netNH < 0 ? "Bearish" : "Neutral"),
      spark:   Array.isArray(sec?.spark) ? sec.spark : [],
      last:    netNH,
      deltaPct: pct
    };
  });
  return list.sort((a,b) => orderKey(a.sector) - orderKey(b.sector));
}

/* --------------------------------- Main Row -------------------------------- */

export default function RowIndexSectors() {
  const { data: live, loading, error } = useDashboardPoll("dynamic");

  // Replay bridge
  const [replayOn, setReplayOn] = useState(false);
  const [replayData, setReplayData] = useState(null);
  useEffect(() => {
    function onReplay(e) {
      const detail = e?.detail || {};
      const on = !!detail.on;
      setReplayOn(on);
      setReplayData(on ? (detail.data || null) : null);
    }
    window.addEventListener("replay:update", onReplay);
    return () => window.removeEventListener("replay:update", onReplay);
  }, []);
  const source = (replayOn && replayData) ? replayData : live;
  const ts = source?.meta?.ts || source?.updated_at || source?.ts || null;

  // Cards from source
  const cards = useMemo(() => {
    let list = fromSectorCards(source);
    if (list.length === 0) list = fromSectors(source || {});
    return list;
  }, [source]);

  // Δ1h — hour-over-hour from backend trend endpoint
  const [hourTrend, setHourTrend] = useState(null);
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    const controller = new AbortController();
    const load = async () => {
      try {
        const r = await fetch(`${API}/api/sectorTrend?window=1`, { signal: controller.signal, cache:"no-store" });
        const j = await r.json();
        if (!aliveRef.current) return;
        setHourTrend(j?.sectors || {});
      } catch {
        if (aliveRef.current) setHourTrend(null);
      }
    };
    load();
    const t = setInterval(load, 60_000);
    return () => { aliveRef.current = false; controller.abort(); clearInterval(t); };
  }, []);
  const d1hMap = useMemo(() => {
    const out = {};
    if (!hourTrend) return out;
    for (const [rawKey, pair] of Object.entries(hourTrend)) {
      const key = ALIASES[norm(rawKey)] || norm(rawKey);
      const d = Number(pair?.deltaPct ?? NaN);
      if (Number.isFinite(d)) out[key] = d;
    }
    return out;
  }, [hourTrend]);

  // Δ10m — from last two 10min snapshots
  const [d10mMap, setD10mMap] = useState({});
  useEffect(() => {
    let mounted = true;
    (async () => {
      const m = await computeDeltaFromReplay("10min");
      if (mounted) setD10mMap(m);
    })();
    const t = setInterval(async () => {
      const m = await computeDeltaFromReplay("10min");
      setD10mMap(m);
    }, 60_000);
    return () => { mounted = false; clearInterval(t); };
  }, []);

  // Δ1d — from last two EOD snapshots
  const [d1dMap, setD1dMap] = useState({});
  useEffect(() => {
    let mounted = true;
    (async () => {
      const m = await computeDeltaFromReplay("eod");
      if (mounted) setD1dMap(m);
    })();
    const t = setInterval(async () => {
      const m = await computeDeltaFromReplay("eod");
      setD1dMap(m);
    }, 300_000);
    return () => { mounted = false; clearInterval(t); };
  }, []);

  // Legend modal
  const [legendOpen, setLegendOpen] = useState(false);

  return (
    <section id="row-4" className="panel index-sectors" aria-label="Index Sectors">
      <div className="panel-head" style={{ alignItems:"center" }}>
        <div className="panel-title">Index Sectors</div>
        <button
          onClick={()=> setLegendOpen(true)}
          style={{
            background:"#0b0b0b", color:"#e5e7eb",
            border:"1px solid #2b2b2b", borderRadius:8,
            padding:"6px 10px", fontWeight:600, cursor:"pointer", marginLeft:8
          }}
          title="Legend"
        >
          Legend
        </button>
        <div className="spacer" />
        <LastUpdated ts={ts} />
      </div>

      {!source && loading && <div className="small muted">Loading…</div>}
      {error && <div className="small muted">Failed to load sectors.</div>}

      {Array.isArray(cards) && cards.length > 0 ? (
        <div style={{
          display:"grid",
          gridTemplateColumns:"repeat(auto-fill, minmax(210px, 1fr))",
          gap:8, marginTop:6
        }}>
          {cards.map((c, i) => {
            const normName = ALIASES[norm(c?.sector || "")] || norm(c?.sector || "");
            const d10 = d10mMap[normName];
            const d1h = d1hMap[normName];
            const d1d = d1dMap[normName];

            return (
              <SectorCard
                key={c?.sector || i}
                sector={c?.sector}
                outlook={c?.outlook}
                spark={c?.spark}
                last={Number.isFinite(c?.last) ? c.last : (Number.isFinite(c?.value) ? c.value : null)}
                deltaPct={Number.isFinite(c?.deltaPct) ? c.deltaPct :
                          (Number.isFinite(c?.pct) ? c.pct :
                          (Number.isFinite(c?.changePct) ? c.changePct : null))}
                d10m={Number.isFinite(d10) ? d10 : undefined}
                d1h={Number.isFinite(d1h) ? d1h : undefined}
                d1d={Number.isFinite(d1d) ? d1d : undefined}
              />
            );
          })}
        </div>
      ) : (
        !loading && <div className="small muted">No sector data.</div>
      )}

      {/* Legend modal */}
      {legendOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={()=> setLegendOpen(false)}
          style={{
            position:"fixed", inset:0, background:"rgba(0,0,0,0.5)",
            display:"flex", alignItems:"center", justifyContent:"center", zIndex:60
          }}
        >
          <div
            onClick={(e)=> e.stopPropagation()}
            style={{
              width:"min(880px, 92vw)", background:"#0b0b0c",
              border:"1px solid #2b2b2b", borderRadius:12, padding:16,
              boxShadow:"0 10px 30px rgba(0,0,0,0.35)"
            }}
          >
            <IndexSectorsLegendContent />
            <div style={{ display:"flex", justifyContent:"flex-end", marginTop:12 }}>
              <button
                onClick={()=> setLegendOpen(false)}
                style={{
                  background:"#eab308", color:"#111827", border:"none",
                  borderRadius:8, padding:"8px 12px", fontWeight:700, cursor:"pointer"
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
