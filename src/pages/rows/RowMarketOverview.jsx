// src/pages/rows/RowMarketOverview.jsx
import React from "react";
import { useDashboardPoll } from "../../lib/dashboardApi";
import { LastUpdated } from "../../components/LastUpdated";

const INTRADAY_URL = process.env.REACT_APP_INTRADAY_URL;
const INTRADAY_SOURCE_URL = process.env.REACT_APP_INTRADAY_SOURCE_URL;

const API =
  (typeof window !== "undefined" && (window.__API_BASE__ || "")) ||
  process.env.REACT_APP_API_URL ||
  "";

function fmtIso(ts) {
  try { return new Date(ts).toLocaleString(); } catch { return ts; }
}
const clamp01 = (n) => Math.max(0, Math.min(100, Number(n)));
const pct = (n) => (Number.isFinite(n) ? n.toFixed(1) : "—");
const toneFor = (v) => (v >= 60 ? "ok" : v >= 40 ? "warn" : "danger");

/* ---------------------------- Stoplight ---------------------------- */
function Stoplight({ label, value, baseline, size = 54, unit = "%", subtitle }) {
  const v = Number.isFinite(value) ? clamp01(value) : NaN;
  const delta =
    Number.isFinite(v) && Number.isFinite(baseline) ? v - baseline : NaN;

  const tone = Number.isFinite(v) ? toneFor(v) : "info";
  const colors = {
    ok:     { bg:"#22c55e", glow:"rgba(34,197,94,.45)" },
    warn:   { bg:"#fbbf24", glow:"rgba(251,191,36,.45)" },
    danger: { bg:"#ef4444", glow:"rgba(239,68,68,.45)" },
    info:   { bg:"#334155", glow:"rgba(51,65,85,.35)" }
  }[tone];

  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4, minWidth:size+36 }}>
      <div title={`${label}: ${pct(v)}${unit === "%" ? "%" : ""}`}
        style={{ width:size, height:size, borderRadius:"50%", background:colors.bg, boxShadow:`0 0 12px ${colors.glow}`,
                 display:"flex", alignItems:"center", justifyContent:"center", border:"4px solid #0c1320" }}>
        <div style={{ fontWeight:800, fontSize:size >= 100 ? 20 : 16, color:"#0b1220" }}>
          {pct(v)}{unit === "%" ? "%" : ""}
        </div>
      </div>
      <div className="small" style={{ color:"#e5e7eb", fontWeight:700, fontSize:15, lineHeight:1.1, textAlign:"center" }}>
        {label}
      </div>
      {subtitle && (
        <div style={{ color:"#94a3b8", fontSize:13, fontWeight:600 }}>
          {subtitle}
        </div>
      )}
    </div>
  );
}

/* -------------------------- Daily baselines ------------------------- */
const dayKey = () => new Date().toISOString().slice(0, 10);
function useDailyBaseline(keyName, current) {
  const [baseline, setBaseline] = React.useState(null);

  React.useEffect(() => {
    const k = `meter_baseline_${dayKey()}_${keyName}`;
    const saved = localStorage.getItem(k);
    if (saved === null && Number.isFinite(current)) {
      localStorage.setItem(k, String(current));
      setBaseline(current);
    } else if (saved !== null) {
      const n = Number(saved);
      setBaseline(Number.isFinite(n) ? n : null);
    }
  }, [keyName]);

  React.useEffect(() => {
    if (!Number.isFinite(current)) return;
    const k = `meter_baseline_${dayKey()}_${keyName}`;
    if (localStorage.getItem(k) === null) {
      localStorage.setItem(k, String(current));
      setBaseline(current);
    }
  }, [keyName, current]);

  return baseline;
}

/* ----------------------------- Legend ------------------------------ */
function Tag({ bg, children }) {
  return (
    <span style={{ display:"inline-block", padding:"2px 6px", borderRadius:6, fontSize:12, marginLeft:6, background:bg, color:"#0f1115", fontWeight:700 }}>
      {children}
    </span>
  );
}
// (LegendContent unchanged — omitted for brevity)

/* ------------------------------ Replay UI ----------------------------- */
function ReplayControls({ on, setOn, granularity, setGranularity, ts, setTs, options, loading }) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={()=> setOn(!on)}
        className={`px-3 py-1 rounded-full border text-sm shadow transition-colors ${
          on ? "border-yellow-400 text-yellow-300 bg-neutral-800"
             : "border-neutral-700 text-neutral-300 bg-neutral-900 hover:border-neutral-500"
        }`}
      >
        {on ? "Replay: ON" : "Replay: OFF"}
      </button>
      <select value={granularity} onChange={(e)=> setGranularity(e.target.value)} disabled={!on}>
        <option value="10min">10m</option>
        <option value="1h">1h</option>
        <option value="1d">1d</option>
      </select>
      <select value={ts || ""} onChange={(e)=> setTs(e.target.value)} disabled={!on || loading || options.length===0}>
        {loading && <option value="">Loading…</option>}
        {!loading && options.length===0 && <option value="">No snapshots</option>}
        {!loading && options.length>0 && (
          <>
            <option value="">Select time…</option>
            {options.map(o => <option key={o.ts} value={o.ts}>{fmtIso(o.ts)}</option>)}
          </>
        )}
      </select>
    </div>
  );
}

/* ------------------------------ Layouts ------------------------------- */
function MeterTilesLayout({
  breadth, momentum, squeezeIntra, squeezeDaily, liquidity, volatility, meterValue,
  bBreadth, bMomentum, bSqueezeIn, bSqueezeDy, bLiquidity, bVol,
  risingCount, risingPct
}) {
  const risingTone = risingPct >= 60 ? "ok" : risingPct >= 40 ? "warn" : "danger";
  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr auto 1fr", alignItems:"center", gap:10, marginTop:6 }}>
      {/* LEFT */}
      <div style={{ display:'flex', gap:10, maxWidth:520, width:'100%', alignItems:'center', justifyContent:'space-between' }}>
        <Stoplight label="Breadth"          value={breadth}      baseline={bBreadth} />
        <Stoplight label="Momentum"         value={momentum}     baseline={bMomentum} />
        <Stoplight label="Intraday Squeeze" value={squeezeIntra} baseline={bSqueezeIn} />
        <Stoplight
          label="Sector Direction (10m)"
          value={risingPct}
          baseline={risingPct}
          subtitle={`${risingCount}/11 rising`}
        />
      </div>
      {/* CENTER */}
      <div style={{ display:"flex", alignItems:"center", gap:14 }}>
        <Stoplight label="Overall Market Indicator" value={meterValue} baseline={meterValue} size={100} />
        <Stoplight label="Daily Squeeze" value={squeezeDaily} baseline={bSqueezeDy} />
      </div>
      {/* RIGHT */}
      <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
        <Stoplight label="Liquidity"  value={liquidity}  baseline={bLiquidity} unit="" />
        <Stoplight label="Volatility" value={volatility} baseline={bVol} />
      </div>
    </div>
  );
}

/* ========================== Main Row component ========================== */
export default function RowMarketOverview() {
  const { data: live } = useDashboardPoll("dynamic");
  const [legendOpen, setLegendOpen] = React.useState(false);

  const [liveIntraday, setLiveIntraday] = React.useState(null);

  const [on, setOn] = React.useState(false);
  const [granularity, setGranularity] = React.useState("10min");
  const [tsSel, setTsSel] = React.useState("");
  const [indexOptions, setIndexOptions] = React.useState([]);
  const [loadingIdx, setLoadingIdx] = React.useState(false);
  const [snap, setSnap] = React.useState(null);
  const [loadingSnap, setLoadingSnap] = React.useState(false);

  const granParam = granularity === "10min" ? "10min" : (granularity === "1h" ? "hourly" : "eod");

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!INTRADAY_URL) return;
        const r1 = await fetch(`${INTRADAY_URL}?t=${Date.now()}`, { cache:"no-store" });
        const j1 = await r1.json();
        if (!cancelled) setLiveIntraday(j1);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  React.useEffect(() => {
    if (!on) { setIndexOptions([]); return; }
    (async () => {
      try {
        setLoadingIdx(true);
        const r = await fetch(`${API}/api/replay/index?granularity=${granParam}&t=${Date.now()}`, { cache:"no-store" });
        const j = await r.json();
        const items = Array.isArray(j?.items) ? j.items : [];
        setIndexOptions(items);
        if (items.length && !tsSel) setTsSel(items[0].ts);
      } finally { setLoadingIdx(false); }
    })();
  }, [on, granParam]);

  React.useEffect(() => {
    if (!on || !tsSel) { setSnap(null); return; }
    (async () => {
      try {
        setLoadingSnap(true);
        const r = await fetch(`${API}/api/replay/at?granularity=${granParam}&ts=${encodeURIComponent(tsSel)}&t=${Date.now()}`, { cache:"no-store" });
        const j = await r.json();
        setSnap(j);
      } catch { setSnap(null); }
      finally { setLoadingSnap(false); }
    })();
  }, [on, tsSel, granParam]);

  const data = on && snap && snap.ok !== false ? snap : (liveIntraday || live);

  const od = data?.odometers ?? {};
  const gg = data?.gauges ?? {};
  const ts = data?.marketMeter?.updatedAt ?? data?.meta?.ts ?? data?.updated_at ?? data?.ts ?? null;

  const breadth   = Number(od?.breadthOdometer   ?? data?.summary?.breadthIdx   ?? gg?.rpm?.pct   ?? 50);
  const momentum  = Number(od?.momentumOdometer  ?? data?.summary?.momentumIdx  ?? gg?.speed?.pct ?? 50);
  const squeezeIntra = Number(od?.squeezeCompressionPct ?? gg?.fuel?.pct ?? 50);
  const squeezeDaily = Number.isFinite(gg?.squeezeDaily?.pct) ? Number(gg.squeezeDaily.pct) : null;
  const liquidity  = Number.isFinite(gg?.oil?.psi) ? Number(gg.oil.psi) : (Number.isFinite(gg?.oilPsi) ? Number(gg.oilPsi) : NaN);
  const volatility = Number.isFinite(gg?.volatilityPct) ? Number(gg.volatilityPct) : (Number.isFinite(gg?.water?.pct) ? Number(gg.water.pct) : NaN);

  const risingCount = data?.intraday?.sectorDirection10m?.risingCount ?? null;
  const risingPct   = data?.intraday?.sectorDirection10m?.risingPct ?? null;

  const bBreadth   = useDailyBaseline("breadth",         breadth);
  const bMomentum  = useDailyBaseline("momentum",        momentum);
  const bSqueezeIn = useDailyBaseline("squeezeIntraday", squeezeIntra);
  const bSqueezeDy = useDailyBaseline("squeezeDaily",    squeezeDaily);
  const bLiquidity = useDailyBaseline("liquidity",       liquidity);
  const bVol       = useDailyBaseline("volatility",      volatility);

  const expansion  = 100 - clamp01(squeezeIntra);
  const baseMeter  = 0.4 * breadth + 0.4 * momentum + 0.2 * expansion;
  const Sdy        = Number.isFinite(squeezeDaily) ? clamp01(squeezeDaily) / 100 : 0;
  const meterValue = Math.round((1 - Sdy) * baseMeter + Sdy * 50);

  return (
    <section id="row-2" className="panel" style={{ padding:10 }}>
      <div className="panel-head" style={{ alignItems:"center" }}>
        <div className="panel-title">Market Meter — Stoplights</div>
        <div className="spacer" />
        <LastUpdated ts={ts} />
        <ReplayControls
          on={on}
          setOn={setOn}
          granularity={granularity}
          setGranularity={setGranularity}
          ts={tsSel}
          setTs={setTsSel}
          options={indexOptions}
          loading={loadingIdx}
        />
      </div>

      <MeterTilesLayout
        breadth={breadth} momentum={momentum} squeezeIntra={squeezeIntra}
        squeezeDaily={squeezeDaily} liquidity={liquidity} volatility={volatility}
        meterValue={meterValue}
        bBreadth={bBreadth} bMomentum={bMomentum} bSqueezeIn={bSqueezeIn}
        bSqueezeDy={bSqueezeDy} bLiquidity={bLiquidity} bVol={bVol}
        risingCount={risingCount} risingPct={risingPct}
      />

      <div className="text-xs text-neutral-500" style={{ marginTop:4 }}>
        {on ? (loadingSnap ? "Loading snapshot…" : (ts ? `Snapshot: ${fmtIso(ts)}` : "Replay ready"))
            : (ts ? `Updated ${fmtIso(ts)}` : "")}
      </div>
    </section>
  );
}
