// src/pages/rows/EngineLights.jsx
import React, { useEffect, useMemo, useState } from "react";
import LuxTrendChip from "../../components/LuxTrendChip";
import LuxTrendDialog from "../../components/LuxTrendDialog";

// Proxies
const INTRADAY_URL = "https://frye-market-backend-1.onrender.com/live/intraday";
const HOURLY_URL   = "https://frye-market-backend-1.onrender.com/live/hourly";
const EOD_URL      = "https://frye-market-backend-1.onrender.com/live/eod"; // or /live/daily

// 10m pills (keep your actual keys)
const R10_DEF = [
  { k:"sigOverallBull",      label:"Overall Bull",      tone:"ok"     },
  { k:"sigOverallBear",      label:"Overall Bear",      tone:"danger" },
  { k:"sigEMA10BullCross",   label:"EMA10 Bull Cross",  tone:"ok"     },
  { k:"sigEMA10BearCross",   label:"EMA10 Bear Cross",  tone:"danger" },
  { k:"sigAccelUp",          label:"Accel Up",          tone:"ok"     },
  { k:"sigAccelDown",        label:"Accel Down",        tone:"danger" },
  { k:"sigRiskOn",           label:"Risk-On",           tone:"ok"     },
  { k:"sigRiskOff",          label:"Risk-Off",          tone:"danger" },
  { k:"sigCompression",      label:"Compression",       tone:"warn"   },
  { k:"sigExpansion",        label:"Expansion",         tone:"ok"     },
  { k:"sigSectorThrust",     label:"Sector Thrust",     tone:"ok"     },
  { k:"sigSectorWeak",       label:"Sector Weak",       tone:"danger" },
  { k:"sigOverheat",         label:"Overheat",          tone:"warn"   },
  { k:"sigTurbo",            label:"Turbo",             tone:"ok"     },
  { k:"sigDivergence",       label:"Divergence",        tone:"warn"   },
  { k:"sigLowLiquidity",     label:"Low Liquidity",     tone:"warn"   },
  { k:"sigVolatilityHigh",   label:"Volatility High",   tone:"warn"   },
];

// 1h (Option A: 4 pills — crossover confirmations)
const R11_1H_DEF = [
  { k:"sigEMA1hBullCross",  label:"EMA1h Bull Cross",  tone:"ok"     },
  { k:"sigEMA1hBearCross",  label:"EMA1h Bear Cross",  tone:"danger" },
  { k:"sigSMI1hBullCross",  label:"SMI1h Bull Cross",  tone:"ok"     },
  { k:"sigSMI1hBearCross",  label:"SMI1h Bear Cross",  tone:"danger" },
];

function Pill({ active, label, tone }) {
  const map = {
    ok:     { bg: "var(--ok)",     fg: "#001b0a" },
    danger: { bg: "var(--danger)", fg: "#2b0000" },
    warn:   { bg: "var(--warn)",   fg: "#221a00" },
    info:   { bg: "var(--info)",   fg: "#001221" },
    off:    { bg: "rgba(148,163,184,0.25)", fg: "var(--text)", dim: true },
  };
  const t = active ? (map[tone] || map.ok) : map.off;
  const style = {
    background: t.bg, color: t.fg, opacity: t.dim ? 0.45 : 1,
    borderRadius: 999, fontSize: 12, padding: "4px 10px", lineHeight: "18px", whiteSpace: "nowrap",
  };
  return <span className="pill" style={style}>{label}</span>;
}

export default function EngineLights() {
  const [j10, setJ10] = useState(null);
  const [j1h, setJ1h] = useState(null);
  const [jd,  setJd]  = useState(null);

  // Fetch
  useEffect(() => {
    let alive = true;
    const pull = async (url, setter) => { try { const r = await fetch(url, { cache: "no-store" }); const j = await r.json(); if (alive) setter(j); } catch {} };
    pull(INTRADAY_URL, setJ10); pull(HOURLY_URL, setJ1h); pull(EOD_URL, setJd);
    const t10 = setInterval(() => pull(INTRADAY_URL, setJ10), 60*1000);
    const t1h = setInterval(() => pull(HOURLY_URL,   setJ1h), 60*1000);
    const td  = setInterval(() => pull(EOD_URL,      setJd),  10*60*1000);
    return () => { alive = false; clearInterval(t10); clearInterval(t1h); clearInterval(td); };
  }, []);

  // Signals
  const signals10 = useMemo(() => (j10?.engineLights?.signals) || {}, [j10]);
  const signals1h = useMemo(() => (j1h?.hourly?.signals) || {}, [j1h]);

  // Times
  const ts10 = j10?.updated_at_utc || j10?.engineLights?.updatedAt || j10?.updated_at || null;
  const ts1h = j1h?.updated_at_utc || j1h?.updated_at || null;
  const ts1d = jd?.updated_at_utc  || jd?.updated_at  || null;

  // Lux strategy states
  const lux10 = useMemo(() => {
    const t = j10?.strategy?.trend10m;
    // if not present, fall back to overall state
    const state  = t?.state || j10?.engineLights?.overall?.state || "yellow";
    const reason = t?.reason || "Neutral/transition";
    const updatedAt = t?.updatedAt || ts10 || "";
    return { state, reason, updatedAt };
  }, [j10, ts10]);

  const lux1h = useMemo(() => {
    const t = j1h?.strategy?.trend1h;
    const state  = t?.state || j1h?.hourly?.overall1h?.state || "yellow";
    const reason = t?.reason || "Neutral/transition";
    const updatedAt = t?.updatedAt || ts1h || "";
    return { state, reason, updatedAt };
  }, [j1h, ts1h]);

  const luxEOD = useMemo(() => {
    const t = jd?.strategy?.trendEOD;
    const fallback = jd?.trendDaily?.trend;
    const state  = (t?.state || fallback?.state || "yellow");
    const reason = (t?.reason || "Neutral/transition");
    const updatedAt = t?.updatedAt || ts1d || "";
    return { state, reason, updatedAt };
  }, [jd, ts1d]);

  // Styles
  const header  = { display: "inline-flex", alignItems: "center", gap: 10, flexWrap: "wrap", maxWidth: "100%" };
  const body    = { display: "flex", flexDirection: "column", gap: 8, marginTop: 8 };
  const rowWrap = { display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap", maxWidth: "100%" };
  const tsChip  = { fontSize: 12, opacity: .75, background:"#0b1220", border:"1px solid var(--border)", borderRadius:999, padding:"2px 8px" };

  return (
    <section id="row-3" className="panel">
      {/* Header (left-aligned, labeled timestamps) */}
      <div className="panel-head" style={header}>
        <span className="panel-title">Engine Lights</span>
        <button className="btn btn-xs" title="Legend">Legend</button>
        {ts10 ? <span style={tsChip}>10m: {ts10}</span> : null}
        {ts1h ? <span style={tsChip}>1h: {ts1h}</span> : null}
        {ts1d ? <span style={tsChip}>EOD: {ts1d}</span> : null}
      </div>

      {/* Two rows only, left-locked */}
      <div className="eng-body" style={body}>
        {/* Row 1: 10m pills + Lux 10m chip + dialog */}
        <div className="eng-row" style={rowWrap}>
          {R10_DEF.map(def => (
            <Pill key={def.k} label={def.label} tone={def.tone} active={Boolean(signals10?.[def.k]?.active)} />
          ))}
          <LuxTrendChip state={lux10.state} reason={lux10.reason} label="Lux 10m" />
          <LuxTrendDialog title="Lux 10m" state={lux10.state} reason={lux10.reason} updatedAt={lux10.updatedAt} />
        </div>

        {/* Row 2: 1h (4 pills) + Lux 1h + Lux EOD */}
        <div className="eng-row" style={rowWrap}>
          {R11_1H_DEF.map(def => (
            <Pill key={def.k} label={def.label} tone={def.tone} active={Boolean(signals1h?.[def.k]?.active)} />
          ))}
          <LuxTrendChip state={lux1h.state} reason={lux1h.reason} label="Lux 1h" />
          <LuxTrendDialog title="Lux 1h" state={lux1h.state} reason={lux1h.reason} updatedAt={lux1h.updatedAt} />
          <LuxTrendChip state={luxEOD.state} reason={luxEOD.reason} label="Lux EOD" />
          <LuxTrendDialog title="Lux EOD" state={luxEOD.state} reason={luxEOD.reason} updatedAt={luxEOD.updatedAt} />
        </div>
      </div>
    </section>
  );
}
