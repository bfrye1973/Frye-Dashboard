import React, { useEffect, useState } from "react";

export default function SmartMoneyZonesPanel() {
  const [zones, setZones] = useState([]);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadZones() {
      try {
        // First attempt: /data/zones.json (where you created it)
        const res = await fetch("/data/zones.json");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setZones(json.zones || []);
        setSelected((json.zones || [])[0] || null);
      } catch (e) {
        console.error("Error loading zones.json", e);
        setError("Could not load zones.json");
      }
    }
    loadZones();
  }, []);

  const onSelect = (zone) => setSelected(zone);

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
      <div style={{ padding: "8px 12px", borderBottom: "1px solid #2b2b2b", fontWeight: 700 }}>
        Smart Money Zones
      </div>

      {error && (
        <div style={{ padding: 12, fontSize: 12, color: "#f97373" }}>
          {error}
        </div>
      )}

      {/* Left: zone list */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <div
          style={{
            width: 130,
            borderRight: "1px solid #2b2b2b",
            overflowY: "auto",
            fontSize: 12,
          }}
        >
          {zones.map((z) => (
            <div
              key={z.id || z.label}
              onClick={() => onSelect(z)}
              style={{
                padding: "6px 8px",
                cursor: "pointer",
                background:
                  selected && (selected.id || selected.label) === (z.id || z.label)
                    ? "#1f2933"
                    : "transparent",
                borderBottom: "1px solid #1a1a1a",
              }}
            >
              <div style={{ fontWeight: 600 }}>
                {z.label || z.type}
              </div>
              <div style={{ color: "#9ca3af" }}>
                {Array.isArray(z.range)
                  ? `${z.range[0]} – ${z.range[1]}`
                  : ""}
              </div>
            </div>
          ))}

          {zones.length === 0 && !error && (
            <div style={{ padding: 12, color: "#9ca3af" }}>
              No zones found in zones.json
            </div>
          )}
        </div>

        {/* Right: selected zone details */}
        <div style={{ flex: 1, padding: 10, fontSize: 12 }}>
          {selected ? (
            <>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
                {selected.label || "Selected Zone"}
              </div>
              <div style={{ marginBottom: 4 }}>
                <span style={{ color: "#9ca3af" }}>Type: </span>
                {selected.type || "n/a"}
              </div>
              <div style={{ marginBottom: 4 }}>
                <span style={{ color: "#9ca3af" }}>Range: </span>
                {Array.isArray(selected.range)
                  ? `${selected.range[0]} – ${selected.range[1]}`
                  : "n/a"}
              </div>
              {selected.side && (
                <div style={{ marginBottom: 4 }}>
                  <span style={{ color: "#9ca3af" }}>Side: </span>
                  {selected.side === "bear" ? "Distribution" : "Accumulation"}
                </div>
              )}
              {/* In this first step, we don't show score/checklist yet */}
              <div style={{ marginTop: 10, color: "#9ca3af" }}>
                (Score & checklist coming next)
              </div>
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
