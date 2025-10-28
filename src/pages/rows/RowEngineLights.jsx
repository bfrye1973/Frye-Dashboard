// src/pages/rows/EngineLights.jsx
import React, { useEffect, useMemo, useState } from "react";
import LuxTrendChip from "../../components/LuxTrendChip";
import LuxTrendDialog from "../../components/LuxTrendDialog";

/* ------------------------------------------------------------------
   Data endpoints (proxies)
   ------------------------------------------------------------------ */
const INTRADAY_URL = "https://frye-market-backend-1.onrender.com/live/intraday";
const HOURLY_URL   = "https://frye-market-backend-1.onrender.com/live/hourly";
const EOD_URL      = "https://frye-market-backend-1.onrender.com/live/eod"; // change to /live/daily if that's your proxy

/* ------------------------------------------------------------------
   Always-on pill sets (structure-first)
   Each pill expects engineLights/hourly signals like:
   { state: "bull"|"bear"|"neutral", recentCross: boolean, lastChanged: ISO, reason?: string }
   ------------------------------------------------------------------ */
const P10 = [
  { k: "sigOverall10m", label: "Overall (10m)" },
  { k: "sigEMA10m",     label: "EMA (10m)"     },
  { k: "sigAccel10m",   label: "Accel (10m)"   },
  { k: "sigCandle10m",  label: "Candle (10m)"  },
];

const P1H = [
  { k: "sigOverall1h",  label: "Overall (1h)"  },
  { k: "sigEMA1h",      label: "EMA (1h)"      },
  { k: "sigSMI1h",      label: "SMI (1h)"      },
];

/* ------------------------------------------------------------------
   Helpers
   ------------------------------------------------------------------ */
const safeStr = (v, d = "") => (v == null ? d : String(v));
const getSig = (obj, key) => (obj && obj[key]) || {};

function toneFromState(state) {
  const s = String(state || "").toLowerCase();
  if (s === "bull")  return "ok";
  if (s === "bear")  return "danger";
  return "warn"; // neutral / compression / transition
}

function Pill({ label, state, recentCross }) {
  const tone = toneFromState(state);
  const map = {
    ok:     { bg: "var(--ok)",     fg: "#001b0a" },
    danger: { bg: "var(--danger)", fg: "#2b0000" },
    warn:   { bg: "var(--warn)",   fg: "#221a00" },
  };
  const t = map[tone] || map.warn;
  const style = {
    background: t.bg,
    color: t.fg,
    borderRadius: 999,
    fontSize: 12,
    padding: "4px 10px",
    lineHeight: "18px",
    whiteSpace: "nowrap",
    position: "relative",
  };
  const dot = {
    content: '""',
    position: "absolute",
    right: 4,
    top: 3,
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: recentCross ? "#ffffff" : "transparent",
    opacity: 0.9,
  };
  return (
    <span className="pill" style={style}>
      {label}
      <i style={dot} />
    </span>
  );
}

/* ------------------------------------------------------------------
   Engine Lights (two rows, left-locked, always-on pills)
   ------------------------------------------------------------------ */
export default function EngineLights() {
  const [j10, setJ10] = useState(null);
  const [j1h, setJ1h] = useState(null);
  const [jd,  setJd]  = useState(null);

  // Fetch on mount; refresh at cadence
  useEffect(() => {
    let alive = true;
    const pull = async (url, setter) => {
      try {
        const r = await fetch(url, { cache: "no-store" });
        const j = await r.json();
        if (alive) setter(j);
      } catch {}
    };
    pull(INTRADAY_URL, setJ10);
    pull(HOURLY_URL,   setJ1h);
    pull(EOD_URL,      setJd);

    const t10 = setInterval(() => pull(INTRADAY_URL, setJ10), 60 * 1000);
    const t1h = setInterval(() => pull(HOURLY_URL,   setJ1h), 60 * 1000);
    const td  = setInterval(() => pull(EOD_URL,      setJd),  10 * 60 * 1000);

    return () => { alive = false; clearInterval(t10); clearInterval(t1h); clearInterval(td); };
  }, []);

  // Signals (always-on format)
  const s10 = useMemo(() => (j10?.engineLights?.signals) || {}, [j10]);
  const s1h = useMemo(() => (j1h?.hourly?.signals)       || {}, [j1h]);

  // Labeled timestamps (left-aligned chips)
  const ts10 = j10?.updated_at_utc || j10?.engineLights?.updatedAt || j10?.updated_at || null;
  const ts1h = j1h?.updated_at_utc || j1h?.updated_at || null;
  const ts1d = jd?.updated_at_utc  || jd?.updated_at  || null;

  // Lux strategy dialogs (green/yellow/red)
  const lux10 = useMemo(() => {
    const t = j10?.strategy?.trend10m;
    return {
      state:  safeStr(t?.state || j10?.engineLights?.overall?.state || "yellow"),
      reason: safeStr(t?.reason || "Neutral/transition"),
      updatedAt: safeStr(t?.updatedAt || ts10 || "")
    };
  }, [j10, ts10]);

  const lux1h = useMemo(() => {
    const t = j1h?.strategy?.trend1h;
    return {
      state:  safeStr(t?.state || j1h?.hourly?.overall1h?.state || "yellow"),
      reason: safeStr(t?.reason || "Neutral/transition"),
      updatedAt: safeStr(t?.updatedAt || ts1h || "")
    };
  }, [j1h, ts1h]);

  const luxEOD = useMemo(() => {
    const t = jd?.strategy?.trendEOD;
    const fallback = jd?.trendDaily?.trend;
    return {
      state:  safeStr((t?.state || fallback?.state || "yellow")),
      reason: safeStr(t?.reason || "Neutral/transition"),
      updatedAt: safeStr(t?.updatedAt || ts1d || "")
    };
  }, [jd, ts1d]);

  // Styles: all left-aligned; two rows; no stretch
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
        {ts10 ? <span style={tsChip}>10m: {safeStr(ts10)}</span> : null}
        {ts1h ? <span style={tsChip}>1h: {safeStr(ts1h)}</span>   : null}
        {ts1d ? <span style={tsChip}>EOD: {safeStr(ts1d)}</span>  : null}
      </div>

      {/* Body: exactly two rows, left-locked */}
      <div className="eng-body" style={body}>
        {/* Row 1 — 10m pills + Lux 10m */}
        <div className="eng-row" style={rowWrap}>
          {P10.map(def => {
            const sig = getSig(s10, def.k);
            return (
              <Pill
                key={def.k}
                label={def.label}
                state={safeStr(sig.state || "neutral")}
                recentCross={Boolean(sig.recentCross)}
              />
            );
          })}
          <LuxTrendChip state={lux10.state} reason={lux10.reason} label="Lux 10m" />
          <LuxTrendDialog title="Lux 10m" state={lux10.state} reason={lux10.reason} updatedAt={lux10.updatedAt} />
        </div>

        {/* Row 2 — 1h pills + Lux 1h + Lux EOD */}
        <div className="eng-row" style={rowWrap}>
          {P1H.map(def => {
            const sig = getSig(s1h, def.k);
            return (
              <Pill
                key={def.k}
                label={def.label}
                state={safeStr(sig.state || "neutral")}
                recentCross={Boolean(sig.recentCross)}
              />
            );
          })}
          <LuxTrendChip state={lux1h.state} reason={lux1h.reason} label="Lux 1h" />
          <LuxTrendDialog title="Lux 1h" state={lux1h.state} reason={lux1h.reason} updatedAt={lux1h.updatedAt} />
          <LuxTrendChip state={luxEOD.state} reason={luxEOD.reason} label="Lux EOD" />
          <LuxTrendDialog title="Lux EOD" state={luxEOD.state} reason={luxEOD.reason} updatedAt={luxEOD.updatedAt} />
        </div>
      </div>
    </section>
  );
}
