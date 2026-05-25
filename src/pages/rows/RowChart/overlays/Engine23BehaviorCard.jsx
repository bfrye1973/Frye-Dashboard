// src/pages/rows/RowChart/overlays/Engine23BehaviorCard.jsx

import React from "react";

const CARD_FONT =
  "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

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
      <span style={{ color: "#94a3b8", fontWeight: 500 }}>{label}</span>
      <span style={{ color: "#e5e7eb", fontWeight: 500, textAlign: "right" }}>
        {value}
      </span>
    </div>
  );
}

function getLevelRowsFromObject(obj) {
  if (!obj || typeof obj !== "object") return [];

  const rows = [];

  const orderedKeys = [
    ["r236", "23.6%"],
    ["r382", "38.2%"],
    ["r500", "50.0%"],
    ["r618", "61.8%"],
    ["r786", "78.6%"],
    ["reference786", "78.6 Ref"],
    ["invalidation", "Invalidation"],

    ["e100", "1.000"],
    ["e1168", "1.168"],
    ["e1272", "1.272"],
    ["e1618", "1.618"],
    ["e200", "2.000"],
    ["e2618", "2.618"],
    ["e300", "3.000"],
    ["e4236", "4.236"],
  ];

  orderedKeys.forEach(([key, label]) => {
    if (obj[key] != null) {
      rows.push([label, obj[key]]);
    }
  });

  return rows;
}

function getLevelBlockConfig({ interpretation, targets }) {
  const activeTargets = targets && typeof targets === "object" ? targets : {};
  const higherTargets =
    interpretation?.higherTargets && typeof interpretation.higherTargets === "object"
      ? interpretation.higherTargets
      : {};

  const activePullbackRows = getLevelRowsFromObject(activeTargets).filter(([label]) =>
    ["23.6%", "38.2%", "50.0%", "61.8%", "78.6%", "78.6 Ref", "Invalidation"].includes(label)
  );

  const activeExtensionRows = getLevelRowsFromObject(activeTargets).filter(([label]) =>
    ["1.000", "1.168", "1.272", "1.618", "2.000", "2.618", "3.000", "4.236"].includes(label)
  );

  const higherExtensionRows = getLevelRowsFromObject(higherTargets).filter(([label]) =>
    ["1.000", "1.168", "1.272", "1.618", "2.000", "2.618", "3.000", "4.236"].includes(label)
  );

  if (activePullbackRows.length) {
    return {
      title: "Key Pullback / Reclaim Levels",
      rows: activePullbackRows,
      color: "#60a5fa",
    };
  }

  if (activeExtensionRows.length) {
    return {
      title: "Active Extension Targets",
      rows: activeExtensionRows,
      color: "#22c55e",
    };
  }

  if (higherExtensionRows.length) {
    return {
      title: "Higher-Degree Extension / Reaction Levels",
      rows: higherExtensionRows,
      color: "#fbbf24",
    };
  }

  return null;
}

function LevelsBlock({ interpretation, targets }) {
  const config = getLevelBlockConfig({ interpretation, targets });

  if (!config || !config.rows.length) return null;

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
          color: config.color,
          fontSize: 13,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          marginBottom: 2,
        }}
      >
        {config.title}
      </div>

      {config.rows.map(([label, value]) => (
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
        border: "1px solid rgba(251,191,36,0.35)",
        borderRadius: 10,
        padding: "10px 12px",
        background: "rgba(113,63,18,0.14)",
        display: "grid",
        gap: 8,
      }}
    >
      <div
        style={{
          color: "#fbbf24",
          fontSize: 16,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          marginBottom: 2,
        }}
      >
        Weakness / Chase-Risk Zones
      </div>

      {safe.slice(0, 4).map((z, idx) => (
        <div
          key={`${z.label || "zone"}-${idx}`}
          style={{
            display: "grid",
            gap: 3,
            paddingBottom: idx < safe.slice(0, 4).length - 1 ? 5 : 0,
            borderBottom:
              idx < safe.slice(0, 4).length - 1
                ? "1px solid rgba(251,191,36,0.10)"
                : "none",
          }}
        >
          <div style={{ color: "#f8fafc", fontWeight: 600, fontSize: 17 }}>
            {z.label || "Zone"}: {z.level ?? "—"}
          </div>

          {z.meaning && (
            <div style={{ color: "#dbeafe", fontSize: 15, lineHeight: 1.42 }}>
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
        fontFamily: CARD_FONT,
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
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Engine 23 — Wave Behavior Read
          </div>

          <div
            style={{
              fontSize: 18,
              fontWeight: 500,
              color: "#f8fafc",
              marginTop: 3,
            }}
          >
            {symbol} • {formatText(interpretation.environment)} •{" "}
            {formatText(interpretation.state)}
          </div>
        </div>

        <div
          style={{
            border: `1px solid ${healthBorder(health)}`,
            borderRadius: 999,
            padding: "5px 10px",
            color,
            fontWeight: 600,
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
        <SmallLine
          label="Preferred"
          value={formatText(interpretation.preferredEntry)}
        />
        <SmallLine
          label="Active Degree"
          value={formatText(interpretation.activeDegree)}
        />
        <SmallLine
          label="Recent"
          value={recent ? `${formatText(recent.degree)} ${recent.wave}` : "—"}
        />
        <SmallLine label="Active Setup" value={active?.setup || "—"} />
        <SmallLine
          label="Higher Context"
          value={higher?.label || interpretation.higherDegreeContext || "—"}
        />
        <SmallLine
          label="Direction"
          value={formatText(interpretation.directionBias)}
        />
      </div>

      <LevelsBlock
        interpretation={interpretation}
        targets={interpretation.activeTargets}
     />
      <WeaknessBlock zones={interpretation.weaknessZones} />

      {interpretation.summary && (
        <div
          style={{
            borderTop: "1px solid rgba(148,163,184,0.25)",
            paddingTop: 8,
            color: "#dbeafe",
            fontSize: 16,
            lineHeight: 1.45,
            fontWeight: 400,
          }}
        >
          {interpretation.summary}
        </div>
      )}
    </div>
  );
}
