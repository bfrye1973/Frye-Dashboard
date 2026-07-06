// src/pages/rows/RowChart/overlays/Engine26ImbalanceWatchCard.jsx

import React from "react";

const CARD_FONT = '"Trebuchet MS", "Lucida Grande", "Segoe UI", Arial, sans-serif';

const CARD_WIDTH = 560;
const CARD_LEFT = "calc(50% + 430px)";

const TEXT_STYLE = {
  fontFamily: CARD_FONT,
  fontSize: 15,
  lineHeight: 1.35,
  fontWeight: 500,
  color: "#dbeafe",
};

const TITLE_STYLE = {
  fontFamily: CARD_FONT,
  fontSize: 22,
  lineHeight: 1.18,
  fontWeight: 800,
  color: "#38bdf8",
};

const LABEL_STYLE = {
  fontFamily: CARD_FONT,
  fontSize: 13,
  lineHeight: 1.2,
  fontWeight: 600,
  color: "#94a3b8",
};

function formatText(value, fallback = "—") {
  if (value == null || value === "") return fallback;

  return String(value)
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function formatUpper(value, fallback = "—") {
  if (value == null || value === "") return fallback;
  return String(value).toUpperCase().replaceAll("_", " ");
}

function formatLevel(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(2) : "—";
}

function formatBool(value) {
  if (value === true) return "YES";
  if (value === false) return "NO";
  return "—";
}

function labelsContain(labels, text) {
  const safeLabels = Array.isArray(labels) ? labels : [];
  const needle = String(text || "").toUpperCase();

  return safeLabels.some((label) =>
    String(label || "").toUpperCase().includes(needle)
  );
}

function statusColor(status, labels, structuralBias) {
  const s = String(status || "").toUpperCase();
  const b = String(structuralBias || "").toUpperCase();

  if (
    s.includes("C_DOWN") ||
    b.includes("C_DOWN") ||
    s.includes("B_BOUNCE_FINAL_FILL")
  ) {
    return "#fbbf24";
  }

  if (
    s.includes("C_UP") ||
    b.includes("C_UP") ||
    s.includes("RECLAIM") ||
    s.includes("W3")
  ) {
    return "#22c55e";
  }

  if (s.includes("TOP_IMBALANCE") || labelsContain(labels, "TOP_IMBALANCE")) {
    return "#fbbf24";
  }

  if (
    s.includes("LOWER_IMBALANCE") ||
    labelsContain(labels, "BOTTOM_IMBALANCE")
  ) {
    return "#38bdf8";
  }

  if (s.includes("PAPER_ALLOW")) return "#22c55e";

  return "#38bdf8";
}

function statusBorder(status, labels, structuralBias) {
  const color = statusColor(status, labels, structuralBias);

  if (color === "#fbbf24") return "rgba(251,191,36,0.68)";
  if (color === "#22c55e") return "rgba(34,197,94,0.62)";
  return "rgba(56,189,248,0.58)";
}

function SmallLine({ label, value, valueColor = "#f8fafc" }) {
  if (value == null || value === "") return null;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "160px 1fr",
        alignItems: "center",
        gap: 10,
      }}
    >
      <div style={LABEL_STYLE}>{label}</div>
      <div
        style={{
          fontFamily: CARD_FONT,
          fontSize: 15,
          lineHeight: 1.3,
          fontWeight: 800,
          color: valueColor,
          textAlign: "right",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function StatusBadge({ label, color }) {
  if (!label) return null;

  return (
    <span
      style={{
        fontFamily: CARD_FONT,
        border: `1px solid ${color}`,
        color,
        background: "rgba(15,23,42,0.72)",
        borderRadius: 999,
        padding: "4px 10px",
        fontSize: 12,
        fontWeight: 800,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

function SectionBox({ border, background, children }) {
  return (
    <div
      style={{
        border: `1px solid ${border}`,
        background,
        borderRadius: 12,
        padding: "11px 12px",
        display: "grid",
        gap: 7,
      }}
    >
      {children}
    </div>
  );
}

function SectionTitle({ children, color = "#38bdf8" }) {
  return (
    <div
      style={{
        fontFamily: CARD_FONT,
        fontSize: 13,
        fontWeight: 800,
        letterSpacing: 0.3,
        textTransform: "uppercase",
        color,
      }}
    >
      {children}
    </div>
  );
}

function LevelPill({ label, value, color = "#f8fafc" }) {
  if (value == null || value === "") return null;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto",
        alignItems: "center",
        gap: 8,
        padding: "7px 9px",
        borderRadius: 10,
        border: "1px solid rgba(148,163,184,0.22)",
        background: "rgba(15,23,42,0.42)",
      }}
    >
      <div
        style={{
          fontFamily: CARD_FONT,
          fontSize: 12,
          fontWeight: 700,
          color: "#94a3b8",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: CARD_FONT,
          fontSize: 17,
          fontWeight: 900,
          color,
          lineHeight: 1.1,
        }}
      >
        {formatLevel(value)}
      </div>
    </div>
  );
}

function ConfirmationList({ items }) {
  const list = Array.isArray(items) ? items.slice(0, 4) : [];
  if (!list.length) return null;

  return (
    <div style={{ display: "grid", gap: 5 }}>
      {list.map((item) => (
        <div
          key={item}
          style={{
            fontFamily: CARD_FONT,
            fontSize: 13,
            lineHeight: 1.28,
            fontWeight: 600,
            color: "#e2e8f0",
          }}
        >
          <span style={{ color: "#fbbf24" }}>• </span>
          {formatUpper(item)}
        </div>
      ))}
    </div>
  );
}

export default function Engine26ImbalanceWatchCard({
  visible = true,
  watch = null,
  plan = null,
  ticket = null,
  symbol = "ES",
}) {
  if (!visible || !watch?.active) return null;

  const zone = watch.activeImbalance || {};
  const structuralPlaybook = watch.structuralPlaybook || {};
  const watchLevels = structuralPlaybook.watchLevels || {};
  const triggerMap = structuralPlaybook.triggerMap || {};
  const engine3 = watch.fastReads?.engine3 || {};
  const engine4 = watch.fastReads?.engine4 || {};
  const permission = watch.permission || {};

  const status = String(watch.status || structuralPlaybook.status || "").toUpperCase();
  const structuralBias =
    watch.structuralBias || structuralPlaybook.structuralBias || "NEUTRAL";

  const color = statusColor(status, watch.labels, structuralBias);
  const border = statusBorder(status, watch.labels, structuralBias);

  const statusLabel =
    watch.activeImbalanceRole || structuralPlaybook.activeImbalanceRole
      ? formatUpper(watch.activeImbalanceRole || structuralPlaybook.activeImbalanceRole)
      : formatText(watch.status, "Structural Imbalance Watch");

  const zoneText =
    zone.lo != null && zone.hi != null
      ? `${formatLevel(zone.lo)}–${formatLevel(zone.hi)}`
      : "—";

  const engine3Text = `${formatUpper(engine3.state, "NO SIGNAL")} / ${formatUpper(
    engine3.quality,
    "—"
  )} / ${formatUpper(engine3.direction, "NEUTRAL")}`;

  const engine4Text = `${formatUpper(engine4.state, "NO SIGNAL")} / ${formatUpper(
    engine4.quality,
    "—"
  )}`;

  const engine6Text = formatUpper(permission.engine6Decision, "PAPER STAND DOWN");

  const template =
    watch.structuralTemplate ||
    structuralPlaybook.template ||
    "NEUTRAL_MANUAL_IMBALANCE_WATCH";

  const preferredAction =
    watch.preferredAction ||
    structuralPlaybook.preferredAction ||
    "WAIT_FOR_CONFIRMATION";

  const preferredDirection =
    watch.preferredDirection ||
    structuralPlaybook.preferredDirection ||
    "NONE";

  const primaryScenario =
    structuralPlaybook.primaryScenario ||
    watch.playbookWatch?.primaryScenario ||
    null;

  const confirmationNeeds =
    structuralPlaybook.confirmationNeeds ||
    watch.playbookWatch?.confirmationNeeds ||
    [];

  const bHigh =
    watchLevels?.manualB?.price ??
    watchLevels?.bLeg?.price ??
    watchLevels?.cProjection?.bHigh ??
    null;

  const bBandLo = watchLevels?.bBounceBand?.lo ?? null;
  const bBandHi = watchLevels?.bBounceBand?.hi ?? null;

  const c100 = triggerMap?.c100 ?? watchLevels?.cProjection?.c100 ?? null;
  const parentR618 =
    triggerMap?.parentR618 ?? watchLevels?.parentFibConfluence?.r618 ?? null;

  const confluenceText =
    c100 != null && parentR618 != null
      ? `${formatLevel(c100)} / ${formatLevel(parentR618)}`
      : c100 != null
      ? formatLevel(c100)
      : parentR618 != null
      ? formatLevel(parentR618)
      : null;

  return (
    <div
      style={{
        fontFamily: CARD_FONT,
        position: "absolute",
        top: 95,
        left: CARD_LEFT,
        zIndex: 109,
        width: CARD_WIDTH,
        maxWidth: "37%",
        borderRadius: 16,
        border: `1px solid ${border}`,
        background: "rgba(6,10,20,0.98)",
        padding: "15px 16px",
        color: "#e5e7eb",
        backdropFilter: "blur(4px)",
        pointerEvents: "none",
        textAlign: "left",
        boxShadow: "0 10px 28px rgba(0,0,0,0.34)",
        display: "grid",
        gap: 10,
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto",
          alignItems: "start",
          gap: 10,
        }}
      >
        <div>
          <div
            style={{
              ...TITLE_STYLE,
              color,
            }}
          >
            Engine 26 — Structural Imbalance Watch
          </div>

          <div
            style={{
              ...TEXT_STYLE,
              color: "#f8fafc",
              fontSize: 14,
              marginTop: 4,
              fontWeight: 700,
            }}
          >
            {symbol} • Engine 22 read first • Paper only
          </div>
        </div>

        <StatusBadge label={statusLabel} color={color} />
      </div>

      <SectionBox border={border} background="rgba(113,63,18,0.16)">
        <SmallLine
          label="Status"
          value={formatUpper(watch.status || structuralPlaybook.status)}
          valueColor={color}
        />
        <SmallLine
          label="Template"
          value={formatUpper(template)}
          valueColor="#f8fafc"
        />
        <SmallLine
          label="Role"
          value={formatUpper(watch.activeImbalanceRole || structuralPlaybook.activeImbalanceRole)}
          valueColor="#fbbf24"
        />
        <SmallLine
          label="Bias"
          value={formatUpper(structuralBias)}
          valueColor="#fbbf24"
        />
        <SmallLine
          label="Action"
          value={formatUpper(preferredAction)}
          valueColor="#f8fafc"
        />
      </SectionBox>

      <SectionBox border="rgba(148,163,184,0.28)" background="rgba(15,23,42,0.36)">
        <SmallLine label="Zone" value={zoneText} />
        <SmallLine label="Current" value={formatLevel(watch.currentPrice)} />
        <SmallLine
          label="Inside / Near"
          value={`${formatBool(zone.inside)} / ${formatBool(zone.near)}`}
        />
        <SmallLine label="Preferred Dir" value={formatUpper(preferredDirection)} />
        <SmallLine label="No Long Chase" value={formatBool(watch.doNotChaseLong)} />
        <SmallLine label="Short Research" value={formatBool(watch.shortResearchOnly)} />
      </SectionBox>

      {primaryScenario && (
        <SectionBox border="rgba(251,191,36,0.32)" background="rgba(113,63,18,0.12)">
          <SmallLine
            label="Scenario"
            value={formatUpper(primaryScenario)}
            valueColor="#fbbf24"
          />
        </SectionBox>
      )}

      <SectionBox border="rgba(56,189,248,0.32)" background="rgba(12,74,110,0.14)">
        <SectionTitle>Engine 22 Levels</SectionTitle>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 7,
          }}
        >
          <LevelPill label="B High" value={bHigh} color="#fbbf24" />
          <LevelPill label="Warn" value={triggerMap.firstWarning} color="#fbbf24" />
          <LevelPill label="B Mid" value={triggerMap.bBounceMid} />
          <LevelPill label="B Low" value={triggerMap.bBounceLower} />
          <LevelPill label="r382" value={triggerMap.parentR382} />
          <LevelPill label="r500" value={triggerMap.parentR500} />
          <LevelPill label="r618" value={triggerMap.parentR618} />
          <LevelPill label="C100" value={triggerMap.c100} color="#fbbf24" />
        </div>

        {bBandLo != null && bBandHi != null && (
          <div
            style={{
              fontFamily: CARD_FONT,
              fontSize: 14,
              lineHeight: 1.3,
              color: "#cbd5e1",
              fontWeight: 700,
            }}
          >
            B-bounce band:{" "}
            <span style={{ color: "#f8fafc" }}>
              {formatLevel(bBandLo)}–{formatLevel(bBandHi)}
            </span>
          </div>
        )}

        {confluenceText && (
          <div
            style={{
              fontFamily: CARD_FONT,
              fontSize: 14,
              lineHeight: 1.3,
              color: "#cbd5e1",
              fontWeight: 700,
            }}
          >
            C100 / parent r618 confluence:{" "}
            <span style={{ color: "#fbbf24" }}>{confluenceText}</span>
          </div>
        )}
      </SectionBox>

      <SectionBox border="rgba(168,85,247,0.35)" background="rgba(59,7,100,0.16)">
        <SectionTitle color="#c084fc">Confirmation Needed</SectionTitle>
        <ConfirmationList items={confirmationNeeds} />
      </SectionBox>

      <SectionBox border="rgba(148,163,184,0.24)" background="rgba(15,23,42,0.32)">
        <SmallLine label="Engine 3" value={engine3Text} />
        <SmallLine label="Engine 4" value={engine4Text} />
        <SmallLine label="Engine 6" value={engine6Text} />
        <SmallLine label="Ticket" value={ticket ? "YES" : "NO"} valueColor={ticket ? "#22c55e" : "#fb7185"} />
      </SectionBox>

      <div
        style={{
          ...TEXT_STYLE,
          color: "#fbbf24",
          borderTop: "1px solid rgba(148,163,184,0.22)",
          paddingTop: 9,
          fontSize: 14,
          fontWeight: 700,
        }}
      >
        Engine 26 does not create permission. Engine 3/4 confirm. Engine 15
        checks risk/path. Engine 6 must approve PAPER_ALLOW.
      </div>

      {plan?.status && (
        <div
          style={{
            ...TEXT_STYLE,
            color: "#94a3b8",
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          Plan: {formatUpper(plan.status)}
        </div>
      )}
    </div>
  );
}
