// src/pages/rows/RowIndexSectors.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { LastUpdated } from "../../components/LastUpdated";
import { useDashboardPoll } from "../../lib/dashboardApi";

const API = "https://frye-market-backend-1.onrender.com";

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

/* --- hourly % badge (always show) --- */
function TrendBadge({ deltaPct }) {
  if (!Number.isFinite(deltaPct)) return null;
  const d = deltaPct; // e.g., +0.84 means +0.84% vs last hour
  let color = "#9ca3af", arrow = "→";
  if (d >= 0.2) { color = "#22c55e"; arrow = "▲"; }
  else if (d <= -0.2) { color = "#ef4444"; arrow = "▼"; }
  const text = `${d >= 0 ? "+" : ""}${d.toFixed(1)}%/h`;
  const title = `vs last hour: ${d >= 0 ? "+" : ""}${d.toFixed(2)}%`;
  return (
    <span title={title} style={{ fontWeight:800, fontSize:12, color, display:"inline-flex", alignItems:"center", gap:4 }}>
      <span>{arrow}</span><span>{text}</span>
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
function SectorCard({ sector, outlook, spark, last, deltaPct, hourDeltaPct }) {
  const tone = toneFor(outlook);
  const arr  = Array.isArray(spark) ? spark : [];

  // prefer provided last/deltaPct; fall back to spark math; finally 0s
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
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          {/* hourly % badge to the RIGHT for visibility */}
          {Number.isFinite(hourDeltaPct) && <TrendBadge deltaPct={hourDeltaPct} />}
          <Badge text={outlook || "Neutral"} tone={tone} />
        </div>
      </div>
      <div className="small" style={{ display:"flex", justifyContent:"space-between", margin:"4px 0 6px 0" }}>
        <span>Last: <strong>{Number.isFinite(_last) ? _last.toFixed(1) : "—"}</strong></span>
        <span className={deltaClass}>{arrow} {Number.isFinite(_deltaPct) ? _deltaPct.toFixed(1) : "0.0"}%</span>
      </div>
      <Sparkline data={arr} />
    </div>
  );
}

/* --- mapping helpers --- */
const ORDER = [
  "tech","materials","healthcare","communication services","real estate",
  "energy","consumer staples","consumer discretionary","financials","utilities","industrials",
];
const norm = (s="") => s.trim().toLowerCase();
const orderKey = (s) => {
  const i = ORDER.indexOf(norm(s));
  return i === -1 ? 999 : i;
};
function titleCase(name="") {
  return name.split(" ").map(w => w ? w[0].toUpperCase()+w.slice(1) : w).join(" ");
}

/* Sector alias map to avoid name mismatches */
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

/* --- prefer outlook.sectorCards, else compute from outlook.sectors --- */
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
    return {
      sector:  titleCase(k),
      outlook: sec?.outlook ?? (netNH > 0 ? "Bullish" : netNH < 0 ? "Bearish" : "Neutral"),
      spark:   Array.isArray(sec?.spark) ? sec.spark : [],
      last:    netNH,
      deltaPct: pct
    };
  });
  return list.sort((a,b) => orderKey(a.sector) - orderKey(b.sector));
}

export default function RowIndexSectors() {
  const { data, loading, error } = useDashboardPoll?.("dynamic") ?? { data:null, loading:false, error:null };
  const ts = data?.meta?.ts || null;

  const cards = useMemo(() => {
    let list = fromSectorCards(data);
    if (list.length === 0) list = fromSectors(data || {});
    return list;
  }, [data]);

  // Fetch /sectorTrend (hour-over-hour % deltas)
  const [trend, setTrend] = useState(null);
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    const controller = new AbortController();
    const load = async () => {
      try {
        const r = await fetch(`${API}/api/sectorTrend?window=1`, { signal: controller.signal, cache:"no-store" });
        const j = await r.json();
        if (!aliveRef.current) return;
        setTrend(j?.sectors || {});
      } catch {
        if (aliveRef.current) setTrend(null);
      }
    };
    load();
    const t = setInterval(load, 60000);
    return () => { aliveRef.current = false; controller.abort(); clearInterval(t); };
  }, []);

  // lookup: normalized sector → deltaPct
  const hourDeltaPctBySector = useMemo(() => {
    const out = {};
    if (!trend) return out;
    for (const [rawKey, pair] of Object.entries(trend)) {
      const key = ALIASES[norm(rawKey)] || norm(rawKey);
      const d = Number(pair?.deltaPct ?? NaN);
      if (Number.isFinite(d)) out[key] = d;
    }
    return out;
  }, [trend]);

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
          {cards.map((c, i) => {
            const normName = ALIASES[norm(c?.sector || "")] || norm(c?.sector || "");
            const hourDelta = hourDeltaPctBySector[normName]; // +/- X.X % vs last hour
            return (
              <SectorCard
                key={c?.sector || i}
                sector={c?.sector}
                outlook={c?.outlook}
                spark={c?.spark}
                last={Number.isFinite(c?.last) ? c.last : (Number.isFinite(c?.value) ? c.value : null)}
                deltaPct={Number.isFinite(c?.deltaPct) ? c.deltaPct : (Number.isFinite(c?.pct) ? c.pct : (Number.isFinite(c?.changePct) ? c.changePct : null))}
                hourDeltaPct={Number.isFinite(hourDelta) ? hourDelta : undefined}
              />
            );
          })}
        </div>
      ) : (
        !loading && <div className="small muted">No sector data.</div>
      )}
    </section>
  );
}
