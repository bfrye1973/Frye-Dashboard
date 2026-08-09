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

function formatPoints(value) {
  const n = Number(value);
  return Number.isFinite(n) ? `${n.toFixed(2)} pts` : "—";
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
  const list = Array.isArray(items) ? items.slice(0, 5) : [];
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

function getDirectionColor(direction) {
  const d = String(direction || "").toUpperCase();
  if (d.includes("SHORT")) return "#fbbf24";
  if (d.includes("LONG")) return "#22c55e";
  return "#38bdf8";
}

function getStrategy1DisplayState(strategy1Setup) {
  if (!strategy1Setup || typeof strategy1Setup !== "object") {
    return {
      label: "STRATEGY 1 NOT ATTACHED",
      color: "#38bdf8",
      border: "rgba(56,189,248,0.58)",
      background: "rgba(12,74,110,0.14)",
      invalidated: false,
      identityMismatch: false,
      hardBlocked: false,
      reactionConfirmed: false,
      participationConfirmed: false,
    };
  }

  const reaction = strategy1Setup?.reaction || {};
  const participation = strategy1Setup?.participation || {};

  const invalidated =
    strategy1Setup?.completedCloseInvalidationConfirmed === true ||
    String(strategy1Setup?.status || "").toUpperCase() === "INVALIDATED";

  const reactionIdentityMismatch =
    reaction?.candidateId != null &&
    reaction?.zoneId != null &&
    (
      reaction.candidateId !== strategy1Setup.candidateId ||
      reaction.zoneId !== strategy1Setup.zoneId
    );

  const participationIdentityMismatch =
    participation?.candidateId != null &&
    participation?.zoneId != null &&
    (
      participation.candidateId !== strategy1Setup.candidateId ||
      participation.zoneId !== strategy1Setup.zoneId
    );

  const identityMismatch =
    reactionIdentityMismatch || participationIdentityMismatch;

  const hardBlocked = participation?.hardBlocked === true;
  const reactionConfirmed = reaction?.confirmed === true;
  const participationConfirmed = participation?.confirmed === true;

  if (invalidated) {
    return {
      label: "INVALIDATED BY COMPLETED CLOSE",
      color: "#fb7185",
      border: "rgba(244,63,94,0.62)",
      background: "rgba(127,29,29,0.15)",
      invalidated,
      identityMismatch,
      hardBlocked,
      reactionConfirmed,
      participationConfirmed,
    };
  }

  if (identityMismatch) {
    return {
      label: "STRATEGY 1 IDENTITY MISMATCH",
      color: "#fb7185",
      border: "rgba(244,63,94,0.62)",
      background: "rgba(127,29,29,0.15)",
      invalidated,
      identityMismatch,
      hardBlocked,
      reactionConfirmed,
      participationConfirmed,
    };
  }

  if (hardBlocked) {
    return {
      label: "STRATEGY 1 HARD BLOCKED",
      color: "#fb7185",
      border: "rgba(244,63,94,0.62)",
      background: "rgba(127,29,29,0.15)",
      invalidated,
      identityMismatch,
      hardBlocked,
      reactionConfirmed,
      participationConfirmed,
    };
  }

  if (reactionConfirmed && participationConfirmed) {
    return {
      label: "REACTION + PARTICIPATION CONFIRMED",
      color: "#22c55e",
      border: "rgba(34,197,94,0.62)",
      background: "rgba(20,83,45,0.13)",
      invalidated,
      identityMismatch,
      hardBlocked,
      reactionConfirmed,
      participationConfirmed,
    };
  }

  if (reactionConfirmed) {
    return {
      label: "REACTION CONFIRMED — PARTICIPATION WAITING",
      color: "#2dd4bf",
      border: "rgba(45,212,191,0.58)",
      background: "rgba(19,78,74,0.13)",
      invalidated,
      identityMismatch,
      hardBlocked,
      reactionConfirmed,
      participationConfirmed,
    };
  }

  if (participationConfirmed) {
    return {
      label: "PARTICIPATION CONFIRMED — REACTION WAITING",
      color: "#2dd4bf",
      border: "rgba(45,212,191,0.58)",
      background: "rgba(19,78,74,0.13)",
      invalidated,
      identityMismatch,
      hardBlocked,
      reactionConfirmed,
      participationConfirmed,
    };
  }

  return {
    label: "WAITING FOR REACTION + PARTICIPATION",
    color: "#38bdf8",
    border: "rgba(56,189,248,0.58)",
    background: "rgba(12,74,110,0.14)",
    invalidated,
    identityMismatch,
    hardBlocked,
    reactionConfirmed,
    participationConfirmed,
  };
}


const SUBMINUTE_EXPECTED_IDENTITY = {
  laneId: "subminute",
  strategyId: "subminute_scalp@10m",
  candidateId: "E26C-SUBMINUTE-87288e1db54cb920bfd4",
  zoneId: "E26Z-SUBMINUTE-d15bf89c7c189d747288",
};

function validateSubminuteEngine26Contract(contract) {
  const objects = [
    contract?.locationCandidate,
    contract?.pipelineIdentity,
    contract?.locationContext,
    contract?.controlMap,
    contract?.proposedGeometry,
  ];

  if (objects.some((item) => !item || typeof item !== "object")) {
    return { attached: false, valid: false };
  }

  return {
    attached: true,
    valid: objects.every(
      (item) =>
        item.candidateId === SUBMINUTE_EXPECTED_IDENTITY.candidateId &&
        item.zoneId === SUBMINUTE_EXPECTED_IDENTITY.zoneId &&
        item.strategyId === SUBMINUTE_EXPECTED_IDENTITY.strategyId &&
        item.laneId === SUBMINUTE_EXPECTED_IDENTITY.laneId
    ),
  };
}

export default function Engine26ImbalanceWatchCard({
  visible = true,
  watch = null,
  plan = null,
  tradePlanPreview = null,
  geometryPreviews = null,
  ticket = null,
  symbol = "ES",
  selectedWaveDegree = "minute",
  subminuteEngine26 = null,
}) {
  if (!visible) return null;

  const normalizedWaveDegree = String(
    selectedWaveDegree || "minute"
  ).toLowerCase();


  if (normalizedWaveDegree === "subminute") {
    const validation = validateSubminuteEngine26Contract(subminuteEngine26);

    if (validation.attached && !validation.valid) {
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
            border: "1px solid rgba(244,63,94,0.62)",
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
          <div style={{ ...TITLE_STYLE, color: "#fb7185" }}>
            Engine 26 — Trade Plan Preview
          </div>
          <SectionBox
            border="rgba(244,63,94,0.62)"
            background="rgba(127,29,29,0.15)"
          >
            <SectionTitle color="#fb7185">
              SUBMINUTE ENGINE 26 IDENTITY MISMATCH
            </SectionTitle>
            <div style={TEXT_STYLE}>
              The Subminute Engine 26 objects do not preserve the same
              candidate, zone, strategy, and lane identity.
            </div>
          </SectionBox>
        </div>
      );
    }

    if (validation.attached && validation.valid) {
      const locationCandidate = subminuteEngine26.locationCandidate;
      const pipelineIdentity = subminuteEngine26.pipelineIdentity;
      const locationContext = subminuteEngine26.locationContext;
      const controlMap = subminuteEngine26.controlMap;
      const proposedGeometry = subminuteEngine26.proposedGeometry;
      const zone = locationContext?.zone || locationCandidate?.location || {};
      const proposedTargets = Array.isArray(proposedGeometry?.proposedTargets)
        ? proposedGeometry.proposedTargets
        : [];
      const plannerStatus =
        proposedGeometry?.lifecycleStatus || "NOT ATTACHED";
      const plannerReady =
        proposedGeometry?.active === true &&
        String(proposedGeometry?.lifecycleStatus || "").toUpperCase() ===
          "PROPOSED_GEOMETRY_AVAILABLE";
      const direction =
        locationCandidate?.direction ||
        pipelineIdentity?.direction ||
        controlMap?.direction ||
        proposedGeometry?.direction ||
        "LONG";
      const noExecution =
        proposedGeometry?.noExecution === true ||
        locationCandidate?.noExecution === true ||
        locationContext?.noExecution === true ||
        controlMap?.noExecution === true;

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
            border: "1px solid rgba(34,197,94,0.62)",
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
              <div style={{ ...TITLE_STYLE, color: "#22c55e" }}>
                Engine 26 — Trade Plan Preview
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
                {symbol} • Subminute lane • Proposal only
              </div>
            </div>
            <StatusBadge
              label={formatUpper(locationCandidate?.status, "ACTIVE")}
              color="#22c55e"
            />
          </div>

          <SectionBox border="rgba(34,197,94,0.46)" background="rgba(20,83,45,0.13)">
            <SmallLine label="Lane" value="SUBMINUTE" valueColor="#22c55e" />
            <SmallLine label="Strategy" value="SUBMINUTE SCALP @ 10M" />
            <SmallLine label="Direction" value={formatUpper(direction)} valueColor={getDirectionColor(direction)} />
            <SmallLine label="Candidate ID" value={locationCandidate?.candidateId} />
            <SmallLine label="Zone ID" value={locationCandidate?.zoneId} />
            <SmallLine label="Pipeline Complete" value={formatBool(pipelineIdentity?.complete)} valueColor="#22c55e" />
          </SectionBox>

          <SectionBox border="rgba(148,163,184,0.28)" background="rgba(15,23,42,0.36)">
            <SectionTitle>Alarm Zone</SectionTitle>
            <SmallLine label="Status" value={formatUpper(locationCandidate?.status)} valueColor="#22c55e" />
            <SmallLine label="Zone" value={zone?.lo != null && zone?.hi != null ? `${formatLevel(zone.lo)}–${formatLevel(zone.hi)}` : "—"} />
            <SmallLine label="Current" value={formatLevel(locationContext?.currentPrice)} />
            <SmallLine label="Relation" value={formatUpper(locationContext?.relation)} />
            <SmallLine label="Distance" value={formatPoints(locationContext?.distancePoints)} />
            <SmallLine label="Trigger TF" value={formatUpper(locationContext?.triggerTimeframe)} />
            <SmallLine label="Context TF" value={formatUpper(locationContext?.contextTimeframe)} />
          </SectionBox>

          <SectionBox border="rgba(56,189,248,0.32)" background="rgba(12,74,110,0.14)">
            <SectionTitle>Trade Plan Preview</SectionTitle>
            <SmallLine label="Planner Status" value={formatUpper(plannerStatus)} valueColor="#22c55e" />
            <SmallLine label="Planner Ready" value={formatBool(plannerReady)} valueColor="#22c55e" />
            <SmallLine label="Entry idea" value={formatLevel(proposedGeometry?.proposedEntryPrice)} />
            <SmallLine label="Stop idea" value={formatLevel(proposedGeometry?.proposedStopPrice)} valueColor="#fb7185" />
            <SmallLine label="Risk preview" value={formatPoints(proposedGeometry?.proposedStopDistancePoints)} valueColor="#fb7185" />
            <SmallLine label="Reward preview" value="—" valueColor="#22c55e" />
            <SmallLine label="Preview R/R" value="—" valueColor="#22c55e" />
          </SectionBox>

          <SectionBox border="rgba(251,191,36,0.32)" background="rgba(113,63,18,0.12)">
            <SectionTitle color="#fbbf24">Structure</SectionTitle>
            <SmallLine label="Control State" value={formatUpper(controlMap?.currentControlState)} valueColor="#fbbf24" />
            <SmallLine label="Required Reaction" value={formatUpper(controlMap?.requiredReaction)} />
            <SmallLine label="Trigger Level" value={formatLevel(controlMap?.triggerLevel)} />
            <SmallLine label="Acceptance" value={formatLevel(controlMap?.acceptanceBoundary)} />
            <SmallLine label="Reclaim" value={formatLevel(controlMap?.reclaimBoundary)} />
            <SmallLine label="Invalidation" value={formatLevel(controlMap?.invalidationBoundary)} valueColor="#fb7185" />
          </SectionBox>

          <SectionBox border="rgba(34,197,94,0.32)" background="rgba(20,83,45,0.12)">
            <SectionTitle color="#22c55e">Target Map</SectionTitle>
            <SmallLine label="Targets attached" value={proposedTargets.length ? "YES" : "NO"} valueColor={proposedTargets.length ? "#22c55e" : "#fbbf24"} />
            <SmallLine label="Target count" value={String(proposedTargets.length)} />
            <SmallLine label="First target" value={proposedTargets[0]?.price != null ? formatLevel(proposedTargets[0].price) : "—"} />
            <SmallLine label="Target source zones" value={Array.isArray(controlMap?.targetSourceZones) ? String(controlMap.targetSourceZones.length) : "0"} />
          </SectionBox>

          <SectionBox border="rgba(168,85,247,0.35)" background="rgba(59,7,100,0.16)">
            <SectionTitle color="#c084fc">Confirmation Needed</SectionTitle>
            <ConfirmationList
              items={[
                controlMap?.requiredReaction,
                controlMap?.invalidationCondition,
                "ENGINE6_PERMISSION_NOT_ATTACHED",
              ].filter(Boolean)}
            />
          </SectionBox>

          <SectionBox border="rgba(148,163,184,0.24)" background="rgba(15,23,42,0.32)">
            <SectionTitle>Activation Check</SectionTitle>
            <SmallLine label="Proposal Only" value={formatBool(proposedGeometry?.proposalOnly)} />
            <SmallLine label="Official" value={formatBool(proposedGeometry?.official)} />
            <SmallLine label="Executable" value={formatBool(!proposedGeometry?.nonExecutable)} valueColor="#fb7185" />
            <SmallLine label="No Execution" value={formatBool(noExecution)} valueColor="#fb7185" />
            <SmallLine label="Engine 6" value="NOT ATTACHED" valueColor="#fbbf24" />
            <SmallLine label="Ticket" value="NO" valueColor="#fb7185" />
          </SectionBox>

          <SectionBox border="rgba(168,85,247,0.35)" background="rgba(59,7,100,0.16)">
            <SectionTitle color="#c084fc">Engine 7 Size Preview</SectionTitle>
            <SmallLine label="Mode" value="NOT ATTACHED" />
            <SmallLine label="Allowed" value="NO" valueColor="#fb7185" />
            <SmallLine label="Engine 6" value="NOT ATTACHED" />
            <SmallLine label="Score" value="—" />
            <div style={{ ...TEXT_STYLE, fontSize: 13, fontWeight: 700, color: "#cbd5e1" }}>
              Engine 7 sizing is not attached for the Subminute lane.
            </div>
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
            Subminute Engine 26 candidate, zone, location, control map, and proposal geometry are attached.
            Engine 6, Engine 7, Engine 9, Engine 8, and Engine 10 remain unattached and non-executable.
          </div>

          <div style={{ ...TEXT_STYLE, color: "#94a3b8", fontSize: 13, fontWeight: 700 }}>
            Plan: {formatUpper(plannerStatus)}
          </div>
        </div>
      );
    }
  }

  if (normalizedWaveDegree !== "minute") {
    const laneLabel =
      normalizedWaveDegree === "subminute"
        ? "Subminute"
        : normalizedWaveDegree === "minor"
        ? "Minor"
        : normalizedWaveDegree === "intermediate"
        ? "Intermediate"
        : normalizedWaveDegree === "primary"
        ? "Primary"
        : formatText(normalizedWaveDegree, "Selected");

    const unavailableTitle = `${laneLabel} Engine 26 Trade Plan not attached`;

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
          border: "1px solid rgba(56,189,248,0.58)",
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
                color: "#38bdf8",
              }}
            >
              Engine 26 — Trade Plan Preview
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
              {symbol} • {laneLabel} lane • Read only
            </div>
          </div>

          <StatusBadge label="NOT ATTACHED" color="#38bdf8" />
        </div>

        <SectionBox border="rgba(56,189,248,0.32)" background="rgba(12,74,110,0.14)">
          <SmallLine label="Status" value="NOT ATTACHED" valueColor="#38bdf8" />
          <SmallLine label="Template" value="—" />
          <SmallLine label="Role" value="—" />
          <SmallLine label="Bias" value="—" />
          <SmallLine label="Action" value="—" />
        </SectionBox>

        <SectionBox border="rgba(148,163,184,0.28)" background="rgba(15,23,42,0.36)">
          <SectionTitle>Alarm Zone</SectionTitle>
          <SmallLine label="Alarm" value="NOT ATTACHED" valueColor="#38bdf8" />
          <SmallLine label="Zone" value="—" />
          <SmallLine label="Current" value="—" />
          <SmallLine label="Inside / Near" value="— / —" />
          <SmallLine label="Preferred Dir" value="—" />
          <SmallLine label="No Long Chase" value="—" />
          <SmallLine label="Short Research" value="—" />
        </SectionBox>

        <SectionBox border="rgba(56,189,248,0.32)" background="rgba(12,74,110,0.14)">
          <SectionTitle>Trade Plan Preview</SectionTitle>
          <SmallLine label="Entry idea" value="—" />
          <SmallLine label="Stop idea" value="—" />
          <SmallLine label="Confirm gate" value="—" />
          <SmallLine label="Risk preview" value="—" />
          <SmallLine label="Reward preview" value="—" />
          <SmallLine label="Preview R/R" value="—" />
        </SectionBox>

        <SectionBox border="rgba(251,191,36,0.32)" background="rgba(113,63,18,0.12)">
          <SectionTitle color="#fbbf24">Structure</SectionTitle>
          <SmallLine label="Scenario" value="NOT ATTACHED" valueColor="#fbbf24" />
          <SmallLine label="Old B" value="—" />
          <SmallLine label="Active B" value="—" />
        </SectionBox>

        <SectionBox border="rgba(34,197,94,0.32)" background="rgba(20,83,45,0.12)">
          <SectionTitle color="#22c55e">Target Map</SectionTitle>
          <SmallLine label="Scalp goal" value="—" valueColor="#22c55e" />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 7,
            }}
          >
            <LevelPill label="C100 / first reaction" value="—" color="#fbbf24" />
            <LevelPill label="A-low break" value="—" color="#f8fafc" />
            <LevelPill label="C1272 / pressure" value="—" color="#22c55e" />
            <LevelPill label="C1618 / stretch" value="—" color="#38bdf8" />
          </div>
        </SectionBox>

        <SectionBox border="rgba(168,85,247,0.35)" background="rgba(59,7,100,0.16)">
          <SectionTitle color="#c084fc">Confirmation Needed</SectionTitle>
          <div
            style={{
              ...TEXT_STYLE,
              fontSize: 13,
              color: "#cbd5e1",
              fontWeight: 700,
            }}
          >
            {unavailableTitle}
          </div>
        </SectionBox>

        <SectionBox border="rgba(148,163,184,0.24)" background="rgba(15,23,42,0.32)">
          <SectionTitle>Activation Check</SectionTitle>
          <SmallLine label="Engine 15" value="—" />
          <SmallLine label="Engine 3" value="—" />
          <SmallLine label="Engine 4" value="—" />
          <SmallLine label="Engine 6" value="NOT ATTACHED" valueColor="#fbbf24" />
          <SmallLine label="Paper allowed" value="NO" valueColor="#fb7185" />
          <SmallLine label="Ticket" value="NO" valueColor="#fb7185" />
        </SectionBox>

        <SectionBox border="rgba(168,85,247,0.35)" background="rgba(59,7,100,0.16)">
          <SectionTitle color="#c084fc">Engine 7 Size Preview</SectionTitle>
          <SmallLine label="Mode" value="R ONLY PREVIEW" />
          <SmallLine label="Allowed" value="NO" valueColor="#fb7185" />
          <SmallLine label="Engine 6" value="NOT ATTACHED" />
          <SmallLine label="Score" value="—" />

          <div
            style={{
              ...TEXT_STYLE,
              fontSize: 13,
              fontWeight: 700,
              color: "#cbd5e1",
            }}
          >
            No lane-owned Engine 26 candidate, zone, control map, or trade plan
            is attached for this wavelength.
          </div>
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
          {unavailableTitle}. No Minute Engine 26 data is reused.
        </div>

        <div
          style={{
            ...TEXT_STYLE,
            color: "#94a3b8",
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          Plan: NOT ATTACHED
        </div>
      </div>
    );
  }

const minuteWatchAttached =
  watch &&
  typeof watch === "object";

const minuteWatch = minuteWatchAttached
  ? watch
  : {};

const minuteWatchActive =
  minuteWatch?.active === true;

const structuralPlaybook =
  minuteWatch.structuralPlaybook || {};

const watchLevels =
  structuralPlaybook.watchLevels || {};

const triggerMap =
  structuralPlaybook.triggerMap || {};

const engine3 =
  minuteWatch?.fastReads?.engine3 || {};

const engine4 =
  minuteWatch?.fastReads?.engine4 || {};

const permission =
  minuteWatch.permission || {};

const preview =
  tradePlanPreview ||
  minuteWatch.tradePlanPreview ||
  null;

const generalContext =
  preview?.generalContext || null;

const strategy1Setup =
  preview?.strategy1Setup || null;

const strategy1Attached =
  strategy1Setup &&
  typeof strategy1Setup === "object" &&
  strategy1Setup.candidateId &&
  strategy1Setup.zoneId &&
  strategy1Setup.laneId === "minute" &&
  strategy1Setup.strategyId === "intraday_scalp@10m";

const strategy1State =
  getStrategy1DisplayState(strategy1Setup);

const strategy1EntryZone =
  strategy1Setup?.entryZone || null;

const strategy1TargetZone =
  strategy1Setup?.targetZone || null;

const strategy1Reaction =
  strategy1Setup?.reaction || {};

const strategy1Participation =
  strategy1Setup?.participation || {};

/*
 * Legacy watch-zone data remains compatibility context only.
 * It must not control the Strategy 1 header when the child is attached.
 */
const legacyZone =
  minuteWatch.activeImbalance || {};

const structure = preview?.structure || null;
const entryIdea = preview?.entryIdea || null;
const stopIdea = preview?.stopIdea || null;
const confirmationGate = preview?.confirmationGate || null;
const geometryPreview = preview?.geometryPreview || null;
const engine7Sizing = preview?.engine7Sizing || null;
const permissionState = preview?.permissionState || null;

const legacyStatus =
  String(
    minuteWatch.status ||
    structuralPlaybook.status ||
    ""
  ).toUpperCase();

const legacyStructuralBias =
  minuteWatch.structuralBias ||
  structuralPlaybook.structuralBias ||
  "NEUTRAL";

const color =
  strategy1Attached
    ? strategy1State.color
    : statusColor(
        legacyStatus,
        minuteWatch.labels,
        legacyStructuralBias
      );

const border =
  strategy1Attached
    ? strategy1State.border
    : statusBorder(
        legacyStatus,
        minuteWatch.labels,
        legacyStructuralBias
      );

const statusLabel =
  strategy1Attached
    ? strategy1State.label
    : minuteWatchActive
    ? (
        minuteWatch?.activeImbalanceRole ||
        structuralPlaybook?.activeImbalanceRole
          ? formatUpper(
              minuteWatch?.activeImbalanceRole ||
              structuralPlaybook?.activeImbalanceRole
            )
          : formatText(
              minuteWatch?.status,
              "Structural Imbalance Watch"
            )
      )
    : minuteWatchAttached
    ? "WAITING FOR STRATEGY 1 PREVIEW"
    : "ENGINE 26 NOT ATTACHED";

const strategy1ZoneText =
  strategy1EntryZone?.low != null &&
  strategy1EntryZone?.high != null
    ? `${formatLevel(strategy1EntryZone.low)}–${formatLevel(
        strategy1EntryZone.high
      )}`
    : strategy1Setup?.location?.lo != null &&
      strategy1Setup?.location?.hi != null
    ? `${formatLevel(strategy1Setup.location.lo)}–${formatLevel(
        strategy1Setup.location.hi
      )}`
    : "—";

const generalContextZoneText =
  generalContext?.zone?.lo != null &&
  generalContext?.zone?.hi != null
    ? `${formatLevel(generalContext.zone.lo)}–${formatLevel(
        generalContext.zone.hi
      )}`
    : "—";

const targetZoneText =
  strategy1TargetZone?.low != null &&
  strategy1TargetZone?.high != null
    ? `${formatLevel(strategy1TargetZone.low)}–${formatLevel(
        strategy1TargetZone.high
      )}`
    : "—";

const legacyZoneText =
  legacyZone.lo != null &&
  legacyZone.hi != null
    ? `${formatLevel(legacyZone.lo)}–${formatLevel(legacyZone.hi)}`
    : "—";

const engine3Text = `${formatUpper(engine3.state, "NO SIGNAL")} / ${formatUpper(
    engine3.quality,
    "—"
  )} / ${formatUpper(engine3.direction, "NEUTRAL")}`;

const engine4Text = `${formatUpper(engine4.state, "NO SIGNAL")} / ${formatUpper(
    engine4.quality,
    "—"
  )}`;

const template =
  strategy1Attached
    ? strategy1Setup.setupClass ||
      strategy1Setup.setupType ||
      "NEGOTIATED_ZONE_SWEEP_RECLAIM_ROTATION"
    : minuteWatch.structuralTemplate ||
      structuralPlaybook.template ||
      "NEUTRAL_MANUAL_IMBALANCE_WATCH";

const preferredAction =
  strategy1Attached
    ? strategy1State.label
    : minuteWatch.preferredAction ||
      structuralPlaybook.preferredAction ||
      "WAIT_FOR_CONFIRMATION";

const preferredDirection =
  strategy1Attached
    ? strategy1Setup.direction || "LONG"
    : minuteWatch.preferredDirection ||
      structuralPlaybook.preferredDirection ||
      "NONE";

const primaryScenario =
  strategy1Attached
    ? strategy1Setup.setupClass ||
      strategy1Setup.setupType
    : structuralPlaybook.primaryScenario ||
      minuteWatch.playbookWatch?.primaryScenario ||
      null;

const cardDirection =
  strategy1Attached
    ? strategy1Setup.direction || "LONG"
    : structure?.direction || preferredDirection;
const paperAllowed =
    permissionState?.paperAllowed === true ||
    permission.engine6Allowed === true ||
    false;

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
            Engine 26 — Trade Plan Preview
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
            {symbol} • Minute Strategy 1 • Paper only
          </div>
        </div>

        <StatusBadge label={statusLabel} color={color} />
      </div>

      <SectionBox
        border={border}
        background={
          strategy1Attached
            ? strategy1State.background
            : "rgba(113,63,18,0.16)"
        }
      >
        <SmallLine
          label="Status"
          value={
            strategy1Attached
              ? strategy1State.label
              : formatUpper(
                  minuteWatch.status ||
                  structuralPlaybook.status
                )
          }
          valueColor={color}
        />

        <SmallLine
          label="Lane"
          value={
            strategy1Attached
              ? formatUpper(strategy1Setup.laneId, "MINUTE")
              : "MINUTE"
          }
          valueColor="#38bdf8"
        />

        <SmallLine
          label="Strategy"
          value={
            strategy1Attached
              ? formatUpper(strategy1Setup.strategyId)
              : "INTRADAY SCALP @ 10M"
          }
        />

        <SmallLine
          label="Template"
          value={formatUpper(template)}
          valueColor="#f8fafc"
        />

        <SmallLine
          label="Grade"
          value={
            strategy1Attached
              ? formatUpper(strategy1Setup.setupGrade, "A+++")
              : "—"
          }
          valueColor="#fbbf24"
        />

        <SmallLine
          label="Direction"
          value={formatUpper(cardDirection)}
          valueColor={getDirectionColor(cardDirection)}
        />

        <SmallLine
          label="Action"
          value={formatUpper(preferredAction)}
          valueColor="#f8fafc"
        />
      </SectionBox>

      <SectionBox
        border="rgba(148,163,184,0.28)"
        background="rgba(15,23,42,0.36)"
      >
        <SectionTitle>Strategy 1 Location</SectionTitle>
        <SmallLine label="Setup Active" value={formatBool(strategy1Setup?.active)} valueColor={strategy1Setup?.active ? "#22c55e" : "#fbbf24"} />
        <SmallLine label="Zone" value={strategy1Attached ? strategy1ZoneText : legacyZoneText} />
        <SmallLine label="Current" value={formatLevel(strategy1Attached ? strategy1Setup?.currentPrice : minuteWatch.currentPrice)} />
        <SmallLine label="Relation" value={strategy1Attached ? formatUpper(strategy1Setup?.location?.relation) : "—"} />
        <SmallLine label="Direction" value={formatUpper(cardDirection)} valueColor={getDirectionColor(cardDirection)} />
        <SmallLine label="Entry Midline" value={formatLevel(strategy1EntryZone?.midline)} />
        <SmallLine label="Trigger" value={formatLevel(strategy1Setup?.triggerLevel)} valueColor="#22c55e" />
        <SmallLine label="Reclaim" value={formatLevel(strategy1Setup?.reclaimBoundary)} valueColor="#2dd4bf" />
        <SmallLine label="Invalidation" value={formatLevel(strategy1Setup?.locationInvalidationBoundary)} valueColor="#fb7185" />
        <SmallLine label="Completed-Close Invalid" value={formatBool(strategy1Setup?.completedCloseInvalidationConfirmed)} valueColor={strategy1Setup?.completedCloseInvalidationConfirmed ? "#fb7185" : "#22c55e"} />
      </SectionBox>

      <SectionBox border="rgba(56,189,248,0.32)" background="rgba(12,74,110,0.14)">
        <SectionTitle>Strategy 1 Trade Plan</SectionTitle>
        <SmallLine label="Candidate ID" value={strategy1Setup?.candidateId} />
        <SmallLine label="Zone ID" value={strategy1Setup?.zoneId} />
        <SmallLine label="Entry Zone" value={strategy1ZoneText} />
        <SmallLine label="Entry idea" value={entryIdea?.preferredArea || (strategy1EntryZone?.midline != null ? formatLevel(strategy1EntryZone.midline) : "—")} valueColor="#f8fafc" />
        <SmallLine label="Stop idea" value={formatLevel(strategy1Setup?.locationInvalidationBoundary ?? stopIdea?.price)} valueColor="#fb7185" />
        <SmallLine label="Confirm gate" value={strategy1Setup?.triggerLevel != null ? `${formatLevel(strategy1Setup.triggerLevel)} / reclaim and hold` : confirmationGate?.rule || "—"} valueColor="#fbbf24" />
        <SmallLine label="Reaction" value={formatUpper(strategy1Reaction?.status, "WAITING")} valueColor={strategy1Reaction?.confirmed ? "#22c55e" : "#38bdf8"} />
        <SmallLine label="Participation" value={formatUpper(strategy1Participation?.status, "WAITING")} valueColor={strategy1Participation?.confirmed ? "#22c55e" : "#38bdf8"} />
        <SmallLine label="Risk preview" value={formatPoints(geometryPreview?.riskPoints)} valueColor="#fb7185" />
        <SmallLine label="Reward preview" value={formatPoints(geometryPreview?.rewardPoints)} valueColor="#22c55e" />
        <SmallLine label="Preview R/R" value={geometryPreview?.riskReward != null ? `${geometryPreview.riskReward} R` : "—"} valueColor="#22c55e" />
      </SectionBox>

      <SectionBox border="rgba(251,191,36,0.32)" background="rgba(113,63,18,0.12)">
        <SectionTitle color="#fbbf24">General Context — Parent Only</SectionTitle>
        <SmallLine label="Context Only" value={formatBool(generalContext?.contextOnly)} valueColor="#fbbf24" />
        <SmallLine label="Source" value={formatUpper(generalContext?.source)} />
        <SmallLine label="Status" value={formatUpper(generalContext?.status)} />
        <SmallLine label="Parent Zone" value={generalContextZoneText} />
        <SmallLine label="Parent Direction" value={`${formatUpper(generalContext?.direction, "—")} — CONTEXT ONLY`} valueColor="#fbbf24" />
        <SmallLine label="Relation" value={formatUpper(generalContext?.zone?.relation)} />
        <SmallLine label="Distance" value={formatPoints(generalContext?.zone?.distancePoints)} />
        <div style={{ ...TEXT_STYLE, color: "#cbd5e1", fontSize: 13, fontWeight: 700 }}>
          The general parent may be SHORT while Strategy 1 remains LONG. Parent direction does not control the Strategy 1 header, zone, trigger, reclaim, invalidation, or target.
        </div>
      </SectionBox>

      <SectionBox border="rgba(34,197,94,0.32)" background="rgba(20,83,45,0.12)">
        <SectionTitle color="#22c55e">Strategy 1 Target Zone</SectionTitle>
        <SmallLine label="Target Zone" value={targetZoneText} valueColor="#22c55e" />
        <SmallLine label="Target Low" value={formatLevel(strategy1TargetZone?.low)} valueColor="#22c55e" />
        <SmallLine label="Target Midline" value={formatLevel(strategy1TargetZone?.midline)} valueColor="#22c55e" />
        <SmallLine label="Target High" value={formatLevel(strategy1TargetZone?.high)} valueColor="#22c55e" />
        <SmallLine label="Target Source" value={formatUpper(strategy1TargetZone?.source)} />
        <SmallLine label="Runner" value="ENGINE 9 HANDOFF REQUIRED" valueColor="#38bdf8" />
      </SectionBox>

      <SectionBox border="rgba(168,85,247,0.35)" background="rgba(59,7,100,0.16)">
        <SectionTitle color="#c084fc">Confirmation Needed</SectionTitle>
        <ConfirmationList
          items={[
            strategy1Reaction?.confirmed
              ? "ENGINE3_REACTION_CONFIRMED"
              : strategy1Reaction?.status || "ENGINE3_REACTION_WAITING",
            strategy1Participation?.confirmed
              ? "ENGINE4_PARTICIPATION_CONFIRMED"
              : strategy1Participation?.status || "ENGINE4_PARTICIPATION_WAITING",
            strategy1Setup?.completedCloseInvalidationConfirmed
              ? "STRATEGY1_COMPLETED_CLOSE_INVALIDATED"
              : "COMPLETED_CLOSE_INVALIDATION_NOT_CONFIRMED",
            "ENGINE6_FINAL_PERMISSION_REQUIRED",
          ]}
        />
      </SectionBox>

      <SectionBox border="rgba(148,163,184,0.24)" background="rgba(15,23,42,0.32)">
        <SectionTitle>Activation Check</SectionTitle>

        <SmallLine
          label="Engine 15"
          value={`${formatUpper(
            permissionState?.engine15Readiness || "WATCH"
          )} / ${formatUpper(permissionState?.engine15Action || "WAIT")}`}
          valueColor="#fbbf24"
        />

        <SmallLine label="Engine 3" value={engine3Text} />

        <SmallLine label="Engine 4" value={engine4Text} />

        <SmallLine
          label="Engine 6"
          value={formatUpper(
            permissionState?.engine6Decision ||
              permission.engine6Decision ||
              "PAPER STAND DOWN"
          )}
          valueColor={permissionState?.engine6Allowed ? "#22c55e" : "#fbbf24"}
        />

        <SmallLine
          label="Paper allowed"
          value={formatBool(paperAllowed)}
          valueColor={paperAllowed ? "#22c55e" : "#fb7185"}
        />

        <SmallLine
          label="Ticket"
          value={ticket || permissionState?.ticketAllowed ? "YES" : "NO"}
          valueColor={ticket || permissionState?.ticketAllowed ? "#22c55e" : "#fb7185"}
        />
      </SectionBox>

      <SectionBox border="rgba(168,85,247,0.35)" background="rgba(59,7,100,0.16)">
        <SectionTitle color="#c084fc">Engine 7 Size Preview</SectionTitle>

        <SmallLine
          label="Mode"
          value={formatUpper(engine7Sizing?.mode || "R_ONLY_PREVIEW")}
        />

        <SmallLine
          label="Allowed"
          value={formatBool(engine7Sizing?.allowed)}
          valueColor={engine7Sizing?.allowed ? "#22c55e" : "#fb7185"}
        />

        <SmallLine
          label="Engine 6"
          value={formatUpper(engine7Sizing?.engine6Permission || permissionState?.engine6Decision)}
        />

        <SmallLine
          label="Score"
          value={engine7Sizing?.totalScore != null ? String(engine7Sizing.totalScore) : "—"}
        />

        <div
          style={{
            ...TEXT_STYLE,
            fontSize: 13,
            fontWeight: 700,
            color: "#cbd5e1",
          }}
        >
          {engine7Sizing?.note ||
            "Engine 7 v1 is R-only preview. Contract sizing comes later in Engine 7 v2."}
        </div>
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
        Strategy 1 is owned by the Minute child candidate. The broad parent remains
        context only. Engine 3 confirms reaction, Engine 4 confirms participation,
        and Engine 6 remains final permission authority. No ticket or execution is
        created here.
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
