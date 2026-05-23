// src/pages/rows/RowChart/overlays/Engine23BehaviorCard.jsx

import React from "react";

function formatText(value, fallback = "—") {
  if (value == null || value === "") return fallback;
  return String(value)
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function formatLevel(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(2) : "—";
}

function healthColor(health) {
  const h = String(health || "").toUpperCase();

  if (h === "HEALTHY") return "#22c55e";
  if (h === "CAUTION") return "#fbbf24";
  if (h === "RISK") return "#fb7185";

  return "#94a3b8";
}

function healthBorder(health) {
  const h = String(health || "").toUpperCase();

  if (h === "HEALTHY") return "rgba(34,197,94,0.50)";
  if (h === "CAUTION") return "rgba(251,191,36,0.55)";
  if (h === "RISK") return "rgba(251,113,133,0.60)";

  return "rgba(148,163,184,0.35)";
}

function SmallLine({ label, value }) {
  if (value == null || value === "") return null;

  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
      <span style={{ color: "#94a3b8", fontWeight: 800 }}>{label}</span>
      <span style={{ color: "#e5e7eb", fontWeight: 800, textAlign: "right" }}>
        {value}
      </span>
    </div>
  );
}

function LevelsBlock({ targets }) {
  if (!targets || typeof targets !== "object") return null;

  const rows = [
    ["r382", targets.r382],
    ["r500", targets.r500],
    ["r618", targets.r618],
    ["Invalidation", targets.invalidation],
    ["78.6 Ref", targets.reference786],
  ];

  return (
    <div
      style={{
        border: "1px solid rgba(148,163,184,0.25)",
        borderRadius: 10,
        padding: "8px 10px",
        background: "rgba(15,23,42,0.35)",
        display: "grid",
        gap: 4,
      }}
    >
      <div
        style={{
          color: "#60a5fa",
          fontSize: 13,
          fontWeight: 900,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          marginBottom: 2,
        }}
      >
        Key Pullback Levels
      </div>

      {rows.map(([label, value]) => (
        <SmallLine key={label} label={label} value={formatLevel(value)} />
      ))}
    </div>
  );
}

function WeaknessBlock({ zones }) {
  const safe = Array.isArray(zones) ? zones.filter(Boolean) : [];
  if (!safe.length) return null;

  return (
    <div
      style={{
        border: "1px solid rgba(251,191,36,0.28)",
        borderRadius: 10,
        padding: "8px 10px",
        background: "rgba(113,63,18,0.12)",
        display: "grid",
        gap: 5,
      }}
    >
      <div
        style={{
          color: "#fbbf24",
          fontSize: 13,
          fontWeight: 900,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          marginBottom: 2,
        }}
      >
        Weakness / Chase-Risk Zones
      </div>

      {safe.slice(0, 4).map((z, idx) => (
        <div key={`${z.label || "zone"}-${idx}`} style={{ display: "grid", gap: 2 }}>
          <div style={{ color: "#f8fafc", fontWeight: 850, fontSize: 14 }}>
            {z.label || "Zone"}: {z.level ?? "—"}
          </div>
          {z.meaning && (
            <div style={{ color: "#cbd5e1", fontSize: 13, lineHeight: 1.35 }}>
              {z.meaning}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function Engine23BehaviorCard({
  visible = true,
  interpretation = null,
  symbol = "ES",
}) {
  if (!visible || !interpretation) return null;

  const health = interpretation.health || "UNKNOWN";
  const color = healthColor(health);

  const recent = interpretation.recentCompletion;
  const active = interpretation.activeStructure;
  const higher = interpretation.higherContext;

  return (
    <div
      style={{
        fontFamily: "Arial, Helvetica, sans-serif",
        position: "absolute",
        top: 166,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 111,
        width: 780,
        maxWidth: "62%",
        borderRadius: 14,
        border: `1px solid ${healthBorder(health)}`,
        background: "rgba(6,10,20,0.96)",
        padding: "12px 16px",
        color: "#e5e7eb",
        backdropFilter: "blur(4px)",
        pointerEvents: "none",
        textAlign: "left",
        boxShadow: "0 8px 24px rgba(0,0,0,0.28)",
        display: "grid",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 950,
              color,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Engine 23 — Wave Behavior Read
          </div>

          <div style={{ fontSize: 18, fontWeight: 900, color: "#f8fafc", marginTop: 3 }}>
            {symbol} • {formatText(interpretation.environment)} • {formatText(interpretation.state)}
          </div>
        </div>

        <div
          style={{
            border: `1px solid ${healthBorder(health)}`,
            borderRadius: 999,
            padding: "5px 10px",
            color,
            fontWeight: 950,
            fontSize: 13,
            background: "rgba(15,23,42,0.55)",
            whiteSpace: "nowrap",
          }}
        >
          {formatText(health)}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8,
          fontSize: 14,
        }}
      >
        <SmallLine label="Preferred" value={formatText(interpretation.preferredEntry)} />
        <SmallLine label="Active Degree" value={formatText(interpretation.activeDegree)} />
        <SmallLine label="Recent" value={recent ? `${formatText(recent.degree)} ${recent.wave}` : "—"} />
        <SmallLine label="Active Setup" value={active?.setup || "—"} />
        <SmallLine label="Higher Context" value={higher?.label || interpretation.higherDegreeContext || "—"} />
        <SmallLine label="Direction" value={formatText(interpretation.directionBias)} />
      </div>

      <LevelsBlock targets={interpretation.activeTargets} />
      <WeaknessBlock zones={interpretation.weaknessZones} />

      {interpretation.summary && (
        <div
          style={{
            borderTop: "1px solid rgba(148,163,184,0.25)",
            paddingTop: 8,
            color: "#dbeafe",
            fontSize: 16,
            lineHeight: 1.4,
            fontWeight: 650,
          }}
        >
          {interpretation.summary}
        </div>
      )}
    </div>
  );
}
