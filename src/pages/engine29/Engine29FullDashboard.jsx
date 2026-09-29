import React, { useEffect, useState } from "react";

// Engine 29 — Presentation V1
// Full presentation rewrite. Backend Engine29 authority is unchanged.

const API_BASE =
  (typeof window !== "undefined" && (window.__API_BASE__ || "")) ||
  process.env.REACT_APP_API_BASE ||
  process.env.VITE_TRADING_API_BASE ||
  "https://frye-market-backend-1.onrender.com";

const API_ROOT = API_BASE.replace(/\/+$/, "").replace(/\/api$/, "");
const ROUTE = API_ROOT + "/api/v1/engine29/cross-market-stress";
const UPDATE_ROUTE = API_ROOT + "/api/v1/engine29/dashboard-refresh";
const READ_POLL_MS = 15_000;
const LIVE_REBUILD_MS = 10 * 60_000;
const FONT = "Arial, Helvetica, sans-serif";

const COLORS = {
  bg: "#020817", panel: "#0b1426", border: "#26364f", text: "#e2e8f0",
  muted: "#7f91aa", blue: "#60a5fa", green: "#22c55e", yellow: "#fbbf24",
  orange: "#f97316", red: "#ef4444"
};

function clean(value) {
  if (value === null || value === undefined || value === "") return "—";
  return String(value).replaceAll("_", " ");
}

function pct(value, digits = 1) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  const scaled = Math.abs(n) <= 1 ? n * 100 : n;
  return scaled.toFixed(digits) + "%";
}

function stateColor(value) {
  const s = String(value || "").toUpperCase();
  if (/HEALTHY|CONFIRMED|SUPPORTS|RECLAIM|POSITIVE|RECOVER/.test(s)) return COLORS.green;
  if (/SEVERE|BREAK|DETERIOR|NEGATIVE|OPPOSES|FAILED|INVALID/.test(s)) return COLORS.red;
  if (/STRESS|WEAK|PRESSURE|CAUTION|WATCH|FORMING|RISING/.test(s)) return COLORS.orange;
  if (/MIXED|STABIL|NEUTRAL|MONITOR|PARTIAL|TEST|SWEEP/.test(s)) return COLORS.yellow;
  return COLORS.blue;
}

function Card({ children, style = {} }) {
  return <div style={{
    background: "linear-gradient(180deg, rgba(15,26,47,.98), rgba(7,16,32,.98))",
    border: "1px solid " + COLORS.border, borderRadius: 10, padding: 12,
    boxShadow: "0 10px 24px rgba(0,0,0,.16)", ...style
  }}>{children}</div>;
}

function SectionTitle({ children, color = COLORS.blue }) {
  return <div style={{ color, fontSize: 12, fontWeight: 950, letterSpacing: ".055em", textTransform: "uppercase" }}>{children}</div>;
}

function KV({ label, value, valueColor }) {
  return <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
    <span style={{ color: COLORS.muted, fontSize: 12 }}>{label}</span>
    <strong style={{ color: valueColor || stateColor(value), fontSize: 12, textAlign: "right" }}>{clean(value)}</strong>
  </div>;
}

function HeadlineCard({ label, value, summary }) {
  const color = stateColor(value);
  return <Card style={{ borderColor: color + "88", minHeight: 86 }}>
    <div style={{ color: COLORS.muted, fontSize: 10, fontWeight: 900 }}>{label}</div>
    <div style={{ marginTop: 7, color, fontSize: 21, fontWeight: 950, lineHeight: 1.05 }}>{clean(value)}</div>
    <div style={{ marginTop: 7, color: "#b9c7da", fontSize: 11 }}>{summary || "—"}</div>
  </Card>;
}

function LiveMonitor({ data, display }) {
  const live = data?.liveMonitor || {};
  const metrics = live?.metrics || {};
  const why = Array.isArray(display?.liveMonitor?.why) ? display.liveMonitor.why : [];
  const measurements = [
    ["Headline 10m", metrics?.headline?.move10], ["Headline 20m", metrics?.headline?.move20],
    ["Breadth 10m", metrics?.breadth?.move10], ["Breadth 20m", metrics?.breadth?.move20],
    ["Leadership 10m", metrics?.leadership?.move10], ["Credit 10m", metrics?.credit?.move10],
    ["Financials 10m", metrics?.financials?.move10], ["VIX 10m", metrics?.vix?.move10]
  ];

  return <Card style={{ borderColor: stateColor(live?.state) + "88" }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
      <SectionTitle color={stateColor(live?.state)}>10m Live Monitor · 20m Persistence</SectionTitle>
      <span style={{ color: COLORS.muted, fontSize: 10 }}>DIAGNOSTIC ONLY</span>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr 1.25fr", gap: 14, marginTop: 10 }}>
      <div>
        <div style={{ color: stateColor(live?.state), fontSize: 20, fontWeight: 950 }}>{clean(live?.state)}</div>
        <div style={{ display: "grid", gap: 5, marginTop: 9 }}>
          <KV label="Participation" value={live?.participation} />
          <KV label="10m direction" value={live?.direction} />
          <KV label="30m context" value={live?.fastTacticalContext?.state} />
          <KV label="Authority" value={live?.authority} />
        </div>
      </div>
      <div>
        <SectionTitle>Live Measurements</SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 7 }}>
          {measurements.map(([label, value]) => <div key={label} style={{ border: "1px solid rgba(148,163,184,.14)", borderRadius: 7, padding: "7px 8px" }}>
            <div style={{ color: COLORS.muted, fontSize: 9, fontWeight: 850 }}>{label}</div>
            <div style={{ marginTop: 3, color: Number(value) >= 0 ? COLORS.green : COLORS.red, fontWeight: 900 }}>{pct(value, 2)}</div>
          </div>)}
        </div>
      </div>
      <div>
        <SectionTitle>Why This State?</SectionTitle>
        <div style={{ display: "grid", gap: 5, marginTop: 7 }}>
          {why.length ? why.map((item, index) => <div key={index} style={{ color: "#cbd5e1", fontSize: 11, lineHeight: 1.35 }}>• {item}</div>)
            : <div style={{ color: COLORS.muted, fontSize: 11 }}>{display?.liveMonitor?.summary || "No live explanation published."}</div>}
        </div>
      </div>
    </div>
  </Card>;
}

function MarketCharacterCards({ data }) {
  const liquidity = data?.marketCharacter?.liquidity || {};
  const move = data?.marketCharacter?.move || {};
  const trap = data?.marketCharacter?.trap || {};
  const auction = data?.trapDetection?.auctionEvent || {};
  const momentum = data?.trapDetection?.momentumRepair || {};
  const primary = data?.trapDetection?.participation?.primary || {};
  const secondary = data?.trapDetection?.participation?.secondary || {};
  const pressure = data?.moveCharacter?.underlyingPressure || {};
  const level = liquidity?.level || auction?.liquidityLevel || {};
  const sweep = liquidity?.sweep || auction?.sweep || {};
  const blockers = Array.isArray(trap?.confirmationBlockedBy) ? trap.confirmationBlockedBy : [];

  const primaryRead = primary?.available === false ? "UNAVAILABLE"
    : primary?.primaryParticipationSupportsTrap ? "SUPPORTS"
    : primary?.primaryParticipationOpposesTrap ? "OPPOSES"
    : primary?.available ? "NEUTRAL" : "UNAVAILABLE";
  const secondaryRead = secondary?.secondarySupportsTrap ? "SUPPORTS"
    : secondary?.secondaryOpposesTrap ? "OPPOSES"
    : secondary?.trapSide ? "NEUTRAL" : "—";

  const cards = [
    ["Liquidity", "LEVELS · SWEEPS · RECLAIMS", liquidity?.state || "NO_LIQUIDITY_EVENT", [
      ["Level", level?.boundary ?? level?.level], ["Type", level?.type],
      ["Significance", auction?.liquidityLevel?.significance], ["Auction", liquidity?.auctionResult],
      ["Excursion", sweep?.excursionPoints != null ? sweep.excursionPoints + " pts" : null],
      ["Reclaimed", liquidity?.reclaimObserved === true ? "YES" : liquidity?.reclaimObserved === false ? "NO" : null]
    ]],
    ["Move / Squeeze", "30M AUTHORITY · 10M TRANSITION", move?.moveCharacter || "NO_ACTIVE_MOVE", [
      ["30m direction", move?.direction], ["10m transition", move?.fastState || data?.liveMonitor?.state],
      ["10m direction", move?.liveDirection || data?.liveMonitor?.direction],
      ["20m persistence", data?.liveMonitor?.persistenceWindow],
      ["Participation", move?.participation || data?.liveMonitor?.participation], ["Pressure", pressure?.state]
    ]],
    ["Trap Detection", "FAILED AUCTIONS · FALSE BREAKS", trap?.state || "NO_ACTIVE_TRAP", [
      ["Side", trap?.side || "NONE"], ["Location", trap?.locationQuality],
      ["30m failed hold", auction?.acceptance30m?.failedHold === true ? "YES" : auction?.acceptance30m?.failedHold === false ? "NO" : null],
      ["Momentum repair", momentum?.state], ["E25 participation", primaryRead], ["E29 confirmation", secondaryRead]
    ]]
  ];

  return <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(280px, 1fr))", gap: 10 }}>
    {cards.map(([title, kicker, state, rows]) => {
      const color = stateColor(state);
      return <Card key={title} style={{ borderColor: color + "88" }}>
        <div style={{ color: COLORS.muted, fontSize: 9, fontWeight: 900 }}>{kicker}</div>
        <div style={{ marginTop: 4, color: COLORS.text, fontSize: 15, fontWeight: 950, textTransform: "uppercase" }}>{title}</div>
        <div style={{ margin: "8px 0", color, fontSize: 21, fontWeight: 950 }}>{clean(state)}</div>
        <div style={{ display: "grid", gap: 5 }}>{rows.map(([label, value]) => <KV key={label} label={label} value={value} />)}</div>
        {title === "Trap Detection" && blockers.length ? <div style={{ borderTop: "1px solid rgba(148,163,184,.14)", marginTop: 9, paddingTop: 8 }}>
          <SectionTitle color={COLORS.yellow}>Trap Still Needs</SectionTitle>
          {blockers.slice(0, 4).map(item => <div key={item} style={{ color: "#cbd5e1", fontSize: 10, marginTop: 4 }}>○ {clean(item)}</div>)}
        </div> : null}
      </Card>;
    })}
  </div>;
}

/*__COMPONENTS_A__*/
function MarketInternalsMap({ groups, display }) {
  const hood = display?.underTheHood || {};
  const rows = [
    ["Large Indexes", "headlineIndex", hood?.largeIndexes], ["Breadth", "breadth", hood?.breadth],
    ["Leadership", "leadership", hood?.techLeadership], ["Credit", "credit", hood?.credit],
    ["Rates", "ratesDuration", hood?.ratesBonds], ["Energy", "energyInflation", hood?.oil],
    ["Volatility", "volatility", hood?.volatility], ["Financials", "financialConditions", hood?.financialConditions]
  ];
  return <Card>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
      <SectionTitle>Market Internals Map</SectionTitle>
      <span style={{ color: COLORS.muted, fontSize: 10 }}>STATE · 1W · 1H · 30M</span>
    </div>
    <div style={{ marginTop: 8, overflowX: "auto" }}><div style={{ minWidth: 760 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1.35fr 1.2fr repeat(3,1fr)", gap: 8, padding: "6px 8px", color: COLORS.muted, fontSize: 9, fontWeight: 900 }}>
        <span>INTERNAL</span><span>STATE</span><span>1W</span><span>1H</span><span>30M</span>
      </div>
      {rows.map(([label, key, displayState]) => {
        const group = groups?.[key] || {};
        const structural = group?.structural?.state, tactical = group?.tactical?.state, fast = group?.fastTactical?.state;
        const state = displayState || structural || tactical || fast || "—";
        return <div key={label} style={{ display: "grid", gridTemplateColumns: "1.35fr 1.2fr repeat(3,1fr)", gap: 8, padding: 8, borderTop: "1px solid #17243a", fontSize: 11 }}>
          <strong style={{ color: COLORS.text }}>{label}</strong><strong style={{ color: stateColor(state) }}>{clean(state)}</strong>
          <span style={{ color: stateColor(structural) }}>{clean(structural)}</span>
          <span style={{ color: stateColor(tactical) }}>{clean(tactical)}</span>
          <span style={{ color: stateColor(fast) }}>{clean(fast)}</span>
        </div>;
      })}
    </div></div>
  </Card>;
}

function DivergencesAndParticipation({ data, groups }) {
  const primary = data?.trapDetection?.participation?.primary || {};
  const breadth = primary?.breadth || {}, volume = primary?.stockVolume || {}, intraday = volume?.intraday || {};
  const gs = key => groups?.[key]?.fastTactical?.state || groups?.[key]?.tactical?.state || groups?.[key]?.structural?.state || null;
  const headline = gs("headlineIndex"), breadth29 = gs("breadth"), leadership = gs("leadership"), credit = gs("credit");
  const weak = /BREAK|SEVERE|WEAK|DETERIOR|STRESS/i, strong = /HEALTHY|RECOVER|SUPPORT/i;
  const divergences = [];
  if (strong.test(String(leadership || "")) && weak.test(String(breadth29 || ""))) divergences.push(["Leadership vs Breadth", leadership, breadth29]);
  if (headline && breadth29 && headline !== breadth29) divergences.push(["Indexes vs Breadth", headline, breadth29]);
  if (headline && credit && strong.test(String(headline)) && weak.test(String(credit))) divergences.push(["Price vs Credit", headline, credit]);
  const trapEffect = primary?.primaryParticipationSupportsTrap ? "SUPPORTS" : primary?.primaryParticipationOpposesTrap ? "OPPOSES" : primary?.available ? "NEUTRAL" : "UNAVAILABLE";

  return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
    <Card>
      <SectionTitle color={COLORS.yellow}>Important Divergences</SectionTitle>
      {divergences.length ? divergences.map(([title, left, right]) => <div key={title} style={{ marginTop: 7, padding: 8, border: "1px solid rgba(245,158,11,.28)", borderRadius: 7 }}>
        <strong style={{ color: COLORS.text, fontSize: 12 }}>{title}</strong>
        <div style={{ color: COLORS.muted, fontSize: 10, marginTop: 3 }}>{clean(left)} · {clean(right)}</div>
      </div>) : <div style={{ color: COLORS.muted, fontSize: 11, marginTop: 8 }}>No major presentation-level divergence detected.</div>}
    </Card>
    <Card>
      <SectionTitle>Engine 25 Participation</SectionTitle>
      <div style={{ color: COLORS.muted, fontSize: 9, marginTop: 3 }}>{primary?.authority || "ENGINE25 SCANNER PRIMARY READ ONLY"}</div>
      <div style={{ display: "grid", gap: 5, marginTop: 8 }}>
        <KV label="Breadth" value={breadth?.label} /><KV label="Distribution" value={volume?.distributionLabel} />
        <KV label="Coverage" value={pct(intraday?.coveragePct)} /><KV label="Advancing volume" value={pct(intraday?.advancingVolumeShare)} />
        <KV label="Declining volume" value={pct(intraday?.decliningVolumeShare)} /><KV label="Volume imbalance" value={pct(intraday?.volumeImbalance)} />
        <KV label="Breadth alignment" value={primary?.breadthAlignment} /><KV label="Volume alignment" value={primary?.volumeAlignment} />
        <KV label="Trap effect" value={trapEffect} />
      </div>
    </Card>
  </div>;
}

function RawEvidence({ groups, data }) {
  const rows = [
    ["Large Indexes", groups?.headlineIndex], ["Breadth", groups?.breadth], ["Tech Leadership", groups?.leadership],
    ["Credit", groups?.credit], ["Rates / Bonds", groups?.ratesDuration], ["Oil / Energy", groups?.energyInflation],
    ["Volatility", groups?.volatility], ["Financial Conditions", groups?.financialConditions]
  ];
  return <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(220px,1fr))", gap: 8 }}>
    {rows.map(([name, group]) => <Card key={name}>
      <SectionTitle>{name}</SectionTitle>
      <div style={{ display: "grid", gap: 5, marginTop: 8 }}>
        <KV label="1W" value={group?.structural?.state} /><KV label="1H" value={group?.tactical?.state} /><KV label="30m" value={group?.fastTactical?.state} />
        {(group?.members || []).slice(0, 8).map(member => <KV key={member?.symbol || member?.name} label={member?.symbol || member?.name} value={member?.state || member?.status} />)}
      </div>
    </Card>)}
    <Card><SectionTitle>Underlying Pressure</SectionTitle><div style={{ marginTop: 8 }}><KV label="State" value={data?.moveCharacter?.underlyingPressure?.state} /></div></Card>
  </div>;
}

/*__COMPONENTS_B__*/
function Takeaways({ data, display }) {
  const general = data?.missingConfirmations || display?.missingConfirmation || [];
  const trapBlockers = data?.marketCharacter?.trap?.confirmationBlockedBy || [];
  return <div style={{ display: "grid", gridTemplateColumns: "1.3fr .7fr", gap: 10 }}>
    <Card>
      <SectionTitle>Key Takeaways</SectionTitle>
      <div style={{ display: "grid", gap: 5, marginTop: 8 }}>
        <KV label="Regime" value={data?.overallState} /><KV label="1H current" value={data?.tacticalState} />
        <KV label="30m fast" value={data?.fastTacticalState} /><KV label="Liquidity" value={data?.marketCharacter?.liquidity?.state} />
        <KV label="Move" value={data?.marketCharacter?.move?.moveCharacter} /><KV label="Trap" value={data?.marketCharacter?.trap?.state} />
      </div>
      <div style={{ color: "#cbd5e1", fontSize: 11, lineHeight: 1.4, marginTop: 9 }}>{display?.overallSummary || "—"}</div>
    </Card>
    <Card>
      <SectionTitle color={COLORS.yellow}>Missing Confirmation</SectionTitle>
      <div style={{ color: COLORS.muted, fontSize: 9, marginTop: 3 }}>GENERAL CROSS-MARKET</div>
      {general.length ? general.map(item => <div key={item} style={{ color: COLORS.yellow, fontSize: 10, marginTop: 5 }}>○ {clean(item)}</div>)
        : <div style={{ color: COLORS.green, fontSize: 11, marginTop: 7 }}>✓ None</div>}
      {trapBlockers.length ? <div style={{ borderTop: "1px solid #26364f", marginTop: 9, paddingTop: 8 }}>
        <div style={{ color: COLORS.muted, fontSize: 9 }}>TRAP STILL NEEDS</div>
        {trapBlockers.map(item => <div key={item} style={{ color: COLORS.orange, fontSize: 10, marginTop: 5 }}>○ {clean(item)}</div>)}
      </div> : null}
    </Card>
  </div>;
}

/*__COMPONENTS_C__*/
export default function Engine29FullDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [rebuildStatus, setRebuildStatus] = useState("IDLE");
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let rebuildInFlight = false;

    async function load() {
      try {
        const response = await fetch(ROUTE, { cache: "no-store" });
        if (!response.ok) throw new Error("HTTP " + response.status);
        const json = await response.json();
        if (!cancelled) { setData(json); setError(null); }
      } catch (err) {
        if (!cancelled) setError(err?.message || String(err));
      }
    }

    async function rebuild() {
      if (rebuildInFlight) return;
      rebuildInFlight = true;
      if (!cancelled) setRebuildStatus("RUNNING");
      try {
        const response = await fetch(UPDATE_ROUTE, { method: "POST", cache: "no-store" });
        if (!response.ok) throw new Error("HTTP " + response.status);
        if (!cancelled) setRebuildStatus("SUCCESS");
        await load();
      } catch (err) {
        if (!cancelled) setRebuildStatus("ERROR");
      } finally {
        rebuildInFlight = false;
      }
    }

    load();
    const readTimer = setInterval(load, READ_POLL_MS);
    const rebuildTimer = setInterval(rebuild, LIVE_REBUILD_MS);
    return () => { cancelled = true; clearInterval(readTimer); clearInterval(rebuildTimer); };
  }, []);

  const d = data?.data || data || {};
  const display = d?.display || {};
  const groups = d?.groups || {};
  const top = {
    oneWeek: display?.oneWeek?.state || d?.overallState,
    oneHour: display?.oneHour?.state || d?.tacticalState,
    thirtyMinute: display?.thirtyMinute?.state || d?.fastTacticalState,
    esMove: display?.esMove?.state || d?.moveCharacter?.moveCharacter || d?.marketCharacter?.move?.moveCharacter,
  };

  return <div style={{ minHeight: "100vh", background: COLORS.bg, color: COLORS.text, fontFamily: FONT, padding: "18px 20px 28px" }}>
    <div style={{ maxWidth: 1500, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 950, letterSpacing: ".02em" }}>ENGINE 29 — CROSS-MARKET STRESS</div>
          <div style={{ color: COLORS.muted, fontSize: 11, marginTop: 3 }}>Bigger picture · Intraday condition · 30m fast shift · 10m transition · ES squeeze / liquidity / trap read</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ color: rebuildStatus === "ERROR" ? COLORS.red : COLORS.green, fontSize: 10, fontWeight: 900 }}>● {rebuildStatus === "ERROR" ? "REBUILD ERROR" : "LIVE BUILD READY"}</span>
          <button onClick={() => window.history.back()} style={{ background: "#111c2e", color: COLORS.text, border: "1px solid #334155", borderRadius: 6, padding: "7px 11px", cursor: "pointer", fontWeight: 800 }}>Close</button>
        </div>
      </div>

      {error ? <Card style={{ borderColor: COLORS.red, marginBottom: 10 }}><strong style={{ color: COLORS.red }}>Engine29 read error:</strong> {error}</Card> : null}

      {!data ? <Card>Loading Engine 29...</Card> : <div style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
          <HeadlineCard label="1W BIGGER PICTURE" value={top.oneWeek} summary={display?.oneWeek?.summary} />
          <HeadlineCard label="1H INTRADAY" value={top.oneHour} summary={display?.oneHour?.summary} />
          <HeadlineCard label="30M FAST SHIFT" value={top.thirtyMinute} summary={display?.thirtyMinute?.summary} />
          <HeadlineCard label="ES MOVE" value={top.esMove} summary={display?.esMove?.summary} />
        </div>

        <LiveMonitor data={d} display={display} />
        <MarketCharacterCards data={d} />
        <MarketInternalsMap groups={groups} display={display} />
        <DivergencesAndParticipation data={d} groups={groups} />
        <Takeaways data={d} display={display} />

        <Card style={{ padding: 10 }}>
          <button onClick={() => setShowRaw(v => !v)} style={{ width: "100%", border: 0, background: "transparent", color: COLORS.text, cursor: "pointer", display: "flex", justifyContent: "space-between", fontFamily: FONT, fontWeight: 950 }}>
            <span>SHOW RAW EVIDENCE</span><span style={{ color: COLORS.blue }}>{showRaw ? "HIDE ▲" : "OPEN ▼"}</span>
          </button>
        </Card>
        {showRaw ? <RawEvidence groups={groups} data={d} /> : null}
      </div>}
    </div>
  </div>;
}
