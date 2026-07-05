// src/pages/rows/RowChart/overlays/Engine26ImbalanceWatchCard.jsx

import React from "react";

const CARD_FONT = '"Trebuchet MS", "Lucida Grande", "Segoe UI", Arial, sans-serif';

const CARD_WIDTH = 470;
const CARD_LEFT = "calc(50% + 430px)";

const TEXT_STYLE = {
  fontFamily: CARD_FONT,
  fontSize: 17,
  lineHeight: 1.38,
  fontWeight: 400,
  color: "#dbeafe",
};const TITLE_STYLE = {
  fontFamily: CARD_FONT,
  fontSize: 21,
  lineHeight: 1.18,
  fontWeight: 600,
  color: "#38bdf8",
};

const LABEL_STYLE = {
  fontFamily: CARD_FONT,
  fontSize: 13,
  lineHeight: 1.25,
  fontWeight: 400,
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
  if (value === true) return "Yes";
  if (value === false) return "No";
  return "—";
}

function labelsContain(labels, text) {
  const safeLabels = Array.isArray(labels) ? labels : [];
  const needle = String(text || "").toUpperCase();

  return safeLabels.some((label) =>
    String(label || "").toUpperCase().includes(needle)
  );
}

function statusColor(status, labels) {
  const s = String(status || "").toUpperCase();

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

function statusBorder(status, labels) {
  const s = String(status || "").toUpperCase();

  if (s.includes("TOP_IMBALANCE") || labelsContain(labels, "TOP_IMBALANCE")) {
    return "rgba(251,191,36,0.62)";
  }

  if (
    s.includes("LOWER_IMBALANCE") ||
    labelsContain(labels, "BOTTOM_IMBALANCE")
  ) {
    return "rgba(56,189,248,0.58)";
  }

  if (s.includes("PAPER_ALLOW")) return "rgba(34,197,94,0.58)";

  return "rgba(56,189,248,0.52)";
}

function SmallLine({ label, value, valueColor = "#dbeafe" }) {
  if (value == null || value === "") return null;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "125px 1fr",
        alignItems: "center",
        gap: 10,
        fontFamily: CARD_FONT,
        fontSize: 15,
        lineHeight: 1.3,
      }}
    >
      <span style={LABEL_STYLE}>{label}</span>
      <span
        style={{
          color: valueColor,
          fontWeight: 500,
          textAlign: "right",
        }}
      >
        {value}
      </span>
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
        padding: "3px 8px",
        fontSize: 12,
        fontWeight: 600,
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
        borderRadius: 11,
        padding: "10px 11px",
        display: "grid",
        gap: 6,
      }}
    >
      {children}
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
  const longTerm = watch.waveContext?.longTermLifecycle || {};
  const intraday = watch.waveContext?.intradayScalpLifecycle || {};
  const engine3 = watch.fastReads?.engine3 || {};
  const engine4 = watch.fastReads?.engine4 || {};
  const permission = watch.permission || {};

  const status = String(watch.status || "").toUpperCase();
  const color = statusColor(status, watch.labels);
  const border = statusBorder(status, watch.labels);

  const isTop =
    status.includes("TOP_IMBALANCE") ||
    labelsContain(watch.labels, "TOP_IMBALANCE");

  const isLower =
    status.includes("LOWER_IMBALANCE") ||
    labelsContain(watch.labels, "BOTTOM_IMBALANCE");

  const statusLabel = isTop
    ? "Top Imbalance Active"
    : isLower
    ? "Lower Imbalance Active"
    : formatText(watch.status, "Manual Imbalance Watch");

  const action = isTop
    ? "Watch acceptance or rejection."
    : isLower
    ? "Watch sweep reclaim or support failure."
    : "Watch reaction. Direction is not assumed.";

  const zoneText =
    zone.lo != null && zone.hi != null
      ? `${formatLevel(zone.lo)}–${formatLevel(zone.hi)}`
      : "—";

  const waveText = `${formatText(
    longTerm.key,
    "Intermediate context"
  )} / ${formatText(intraday.key, "Intraday scalp context")}`;

  const engine3Text = `${formatUpper(engine3.state, "NO SIGNAL")} / ${formatUpper(
    engine3.quality,
    "—"
  )} / ${formatUpper(engine3.direction, "NEUTRAL")}`;

  const engine4Text = `${formatUpper(engine4.state, "NO SIGNAL")} / ${formatUpper(
    engine4.quality,
    "—"
  )}`;

  const engine6Text = formatUpper(permission.engine6Decision, "PAPER STAND DOWN");

  return (
    <div
      style={{
        fontFamily: CARD_FONT,
        position: "absolute",
        top: 95,
        left: CARD_LEFT,
        zIndex: 109,
        width: CARD_WIDTH,
        maxWidth: "32%",
        borderRadius: 15,
        border: `1px solid ${border}`,
        background: "rgba(6,10,20,0.97)",
        padding: "14px 15px",
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
            Engine 26 — Manual Imbalance Watch
          </div>

          <div
            style={{
              ...TEXT_STYLE,
              color: "#f8fafc",
              fontSize: 15,
              marginTop: 4,
            }}
          >
            {symbol} • {formatText(watch.mode)} • Watch Only
          </div>
        </div>

        <StatusBadge label={statusLabel} color={color} />
      </div>

      <SectionBox
        border={border}
        background={isTop ? "rgba(113,63,18,0.16)" : "rgba(12,74,110,0.16)"}
      >
        <SmallLine label="Zone" value={zoneText} valueColor="#f8fafc" />
        <SmallLine label="Current" value={formatLevel(watch.currentPrice)} />
        <SmallLine
          label="Distance"
          value={
            zone.distancePts != null ? `${formatLevel(zone.distancePts)} pts` : "—"
          }
        />
        <SmallLine label="Near" value={formatBool(zone.near)} />
        <SmallLine label="Inside" value={formatBool(zone.inside)} />
        <SmallLine label="Alarm" value={formatBool(watch.alarmAllEngines)} />
      </SectionBox>

      <div style={TEXT_STYLE}>
        <span style={{ color: "#94a3b8" }}>Wave: </span>
        <span style={{ color: "#f8fafc" }}>{waveText}</span>
      </div>

      <div style={TEXT_STYLE}>
        <span style={{ color: "#94a3b8" }}>Engine 3: </span>
        <span style={{ color: "#f8fafc" }}>{engine3Text}</span>
      </div>

      <div style={TEXT_STYLE}>
        <span style={{ color: "#94a3b8" }}>Engine 4: </span>
        <span style={{ color: "#f8fafc" }}>{engine4Text}</span>
      </div>

      <div style={TEXT_STYLE}>
        <span style={{ color: "#94a3b8" }}>Engine 6: </span>
        <span style={{ color: "#f8fafc" }}>{engine6Text}</span>
        <span style={{ color: "#94a3b8" }}> • Ticket </span>
        <span style={{ color: ticket ? "#22c55e" : "#fb7185" }}>
          {ticket ? "Yes" : "No"}
        </span>
      </div>

      <div
        style={{
          ...TEXT_STYLE,
          color: "#fbbf24",
          borderTop: "1px solid rgba(148,163,184,0.22)",
          paddingTop: 8,
        }}
      >
        {action} Direction is not assumed. No paper trade until Engine 6
        PAPER_ALLOW.
      </div>

      {plan?.status && (
        <div
          style={{
            ...TEXT_STYLE,
            color: "#94a3b8",
            fontSize: 13,
          }}
        >
          Plan: {formatUpper(plan.status)}
        </div>
      )}
    </div>
  );
}
