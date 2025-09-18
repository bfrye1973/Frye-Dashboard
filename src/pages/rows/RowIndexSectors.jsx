// src/pages/rows/RowIndexSectors.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useDashboardPoll } from "../../lib/dashboardApi";
import { LastUpdated } from "../../components/LastUpdated";
import CadenceBadge from "../../components/CadenceBadge";

/* ---------------------------- tiny helpers ---------------------------- */
function safe(obj, path) {
  let cur = obj;
  for (let i = 0; i < path.length; i++) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = cur[path[i]];
  }
  return cur;
}
function pickCadence(source) {
  return safe(source, ["meta", "cadence"]) || "unknown";
}
/** Prefer section stamps; then “outlook” (some backends attach it there); then meta/legacy. */
function pickSectorsTs(source) {
  if (!source || typeof source !== "object") return null;
  return (
    safe(source, ["sectors", "updatedAt"]) ||
    safe(source, ["outlook", "updatedAt"]) ||
    safe(source, ["meta", "ts"]) ||
    source.updated_at ||
    source.ts ||
    null
  );
}

/** returns array of card-like objects no matter how backend shapes them */
function getSectorCards(source) {
  if (!source) return [];
  const s = safe(source, ["sectors"]);
  const o = safe(source, ["outlook"]);

  // 1) New preferred: /dashboard.outlook.sectorCards (what your backend emits now)
  if (Array.isArray(safe(o, ["sectorCards"]))) return safe(o, ["sectorCards"]);

  // 2) Also allow sectors.sectorCards / sectors.cards / sectors.list
  if (Array.isArray(safe(s, ["sectorCards"]))) return safe(s, ["sectorCards"]);
  if (Array.isArray(safe(s, ["cards"])))       return safe(s, ["cards"]);
  if (Array.isArray(safe(s, ["list"])))        return safe(s, ["list"]);

  // 3) Dict fallback: sectors.groups = { "Tech": { advPct, decPct, ... } }
  const groups = safe(s, ["groups"]);
  if (groups && typeof groups === "object") {
    const out = [];
    for (const name in groups) {
      if (!Object.prototype.hasOwnProperty.call(groups, name)) continue;
      const g = groups[name] || {};
      out.push({
        name,
        advPct: g.advPct,
        decPct: g.decPct,
        netNH: g.netNH,
        breadthTR: g.breadthTR,
        tone: g.tone || g.state, // optional
      });
    }
    return out;
  }

  return [];
}

function pct(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(2) + "%" : "—";
}
function toneForNet(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "neutral";
  if (v > 0.4) return "bull";
  if (v < -0.4) return "bear";
  return "neutral";
}

function Stat({ k, v }) {
  return (
    <span style={{ display: "inline-flex", gap: 6 }}>
      <span style={{ color: "#94a3b8" }}>{k}:</span>
      <span style={{ color: "#e5e7eb", fontWeight: 700 }}>{v}</span>
    </span>
  );
}

function Pill({ label, tone, subtitle }) {
  const theme =
    tone === "bull"
      ? { bd: "#14532d", bg: "#052e1a", tag: "#22c55e" }
      : tone === "bear"
      ? { bd: "#7f1d1d", bg: "#2a0b0b", tag: "#ef4444" }
      : { bd: "#334155", bg: "#0b1220", tag: "#94a3b8" };

  return (
    <div
      style={{
        minWidth: 180,
        border: "1px solid " + theme.bd,
        background: theme.bg,
        borderRadius: 10,
        padding: "8px 10px",
        display: "grid",
        gridTemplateColumns: "1fr auto",
        gap: 6,
        alignItems: "center",
      }}
      title={label}
    >
      <div style={{ color: "#e5e7eb", fontWeight: 800, fontSize: 13 }}>{label}</div>
      <span
        style={{
          fontSize: 11,
          color: "#0b1220",
          background: theme.tag,
          borderRadius: 999,
          padding: "2px 8px",
          fontWeight: 800,
          justifySelf: "end",
        }}
      >
        {String(tone || "neutral").toUpperCase()}
      </span>

      {subtitle ? (
        <div
          style={{
            gridColumn: "1 / span 2",
            color: "#cbd5e1",
            fontSize: 12,
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          {subtitle}
        </div>
      ) : null}
    </div>
  );
}

/* =============================== MAIN ================================= */
export default function RowIndexSectors() {
  const { data: live } = useDashboardPoll("dynamic");

  // replay support (from RowMarketOverview)
  const [replayOn, setReplayOn] = useState(false);
  const [replayData, setReplayData] = useState(null);
  useEffect(() => {
    function onReplay(e) {
      const d = e && e.detail ? e.detail : {};
      setReplayOn(!!d.on);
      setReplayData(d.on ? d.data || null : null);
    }
    if (typeof window !== "undefined") {
      window.addEventListener("replay:update", onReplay);
      return () => window.removeEventListener("replay:update", onReplay);
    }
    return () => {};
  }, []);

  const source = replayOn && replayData ? replayData : live;

  const ts = pickSectorsTs(source);
  const cadence = pickCadence(source);

  // where the cards actually live
  const cardsRaw = useMemo(() => getSectorCards(source), [source]);

  // normalize for view
  const cards = useMemo(() => {
    return cardsRaw.map((c, idx) => {
      const name = (c && (c.name || c.label)) || "Sector";
      const adv = Number(c && c.advPct);
      const dec = Number(c && c.decPct);
      const tr = Number(c && c.breadthTR);

      // tone: prefer provided tone/state, otherwise infer from adv-dec or breadthTR
      let tone =
        (c && (c.tone || c.state)) ? String(c.tone || c.state).toLowerCase() : "neutral";
      if (tone !== "bull" && tone !== "bear" && tone !== "neutral") {
        const net = Number.isFinite(adv) && Number.isFinite(dec) ? adv - dec : tr;
        tone = toneForNet(net);
      }

      const parts = [];
      if (c && c.advPct != null) parts.push(<Stat key={"a" + idx} k="Adv" v={pct(c.advPct)} />);
      if (c && c.decPct != null) parts.push(<Stat key={"d" + idx} k="Dec" v={pct(c.decPct)} />);
      if (c && c.netNH != null) parts.push(<Stat key={"nh" + idx} k="Net NH" v={String(c.netNH)} />);
      if (c && c.breadthTR != null) parts.push(<Stat key={"tr" + idx} k="Breadth TR" v={pct(c.breadthTR)} />);

      return { name, tone, subtitle: parts };
    });
  }, [cardsRaw]);

  // helpful log if nothing found (does not break build)
  useEffect(() => {
    if (!source) return;
    if (cardsRaw.length === 0) {
      // eslint-disable-next-line no-console
      console.warn(
        "[IndexSectors] No sector cards found. Checked: outlook.sectorCards, sectors.sectorCards, sectors.cards, sectors.list, sectors.groups"
      );
    }
  }, [source, cardsRaw.length]);

  return (
    <section id="row-4" className="panel" style={{ padding: 10 }}>
      <div className="panel-head" style={{ alignItems: "center" }}>
        <div className="panel-title">Index Sectors</div>
        <div className="spacer" />
        <LastUpdated ts={ts} />
        <CadenceBadge ts={ts} cadence={cadence} />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 10,
          alignItems: "stretch",
        }}
      >
        {cards.length > 0 ? (
          cards.map((x, i) => (
            <Pill key={x.name + "-" + i} label={x.name} tone={x.tone} subtitle={x.subtitle} />
          ))
        ) : (
          <div className="text-xs" style={{ color: "#9ca3af", padding: "8px 4px" }}>
            No sector data.
          </div>
        )}
      </div>
    </section>
  );
}
