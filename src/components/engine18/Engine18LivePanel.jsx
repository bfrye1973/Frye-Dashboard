// Engine 18 real-time panel v1 — DISPLAY ONLY.
// Renders the engine18.live.v1 snapshot (backend PR: engine18LiveWorker.js). It never recomputes engine
// logic and never gives buy/sell instructions: confirmation and warnings only.
// Separate panel. Not wired to the LIVE chart.
import React from "react";

const C = {
  bg: "#0f1115", card: "#171a21", line: "#262b36", text: "#e6e8ee", dim: "#9aa3b2",
  buy: "#22c55e", sell: "#ef4444", warn: "#f59e0b", info: "#60a5fa", zone: "#14b8a6",
};
const toneColor = (tone) => (tone === "WARNING" ? C.warn : tone === "CONFIRMATION" ? C.buy : C.dim);
const sideColor = (side) => (side === "BUY" ? C.buy : C.sell);
const fmt = (n, d = 2) => (n == null || Number.isNaN(n) ? "–" : Number(n).toLocaleString(undefined, { maximumFractionDigits: d }));
const human = (s) => (s ? String(s).replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) : "");

function Box({ title, children, right }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: 12, marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ color: C.dim, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.6 }}>{title}</div>
        {right}
      </div>
      {children}
    </div>
  );
}

function CurrentRead({ read }) {
  const color = toneColor(read?.tone);
  return (
    <Box title="Current read" right={<span style={{ color: C.dim, fontSize: 12 }}>{read?.since ? `since ${read.since}` : ""}</span>}>
      <div style={{ borderLeft: `4px solid ${color}`, paddingLeft: 10 }}>
        <div style={{ color, fontWeight: 700, fontSize: 13 }}>
          {read?.tone === "WARNING" ? "⚠️ WARNING" : read?.tone === "CONFIRMATION" ? "✅ CONFIRMATION" : "No signal"}
          {read?.side ? ` · ${human(read.side)}` : ""}
        </div>
        <div style={{ color: C.text, fontSize: 16, marginTop: 4 }} data-testid="current-read-line">{read?.line}</div>
      </div>
      {read?.activeReads?.length > 0 && (
        <ul style={{ margin: "10px 0 0", paddingLeft: 18, color: C.dim, fontSize: 12 }}>
          {read.activeReads.map((r, i) => (
            <li key={i}><span style={{ color: toneColor(r.kind) }}>{human(r.type)}</span> · {r.time} · {r.read}</li>
          ))}
        </ul>
      )}
    </Box>
  );
}

function LevelCard({ card }) {
  const color = sideColor(card.side);
  return (
    <div data-testid="level-card" style={{ border: `1px solid ${C.line}`, borderLeft: `4px solid ${color}`, borderRadius: 8, padding: 10, marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div style={{ color, fontWeight: 800, fontSize: 18 }}>{card.side} {fmt(card.price)}</div>
        <div style={{ color: C.dim, fontSize: 12 }}>
          strength {card.strength} · {fmt(card.distancePts)} pts away{card.state ? ` · ${human(card.state)}` : ""}
        </div>
      </div>
      <div style={{ color: C.text, fontSize: 13, marginTop: 4 }}>{card.sources.map(human).join(" + ")}</div>
      <div style={{ color: C.dim, fontSize: 12 }}>{card.labels.join(", ")}</div>
      {card.insideOwnerZones?.length > 0 && (
        <div style={{ color: C.zone, fontSize: 12, marginTop: 4 }}>🟩 Inside your zone: {card.insideOwnerZones.join(" · ")}</div>
      )}
      {card.flippedFrom && <div style={{ color: C.info, fontSize: 12 }}>↔ Flipped (was {card.flippedFrom.map(human).join(", ")})</div>}
      {card.defenseHistory?.length > 0 && (
        <div style={{ fontSize: 12, marginTop: 6 }}>
          <span style={{ color: C.dim }}>🛡️ History: </span>
          <span style={{ color: C.text }}>
            {card.defenseHistory.map((h) => `${human(h.type)} ${h.time}${h.penetrationPts != null ? ` (${fmt(h.penetrationPts)} pts)` : ""}`).join(" · ")}
          </span>
        </div>
      )}
      <div style={{ fontSize: 12, marginTop: 6 }}>
        <span style={{ color: C.dim }}>📈 Now: </span>
        <span style={{ color: C.text }}>
          {card.currentFlowRead ? card.currentFlowRead.map((r) => r.read).join(" · ") : card.currentFlowNote}
        </span>
      </div>
      {card.ownerBreakRule?.fullBodyCloseBeyondAt && (
        <div style={{ fontSize: 12, color: C.warn, marginTop: 4 }}>
          Your rule: full-body close {card.side === "BUY" ? "below" : "above"} at {card.ownerBreakRule.fullBodyCloseBeyondAt}
          {card.ownerBreakRule.sinceLastProof ? " (after last proof)" : " (before it was re-proven)"}
        </div>
      )}
      <div style={{ fontSize: 12, color: C.warn, marginTop: 4 }}>⚠️ Watch: {card.invalidation}</div>
    </div>
  );
}

function Last15({ last15, volume, trend }) {
  const mins = last15?.minutes || [];
  const maxAbs = Math.max(1, ...mins.map((m) => Math.abs(m.delta)));
  return (
    <Box title="Last 15 minutes: price vs flow">
      <div style={{ display: "flex", gap: 16, fontSize: 13, color: C.text, marginBottom: 8, flexWrap: "wrap" }}>
        <span>Price {last15?.changePts >= 0 ? "+" : ""}{fmt(last15?.changePts)} pts</span>
        <span>Buyers − sellers: {last15?.delta >= 0 ? "+" : ""}{fmt(last15?.delta, 0)}</span>
        <span>Volume vs normal: {volume?.ratio != null ? `${Math.round(volume.ratio * 100)}%` : "–"}</span>
        <span>Lows: {human(trend?.lows)} · Highs: {human(trend?.highs)}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 2, height: 48 }} aria-label="delta per minute">
        {mins.map((m, i) => (
          <div key={i} title={`${m.time} move ${fmt(m.movePts)} · delta ${fmt(m.delta, 0)}`}
            style={{ flex: 1, height: `${(Math.abs(m.delta) / maxAbs) * 100}%`, minHeight: 2,
              background: m.delta >= 0 ? C.buy : C.sell, opacity: 0.8, alignSelf: m.delta >= 0 ? "flex-end" : "flex-start" }} />
        ))}
      </div>
    </Box>
  );
}

export default function Engine18LivePanel({ snapshot, synthetic = false }) {
  if (!snapshot) return <div style={{ color: C.dim, padding: 16 }}>Engine 18 is warming up…</div>;
  const s = snapshot;
  return (
    <div style={{ background: C.bg, color: C.text, padding: 16, fontFamily: "system-ui, sans-serif", maxWidth: 760 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
        <div style={{ fontSize: 20, fontWeight: 800 }}>Engine 18 · Liquidity (live)</div>
        <div style={{ color: C.dim, fontSize: 12 }}>
          ES {fmt(s.price)} · {s.time}{synthetic ? " · PREVIEW (synthetic data)" : ""}
        </div>
      </div>
      <CurrentRead read={s.currentRead} />
      <Box title="Liquidity lines (fixed prices, max 2 + 2)">
        {s.lines?.length ? s.lines.map((c) => <LevelCard key={c.id} card={c} />)
          : <div style={{ color: C.dim, fontSize: 13 }}>No line qualifies right now ({human(s.noLineReason)}). Zero lines is a valid answer.</div>}
        {s.airPockets?.length > 0 && (
          <div style={{ color: C.dim, fontSize: 12 }}>Air pockets (thin volume, fast travel): {s.airPockets.map((a) => `${fmt(a.lo)}–${fmt(a.hi)}`).join(" · ")}</div>
        )}
      </Box>
      <Last15 last15={s.last15} volume={s.volumeVsNormal} trend={s.trend} />
      <div style={{ color: C.dim, fontSize: 11 }}>
        Data: {human(s.dataSource)} · Order book: {human(s.orderBook)} · Your break rule: {s.rules?.ownerBreakRule ? "full-body close" : "close"}.
        {" "}{s.note}
      </div>
    </div>
  );
}
