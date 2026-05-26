// src/pages/rows/RowChart/overlays/Engine23BehaviorCard.jsx

import React from "react";

const CARD_FONT = "Arial, Helvetica, sans-serif";

const TEXT_STYLE = {
  fontFamily: CARD_FONT,
  fontSize: 17,
  lineHeight: 1.42,
  fontWeight: 500,
  color: "#dbeafe",
};

const TITLE_STYLE = {
  fontFamily: CARD_FONT,
  fontSize: 17,
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.02em",
};

const BOX_STYLE = {
  borderRadius: 10,
  padding: "8px 10px",
  display: "grid",
  gap: 6,
};

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
    <div
      style={{
        fontFamily: CARD_FONT,
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        fontSize: 17,
        lineHeight: 1.42,
        fontWeight: 500,
      }}
    >
      <span style={{ color: "#94a3b8", fontWeight: 600 }}>{label}</span>
      <span style={{ color: "#dbeafe", fontWeight: 500, textAlign: "right" }}>
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

  const pullbackLabels = [
    "23.6%",
    "38.2%",
    "50.0%",
    "61.8%",
    "78.6%",
    "78.6 Ref",
    "Invalidation",
  ];

  const extensionLabels = [
    "1.000",
    "1.168",
    "1.272",
    "1.618",
    "2.000",
    "2.618",
    "3.000",
    "4.236",
  ];

  const activePullbackRows = getLevelRowsFromObject(activeTargets).filter(([label]) =>
    pullbackLabels.includes(label)
  );

  const activeExtensionRows = getLevelRowsFromObject(activeTargets).filter(([label]) =>
    extensionLabels.includes(label)
  );

  const higherExtensionRows = getLevelRowsFromObject(higherTargets).filter(([label]) =>
    extensionLabels.includes(label)
  );

  if (activePullbackRows.length) {
    return {
      title: "Key Pullback / Reclaim Levels",
      rows: activePullbackRows,
      color: "#60a5fa",
      border: "rgba(96,165,250,0.35)",
      background: "rgba(30,64,175,0.13)",
    };
  }

  if (activeExtensionRows.length) {
    return {
      title: "Active Extension Targets",
      rows: activeExtensionRows,
      color: "#22c55e",
      border: "rgba(34,197,94,0.35)",
      background: "rgba(20,83,45,0.13)",
    };
  }

  if (higherExtensionRows.length) {
    return {
      title: "Higher-Degree Extension / Reaction Levels",
      rows: higherExtensionRows,
      color: "#fbbf24",
      border: "rgba(251,191,36,0.35)",
      background: "rgba(113,63,18,0.14)",
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
        ...BOX_STYLE,
        border: `1px solid ${config.border}`,
        background: config.background,
      }}
    >
      <div
        style={{
          ...TITLE_STYLE,
          color: config.color,
          marginBottom: 2,
        }}
      >
        {config.title}
      </div>

      <div style={{ display: "grid", gap: 4 }}>
        {config.rows.map(([label, value]) => (
          <SmallLine key={label} label={label} value={formatLevel(value)} />
        ))}
      </div>
    </div>
  );
}

function WeaknessBlock({ zones }) {
  const safe = Array.isArray(zones) ? zones.filter(Boolean) : [];
  if (!safe.length) return null;

  return (
    <div
      style={{
        ...BOX_STYLE,
        border: "1px solid rgba(251,191,36,0.35)",
        background: "rgba(113,63,18,0.14)",
      }}
    >
      <div
        style={{
          ...TITLE_STYLE,
          color: "#fbbf24",
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
            gap: 4,
            paddingBottom: idx < safe.slice(0, 4).length - 1 ? 6 : 0,
            borderBottom:
              idx < safe.slice(0, 4).length - 1
                ? "1px solid rgba(251,191,36,0.10)"
                : "none",
          }}
        >
          <div
            style={{
              ...TEXT_STYLE,
              color: "#f8fafc",
              fontWeight: 700,
            }}
          >
            {z.label || "Zone"}: {z.level ?? "—"}
          </div>

          {z.meaning && (
            <div
              style={{
                ...TEXT_STYLE,
                color: "#dbeafe",
                fontWeight: 500,
              }}
            >
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
        top: 150,
        right: 24,
        zIndex: 108,
        width: 520,
        maxWidth: "32%",
        maxHeight: "calc(100vh - 210px)",
        overflowY: "auto",
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
        gap: 8,
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
              ...TITLE_STYLE,
              color,
              fontSize: 17,
            }}
          >
            Engine 23 — Wave Behavior Read
          </div>

          <div
            style={{
              ...TEXT_STYLE,
              color: "#f8fafc",
              fontWeight: 600,
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
            fontFamily: CARD_FONT,
            fontWeight: 700,
            fontSize: 17,
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
          gap: 6,
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
            ...TEXT_STYLE,
            color: "#dbeafe",
            fontWeight: 500,
          }}
        >
          {interpretation.summary}
        </div>
      )}
    </div>
  );
}
