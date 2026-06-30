// src/pages/rows/RowChart/overlays/Engine26ImbalanceWatchCard.jsx

import React from "react";

const CARD_FONT = '"Trebuchet MS", "Lucida Grande", "Segoe UI", Arial, sans-serif';

const CARD_WIDTH = 520;
const CARD_LEFT = "calc(50% + 430px)";

const TEXT_STYLE = {
  fontFamily: CARD_FONT,
  fontSize: 24,
  lineHeight: 1.35,
  fontWeight: 400,
  color: "#dbeafe",
};

const TITLE_STYLE = {
  fontFamily: CARD_FONT,
  fontSize: 28,
  fontWeight: 600,
  textTransform: "none",
  letterSpacing: "0.01em",
};

const LABEL_STYLE = {
  fontFamily: CARD_FONT,
  fontSize: 20,
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
  const needle = String(text || "").toUpperCase();
  const safeLabels = Array.isArray(labels) ? labels : [];

  return safeLabels.some((label) =>
    String(label || "").toUpperCase().includes(needle)
  );
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

  if (s.includes("TOP_IMBALANCE")) return "rgba(251,191,36,0.68)";
  if (s.includes("LOWER_IMBALANCE")) return "rgba(56,189,248,0.65)";
  if (s.includes("PAPER_ALLOW")) return "rgba(34,197,94,0.65)";

  return "rgba(251,191,36,0.62)";
}

function SmallLine({ label, value, valueColor = "#dbeafe" }) {
  if (value == null || value === "") return null;

  return (
    <div
      style={{
        fontFamily: CARD_FONT,
        display: "grid",
        gridTemplateColumns: "190px 1fr",
        alignItems: "center",
        gap: 14,
        fontSize: 22,
        lineHeight: 1.25,
        fontWeight: 400,
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

function StatusBadge({ label, color = "#fbbf24" }) {
  if (!label) return null;

  return (
    <span
      style={{
        fontFamily: CARD_FONT,
        border: `1px solid ${color}`,
        color,
        background: "rgba(15,23,42,0.72)",
        borderRadius: 999,
        padding: "6px 11px",
        fontSize: 17,
        fontWeight: 600,
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
        maxWidth: "34%",
        borderRadius: 16,
        border: `1px solid ${statusBorder(status)}`,
        background: "rgba(6,10,20,0.97)",
        padding: "18px 20px",
        color: "#e5e7eb",
        backdropFilter: "blur(4px)",
        pointerEvents: "none",
        textAlign: "left",
        boxShadow: "0 10px 30px rgba(0,0,0,0.34)",
        display: "grid",
        gap: 14,
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto",
          alignItems: "start",
          gap: 14,
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
              fontSize: 22,
              marginTop: 5,
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
            ? "rgba(113,63,18,0.16)"
            : "rgba(12,74,110,0.16)",
          borderRadius: 12,
          padding: "13px 14px",
          display: "grid",
          gap: 8,
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

      <div style={{ ...TEXT_STYLE }}>
        <span style={{ color: "#94a3b8" }}>Wave context: </span>
        <span style={{ color: "#f8fafc" }}>{waveText}</span>
      </div>

      <div style={{ ...TEXT_STYLE }}>
        <span style={{ color: "#94a3b8" }}>Engine 3: </span>
        <span style={{ color: "#f8fafc" }}>{engine3Text}</span>
      </div>

      <div style={{ ...TEXT_STYLE }}>
        <span style={{ color: "#94a3b8" }}>Engine 4: </span>
        <span style={{ color: "#f8fafc" }}>{engine4Text}</span>
      </div>

      <div style={{ ...TEXT_STYLE }}>
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
          paddingTop: 11,
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
            fontSize: 20,
          }}
        >
          Plan: {formatUpper(plan.status)}
        </div>
      )}
    </div>
  );
}
