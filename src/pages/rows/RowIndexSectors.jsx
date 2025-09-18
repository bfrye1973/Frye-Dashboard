// src/pages/rows/RowIndexSectors.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useDashboardPoll } from "../../lib/dashboardApi";
import { LastUpdated } from "../../components/LastUpdated";
import CadenceBadge from "../../components/CadenceBadge";

/* ---------------------------- tiny helpers ---------------------------- */
function safe(obj, path) {
  // safe(obj, ["a","b","c"])
  let cur = obj;
  for (let i = 0; i < path.length; i++) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = cur[path[i]];
  }
  return cur;
}
function pickTs(source) {
  if (!source || typeof source !== "object") return null;
  const s = source.sectors && source.sectors.updatedAt;
  const m = source.meta && source.meta.ts;
  const ua = source.updated_at;
  const t = source.ts;
  return s || m || ua || t || null;
}
function pickCadence(source) {
  return safe(source, ["meta", "cadence"]) || "unknown";
}
function pct(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(2) + "%" : "—";
}
function toneForNet(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "neutral";
  if (v > 0.4) return "bull";       // net positive
  if (v < -0.4) return "bear";      // net negative
  return "neutral";
}

/* ---------------------------- UI primitives --------------------------- */
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
      <div style={{ color: "#e5e7eb", fontWeight: 800, fontSize: 13 }}>
        {label}
      </div>
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
        {tone.toUpperCase()}
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

function Stat({ k, v }) {
  return (
    <span style={{ display: "inline-flex", gap: 6 }}>
      <span style={{ color: "#94a3b8" }}>{k}:</span>
      <span style={{ color: "#e5e7eb", fontWeight: 700 }}>{v}</span>
    </span>
  );
}

/* =============================== MAIN ================================= */
export default function RowIndexSectors() {
  // live poll
  const poll = useDashboardPoll("dynamic");
  const live = poll && poll.data ? poll.data : null;

  // replay bridge (listens to window "replay:update")
  const [replayOn, setReplayOn] = useState(false);
  const [replayData, setReplayData] = useState(null);
  useEffect(() => {
    function onReplay(e) {
      const d = e && e.detail ? e.detail : {};
      const on = !!d.on;
      setReplayOn(on);
      setReplayData(on ? d.data || null : null);
    }
    if (typeof window !== "undefined") {
      window.addEventListener("replay:update", onReplay);
      return () => window.removeEventListener("replay:update", onReplay);
    }
    return () => {};
  }, []);

  // choose source (snapshot vs live)
  const source = replayOn && replayData ? replayData : live;

  // per-section timestamp + cadence
  const ts = pickTs(source);
  const cadence = pickCadence(source);

  // get sector cards (resilient to different shapes)
  const cards = useMemo(() => {
    const s = source && source.sectors;
    if (!s) return [];

    // preferred: sectors.sectorCards = [{ name, advPct, decPct, netNH, breadthTR, ... }]
    if (Array.isArray(s.sectorCards)) return s.sectorCards;

    // legacy shapes fallback
    if (Array.isArray(s.list)) return s.list;
    if (Array.isArray(s.cards)) return s.cards;

    // build from groups dict if provided (name -> stats)
    const g = s.groups || {};
    const out = [];
    for (const key in g) {
      if (!Object.prototype.hasOwnProperty.call(g, key)) continue;
      const obj = g[key] || {};
      out.push({
        name: key,
        advPct: obj.advPct,
        decPct: obj.decPct,
        netNH: obj.netNH,
        breadthTR: obj.breadthTR,
        label: obj.label || key,
      });
    }
    return out;
  }, [source]);

  // normalize each card to a uniform view model
  const vm = useMemo(() => {
    return cards.map((c, idx) => {
      const name = (c && (c.name || c.label)) || "Sector";
      // try to compute a net tone:
      //  - use provided "state"/"tone" if present
      //  - else infer from adv - dec or breadthTR
      let tone = "neutral";
      const provided =
        (c && (c.tone || c.state)) ? String(c.tone || c.state).toLowerCase() : "";

      if (provided === "bull" || provided === "bear" || provided === "neutral") {
        tone = provided;
      } else {
        const adv = Number(c && c.advPct);
        const dec = Number(c && c.decPct);
        const tr = Number(c && c.breadthTR);
        const net = Number.isFinite(adv) && Number.isFinite(dec) ? adv - dec : tr;
        tone = toneForNet(net);
      }

      // subtitle stats line
      const parts = [];
      if (c && c.advPct != null) parts.push(<Stat key={"a" + idx} k="Adv" v={pct(c.advPct)} />);
      if (c && c.decPct != null) parts.push(<Stat key={"d" + idx} k="Dec" v={pct(c.decPct)} />);
      if (c && c.netNH != null) parts.push(<Stat key={"nh" + idx} k="Net NH" v={String(c.netNH)} />);
      if (c && c.breadthTR != null)
        parts.push(<Stat key={"tr" + idx} k="Breadth TR" v={pct(c.breadthTR)} />);

      return { name, tone, subtitle: parts };
    });
  }, [cards]);

  return (
    <section id="row-4" className="panel" style={{ padding: 10 }}>
      {/* header */}
      <div className="panel-head" style={{ alignItems: "center" }}>
        <div className="panel-title">Index Sectors</div>
        <div className="spacer" />
        <LastUpdated ts={ts} />
        <CadenceBadge ts={ts} cadence={cadence} />
      </div>

      {/* grid of sector pills */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 10,
          alignItems: "stretch",
        }}
      >
        {vm.length > 0 ? (
          vm.map((x, i) => (
            <Pill key={x.name + "-" + i} label={x.name} tone={x.tone} subtitle={x.subtitle} />
          ))
        ) : (
          <div
            className="text-xs"
            style={{ color: "#9ca3af", padding: "8px 4px" }}
          >
            No sector data.
          </div>
        )}
      </div>
    </section>
  );
}
