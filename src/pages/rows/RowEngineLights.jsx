// src/pages/rows/EngineLights.jsx
import React, { useEffect, useMemo, useState } from "react";
import LuxTrendChip from "../../components/LuxTrendChip";
import LuxTrendDialog from "../../components/LuxTrendDialog"; // keep for now (can remove if you want only big panels)
import LuxTrendPanel from "../../components/LuxTrendPanel";

/* Endpoints */
const INTRADAY_URL = "https://frye-market-backend-1.onrender.com/live/intraday";
const HOURLY_URL   = "https://frye-market-backend-1.onrender.com/live/hourly";
const EOD_URL      = "https://frye-market-backend-1.onrender.com/live/eod"; // change if your proxy differs

/* Always-on pills */
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

/* Helpers */
const safeStr = (v, d = "") => (v == null ? d : String(v));
const getSig = (obj, key) => (obj && obj[key]) || {};

const fmtAZ = (ts) => {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleString("en-US", {
      timeZone: "America/Phoenix",
      hour12: false, month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
    });
  } catch { return String(ts); }
};

function toneFromState(state) {
  const s = String(state || "").toLowerCase();
  if (s === "bull")  return "ok";
  if (s === "bear")  return "danger";
  return "warn";
}
function Pill({ label, state, recentCross }) {
  const tone = toneFromState(state);
  const map = {
    ok:     { bg: "var(--ok)",     fg: "#001b0a" },
    danger: { bg: "var(--danger)", fg: "#2b0000" },
    warn:   { bg: "var(--warn)",   fg: "#221a00" },
  };
  const t = map[tone] || map.warn;
  const style = { background: t.bg, color: t.fg, borderRadius: 999, fontSize: 12, padding: "4px 10px", lineHeight: "18px", whiteSpace: "nowrap", position: "relative" };
  const dot = { content: '""', position: "absolute", right: 4, top: 3, width: 6, height: 6, borderRadius: "50%", background: recentCross ? "#fff" : "transparent", opacity: 0.9 };
  return <span className="pill" style={style}>{label}<i style={dot} /></span>;
}

/* Fallback derivation (until backend keys are present) */
const derive10mState = (sigKey, j10, lux10) => {
  const overall = (j10?.engineLights?.overall?.state || "").toLowerCase();
  const lux     = (lux10?.state || "").toLowerCase();
  const luxMap  = lux === "green" ? "bull" : lux === "red" ? "bear" : "neutral";
  switch (sigKey) {
    case "sigOverall10m": return overall || luxMap;
    case "sigEMA10m":     return luxMap;
    case "sigAccel10m":   return overall || "neutral";
    case "sigCandle10m":  return "neutral";
    default: return "neutral";
  }
};
const derive1hState = (sigKey, j1h, lux1h) => {
  const overall = (j1h?.hourly?.overall1h?.state || "").toLowerCase();
  const lux     = (lux1h?.state || "").toLowerCase();
  const luxMap  = lux === "green" ? "bull" : lux === "red" ? "bear" : "neutral";
  switch (sigKey) {
    case "sigOverall1h": return overall || luxMap;
    case "sigEMA1h":     return luxMap;
    case "sigSMI1h":     return luxMap;
    default: return "neutral";
  }
};

export default function EngineLights() {
  const [j10, setJ10] = useState(null);
  const [j1h, setJ1h] = useState(null);
  const [jd,  setJd]  = useState(null);

  useEffect(() => {
    let alive = true;
    const pull = async (url, setter) => { try { const r = await fetch(url, { cache: "no-store" }); const j = await r.json(); if (alive) setter(j); } catch {} };
    pull(INTRADAY_URL, setJ10);
    pull(HOURLY_URL,   setJ1h);
    pull(EOD_URL,      setJd);
    const t10 = setInterval(() => pull(INTRADAY_URL, setJ10), 60 * 1000);
    const t1h = setInterval(() => pull(HOURLY_URL,   setJ1h), 60 * 1000);
    const td  = setInterval(() => pull(EOD_URL,      setJd),  10 * 60 * 1000);
    return () => { alive = false; clearInterval(t10); clearInterval(t1h); clearInterval(td); };
  }, []);

  const s10 = useMemo(() => (j10?.engineLights?.signals) || {}, [j10]);
  const s1h = useMemo(() => (j1h?.hourly?.signals)       || {}, [j1h]);

  const ts10 = j10?.updated_at_utc || j10?.engineLights?.updatedAt || j10?.updated_at || null;
  const ts1h = j1h?.updated_at_utc || j1h?.updated_at || null;
  const ts1d = jd?.updated_at_utc  || jd?.updated_at  || null;

  // Lux states
  const lux10 = useMemo(() => {
    const t = j10?.strategy?.trend10m;
    return { state:  safeStr(t?.state || j10?.engineLights?.overall?.state || "yellow"),
             reason: safeStr(t?.reason || "Neutral/transition"),
             updatedAt: safeStr(t?.updatedAt || ts10 || "") };
  }, [j10, ts10]);

  const lux1h = useMemo(() => {
    const t = j1h?.strategy?.trend1h;
    return { state:  safeStr(t?.state || j1h?.hourly?.overall1h?.state || "yellow"),
             reason: safeStr(t?.reason || "Neutral/transition"),
             updatedAt: safeStr(t?.updatedAt || ts1h || "") };
  }, [j1h, ts1h]);

  const luxEOD = useMemo(() => {
    const t = jd?.strategy?.trendEOD;
    const fallback = jd?.trendDaily?.trend;
    return { state:  safeStr(t?.state || fallback?.state || "yellow"),
             reason: safeStr(t?.reason || "Neutral/transition"),
             updatedAt: safeStr(t?.updatedAt || ts1d || "") };
  }, [jd, ts1d]);

  /* —— Extract panel metrics with safe fallbacks —— */
  const m10 = j10?.metrics || {};
  const m1h = j1h?.metrics || {};
  const md  = jd?.metrics  || {};

  // 10m proxies (use your existing metrics if present)
  const tstr10  = m10.trend_strength_10m ?? j10?.engineLights?.overall?.score ?? "—";
  const vol10   = m10.volatility_pct     ?? "—";
  const sqz10   = m10.squeeze_pct        ?? "—";
  const vsent10 = m10.volume_sentiment_10m ?? "—";

  // 1h metrics
  const tstr1h  = m1h.momentum_combo_1h_pct ?? j1h?.hourly?.overall1h?.score ?? "—";
  const vol1h   = m1h.volatility_1h_scaled ?? m1h.volatility_1h_pct ?? "—";
  const sqz1h   = m1h.squeeze_1h_pct ?? "—";
  const vsent1h = m1h.volume_sentiment_1h ?? "—";

  // EOD metrics
  const tstr1d  = md.daily_trend_pct ?? "—";
  const vol1d   = md.volatility_pct ?? "—";
  const sqz1d   = md.squeeze_daily_pct ?? "—";
  const vsent1d = md.volume_sentiment_daily ?? "—";

  // Layout
  const header  = { display: "inline-flex", alignItems: "center", gap: 10, flexWrap: "wrap", maxWidth: "100%" };
  const body    = { display: "flex", flexDirection: "column", gap: 8, marginTop: 8 };
  const rowWrap = { display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap", maxWidth: "100%" };
  const tsChip  = { fontSize: 12, opacity: .75, background:"#0b1220", border:"1px solid var(--border)", borderRadius:999, padding:"2px 8px" };

  // Panels Row (3 big cards, same height)
  const panelsRow = {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(240px, 1fr))",
    gap: 12,
    alignItems: "stretch",
    marginTop: 8,
  };

  return (
    <section id="row-3" className="panel">
      {/* Header (AZ timestamps) */}
      <div className="panel-head" style={header}>
        <span className="panel-title">Engine Lights</span>
        <button className="btn btn-xs" title="Legend">Legend</button>
        {ts10 ? <span style={tsChip}>10m: {fmtAZ(ts10)}</span> : null}
        {ts1h ? <span style={tsChip}>1h: {fmtAZ(ts1h)}</span>   : null}
        {ts1d ? <span style={tsChip}>EOD: {fmtAZ(ts1d)}</span>  : null}
      </div>

      {/* Two pill rows (left-locked) */}
      <div className="eng-body" style={body}>
        <div className="eng-row" style={rowWrap}>
          {P10.map(def => {
            const sig   = getSig(s10, def.k);
            const state = safeStr(sig.state || derive10mState(def.k, j10, lux10) || "neutral");
            const recent= Boolean(sig.recentCross);
            return <Pill key={def.k} label={def.label} state={state} recentCross={recent} />;
          })}
        </div>

        <div className="eng-row" style={rowWrap}>
          {P1H.map(def => {
            const sig   = getSig(s1h, def.k);
            const state = safeStr(sig.state || derive1hState(def.k, j1h, lux1h) || "neutral");
            const recent= Boolean(sig.recentCross);
            return <Pill key={def.k} label={def.label} state={state} recentCross={recent} />;
          })}
        </div>

        {/* Three bigger Lux panels — fill remaining height, no stretch sidewise */}
        <div style={panelsRow}>
          <LuxTrendPanel
            title="Lux 10m"
            state={lux10.state} reason={lux10.reason} updatedAt={fmtAZ(lux10.updatedAt)}
            trendStrength={tstr10} volatility={vol10} squeeze={sqz10} volumeSentiment={vsent10}
          />
          <LuxTrendPanel
            title="Lux 1h"
            state={lux1h.state} reason={lux1h.reason} updatedAt={fmtAZ(lux1h.updatedAt)}
            trendStrength={tstr1h} volatility={vol1h} squeeze={sqz1h} volumeSentiment={vsent1h}
          />
          <LuxTrendPanel
            title="Lux EOD"
            state={luxEOD.state} reason={luxEOD.reason} updatedAt={fmtAZ(luxEOD.updatedAt)}
            trendStrength={tstr1d} volatility={vol1d} squeeze={sqz1d} volumeSentiment={vsent1d}
          />
        </div>
      </div>
    </section>
  );
}
