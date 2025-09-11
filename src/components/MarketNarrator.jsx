// src/components/MarketNarrator.jsx
import React, { useEffect, useMemo, useState } from "react";

// FINAL CANONICAL BACKEND
const API = "https://frye-market-backend-1.onrender.com";

/* helpers */
const clamp01 = (n) => Math.max(0, Math.min(100, Number(n)));
const pct = (n) => (Number.isFinite(n) ? n.toFixed(1) + "%" : "—");
const fmtDate = (d) => new Date(d).toLocaleDateString(undefined, { month:"short", day:"numeric" });

function sectorTotals(sectors) {
  const keys = Object.keys(sectors || {});
  return keys.reduce((acc, k) => {
    const v = sectors[k] || {};
    acc.nh += Number(v?.nh || 0);
    acc.nl += Number(v?.nl || 0);
    acc.u  += Number(v?.up || v?.u || 0);
    acc.d  += Number(v?.down || v?.d || 0);
    return acc;
  }, { nh:0, nl:0, u:0, d:0 });
}

function indicatorsLine(dash) {
  const gg = dash?.gauges || {};
  const od = dash?.odometers || {};
  const breadth   = Number(dash?.summary?.breadthIdx ?? gg?.rpm?.pct ?? 50);
  const momentum  = Number(dash?.summary?.momentumIdx ?? gg?.speed?.pct ?? 50);
  const squeezeIn = Number(od?.squeezeCompressionPct ?? gg?.fuel?.pct ?? 50);
  const squeezeDy = Number(gg?.squeezeDaily?.pct ?? NaN);
  const liqPsi    = Number(gg?.oil?.psi ?? gg?.oilPsi ?? NaN);
  const vol       = Number(gg?.volatilityPct ?? gg?.water?.pct ?? NaN);

  const expansion = 100 - clamp01(squeezeIn);
  const baseMeter = 0.4 * breadth + 0.4 * momentum + 0.2 * expansion;
  const Sdy       = Number.isFinite(squeezeDy) ? clamp01(squeezeDy)/100 : 0;
  const overall   = Math.round((1 - Sdy) * baseMeter + Sdy * 50);

  const parts = [
    `Breadth ${pct(breadth)}`,
    `Momentum ${pct(momentum)}`,
    `Intraday squeeze ${pct(squeezeIn)} (expansion ${pct(expansion)})`,
    Number.isFinite(squeezeDy) ? `Daily squeeze ${pct(squeezeDy)}` : null,
    Number.isFinite(liqPsi)    ? `Liquidity ${liqPsi.toFixed(0)} PSI` : null,
    Number.isFinite(vol)       ? `Volatility ${pct(vol)}` : null,
    `Overall meter ${pct(overall)}`
  ].filter(Boolean);
  return parts.join(" · ");
}

function buildNowScript(scope, dash, sectorKey) {
  const sectors = dash?.outlook?.sectors || {};
  const inScope = sectorKey && sectors[sectorKey] ? { [sectorKey]: sectors[sectorKey] } : sectors;
  const t = sectorTotals(inScope);
  const ind = indicatorsLine(dash);
  return [
    `Here’s the current ${scope} market status.`,
    ind + ".",
    `Right now we have ${t.nh} new highs vs ${t.nl} new lows, and ADR up ${t.u} vs down ${t.d}.`
  ].join(" ");
}

function buildOneDayRecap(scope, dash, outlook5) {
  const last = Array.isArray(outlook5?.rows) && outlook5.rows.length ? outlook5.rows.slice(-1)[0] : null;
  const ind  = indicatorsLine(dash);
  if (!last) return [`Here’s the ${scope} one-day recap.`, ind + "."].join(" ");
  return [
    `Here’s the ${scope} one-day recap (${fmtDate(last.date)}).`,
    ind + ".",
    `We recorded ${last.nh} new highs vs ${last.nl} new lows, ADR up ${last.u} vs down ${last.d}.`
  ].join(" ");
}

function buildFiveDayTrend(scope, outlook5) {
  const rows = Array.isArray(outlook5?.rows) ? outlook5.rows : [];
  if (rows.length < 5) return "Not enough data for a 5-day trend.";
  const seg = rows.map(r => ({ ...r, label: fmtDate(r.date) }));
  const early = seg.slice(0,2), mid = seg.slice(2,3), late = seg.slice(3);
  const avg = a => a.length ? a.reduce((x,y)=>x+y,0)/a.length : 0;
  const br  = xs => avg(xs.map(d => d.nh/Math.max(1,d.nl)));
  const vr  = xs => avg(xs.map(d => d.u /Math.max(1,d.d )));
  const word = (x,lo,hi,a,b,c)=> x>=hi?a: x<=lo?b:c;

  const bE = word(br(early),0.85,1.15,"bullish","bearish","neutral");
  const bM = word(br(mid),  0.85,1.15,"bullish","bearish","neutral");
  const bL = word(br(late), 0.85,1.15,"bullish","bearish","neutral");
  const vE = word(vr(early),0.9,1.1,"expanding","contracting","mixed");
  const vM = word(vr(mid),  0.9,1.1,"expanding","contracting","mixed");
  const vL = word(vr(late), 0.9,1.1,"expanding","contracting","mixed");
  const t  = seg[seg.length-1];

  const guidance =
    vL==="contracting" && bL!=="bearish" ? "Net effect: grind-up — watch for expansion to power stronger moves." :
    vL==="expanding" && bL==="bullish"   ? "Net effect: constructive — breakouts have better odds." :
    vL==="expanding" && bL==="bearish"   ? "Net effect: risk-off with wider ranges — manage downside and size." :
                                           "Net effect: mixed tape — expect chop until volatility picks a side.";

  return [
    `Here’s your ${scope} 5-day trend.`,
    `${seg[0].label} to ${seg[1].label}: breadth was ${bE}, volatility ${vE}.`,
    `${seg[2].label}: breadth turned ${bM}, volatility ${vM}.`,
    `${seg[3].label} to ${seg[4].label}: breadth stayed ${bL}, volatility ${vL}.`,
    `Most recent session: ${t.nh} new highs vs ${t.nl} new lows; ADR up ${t.u} vs down ${t.d}.`,
    guidance
  ].join(" ");
}

export default function MarketNarrator() {
  const [dash, setDash] = useState(null);
  const [five, setFive] = useState(null);
  const [speaking, setSpeaking] = useState(false);
  const [scope, setScope]   = useState("All Market");
  const [mode, setMode]     = useState("now");
  const [sectorKey, setSectorKey] = useState("");

  useEffect(() => {
    fetch(`${API}/api/dashboard`, { cache:"no-store" }).then(r=>r.json()).then(setDash).catch(()=>setDash(null));
    fetch(`${API}/api/outlook5d`, { cache:"no-store" }).then(r=>r.json()).then(setFive).catch(()=>setFive(null));
  }, []);

  const sectorOptions = useMemo(() => {
    const cards = dash?.outlook?.sectorCards || dash?.sectorCards || [];
    return cards.map(c => c?.sector).filter(Boolean);
  }, [dash]);

  const script = useMemo(() => {
    if (!dash) return "Loading indicators…";
    if (mode === "now") {
      const key = sectorKey && sectorOptions.includes(sectorKey) ? sectorKey.toLowerCase() : "";
      const text = buildNowScript(scope, dash, key);
      return text;
    }
    if (mode === "1d") return buildOneDayRecap(scope, dash, five);
    return buildFiveDayTrend(scope, five);
  }, [mode, scope, dash, five, sectorKey, sectorOptions]);

  const speak = () => {
    if (!("speechSynthesis" in window)) { alert("Speech not supported."); return; }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(script);
    u.rate = 1.05; u.pitch = 1.0;
    const v = window.speechSynthesis.getVoices()
      .find(v => /Google US English|Samantha|Microsoft (Aria|Zira)/i.test(v.name));
    if (v) u.voice = v;
    u.onend = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(u);
  };

  return (
    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
      <select value={scope} onChange={e=>setScope(e.target.value)} className="px-2 py-1 rounded border">
        <option>All Market</option>
        <option>Technology</option>
        <option>Materials</option>
        <option>Healthcare</option>
        <option>Communication Services</option>
        <option>Real Estate</option>
        <option>Energy</option>
        <option>Consumer Staples</option>
        <option>Consumer Discretionary</option>
        <option>Financials</option>
        <option>Utilities</option>
        <option>Industrials</option>
      </select>

      {mode === "now" && (
        <select value={sectorKey} onChange={e=>setSectorKey(e.target.value)} className="px-2 py-1 rounded border">
          <option value="">All Sectors</option>
          {sectorOptions.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      )}

      <select value={mode} onChange={e=>setMode(e.target.value)} className="px-2 py-1 rounded border">
        <option value="now">Current status</option>
        <option value="1d">1-day recap</option>
        <option value="5d">5-day trend</option>
      </select>

      {!speaking
        ? <button onClick={speak} className="px-3 py-1 rounded bg-black text-white">🔊 Explain</button>
        : <button onClick={()=>{ window.speechSynthesis.cancel(); setSpeaking(false); }} className="px-3 py-1 rounded bg-gray-200">⏹ Stop</button>}
    </div>
  );
}
