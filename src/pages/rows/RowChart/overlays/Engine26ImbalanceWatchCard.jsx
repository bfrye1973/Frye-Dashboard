// src/pages/rows/RowChart/overlays/Engine26ImbalanceWatchCard.jsx

import React from "react";

const CARD_FONT = '"Trebuchet MS", "Lucida Grande", "Segoe UI", Arial, sans-serif';

const TEXT_STYLE = {
  fontFamily: CARD_FONT,
  fontSize: 14,
  lineHeight: 1.4,
  fontWeight: 400,
  color: "#dbeafe",
};

const TITLE_STYLE = {
  fontFamily: CARD_FONT,
  fontSize: 17,
  fontWeight: 500,
  textTransform: "none",
  letterSpacing: "0.01em",
};

const LABEL_STYLE = {
  fontFamily: CARD_FONT,
  fontSize: 12,
  lineHeight: 1.3,
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

function statusColor(status) {
  const s = String(status || "").toUpperCase();

  if (s.includes("TOP_IMBALANCE")) return "#fbbf24";
  if (s.includes("LOWER_IMBALANCE")) return "#38bdf8";
  if (s.includes("PAPER_ALLOW")) return "#22c55e";

  return "#fbbf24";
}

function statusBorder(status) {
  const s = String(status || "").toUpperCase();

  if (s.includes("TOP_IMBALANCE")) return "rgba(251,191,36,0.60)";
  if (s.includes("LOWER_IMBALANCE")) return "rgba(56,189,248,0.55)";
  if (s.includes("PAPER_ALLOW")) return "rgba(34,197,94,0.55)";

  return "rgba(251,191,36,0.55)";
}

function SmallLine({ label, value, valueColor = "#dbeafe" }) {
  if (value == null || value === "") return null;

  return (
    <div
      style={{
        fontFamily: CARD_FONT,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 10,
        fontSize: 13,
        lineHeight: 1.35,
        fontWeight: 400,
      }}
    >
      <span style={LABEL_STYLE}>{label}</span>
      <span
        style={{
          color: valueColor,
          fontWeight: 400,
          textAlign: "right",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function StatusBadge({ label, color = "#fbbf24" }) {
  if (!label) return null;

  return (
    <span
      style={{
        fontFamily: CARD_FONT,
        border: `1px solid ${color}`,
        color,
        background: "rgba(15,23,42,0.62)",
        borderRadius: 999,
        padding: "3px 8px",
        fontSize: 11,
        fontWeight: 500,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
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
  const color = statusColor(status);

  const isTop = status.includes("TOP_IMBALANCE");
  const isLower =
    status.includes("LOWER_IMBALANCE") ||
    String(watch.labels || "").toUpperCase().includes("BOTTOM_IMBALANCE");

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
        top: 105,
        left: "calc(50% + 430px)",
        zIndex: 109,
        width: 430,
        maxWidth: "28%",
        borderRadius: 14,
        border: `1px solid ${statusBorder(status)}`,
        background: "rgba(6,10,20,0.96)",
        padding: "12px 15px",
        color: "#e5e7eb",
        backdropFilter: "blur(4px)",
        pointerEvents: "none",
        textAlign: "left",
        boxShadow: "0 8px 24px rgba(0,0,0,0.30)",
        display: "grid",
        gap: 8,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "start",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div>
          <div
            style={{
              ...TITLE_STYLE,
              color,
              fontSize: 18,
            }}
          >
            Engine 26 — Manual imbalance watch
          </div>

          <div
            style={{
              ...TEXT_STYLE,
              color: "#f8fafc",
              marginTop: 3,
            }}
          >
            {symbol} • {formatText(watch.mode)} • Watch Only
          </div>
        </div>

        <StatusBadge label={statusLabel} color={color} />
      </div>

      <div
        style={{
          border: `1px solid ${statusBorder(status)}`,
          background: isTop
            ? "rgba(113,63,18,0.14)"
            : "rgba(12,74,110,0.14)",
          borderRadius: 10,
          padding: "8px 10px",
          display: "grid",
          gap: 5,
        }}
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
      </div>

      <div style={{ ...TEXT_STYLE, color: "#dbeafe" }}>
        <span style={{ color: "#94a3b8" }}>Wave context: </span>
        {waveText}
      </div>

      <div style={{ ...TEXT_STYLE }}>
        <span style={{ color: "#94a3b8" }}>Fast reads: </span>
        Engine 3 {engine3Text} • Engine 4 {engine4Text}
      </div>

      <div style={{ ...TEXT_STYLE }}>
        <span style={{ color: "#94a3b8" }}>Permission: </span>
        Engine 6 {engine6Text} • Ticket {ticket ? "Yes" : "No"}
      </div>

      <div
        style={{
          ...TEXT_STYLE,
          color: "#fbbf24",
          borderTop: "1px solid rgba(148,163,184,0.18)",
          paddingTop: 7,
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
            fontSize: 12,
          }}
        >
          Plan: {formatUpper(plan.status)}
        </div>
      )}
    </div>
  );
}
