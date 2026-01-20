import React, { useEffect, useMemo, useState } from "react";

// ---- helpers ----
function fmtRange(pr) {
  if (!Array.isArray(pr) || pr.length !== 2) return "";
  const hi = Number(pr[0]);
  const lo = Number(pr[1]);
  if (!Number.isFinite(hi) || !Number.isFinite(lo)) return "";
  const top = Math.max(hi, lo).toFixed(2);
  const bot = Math.min(hi, lo).toFixed(2);
  return `${bot} – ${top}`;
}

function pick(obj, path, fallback = null) {
  try {
    return path.split(".").reduce((a, k) => (a ? a[k] : undefined), obj) ?? fallback;
  } catch {
    return fallback;
  }
}

function boolMark(v) {
  return v ? { mark: "✓", color: "#10b981" } : { mark: "✕", color: "#f97373" };
}

// Build a simple “AI smart” explanation from shelf diagnostics (deterministic)
function explainShelf(shelf) {
  const rel = shelf?.diagnostic?.relevance;
  const w3 = rel?.window3d;
  const w7 = rel?.window7d;

  if (!rel || !w3 || !w7) {
    return {
      headline: "No diagnostics available",
      why: [],
      verdict: "",
    };
  }

  const type = String(rel.typeByRelevance || shelf.type || "").toUpperCase();
  const why = [];

  // Q3 summary (wick behavior)
  why.push(
    `Q3 (Wicks): 3d upperTouches=${w3.upperWickTouches}, lowerTouches=${w3.lowerWickTouches} | bias=${w3.wickBias}`
  );
  why.push(
    `Q3 (Wicks): 7d upperTouches=${w7.upperWickTouches}, lowerTouches=${w7.lowerWickTouches} | bias=${w7.wickBias}`
  );

  // Q5 summary (acceptance vs rejection)
  why.push(
    `Q5 (Acceptance): 3d sustainedAbove=${String(w3.sustainedClosesAbove)} sustainedBelow=${String(
      w3.sustainedClosesBelow
    )} netProgress=${w3.netProgressSignedPts}`
  );
  why.push(
    `Q5 (Acceptance): 7d sustainedAbove=${String(w7.sustainedClosesAbove)} sustainedBelow=${String(
      w7.sustainedClosesBelow
    )} netProgress=${w7.netProgressSignedPts}`
  );

  // Reasons (human)
  if (type === "DISTRIBUTION") {
    if ((w7.failedPushUp ?? 0) > 0) why.push(`Repeated failed pushes ABOVE zone (7d failedPushUp=${w7.failedPushUp}).`);
    if (w3.sustainedClosesAbove === false) why.push("No sustained closes above zone in last 3 days.");
    if ((w3.netProgressSignedPts ?? 0) < 0) why.push("Net progress is negative over last 3 days.");
  } else {
    if ((w7.failedPushDown ?? 0) > 0) why.push(`Repeated failed pushes BELOW zone (7d failedPushDown=${w7.failedPushDown}).`);
    if (w3.sustainedClosesBelow === false) why.push("No sustained closes below zone in last 3 days.");
    if ((w3.netProgressSignedPts ?? 0) > 0) why.push("Net progress is positive over last 3 days.");
  }

  const verdict = `Type by relevance: ${rel.typeByRelevance} (confidence ${rel.confidence}, distWeighted ${rel.distWeighted}, accWeighted ${rel.accWeighted})`;

  return {
    headline: `${type} shelf`,
    why,
    verdict,
  };
}

export default function SmartMoneyZonesPanel() {
  const [zones, setZones] = useState([]);
  const [selected, setSelected] = useState(null);
  const [selectedShelf, setSelectedShelf] = useState(null);
  const [selectedExplain, setSelectedExplain] = useState(null);
  const [error, setError] = useState(null);

  // Load existing zones.json (unchanged)
  useEffect(() => {
    async function loadZones() {
      try {
        const res = await fetch("/data/zones.json");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const list = json.zones || [];
        setZones(list);
        setSelected(list[0] || null);
      } catch (e) {
        console.error("Error loading /data/zones.json", e);
        setError("Could not load zones.json");
      }
    }
    loadZones();
  }, []);

  // ✅ Listen for shelf clicks from chart overlay
  useEffect(() => {
    function onShelfSelected(e) {
      const payload = e?.detail;
      if (!payload || payload.kind !== "shelf") return;

      const shelf = payload.selected;
      setSelectedShelf(shelf);

      // Use payload.explain if present, otherwise build it here
      const expl = payload.explain || explainShelf(shelf);
      setSelectedExplain(expl);
    }

    window.addEventListener("smz:shelfSelected", onShelfSelected);
    return () => window.removeEventListener("smz:shelfSelected", onShelfSelected);
  }, []);

  const onSelectZone = (z) => setSelected(z);

  const renderChecks = (checks) => {
    if (!checks) return <div style={{ color: "#9ca3af" }}>No checklist data</div>;

    const items = [
      { key: "hrHits3", label: "1h touched level ≥ 3 times" },
      { key: "m10Hits7", label: "10m wicks hit level ≥ 7 times" },
      { key: "wickSide", label: "Wick direction matches zone side" },
      { key: "bodiesOutside", label: "Bodies close outside band" },
      { key: "effortVsResult", label: "Volume absorption (Effort≠Result)" },
      { key: "sweep", label: "Liquidity sweep / SFP" },
      { key: "thrust", label: "Displacement candle away" },
      { key: "trueGap", label: "True gap magnet in that direction" },
      { key: "confirm4h", label: "4h confirms this zone" },
      { key: "notExhausted", label: "Zone not exhausted" },
    ];

    return (
      <div style={{ marginTop: 8 }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Checklist</div>
        {items.map((item) => {
          let value = checks[item.key];
          if (item.key === "wickSide") value = Boolean(checks.wickSide);
          const { mark, color } = boolMark(Boolean(value));
          return (
            <div key={item.key} style={{ fontSize: 11, color }}>
              {mark} {item.label}
            </div>
          );
        })}
      </div>
    );
  };

  // Render shelf Q3/Q5 answers cleanly
  const shelfCard = useMemo(() => {
    if (!selectedShelf) return null;

    const rel = selectedShelf?.diagnostic?.relevance;
    const w3 = rel?.window3d;
    const w7 = rel?.window7d;

    const type = String(selectedShelf.type || rel?.typeByRelevance || "").toLowerCase();
    const isDist = type === "distribution";

    const headerColor = isDist ? "#f97373" : "#60a5fa";

    return (
      <div style={{ padding: "10px 12px", borderBottom: "1px solid #2b2b2b" }}>
        <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 6 }}>
          Selected Shelf (Click on chart)
        </div>

        <div style={{ fontSize: 13, fontWeight: 800, color: headerColor, marginBottom: 4 }}>
          {isDist ? "Distribution" : "Accumulation"} — {fmtRange(selectedShelf.priceRange)}
        </div>

        <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 8 }}>
          Strength: {Number.isFinite(Number(selectedShelf.strength)) ? Math.round(selectedShelf.strength) : "—"}
        </div>

        {selectedExplain?.verdict && (
          <div style={{ fontSize: 11, color: "#d1d5db", marginBottom: 8 }}>
            {selectedExplain.verdict}
          </div>
        )}

        {/* Q3 */}
        <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 4 }}>Q3 — Wick Behavior</div>
        {w3 && w7 ? (
          <div style={{ fontSize: 11, color: "#e5e7eb", lineHeight: 1.35 }}>
            <div>
              3D: upperTouches <b>{w3.upperWickTouches}</b> | lowerTouches <b>{w3.lowerWickTouches}</b> | wickBias{" "}
              <b>{w3.wickBias}</b>
            </div>
            <div>
              7D: upperTouches <b>{w7.upperWickTouches}</b> | lowerTouches <b>{w7.lowerWickTouches}</b> | wickBias{" "}
              <b>{w7.wickBias}</b>
            </div>
            <div style={{ color: "#9ca3af", marginTop: 2 }}>
              (Upper wicks repeated at highs = distribution; isolated lower wick can be liquidity grab.)
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 11, color: "#9ca3af" }}>No relevance diagnostics found.</div>
        )}

        {/* Q5 */}
        <div style={{ fontWeight: 700, fontSize: 12, marginTop: 10, marginBottom: 4 }}>Q5 — Acceptance vs Rejection</div>
        {w3 && w7 ? (
          <div style={{ fontSize: 11, color: "#e5e7eb", lineHeight: 1.35 }}>
            <div>
              3D: sustainedAbove <b>{String(w3.sustainedClosesAbove)}</b> | sustainedBelow{" "}
              <b>{String(w3.sustainedClosesBelow)}</b> | netProgress <b>{w3.netProgressSignedPts}</b>
            </div>
            <div>
              7D: sustainedAbove <b>{String(w7.sustainedClosesAbove)}</b> | sustainedBelow{" "}
              <b>{String(w7.sustainedClosesBelow)}</b> | netProgress <b>{w7.netProgressSignedPts}</b>
            </div>
            <div style={{ color: "#9ca3af", marginTop: 2 }}>
              (Acceptance requires sustained closes + progress. Proximity alone is not acceptance at highs.)
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 11, color: "#9ca3af" }}>No relevance diagnostics found.</div>
        )}

        {/* AI-style explanation */}
        {selectedExplain?.why?.length ? (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 4 }}>Why the engine chose this</div>
            <div style={{ fontSize: 11, color: "#d1d5db", lineHeight: 1.35 }}>
              {selectedExplain.why.map((line, idx) => (
                <div key={idx} style={{ marginBottom: 3 }}>
                  • {line}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
          <button
            onClick={() => {
              setSelectedShelf(null);
              setSelectedExplain(null);
            }}
            style={{
              fontSize: 11,
              padding: "6px 8px",
              background: "#111827",
              color: "#e5e7eb",
              border: "1px solid #374151",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            Clear Selected Shelf
          </button>
        </div>
      </div>
    );
  }, [selectedShelf, selectedExplain]);

  return (
    <div
      style={{
        width: 320,
        minWidth: 320,
        height: "100%",
        background: "#0f0f0f",
        borderLeft: "1px solid #2b2b2b",
        color: "#e5e7eb",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          padding: "8px 12px",
          borderBottom: "1px solid #2b2b2b",
          fontWeight: 700,
          fontSize: 13,
        }}
      >
        Smart Money Zones
      </div>

      {error && <div style={{ padding: 12, fontSize: 12, color: "#f97373" }}>{error}</div>}

      {/* ✅ Selected shelf scorecard appears on top */}
      {shelfCard}

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Zone list */}
        <div
          style={{
            width: 140,
            borderRight: "1px solid #2b2b2b",
            overflowY: "auto",
            fontSize: 12,
          }}
        >
          {zones.map((z) => {
            const isSelected = selected && (selected.id || selected.label) === (z.id || z.label);
            const bg = isSelected ? "#1f2933" : "transparent";
            const sideLabel = z.side === "bear" ? "Dist" : "Accum";
            return (
              <div
                key={z.id || z.label}
                onClick={() => onSelectZone(z)}
                style={{
                  padding: "6px 8px",
                  cursor: "pointer",
                  background: bg,
                  borderBottom: "1px solid #1a1a1a",
                }}
              >
                <div style={{ fontWeight: 600 }}>{z.label || sideLabel}</div>
                <div style={{ color: "#9ca3af" }}>
                  {z.top != null && z.bottom != null ? `${z.bottom.toFixed(2)} – ${z.top.toFixed(2)}` : ""}
                </div>
                {typeof z.score === "number" && (
                  <div style={{ color: "#fbbf24", fontSize: 11 }}>Score: {z.score}</div>
                )}
              </div>
            );
          })}

          {zones.length === 0 && !error && <div style={{ padding: 12, color: "#9ca3af" }}>No zones in zones.json</div>}
        </div>

        {/* Selected zone details (existing zones.json panel unchanged) */}
        <div style={{ flex: 1, padding: 10, fontSize: 12 }}>
          {selected ? (
            <>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{selected.label || "Selected Zone"}</div>
              <div style={{ marginBottom: 4 }}>
                <span style={{ color: "#9ca3af" }}>Type: </span>
                {selected.type || "smart_money"}
              </div>
              <div style={{ marginBottom: 4 }}>
                <span style={{ color: "#9ca3af" }}>Side: </span>
                {selected.side === "bear" ? "Distribution" : "Accumulation"}
              </div>
              <div style={{ marginBottom: 4 }}>
                <span style={{ color: "#9ca3af" }}>Range: </span>
                {selected.bottom?.toFixed(2)} – {selected.top?.toFixed(2)} (mid {selected.mid?.toFixed(2)})
              </div>
              {typeof selected.score === "number" && (
                <div style={{ marginBottom: 8 }}>
                  <span style={{ color: "#9ca3af" }}>Score: </span>
                  {selected.score} / 100
                </div>
              )}
              {renderChecks(selected.checks)}
            </>
          ) : (
            <div style={{ color: "#9ca3af" }}>Select a zone from the list on the left.</div>
          )}
        </div>
      </div>
    </div>
  );
}
