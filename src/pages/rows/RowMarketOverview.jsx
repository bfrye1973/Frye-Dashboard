// src/pages/rows/RowMarketOverview.jsx
import React from "react";
import { useDashboardPoll } from "../../lib/dashboardApi";
import { LastUpdated } from "../../components/LastUpdated";

// LIVE data endpoints (Create React App env)
const INTRADAY_URL = process.env.REACT_APP_INTRADAY_URL;

// Optional backend API base for replay endpoints
const API =
  (typeof window !== "undefined" && (window.__API_BASE__ || "")) ||
  process.env.REACT_APP_API_URL ||
  "";

/* ------------------------------ utils ------------------------------ */
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
      <div className="small" style={{ color:"#e5e7eb", fontWeight:700, fontSize:15, textAlign:"center" }}>
        {label}
      </div>
      {subtitle && (
        <div style={{ color:"#94a3b8", fontSize:12, fontWeight:600, textAlign:"center" }}>
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
    // eslint-disable-next-line
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
function LegendContent() {
  const h2 = { color:"#e5e7eb", margin:"6px 0 8px", fontSize:16, fontWeight:700 };
  const p  = { color:"#cbd5e1", margin:"4px 0", fontSize:14, lineHeight:1.5 };
  const ul = { color:"#cbd5e1", fontSize:14, lineHeight:1.5, paddingLeft:18, margin:"4px 0 10px" };
  return (
    <div>
      {/* Breadth */}
      <div style={h2}>Breadth</div>
      <p style={p}>Measures the balance of <b>new highs vs new lows</b> across the market.</p>
      <p style={p}><b>Example:</b> 95% → Almost all stocks are setting more new highs than new lows (broad participation).</p>
      <p style={p}><b>Zones:</b></p>
      <ul style={ul}>
        <li>0–34% <Tag bg="#ef4444">🔴 Weak</Tag> — More new lows than highs.</li>
        <li>35–64% <Tag bg="#facc15">🟡 Neutral</Tag> — Highs ≈ Lows (mixed).</li>
        <li>65–84% <Tag bg="#22c55e">🟢 Strong</Tag> — More new highs than lows.</li>
        <li>85–100% <Tag bg="#fca5a5">🟥 Extreme</Tag> — Overheated; risk of pullback.</li>
      </ul>

      {/* Momentum */}
      <div style={h2}>Momentum</div>
      <p style={p}>Measures <b>advancers vs decliners</b> (market thrust).</p>
      <p style={p}><b>Example:</b> 95% → Strong thrust; many more stocks are up than down.</p>
      <p style={p}><b>Zones:</b></p>
      <ul style={ul}>
        <li>0–34% <Tag bg="#ef4444">🔴 Bearish</Tag> — Decliners dominate.</li>
        <li>35–64% <Tag bg="#facc15">🟡 Neutral</Tag> — Balanced.</li>
        <li>65–84% <Tag bg="#22c55e">🟢 Bullish</Tag> — Advancers dominate.</li>
        <li>85–100% <Tag bg="#fca5a5">🟥 Extreme</Tag> — Unsustainable momentum.</li>
      </ul>

      {/* Intraday Squeeze */}
      <div style={h2}>Intraday Squeeze</div>
      <p style={p}>Shows how compressed today’s ranges are (spring tension) — higher = tighter coil.</p>
      <ul style={ul}>
        <li>0–34% <Tag bg="#22c55e">🟢 Expanded</Tag></li>
        <li>35–64% <Tag bg="#facc15">🟡 Normal</Tag></li>
        <li>65–84% <Tag bg="#fb923c">🟠 Tight</Tag></li>
        <li>85–100% <Tag bg="#ef4444">🔴 Critical</Tag></li>
      </ul>

      {/* Overall Market Indicator */}
      <div style={h2}>Overall Market Indicator</div>
      <p style={p}>Weighted blend of Breadth (40%), Momentum (40%), Expansion (20%), blended toward 50 when Daily Squeeze is high.</p>

      {/* Daily Squeeze */}
      <div style={h2}>Daily Squeeze</div>
      <p style={p}>Lux-based daily compression on SPY.</p>

      {/* Liquidity */}
      <div style={h2}>Liquidity</div>
      <p style={p}>Depth/ease of execution (PSI). Higher = easier fills.</p>

      {/* Volatility */}
      <div style={h2}>Volatility</div>
      <p style={p}>How big price swings are (ATR/stdev). Higher = more turbulent & risky.</p>
    </div>
  );
}

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
        title="Toggle Replay Mode"
      >
        {on ? "Replay: ON" : "Replay: OFF"}
      </button>

      <select
        value={granularity}
        onChange={(e)=> setGranularity(e.target.value)}
        disabled={!on}
        className="px-2 py-1 rounded-md border border-neutral-700 bg-neutral-900 text-neutral-200 text-sm disabled:opacity-50"
        title="Replay granularity"
      >
        <option value="10min">10m</option>
        <option value="1h">1h</option>
        <option value="1d">1d</option>
      </select>

      <select
        value={ts || ""}
        onChange={(e)=> setTs(e.target.value)}
        disabled={!on || loading || options.length===0}
        className="min-w-[220px] px-2 py-1 rounded-md border border-neutral-700 bg-neutral-900 text-neutral-200 text-sm disabled:opacity-50"
        title="Replay timestamp"
      >
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

/* ------------------------------ Layout ------------------------------- */
function LabeledColumn({ title, children }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
      <div className="small" style={{ color:"#9ca3af", fontWeight:800, letterSpacing:0.2 }}>{title}</div>
      <div style={{ display:"flex", gap:12, alignItems:"center" }}>
        {children}
      </div>
    </div>
  );
}

/* ========================== Main Row component ========================== */
export default function RowMarketOverview() {
  const { data: live } = useDashboardPoll("dynamic");
  const [legendOpen, setLegendOpen] = React.useState(false);

  // LIVE intraday (fetch once)
  const [liveIntraday, setLiveIntraday] = React.useState(null);
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

  // Replay controls
  const [on, setOn] = React.useState(false);
  const [granularity, setGranularity] = React.useState("10min");
  const [tsSel, setTsSel] = React.useState("");
  const [indexOptions, setIndexOptions] = React.useState([]);
  const [loadingIdx, setLoadingIdx] = React.useState(false);
  const [snap, setSnap] = React.useState(null);
  const [loadingSnap, setLoadingSnap] = React.useState(false);
  const granParam = (granularity === "10min" ? "10min" : (granularity === "1h" ? "hourly" : "eod"));

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // choose data: replay → live intraday → polled backend
  const data = on && snap && snap.ok !== false ? snap : (liveIntraday || live);

  const od = data?.odometers ?? {};
  const gg = data?.gauges ?? {};
  const ts =
    data?.marketMeter?.updatedAt ??
    data?.meta?.ts ??
    data?.updated_at ??
    data?.ts ??
    null;

  const breadth     = Number(od?.breadthOdometer   ?? data?.summary?.breadthIdx   ?? gg?.rpm?.pct   ?? 50);
  const momentum    = Number(od?.momentumOdometer  ?? data?.summary?.momentumIdx  ?? gg?.speed?.pct ?? 50);
  const squeezeIntra= Number(od?.squeezeCompressionPct ?? gg?.fuel?.pct ?? 50);
  const squeezeDaily= Number.isFinite(gg?.squeezeDaily?.pct) ? Number(gg.squeezeDaily.pct) : null;
  const liquidity   = Number.isFinite(gg?.oil?.psi) ? Number(gg.oil.psi) : (Number.isFinite(gg?.oilPsi) ? Number(gg.oilPsi) : NaN);
  const volatility  = Number.isFinite(gg?.water?.pct) ? Number(gg.water.pct) : (Number.isFinite(gg?.volatilityPct) ? Number(gg.volatilityPct) : NaN);

  const sectorDirCount = data?.intraday?.sectorDirection10m?.risingCount ?? null;
  const sectorDirPct   = data?.intraday?.sectorDirection10m?.risingPct ?? null;

  // baselines per day
  const bBreadth   = useDailyBaseline("breadth",         breadth);
  const bMomentum  = useDailyBaseline("momentum",        momentum);
  const bSqueezeIn = useDailyBaseline("squeezeIntraday", squeezeIntra);
  const bSqueezeDy = useDailyBaseline("squeezeDaily",    squeezeDaily);
  const bLiquidity = useDailyBaseline("liquidity",       liquidity);
  const bVol       = useDailyBaseline("volatility",      volatility);

  // overall meter (expansion = 100 - squeeze)
  const expansion  = 100 - clamp01(squeezeIntra);
  const baseMeter  = 0.4 * breadth + 0.4 * momentum + 0.2 * expansion;
  const Sdy        = Number.isFinite(squeezeDaily) ? clamp01(squeezeDaily) / 100 : 0;
  const meterValue = Math.round((1 - Sdy) * baseMeter + Sdy * 50);

  /* ------------------------------ RENDER ------------------------------ */
  return (
    <section id="row-2" className="panel" style={{ padding:10 }}>
      {/* Legend modal */}
      {/* (same as before; omit here for brevity — keep your existing LegendContent) */}

      {/* Header */}
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

      {/* Two labeled halves in one horizontal row */}
      <div style={{ display:"flex", justifyContent:"space-between", gap:18, marginTop:8, flexWrap:"wrap" }}>
        {/* LEFT: Intraday Scalp Lights */}
        <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
          <div className="small" style={{ color:"#9ca3af", fontWeight:800 }}>Intraday Scalp Lights</div>
          <div style={{ display:"flex", gap:12, alignItems:"center" }}>
            <Stoplight label="Breadth" value={breadth} baseline={bBreadth} />
            <Stoplight label="Momentum" value={momentum} baseline={bMomentum} />
            <Stoplight label="Intraday Squeeze" value={squeezeIntra} baseline={bSqueezeIn} />
            <Stoplight label="Liquidity" value={liquidity} baseline={bLiquidity} unit="" />
            <Stoplight label="Volatility" value={volatility} baseline={bVol} />
            <Stoplight
              label="Sector Direction (10m)"
              value={sectorDirPct}
              baseline={sectorDirPct}
              subtitle={
                Number.isFinite(sectorDirCount) ? `${sectorDirCount}/11 rising` : ""
              }
            />
          </div>
        </div>

        {/* RIGHT: Overall Market Trend Daily */}
        <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
          <div className="small" style={{ color:"#9ca3af", fontWeight:800 }}>Overall Market Trend Daily</div>
          <div style={{ display:"flex", gap:12, alignItems:"center", justifyContent:"flex-end" }}>
            <Stoplight label="Overall Market Indicator" value={meterValue} baseline={meterValue} size={100} />
            <Stoplight label="Daily Squeeze" value={squeezeDaily} baseline={bSqueezeDy} />
            <Stoplight label="Liquidity" value={liquidity} baseline={bLiquidity} unit="" />
            <Stoplight label="Volatility" value={volatility} baseline={bVol} />
          </div>
        </div>
      </div>

      <div className="text-xs text-neutral-500" style={{ marginTop:4 }}>
        {on ? (loadingSnap ? "Loading snapshot…" : (ts ? `Snapshot: ${fmtIso(ts)}` : "Replay ready"))
            : (ts ? `Updated ${fmtIso(ts)}` : "")}
      </div>
    </section>
  );
}
