// src/pages/rows/RowMarketOverview.jsx
import React from "react";
import { useDashboardPoll } from "../../lib/dashboardApi";
import { LastUpdated } from "../../components/LastUpdated";
import { useViewMode, ViewModes } from "../../context/ModeContext";

// Replay (sandboxed subfolder)
import ReplayControls from "./RowMarketOverview/Replay/ReplayControls";
import { useReplayState } from "./RowMarketOverview/Replay/useReplayState";
import { getReplayIndex, getReplaySnapshot } from "./RowMarketOverview/Replay/replayApi";
import { emitReplayUpdate } from "./RowMarketOverview/Replay/bridge";

/* ---------- helpers ---------- */
const clamp01 = (n) => Math.max(0, Math.min(100, Number(n)));
const pct = (n) => (Number.isFinite(n) ? n.toFixed(1) : "—");
const toneFor = (v) => (v >= 60 ? "ok" : v >= 40 ? "warn" : "danger");
const fmtIso = (ts) => { try { return new Date(ts).toLocaleString(); } catch { return ts; } };

/* ---------- baselines (per day, persisted) ---------- */
const dayKey = () => new Date().toISOString().slice(0, 10);
function useDailyBaseline(keyName, current) {
  const [baseline, setBaseline] = React.useState(null);

  // initial load (read or seed)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyName]);

  // if current appears later AND no baseline yet, seed it
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

/* ---------- stoplight tile ---------- */
function Stoplight({ label, value, baseline, size = 60, unit = "%" }) {
  const v = Number.isFinite(value) ? clamp01(value) : NaN;
  const delta = Number.isFinite(v) && Number.isFinite(baseline) ? v - baseline : NaN;

  const tone = Number.isFinite(v) ? toneFor(v) : "info";
  const colors = {
    ok:     { bg:"#22c55e", glow:"rgba(34,197,94,.45)"  },
    warn:   { bg:"#fbbf24", glow:"rgba(251,191,36,.45)" },
    danger: { bg:"#ef4444", glow:"rgba(239,68,68,.45)"  },
    info:   { bg:"#334155", glow:"rgba(51,65,85,.35)"   }
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
    <div className="light" style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:6, minWidth:size+44 }}>
      <div
        title={`${label}: ${pct(v)}${unit === "%" ? "%" : ""}`}
        style={{
          width:size, height:size, borderRadius:"50%",
          background:colors.bg, boxShadow:`0 0 14px ${colors.glow}`,
          display:"flex", alignItems:"center", justifyContent:"center",
          border:"5px solid #0c1320"
        }}
      >
        <div style={{ fontWeight:800, fontSize:size >= 100 ? 20 : 17, color:"#0b1220" }}>
          {pct(v)}{unit === "%" ? "%" : ""}
        </div>
      </div>
      <div className="small" style={{ color:"#e5e7eb", fontWeight:700, fontSize:16, lineHeight:1.15, textAlign:"center" }}>
        {label}
      </div>
      <div style={{ color: deltaColor, fontSize:14, fontWeight:600, marginTop:2 }}>
        {arrow} {Number.isFinite(delta) ? delta.toFixed(1) : "0.0"}{unit === "%" ? "%" : ""}
      </div>
    </div>
  );
}

/* =======================
   Row 2 — Market Overview
   (SAFE: adds Replay, preserves original behavior)
   ======================= */
export default function RowMarketOverview() {
  // live poll (defensive — no optional-call syntax)
  const { data: live } = useDashboardPoll("dynamic");
  const { mode } = useViewMode(); // view mode from Row 1
  const [legendOpen, setLegendOpen] = React.useState(false);

  // ---- Replay state & data (sandboxed) ----
  const replay = useReplayState(); // { on, setOn, granularity, setGranularity, ts, setTs }
  const [index, setIndex] = React.useState([]); // [{ ts }]
  const [loadingIdx, setLoadingIdx] = React.useState(false);
  const [snap, setSnap] = React.useState(null);
  const [loadingSnap, setLoadingSnap] = React.useState(false);

  // Load available timestamps when turning ON or granularity changes
  React.useEffect(() => {
    if (!replay.on) { setIndex([]); setSnap(null); return; }
    setLoadingIdx(true);
    getReplayIndex(replay.granularity)
      .then(items => {
        setIndex(items);
        if (items.length && !replay.ts) replay.setTs(items[0].ts);
      })
      .catch(() => {})
      .finally(() => setLoadingIdx(false));
  }, [replay.on, replay.granularity]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load specific snapshot when ts changes while ON
  React.useEffect(() => {
    if (!replay.on || !replay.ts) { setSnap(null); return; }
    setLoadingSnap(true);
    getReplaySnapshot(replay.granularity, replay.ts)
      .then(j => setSnap(j))
      .catch(() => setSnap(null))
      .finally(() => setLoadingSnap(false));
  }, [replay.on, replay.ts, replay.granularity]);

  // Inform the chart to sync
  React.useEffect(() => {
    emitReplayUpdate({ on: replay.on, ts: replay.ts, granularity: replay.granularity });
  }, [replay.on, replay.ts, replay.granularity]);

  // Choose data source (snapshot when ON, else live)
  const data = (replay.on && snap && snap.ok !== false) ? snap : live;

  const od = data?.odometers ?? {};
  const gg = data?.gauges ?? {};
  const ts = data?.meta?.ts ?? data?.updated_at ?? data?.ts ?? null;

  // normalized (from dashboardApi.transformToUi / or replay summary)
  const breadth   = Number(od?.breadthOdometer ?? data?.summary?.breadthIdx ?? gg?.rpm?.pct ?? 50);
  const momentum  = Number(od?.momentumOdometer ?? data?.summary?.momentumIdx ?? gg?.speed?.pct ?? 50);

  // intraday squeeze (compression)
  const squeezeIntra = Number(od?.squeezeCompressionPct ?? gg?.fuel?.pct ?? 50);

  // daily squeeze (compression) — MUST be under gauges.squeezeDaily.pct
  const squeezeDaily = Number.isFinite(gg?.squeezeDaily?.pct) ? Number(gg.squeezeDaily.pct) : null;

  // liquidity & volatility; accept canonical and legacy mirrors
  const liquidity  = Number.isFinite(gg?.oil?.psi) ? Number(gg.oil.psi)
                     : (Number.isFinite(gg?.oilPsi) ? Number(gg.oilPsi) : NaN);
  const volatility = Number.isFinite(gg?.volatilityPct) ? Number(gg.volatilityPct)
                     : (Number.isFinite(gg?.water?.pct) ? Number(gg.water.pct) : NaN);

  // daily baselines (for arrows)
  const bBreadth   = useDailyBaseline("breadth",         breadth);
  const bMomentum  = useDailyBaseline("momentum",        momentum);
  const bSqueezeIn = useDailyBaseline("squeezeIntraday", squeezeIntra);
  const bSqueezeDy = useDailyBaseline("squeezeDaily",    squeezeDaily);
  const bLiquidity = useDailyBaseline("liquidity",       liquidity);
  const bVol       = useDailyBaseline("volatility",      volatility);

  // ----- Market Meter (center) -----
  const expansion  = 100 - clamp01(squeezeIntra);
  const baseMeter  = 0.4 * breadth + 0.4 * momentum + 0.2 * expansion;

  // blend toward neutral by daily squeeze
  const Sdy = Number.isFinite(squeezeDaily) ? clamp01(squeezeDaily) / 100 : 0;
  const blended = (1 - Sdy) * baseMeter + Sdy * 50; // 0..100
  const meterValue = Math.round(blended);

  /* ---------- render ---------- */
  return (
    <section id="row-2" className="panel" style={{ padding:12 }}>
      {/* Legend modal */}
      {legendOpen && (
        <LegendModal onClose={() => setLegendOpen(false)}>
          <LegendContent />
        </LegendModal>
      )}

      {/* Header */}
      <div className="panel-head" style={{ alignItems:"center" }}>
        <div className="panel-title">Market Meter — Stoplights</div>
        <button
          onClick={() => setLegendOpen(true)}
          style={{
            background:"#0b0b0b", color:"#e5e7eb", border:"1px solid #2b2b2b",
            borderRadius:8, padding:"6px 10px", fontWeight:600, cursor:"pointer", marginLeft:8
          }}
          title="Legend"
        >
          Legend
        </button>
        <div className="spacer" />
        {/* Right side: LastUpdated + Replay controls */}
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          {replay.on && replay.ts && (
            <span style={{ color:"#9ca3af", fontSize:12 }}>
              Replaying: {fmtIso(replay.ts)} ({replay.granularity})
            </span>
          )}
          <LastUpdated ts={ts} />
          <ReplayControls
            on={replay.on}
            setOn={replay.setOn}
            granularity={replay.granularity}
            setGranularity={replay.setGranularity}
            ts={replay.ts}
            setTs={replay.setTs}
            loadIndex={getReplayIndex}
            index={index}
            setIndex={setIndex}
            loading={loadingIdx}
          />
        </div>
      </div>

      {/* Layouts by view mode (unchanged) */}
      {mode === ViewModes.METER_TILES && (
        <MeterTilesLayout
          breadth={breadth} momentum={momentum} squeezeIntra={squeezeIntra}
          squeezeDaily={squeezeDaily} liquidity={liquidity} volatility={volatility}
          meterValue={meterValue}
          bBreadth={bBreadth} bMomentum={bMomentum} bSqueezeIn={bSqueezeIn}
          bSqueezeDy={bSqueezeDy} bLiquidity={bLiquidity} bVol={bVol}
        />
      )}

      {mode === ViewModes.TRAFFIC && (
        <TrafficLightsLayout
          breadth={breadth} momentum={momentum} squeezeIntra={squeezeIntra}
          squeezeDaily={squeezeDaily} liquidity={liquidity} volatility={volatility}
        />
      )}

      {mode === ViewModes.ARROWS && (
        <ArrowScorecardsLayout
          breadth={{ value: breadth,       base: bBreadth   }}
          momentum={{ value: momentum,     base: bMomentum  }}
          squeezeIntra={{ value: squeezeIntra, base: bSqueezeIn }}
          squeezeDaily={{ value: squeezeDaily, base: bSqueezeDy }}
          liquidity={{ value: liquidity,   base: bLiquidity }}
          volatility={{ value: volatility, base: bVol       }}
          meterValue={meterValue}
        />
      )}

      {/* Optional tiny status line */}
      <div className="text-xs" style={{ color:"#9ca3af", marginTop:6 }}>
        {replay.on
          ? (loadingSnap ? "Loading snapshot…" : (ts ? `Snapshot: ${fmtIso(ts)}` : "Replay ready"))
          : (ts ? `Updated ${fmtIso(ts)}` : "")}
      </div>
    </section>
  );
}

/* =========================
   Layout variants (Row 2)
   ========================= */

function MeterTilesLayout({
  breadth, momentum, squeezeIntra, squeezeDaily, liquidity, volatility,
  meterValue,
  bBreadth, bMomentum, bSqueezeIn, bSqueezeDy, bLiquidity, bVol
}) {
  return (
    <div
      style={{
        display:"grid",
        gridTemplateColumns:"1fr auto 1fr",
        alignItems:"center",
        gap:12,
        marginTop:6
      }}
    >
      {/* LEFT: Breadth, Momentum, Intraday Squeeze */}
      <div style={{
        display:'flex', gap:12, maxWidth:420, width:'100%',
        alignItems:'center', justifyContent:'space-between'
      }}>
        <Stoplight label="Breadth"          value={breadth}      baseline={bBreadth} />
        <Stoplight label="Momentum"         value={momentum}     baseline={bMomentum} />
        <Stoplight label="Intraday Squeeze" value={squeezeIntra} baseline={bSqueezeIn} />
      </div>

      {/* CENTER: big meter + daily squeeze */}
      <div style={{ display:"flex", alignItems:"center", gap:16 }}>
        <Stoplight label="Overall Market Indicator" value={meterValue} baseline={meterValue} size={110} />
        <Stoplight label="Daily Squeeze" value={squeezeDaily} baseline={bSqueezeDy} />
      </div>

      {/* RIGHT: Liquidity, Volatility */}
      <div style={{ display:"flex", gap:12, justifyContent:"flex-end" }}>
        <Stoplight label="Liquidity"  value={liquidity}  baseline={bLiquidity} unit="" />
        <Stoplight label="Volatility" value={volatility} baseline={bVol} />
      </div>
    </div>
  );
}

function TrafficLightsLayout({
  breadth, momentum, squeezeIntra, squeezeDaily, liquidity, volatility
}) {
  return (
    <div style={{ display:"flex", gap:12, flexWrap:"wrap", marginTop:6 }}>
      <Stoplight label="Breadth"          value={breadth}      baseline={null} />
      <Stoplight label="Momentum"         value={momentum}     baseline={null} />
      <Stoplight label="Intraday Squeeze" value={squeezeIntra} baseline={null} />
      <Stoplight label="Daily Squeeze"    value={squeezeDaily} baseline={null} />
      <Stoplight label="Liquidity"        value={liquidity}    baseline={null} unit="" />
      <Stoplight label="Volatility"       value={volatility}   baseline={null} />
    </div>
  );
}

function ArrowScorecardsLayout({
  breadth, momentum, squeezeIntra, squeezeDaily, liquidity, volatility, meterValue
}) {
  const Card = ({ title, value, base }) => {
    const v = Number.isFinite(value) ? value : NaN;
    const d = Number.isFinite(value) && Number.isFinite(base) ? value - base : NaN;
    const arrow = !Number.isFinite(d) ? "→" : d > 0 ? "↑" : d < 0 ? "↓" : "→";
    const tone = Number.isFinite(v) ? toneFor(v) : "info";
    const border = { ok:"#22c55e", warn:"#fbbf24", danger:"#ef4444", info:"#475569" }[tone];

    return (
      <div style={{
        border:`1px solid ${border}`, borderRadius:12, padding:"10px 12px",
        minWidth:160, background:"#0f1113"
      }}>
        <div style={{ color:"#9ca3af", fontSize:12 }}>{title}</div>
        <div style={{ color:"#e5e7eb", fontWeight:800, fontSize:18 }}>{pct(v)}%</div>
        <div style={{ color:"#cbd5e1", fontSize:12, marginTop:2 }}>
          {arrow} {Number.isFinite(d) ? d.toFixed(1) : "0.0"}%
        </div>
      </div>
    );
  };

  return (
    <div style={{ display:"flex", gap:12, flexWrap:"wrap", marginTop:6 }}>
      <Card title="Market Meter" value={meterValue} base={50} />
      <Card title="Breadth" value={breadth.value} base={breadth.base} />
      <Card title="Momentum" value={momentum.value} base={momentum.base} />
      <Card title="Intraday Squeeze" value={squeezeIntra.value} base={squeezeIntra.base} />
      <Card title="Daily Squeeze" value={squeezeDaily.value} base={squeezeDaily.base} />
      <Card title="Liquidity" value={liquidity.value} base={liquidity.base} />
      <Card title="Volatility" value={volatility.value} base={volatility.base} />
    </div>
  );
}

/* =========================
   Legend Modal + Content
   ========================= */

function LegendModal({ onClose, children }) {
  React.useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position:"fixed", inset:0, background:"rgba(0,0,0,0.5)",
        display:"flex", alignItems:"center", justifyContent:"center", zIndex:50
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width:"min(860px, 92vw)", background:"#0b0b0c", border:"1px solid #2b2b2b",
          borderRadius:12, padding:16, boxShadow:"0 10px 30px rgba(0,0,0,0.35)"
        }}
      >
        {children}
        <div style={{ display:"flex", justifyContent:"flex-end", marginTop:12 }}>
          <button
            onClick={onClose}
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
  );
}

function LegendContent() {
  // Keep your original content here. Placeholder title so file compiles if you paste now.
  return (
    <div>
      <div style={{ color:"#e5e7eb", margin:"6px 0 8px", fontSize:16, fontWeight:700 }}>
        Market Meter — Gauge Legend
      </div>
      <div style={{ color:"#cbd5e1", fontSize:14 }}>
        (Your existing LegendContent goes here.)
      </div>
    </div>
  );
}
