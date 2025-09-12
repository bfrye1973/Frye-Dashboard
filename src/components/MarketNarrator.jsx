// src/components/MarketNarrator.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";

// Canonical backend (keep -1)
const API = "https://frye-market-backend-1.onrender.com";

/* ---------- helpers ---------- */
const clamp01 = (n) => Math.max(0, Math.min(100, Number(n)));
const pct = (n) => (Number.isFinite(n) ? n.toFixed(1) + "%" : "—");
const fmtDate = (d) =>
  new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });

function sectorTotals(sectors) {
  const keys = Object.keys(sectors || {});
  return keys.reduce(
    (acc, k) => {
      const v = sectors[k] || {};
      acc.nh += Number(v?.nh || 0);
      acc.nl += Number(v?.nl || 0);
      acc.u += Number(v?.up || v?.u || 0);
      acc.d += Number(v?.down || v?.d || 0);
      return acc;
    },
    { nh: 0, nl: 0, u: 0, d: 0 }
  );
}

function pickLeadersLaggards(cards, limit = 2) {
  const arr = Array.isArray(cards) ? cards.slice() : [];
  // Prefer deltaPct/pct/changePct aliases
  const val = (c) =>
    Number.isFinite(c?.deltaPct)
      ? c.deltaPct
      : Number.isFinite(c?.pct)
      ? c.pct
      : Number.isFinite(c?.changePct)
      ? c.changePct
      : 0;
  arr.sort((a, b) => val(b) - val(a));
  const leaders = arr.slice(0, limit).map((c) => c.sector);
  const laggards = arr.slice(-1).map((c) => c.sector); // top 2 / worst 1
  return { leaders, laggards };
}

/* ---------- narrative building ---------- */
function indicatorsLine(dash) {
  const gg = dash?.gauges || {};
  const od = dash?.odometers || {};
  const breadth = Number(dash?.summary?.breadthIdx ?? gg?.rpm?.pct ?? 50);
  const momentum = Number(dash?.summary?.momentumIdx ?? gg?.speed?.pct ?? 50);
  const squeezeIn = Number(od?.squeezeCompressionPct ?? gg?.fuel?.pct ?? 50);
  const squeezeDy = Number(gg?.squeezeDaily?.pct ?? NaN);
  const liqPsi = Number(gg?.oil?.psi ?? gg?.oilPsi ?? NaN);
  const vol = Number(gg?.volatilityPct ?? gg?.water?.pct ?? NaN);

  const expansion = 100 - clamp01(squeezeIn);
  const baseMeter = 0.4 * breadth + 0.4 * momentum + 0.2 * expansion;
  const Sdy = Number.isFinite(squeezeDy) ? clamp01(squeezeDy) / 100 : 0;
  const overall = Math.round((1 - Sdy) * baseMeter + Sdy * 50);

  const parts = [
    `Breadth ${pct(breadth)}`,
    `Momentum ${pct(momentum)}`,
    `Intraday squeeze ${pct(squeezeIn)} (expansion ${pct(expansion)})`,
    Number.isFinite(squeezeDy) ? `Daily squeeze ${pct(squeezeDy)}` : null,
    Number.isFinite(liqPsi) ? `Liquidity ${liqPsi.toFixed(0)} PSI` : null,
    Number.isFinite(vol) ? `Volatility ${pct(vol)}` : null,
    `Overall meter ${pct(overall)}`,
  ].filter(Boolean);

  return { text: parts.join(" · "), breadth, momentum, squeezeIn, squeezeDy };
}

function spyLineHeuristic({ breadth, momentum, squeezeIn }) {
  // Simple, data-driven sentence without TradingView API
  if (breadth >= 60 && momentum >= 60 && squeezeIn >= 60)
    return "SPY is consolidating near highs with energy building — bias stays up while support holds.";
  if (breadth >= 60 && momentum >= 60)
    return "SPY is holding gains above key moving averages — constructive backdrop.";
  if (breadth < 45 && momentum < 45)
    return "SPY is softening; caution if breadth deteriorates further.";
  return "SPY is range-bound; awaiting a decisive break.";
}

function buildNowScript(scope, dash, sectorKey) {
  if (!dash) return "Loading indicators…";
  const sectors = dash?.outlook?.sectors || {};
  const cards = dash?.outlook?.sectorCards || dash?.sectorCards || [];
  const inScope =
    sectorKey && sectors[sectorKey] ? { [sectorKey]: sectors[sectorKey] } : sectors;
  const t = sectorTotals(inScope);

  const ind = indicatorsLine(dash);
  const { leaders, laggards } = pickLeadersLaggards(cards);
  const spy = spyLineHeuristic(ind);

  const leadersText = leaders.length ? `Leaders: ${leaders.join(", ")}. ` : "";
  const laggardsText = laggards.length ? `Laggard: ${laggards[0]}. ` : "";

  return [
    `Current ${scope} status.`,
    `${ind.text}.`,
    `${leadersText}${laggardsText}`.trim(),
    `NH vs NL is ${t.nh} to ${t.nl}; ADR up vs down is ${t.u} to ${t.d}.`,
    spy,
  ]
    .filter(Boolean)
    .join(" ");
}

function buildOneDayRecap(scope, dash, outlook5) {
  const last = Array.isArray(outlook5?.rows) && outlook5.rows.length
    ? outlook5.rows[outlook5.rows.length - 1]
    : null;
  const ind = indicatorsLine(dash);
  const spy = spyLineHeuristic(ind);

  if (!last)
    return [`${scope} one-day recap.`, `${ind.text}.`, spy].join(" ");

  return [
    `${scope} one-day recap (${fmtDate(last.date)}).`,
    `${ind.text}.`,
    `Session totals: NH ${last.nh}, NL ${last.nl}; ADR up ${last.u}, down ${last.d}.`,
    spy,
  ].join(" ");
}

function buildFiveDayTrend(scope, outlook5) {
  const rows = Array.isArray(outlook5?.rows) ? outlook5.rows : [];
  if (rows.length < 5) return "Not enough data for a five-day trend.";

  const seg = rows.map((r) => ({ ...r, label: fmtDate(r.date) }));
  const early = seg.slice(0, 2);
  const mid = seg.slice(2, 3);
  const late = seg.slice(3);
  const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  const ratioBR = (xs) => avg(xs.map((d) => d.nh / Math.max(1, d.nl)));
  const ratioVR = (xs) => avg(xs.map((d) => d.u / Math.max(1, d.d)));

  const word = (x, lo, hi, a, b, c) => (x >= hi ? a : x <= lo ? b : c);
  const bE = word(ratioBR(early), 0.85, 1.15, "bullish", "bearish", "neutral");
  const bM = word(ratioBR(mid), 0.85, 1.15, "bullish", "bearish", "neutral");
  const bL = word(ratioBR(late), 0.85, 1.15, "bullish", "bearish", "neutral");
  const vE = word(ratioVR(early), 0.9, 1.1, "expanding", "contracting", "mixed");
  const vM = word(ratioVR(mid), 0.9, 1.1, "expanding", "contracting", "mixed");
  const vL = word(ratioVR(late), 0.9, 1.1, "expanding", "contracting", "mixed");

  const thrustNH = rows.reduce((s, r) => s + (r.nh - r.nl), 0);
  const posDays = rows.filter((r) => r.nh > r.nl).length;

  const t = seg[seg.length - 1];

  const guidance =
    vL === "contracting" && bL !== "bearish"
      ? "Net: grind-up — look for expansion to power stronger moves."
      : vL === "expanding" && bL === "bullish"
      ? "Net: constructive — breakouts have better odds."
      : vL === "expanding" && bL === "bearish"
      ? "Net: risk-off with wider ranges — manage downside and size."
      : "Net: mixed — expect chop until volatility picks a side.";

  return [
    `${scope} five-day trend.`,
    `${seg[0].label}–${seg[1].label}: breadth ${bE}, volatility ${vE}.`,
    `${seg[2].label}: breadth ${bM}, volatility ${vM}.`,
    `${seg[3].label}–${seg[4].label}: breadth ${bL}, volatility ${vL}.`,
    `Five-day thrust: ${thrustNH >= 0 ? "net positive" : "net negative"} (${thrustNH}). Positive days: ${posDays}/5.`,
    `Latest session: NH ${t.nh}, NL ${t.nl}; ADR up ${t.u}, down ${t.d}.`,
    guidance,
  ].join(" ");
}

/* ---------- journal helpers ---------- */
function loadJournal() {
  try {
    const raw = localStorage.getItem("market_journal");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
function saveJournalEntry(entry) {
  const prev = loadJournal();
  prev.push({ ...entry, ts: new Date().toISOString() });
  localStorage.setItem("market_journal", JSON.stringify(prev));
}
function downloadText(filename, text) {
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

/* ---------- main component ---------- */
export default function MarketNarrator() {
  const [dash, setDash] = useState(null);
  const [five, setFive] = useState(null);
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [scope, setScope] = useState("All Market");
  const [mode, setMode] = useState("now"); // now | 1d | 5d
  const [sectorKey, setSectorKey] = useState("");

  useEffect(() => {
    fetch(`${API}/api/dashboard`, { cache: "no-store" })
      .then((r) => r.json())
      .then(setDash)
      .catch(() => setDash(null));
    fetch(`${API}/api/outlook5d`, { cache: "no-store" })
      .then((r) => r.json())
      .then(setFive)
      .catch(() => setFive(null));
  }, []);

  const sectorOptions = useMemo(() => {
    const cards = dash?.outlook?.sectorCards || dash?.sectorCards || [];
    return cards.map((c) => c?.sector).filter(Boolean);
  }, [dash]);

  const script = useMemo(() => {
    if (!dash) return "Loading indicators…";
    if (mode === "now") {
      const key = sectorKey && sectorOptions.includes(sectorKey) ? sectorKey.toLowerCase() : "";
      return buildNowScript(scope, dash, key);
    }
    if (mode === "1d") return buildOneDayRecap(scope, dash, five);
    return buildFiveDayTrend(scope, five);
  }, [mode, scope, dash, five, sectorKey, sectorOptions]);

  // --- TTS ---
  const speak = () => {
    if (!("speechSynthesis" in window)) {
      alert("Speech not supported in this browser.");
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(script);
    u.rate = 1.05; u.pitch = 1.0;
    const v = window.speechSynthesis.getVoices()
      .find((v) => /Google US English|Samantha|Microsoft (Aria|Zira)/i.test(v.name));
    if (v) u.voice = v;
    u.onend = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(u);
  };
  const stopSpeak = () => { window.speechSynthesis.cancel(); setSpeaking(false); };

  // --- Mic commands (Web Speech API) ---
  const recogRef = useRef(null);
  useEffect(() => {
    if (!("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) return;
    const R = window.SpeechRecognition || window.webkitSpeechRecognition;
    const r = new R();
    r.lang = "en-US";
    r.continuous = false;
    r.interimResults = false;
    r.onresult = (e) => {
      const phrase = (e.results?.[0]?.[0]?.transcript || "").toLowerCase();
      if (phrase.includes("current")) setMode("now");
      else if (phrase.includes("one day") || phrase.includes("1 day")) setMode("1d");
      else if (phrase.includes("five day") || phrase.includes("5 day")) setMode("5d");
      else if (phrase.includes("explain") || phrase.includes("play")) speak();
      else if (phrase.includes("stop")) stopSpeak();
      else if (phrase.includes("save")) handleSave();
      else if (phrase.includes("download") || phrase.includes("export")) handleDownload();
      setListening(false);
    };
    r.onend = () => setListening(false);
    recogRef.current = r;
  }, []); // init once

  const startListening = () => {
    if (!recogRef.current) { alert("Voice recognition not supported in this browser."); return; }
    setListening(true);
    try { recogRef.current.start(); } catch { setListening(false); }
  };

  // --- journal / download ---
  const handleSave = () => {
    saveJournalEntry({ scope, mode, sectorKey, text: script });
    alert("Saved to Journal (local).");
  };
  const handleDownload = () => {
    const fname = `market_${mode}_${new Date().toISOString().slice(0,10)}.txt`;
    downloadText(fname, script);
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {/* scope */}
      <select value={scope} onChange={(e) => setScope(e.target.value)} className="px-2 py-1 rounded border">
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

      {/* sector (for 'now' mode only) */}
      {mode === "now" && (
        <select value={sectorKey} onChange={(e) => setSectorKey(e.target.value)} className="px-2 py-1 rounded border">
          <option value="">All Sectors</option>
          {sectorOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      )}

      {/* mode */}
      <select value={mode} onChange={(e) => setMode(e.target.value)} className="px-2 py-1 rounded border">
        <option value="now">Current status</option>
        <option value="1d">1-day recap</option>
        <option value="5d">5-day trend</option>
      </select>

      {/* actions */}
      {!speaking ? (
        <button onClick={speak} className="px-3 py-1 rounded bg-black text-white">
          🔊 Explain
        </button>
      ) : (
        <button onClick={stopSpeak} className="px-3 py-1 rounded bg-gray-200">
          ⏹ Stop
        </button>
      )}

      {!listening ? (
        <button onClick={startListening} className="px-3 py-1 rounded border">
          🎙️ Listen
        </button>
      ) : (
        <button onClick={() => { try { recogRef.current?.stop(); } catch {} setListening(false); }} className="px-3 py-1 rounded border">
          ⏹ Stop Mic
        </button>
      )}

      <button onClick={handleSave} className="px-3 py-1 rounded border">💾 Save</button>
      <button onClick={handleDownload} className="px-3 py-1 rounded border">⬇️ Download</button>

      {/* transcript (for quick read/copy) */}
      <div className="small muted" style={{ marginLeft: 12, maxWidth: 540, whiteSpace: "normal" }}>
        {script}
      </div>
    </div>
  );
}
