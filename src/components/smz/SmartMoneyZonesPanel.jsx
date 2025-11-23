import React, { useEffect, useState } from "react";

export default function SmartMoneyZonesPanel() {
  const [zones, setZones] = useState([]);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState(null);

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
      { key: "notExhausted", label: "Zone not exhausted" }
    ];

    return (
      <div style={{ marginTop: 8 }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Checklist</div>
        {items.map((item) => {
          let value = checks[item.key];
          if (item.key === "wickSide") {
            value = Boolean(checks.wickSide);
          }
          const mark = value ? "✓" : "✕";
          const color = value ? "#10b981" : "#f97373";
          return (
            <div key={item.key} style={{ fontSize: 11, color }}>
              {mark} {item.label}
            </div>
          );
        })}
      </div>
    );
  };

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

      {error && (
        <div style={{ padding: 12, fontSize: 12, color: "#f97373" }}>{error}</div>
      )}

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
            const isSelected =
              selected && (selected.id || selected.label) === (z.id || z.label);
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
                <div style={{ fontWeight: 600 }}>
                  {z.label || sideLabel}
                </div>
                <div style={{ color: "#9ca3af" }}>
                  {z.top != null && z.bottom != null
                    ? `${z.bottom.toFixed(2)} – ${z.top.toFixed(2)}`
                    : ""}
                </div>
                {typeof z.score === "number" && (
                  <div style={{ color: "#fbbf24", fontSize: 11 }}>
                    Score: {z.score}
                  </div>
                )}
              </div>
            );
          })}

          {zones.length === 0 && !error && (
            <div style={{ padding: 12, color: "#9ca3af" }}>
              No zones in zones.json
            </div>
          )}
        </div>

        {/* Selected zone details */}
        <div style={{ flex: 1, padding: 10, fontSize: 12 }}>
          {selected ? (
            <>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
                {selected.label || "Selected Zone"}
              </div>
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
                {selected.bottom?.toFixed(2)} – {selected.top?.toFixed(2)}{" "}
                (mid {selected.mid?.toFixed(2)})
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
            <div style={{ color: "#9ca3af" }}>
              Select a zone from the list on the left.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
