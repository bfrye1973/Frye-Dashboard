// src/pages/rows/RowMarketOverview.jsx
import React from "react";
import { useDashboardPoll } from "../../lib/dashboardApi";
import { LastUpdated } from "../../components/LastUpdated";

// LIVE data endpoints (Create React App env)
const INTRADAY_URL = process.env.REACT_APP_INTRADAY_URL;
const INTRADAY_SOURCE_URL = process.env.REACT_APP_INTRADAY_SOURCE_URL;

// Optional backend API base for replay endpoints (unchanged)
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
function Stoplight({ label, value, baseline, size = 54, unit = "%" }) {
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

  const arrow =
    !Number.isFinite(delta) ? "→" :
    Math.abs(delta) < 0.5   ? "→" :
    delta > 0               ? "↑" : "↓";

  const deltaColor =
    !Number.isFinite(delta) ? "#94a3b8" :
    delta > 0               ? "#22c55e" :
    delta < 0               ? "#ef4444" : "#94a3b8";

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
      <div style={{ color:deltaColor, fontSize:13, fontWeight:600 }}>
        {arrow} {Number.isFinite(delta) ? delta.toFixed(1) : "0.0"}{unit === "%" ? "%" : ""}
      </div>
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
      <p style={p}><b>Example:</b> 95% → Very coiled; big move could fire soon.</p>
      <p style={p}><b>Zones:</b></p>
      <ul style={ul}>
        <li>0–34% <Tag bg="#22c55e">🟢 Expanded</Tag> — Market already moving freely.</li>
        <li>35–64% <Tag bg="#facc15">🟡 Normal</Tag> — Average compression.</li>
        <li>65–84% <Tag bg="#fb923c">🟠 Tight</Tag> — Pressure building.</li>
        <li>85–100% <Tag bg="#ef4444">🔴 Critical</Tag> — Very tight coil; breakout risk.</li>
      </ul>

      {/* Overall Market Indicator */}
      <div style={h2}>Overall Market Indicator</div>
      <p style={p}>
        Weighted blend of Breadth (40%), Momentum (40%), Expansion (20%), blended toward 50 when Daily Squeeze is high.
      </p>
      <p style={p}><b>Example:</b> 95% → Market is firing on all cylinders; very strong environment.</p>
      <p style={p}><b>Zones:</b></p>
      <ul style={ul}>
        <li>0–34% <Tag bg="#ef4444">🔴 Weak</Tag> — Market conditions unfavorable.</li>
        <li>35–64% <Tag bg="#facc15">🟡 Mixed</Tag> — Sideways/choppy.</li>
        <li>65–84% <Tag bg="#22c55e">🟢 Favorable</Tag> — Trend-friendly.</li>
        <li>85–100% <Tag bg="#fca5a5">🟥 Extreme</Tag> — May be overheated.</li>
      </ul>

      {/* Daily Squeeze */}
      <div style={h2}>Daily Squeeze</div>
      <p style={p}>Same idea as Intraday Squeeze but on SPY daily bars (Lux indicator).</p>
      <p style={p}><b>Example:</b> 54% → Moderate daily compression (constructive).</p>
      <p style={p}><b>Zones:</b></p>
      <ul style={ul}>
        <li>0–34% <Tag bg="#22c55e">🟢 Expanded</Tag> — Daily ranges wide, not coiled.</li>
        <li>35–64% <Tag bg="#facc15">🟡 Normal</Tag> — Average daily compression.</li>
        <li>65–84% <Tag bg="#fb923c">🟠 Tight</Tag> — Daily pressure building.</li>
        <li>85–100% <Tag bg="#ef4444">🔴 Critical</Tag> — Extreme daily coil; breakout likely.</li>
      </ul>

      {/* Liquidity */}
      <div style={h2}>Liquidity</div>
      <p style={p}>Measures depth/ease of execution (PSI). Higher = easier fills, lower slippage.</p>
      <p style={p}><b>Example:</b> 95% → Very liquid; tight fills; low slippage.</p>
      <p style={p}><b>Zones:</b></p>
      <ul style={ul}>
        <li>0–29% <Tag bg="#ef4444">🔴 Thin</Tag> — Hard to get in/out without moving price.</li>
        <li>30–49% <Tag bg="#fb923c">🟠 Light</Tag> — Patchy liquidity; caution.</li>
        <li>50–69% <Tag bg="#facc15">🟡 Normal</Tag> — Adequate.</li>
        <li>70–100% <Tag bg="#22c55e">🟢 Good / Excellent</Tag> — Very easy to trade.</li>
      </ul>

      {/* Volatility */}
      <div style={h2}>Volatility</div>
      <p style={p}>How big price swings are (ATR/stdev). Higher = more turbulent & risky.</p>
      <p style={p}><b>Example:</b> 95% → Very high volatility; turbulent and risky.</p>
      <p style={p}><b>Zones:</b></p>
      <ul style={ul}>
        <li>0–29% <Tag bg="#22c55e">🟢 Calm</Tag> — Smoother swings; easier to hold.</li>
        <li>30–59% <Tag bg="#facc15">🟡 Normal</Tag> — Typical movement.</li>
        <li>60–74% <Tag bg="#fb923c">🟠 Elevated</Tag> — Risk rises; widen stops.</li>
        <li>75–100% <Tag bg="#ef4444">🔴 High</Tag> — Sharp, unpredictable moves.</li>
      </ul>
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

/* ------------------------------ Layouts ------------------------------- */
function MeterTilesLayout({
  breadth, momentum, squeezeIntra, squeezeDaily, liquidity, volatility, meterValue,
  bBreadth, bMomentum, bSqueezeIn, bSqueezeDy, bLiquidity, bVol
}) {
  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr auto 1fr", alignItems:"center", gap:10, marginTop:6 }}>
      {/* LEFT */}
      <div style={{ display:'flex', gap:10, maxWidth:420, width:'100%', alignItems:'center', justifyContent:'space-between' }}>
        <Stoplight label="Breadth"          value={breadth}      baseline={bBreadth} />
        <Stoplight label="Momentum"         value={momentum}     baseline={bMomentum} />
        <Stoplight label="Intraday Squeeze" value={squeezeIntra} baseline={bSqueezeIn} />
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

  // LIVE intraday (NEW states)
  const [liveIntraday, setLiveIntraday] = React.useState(null);
  const [liveSource, setLiveSource] = React.useState(null); // reserved for sectors row if needed

  // Replay state (UNCHANGED)
  const [on, setOn] = React.useState(false);
  const [granularity, setGranularity] = React.useState("10min");
  const [tsSel, setTsSel] = React.useState("");
  const [indexOptions, setIndexOptions] = React.useState([]);
  const [loadingIdx, setLoadingIdx] = React.useState(false);
  const [snap, setSnap] = React.useState(null);
  const [loadingSnap, setLoadingSnap] = React.useState(false);

  const granParam = (granularity === "10min" ? "10min" : (granularity === "1h" ? "hourly" : "eod"));

  /* -------- LIVE intraday fetch (added) -------- */
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!INTRADAY_URL) return;
        const r1 = await fetch(`${INTRADAY_URL}?t=${Date.now()}`, { cache:"no-store" });
        const j1 = await r1.json();
        if (INTRADAY_SOURCE_URL) {
          const r2 = await fetch(`${INTRADAY_SOURCE_URL}?t=${Date.now()}`, { cache:"no-store" });
          const j2 = await r2.json();
          if (!cancelled) setLiveSource(j2);
        }
        if (!cancelled) setLiveIntraday(j1);
      } catch (e) { console.warn("live intraday fetch failed", e); }
    })();
    return () => { cancelled = true; };
  }, []);

  /* -------- Replay index (unchanged) -------- */
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

  /* -------- Replay snapshot (unchanged) -------- */
  React.useEffect(() => {
    if (!on || !tsSel) { setSnap(null); return; }
    (async () => {
      try {
        setLoadingSnap(true);
        const r = await fetch(`${API}/api/replay/at?granularity=${granParam}&ts=${encodeURIComponent(tsSel)}&t=${Date.now()}`, { cache:"no-store" });
        const j = await r.json();
        setSnap(j);
      } catch {
        setSnap(null);
      } finally {
        setLoadingSnap(false);
      }
    })();
  }, [on, tsSel, granParam]);

  /* -------- Data choose: replay → live intraday → polled backend -------- */
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

  /* ------------------------------ RENDER ------------------------------ */
  return (
    <section id="row-2" className="panel" style={{ padding:10 }}>
      {/* Legend modal (UNCHANGED) */}
      {legendOpen && (
        <div role="dialog" aria-modal="true" onClick={()=> setLegendOpen(false)}
          style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:60 }}>
          <div onClick={(e)=> e.stopPropagation()}
            style={{ width:"min(880px, 92vw)", background:"#0b0b0c", border:"1px solid #2b2b2b", borderRadius:12, padding:16, boxShadow:"0 10px 30px rgba(0,0,0,0.35)" }}>
            <LegendContent />
            <div style={{ display:"flex", justifyContent:"flex-end", marginTop:12 }}>
              <button onClick={()=> setLegendOpen(false)}
                style={{ background:"#eab308", color:"#111827", border:"none", borderRadius:8, padding:"8px 12px", fontWeight:700, cursor:"pointer" }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header with Legend + ReplayControls (UNCHANGED) */}
      <div className="panel-head" style={{ alignItems:"center" }}>
        <div className="panel-title">Market Meter — Stoplights</div>

        <button
          onClick={()=> setLegendOpen(true)}
          style={{ background:"#0b0b0b", color:"#e5e7eb", border:"1px solid #2b2b2b", borderRadius:8, padding:"6px 10px", fontWeight:600, cursor:"pointer", marginLeft:8 }}
          title="Legend"
        >
          Legend
        </button>

        <div className="spacer" />
        <div className="flex items-center gap-3">
          {on && tsSel && (
            <span className="text-xs text-neutral-400 hidden sm:inline-block">
              Replaying: {fmtIso(tsSel)} ({granularity})
            </span>
          )}
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
      </div>

      {/* COMPACT stoplights layout (UNCHANGED) */}
      <MeterTilesLayout
        breadth={breadth} momentum={momentum} squeezeIntra={squeezeIntra}
        squeezeDaily={squeezeDaily} liquidity={liquidity} volatility={volatility}
        meterValue={meterValue}
        bBreadth={bBreadth} bMomentum={bMomentum} bSqueezeIn={bSqueezeIn}
        bSqueezeDy={bSqueezeDy} bLiquidity={bLiquidity} bVol={bVol}
      />

      <div className="text-xs text-neutral-500" style={{ marginTop:4 }}>
        {on ? (loadingSnap ? "Loading snapshot…" : (ts ? `Snapshot: ${fmtIso(ts)}` : "Replay ready"))
            : (ts ? `Updated ${fmtIso(ts)}` : "")}
      </div>
    </section>
  );
}
