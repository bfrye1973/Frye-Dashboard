// src/components/smz/AccDistZonesPanel.jsx
// Simple read-only panel that lists Accumulation / Distribution levels
// from /smz-levels.json so you can see their labels + ranges.

import React, { useEffect, useState } from "react";

const CARD_STYLE = {
  display: "flex",
  flexDirection: "column",
  background: "#050815",
  borderLeft: "1px solid #1f2937",
  padding: "8px 10px",
  color: "#e5e7eb",
  fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  fontSize: 12,
  minWidth: 220,
};

const HEADER_STYLE = {
  fontSize: 13,
  fontWeight: 600,
  marginBottom: 6,
  color: "#fbbf24",
};

const ITEM_STYLE = {
  padding: "4px 0",
  borderBottom: "1px solid rgba(55,65,81,0.4)",
};

const LABEL_STYLE = (type) => ({
  fontWeight: 600,
  color: type === "accumulation" ? "#f97373" : "#60a5fa", // red / blue
});

export default function AccDistZonesPanel() {
  const [levels, setLevels] = useState([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/smz-levels.json");
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled) return;
        setLevels(Array.isArray(json.levels) ? json.levels : []);
      } catch (e) {
        console.warn("[AccDistZonesPanel] failed to load smz-levels.json", e);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!levels.length) {
    return null; // hide panel if nothing there
  }

  const formatRange = (lvl) => {
    if (Array.isArray(lvl.priceRange) && lvl.priceRange.length === 2) {
      const [hi, lo] = lvl.priceRange;
      return `${hi.toFixed(2)} – ${lo.toFixed(2)}`;
    }
    if (typeof lvl.price === "number") {
      const hi = lvl.price;
      const lo = lvl.price - 1;
      return `${hi.toFixed(2)} – ${lo.toFixed(2)}`;
    }
    return "";
  };

  return (
    <div style={CARD_STYLE}>
      <div style={HEADER_STYLE}>Acc / Dist Levels</div>
      {levels.map((lvl, idx) => (
        <div key={idx} style={ITEM_STYLE}>
          <div style={LABEL_STYLE(lvl.type)}>
            {lvl.type === "accumulation" ? "Accumulation" : "Distribution"}
          </div>
          <div>
            Range: {formatRange(lvl)}
            {typeof lvl.strength === "number" && (
              <> · Strength: {lvl.strength}</>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
