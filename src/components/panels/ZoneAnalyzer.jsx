import React, { useMemo, useState, useEffect } from "react";

// props: { zone, onUpdate(checksPatch, notes, userMarkGood) }
export default function ZoneAnalyzer({ zone, onUpdate }) {
  const [checks, setChecks] = useState(zone?.checks || {});
  const [notes, setNotes] = useState("");
  const [mark, setMark] = useState(null); // true/false

  useEffect(() => {
    setChecks(zone?.checks || {});
    setMark(null);
    setNotes("");
  }, [zone?.id]);

  const items = useMemo(() => ([
    { key: "hrHits3",        label: "1) 1h touched ≥ 3 (10d window)" },
    { key: "m10Hits7",       label: "2) 10m wicks ≥ 7 (3 sessions)" },
    { key: "wickSide",       label: `3) Wick side = ${zone?.side === "bull" ? "bottom (ACCUM)" : "top (DIST)"}`, readonly: true },
    { key: "bodiesOutside",  label: "4) Bodies close outside defended band" },
    { key: "effortVsResult", label: "5) Effort ≠ Result (rising vol + small progress)" },
    { key: "sweep",          label: "6) Liquidity sweep (SFP reclaim ≤ 3 bars)" },
    { key: "thrust",         label: "7) Thrust: ≥2× range + ≥1.5× vol" },
    { key: "trueGap",        label: "8) True price gap created (void active)" },
    { key: "confirm4h",      label: "9) 4h confirms (defense or thrust)" },
    { key: "gapFilled",      label: "10) Gap fully filled (cycle resolved)" },
  ]), [zone]);

  const passed = items.reduce((n, it) => {
    if (it.readonly) return zone?.side ? n + 1 : n; // wickSide always counts
    return checks?.[it.key] ? n + 1 : n;
  }, 0);

  const pct = Math.round(((zone?.score ?? 0) * 100));

  function toggle(key) {
    if (items.find(i => i.key === key)?.readonly) return;
    const next = { ...checks, [key]: !checks[key] };
    setChecks(next);
    onUpdate?.(next, notes, mark);
  }

  return (
    <div style={{
      width: 320, background: "#0f0f0f", border: "1px solid #2b2b2b",
      borderRadius: 10, color: "#e5e7eb", padding: 12
    }}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>
        Zone Analyzer — {zone?.side === "bull" ? "ACCUM" : "DIST"} ({zone?.tf})
      </div>
      <div style={{ fontSize: 12, marginBottom: 10, color: "#9ca3af" }}>
        Top: {zone?.top?.toFixed(2)} &nbsp; Bottom: {zone?.bottom?.toFixed(2)} &nbsp;
        Status: {zone?.status} &nbsp; Score: <b>{pct}%</b>
      </div>

      <div style={{ marginBottom: 8 }}>
        <div style={{ height: 10, background: "#222", borderRadius: 6, overflow: "hidden" }}>
          <div style={{
            width: `${pct}%`,
            height: "100%",
            background: pct >= 75 ? "#22c55e" : pct >= 50 ? "#f59e0b" : "#ef4444"
          }} />
        </div>
        <div style={{ fontSize: 11, marginTop: 6, color: "#9ca3af" }}>
          Checklist passed: <b>{passed}</b> / 10
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {items.map((it) => (
          <label key={it.key} style={{ fontSize: 12, opacity: it.readonly ? 0.8 : 1 }}>
            {!it.readonly && (
              <input
                type="checkbox"
                checked={!!checks[it.key]}
                onChange={() => toggle(it.key)}
                style={{ marginRight: 6 }}
              />
            )}
            {it.readonly && <span style={{ marginRight: 6 }}>•</span>}
            {it.label}
          </label>
        ))}
      </div>

      <div style={{ marginTop: 10 }}>
        <textarea
          placeholder="Notes…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          style={{ width: "100%", height: 80, background: "#0b0b0b", color: "#e5e7eb", border: "1px solid #2b2b2b", borderRadius: 6, padding: 6 }}
        />
      </div>

      <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
        <button
          onClick={() => { setMark(true); onUpdate?.(checks, notes, true); }}
          style={{ flex: 1, background: "#0b0b0b", color: "#22c55e", border: "1px solid #2b2b2b", borderRadius: 8, padding: 8, fontWeight: 600 }}
        >✓ Good zone</button>
        <button
          onClick={() => { setMark(false); onUpdate?.(checks, notes, false); }}
          style={{ flex: 1, background: "#0b0b0b", color: "#ef4444", border: "1px solid #2b2b2b", borderRadius: 8, padding: 8, fontWeight: 600 }}
        >✕ Bad zone</button>
      </div>
    </div>
  );
}
