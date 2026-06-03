// src/pages/rows/RowChart/overlays/Engine23BehaviorCard.jsx

import React from "react";

const CARD_FONT = '"Trebuchet MS", "Lucida Grande", "Segoe UI", Arial, sans-serif';

const TEXT_STYLE = {
  fontFamily: CARD_FONT,
  fontSize: 16,
  lineHeight: 1.45,
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
  fontSize: 13,
  lineHeight: 1.35,
  fontWeight: 400,
  color: "#94a3b8",
};

const BOX_STYLE = {
  borderRadius: 10,
  padding: "9px 11px",
  display: "grid",
  gap: 7,
};

function formatText(value, fallback = "—") {
  if (value == null || value === "") return fallback;

  return String(value)
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, function (m) {
      return m.toUpperCase();
    });
}

function formatLevel(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(2) : "—";
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
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

function SmallLine({ label, value, valueColor = "#dbeafe", badge = null }) {
  if (value == null || value === "") return null;

  return (
    <div
      style={{
        fontFamily: CARD_FONT,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        fontSize: 15,
        lineHeight: 1.4,
        fontWeight: 400,
      }}
    >
      <span style={LABEL_STYLE}>{label}</span>
      <span
        style={{
          color: valueColor,
          fontWeight: 400,
          textAlign: "right",
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
        }}
      >
        {value}
        {badge}
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
        border: "1px solid " + color,
        color: color,
        background: "rgba(15,23,42,0.62)",
        borderRadius: 999,
        padding: "2px 7px",
        fontSize: 11,
        fontWeight: 500,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
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

  orderedKeys.forEach(function (item) {
    const key = item[0];
    const label = item[1];

    if (obj[key] != null) {
      rows.push([label, obj[key]]);
    }
  });

  return rows;
}

function getTargetStatus({ value, currentPrice, direction }) {
  const target = toNumber(value);
  const price = toNumber(currentPrice);
  const dir = String(direction || "LONG").toUpperCase();

  if (target == null || price == null) return null;

  if (dir === "SHORT") {
    return price <= target ? "HIT" : null;
  }

  return price >= target ? "HIT" : null;
}

function getLevelBlockConfig({ interpretation, targets }) {
  const activeTargets = targets && typeof targets === "object" ? targets : {};
  const higherTargets =
    interpretation &&
    interpretation.higherTargets &&
    typeof interpretation.higherTargets === "object"
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

  const activePullbackRows = getLevelRowsFromObject(activeTargets).filter(function (row) {
    return pullbackLabels.includes(row[0]);
  });

  const activeExtensionRows = getLevelRowsFromObject(activeTargets).filter(function (row) {
    return extensionLabels.includes(row[0]);
  });

  const higherExtensionRows = getLevelRowsFromObject(higherTargets).filter(function (row) {
    return extensionLabels.includes(row[0]);
  });

  if (activePullbackRows.length) {
    return {
      title: "Key pullback / reclaim levels",
      rows: activePullbackRows,
      color: "#60a5fa",
      border: "rgba(96,165,250,0.35)",
      background: "rgba(30,64,175,0.13)",
      type: "pullback",
    };
  }

  if (activeExtensionRows.length) {
    return {
      title: "Active extension targets",
      rows: activeExtensionRows,
      color: "#22c55e",
      border: "rgba(34,197,94,0.35)",
      background: "rgba(20,83,45,0.13)",
      type: "targets",
    };
  }

  if (higherExtensionRows.length) {
    return {
      title: "Higher-degree extension / reaction levels",
      rows: higherExtensionRows,
      color: "#fbbf24",
      border: "rgba(251,191,36,0.35)",
      background: "rgba(113,63,18,0.14)",
      type: "targets",
    };
  }

  return null;
}

function ReclaimActionBlock({ engine16, waveOpportunity }) {
  const trigger10m =
    engine16 && engine16.regimeLayers && engine16.regimeLayers.trigger10m
      ? engine16.regimeLayers.trigger10m
      : {};

  const pullback1h =
    engine16 && engine16.regimeLayers && engine16.regimeLayers.pullback1h
      ? engine16.regimeLayers.pullback1h
      : {};

  const trend4h =
    engine16 && engine16.regimeLayers && engine16.regimeLayers.trend4h
      ? engine16.regimeLayers.trend4h
      : {};

  const currentPrice =
    toNumber(waveOpportunity && waveOpportunity.currentPrice) ??
    toNumber(trigger10m.close);

  const ema10 = toNumber(trigger10m.ema10);
  const ema20 = toNumber(trigger10m.ema20);
  const support1h = toNumber(pullback1h.ema10);
  const support4h = toNumber(trend4h.ema10);

  const hasLevels =
    currentPrice != null ||
    ema10 != null ||
    ema20 != null ||
    support1h != null ||
    support4h != null;

  if (!hasLevels) return null;

  return (
    <div
      style={{
        ...BOX_STYLE,
        border: "1px solid rgba(56,189,248,0.38)",
        background: "rgba(12,74,110,0.14)",
      }}
    >
      <div
        style={{
          ...TITLE_STYLE,
          color: "#38bdf8",
          marginBottom: 1,
        }}
      >
        Reclaim / pullback levels
      </div>

      <SmallLine
        label="Current price"
        value={formatLevel(currentPrice)}
        valueColor="#f8fafc"
      />

      {(ema10 != null || ema20 != null) && (
        <SmallLine
          label="10m reclaim"
          value={formatLevel(ema10) + " → " + formatLevel(ema20)}
          valueColor="#fbbf24"
          badge={<StatusBadge label={trigger10m.state || "Watch"} color="#fbbf24" />}
        />
      )}

      {support1h != null && (
        <SmallLine
          label="First support"
          value={formatLevel(support1h)}
          valueColor="#93c5fd"
          badge={<StatusBadge label="1H EMA10" color="#60a5fa" />}
        />
      )}

      {support4h != null && (
        <SmallLine
          label="Deeper support"
          value={formatLevel(support4h)}
          valueColor="#93c5fd"
          badge={<StatusBadge label="4H EMA10" color="#60a5fa" />}
        />
      )}
    </div>
  );
}

function LevelsBlock({ interpretation, targets, currentPrice, direction }) {
  const extensionTouchContext =
    interpretation && interpretation.extensionTouchContext
      ? interpretation.extensionTouchContext
      : null;

  const config = getLevelBlockConfig({ interpretation: interpretation, targets: targets });

  if (!config || !config.rows.length) return null;

  return (
    <div
      style={{
        ...BOX_STYLE,
        border: "1px solid " + config.border,
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

      <div style={{ display: "grid", gap: 5 }}>
        {config.rows.map(function (row) {
          const label = row[0];
          const value = row[1];

          const extensionTouched =
            config.type === "targets" &&
            extensionTouchContext &&
            extensionTouchContext.active === true &&
            String(extensionTouchContext.levelLabel || "") === String(label);

          const hit =
            config.type === "targets"
              ? extensionTouched
                ? "TOUCHED_REJECTED"
                : getTargetStatus({
                    value: value,
                    currentPrice: currentPrice,
                    direction: direction,
                  })
              : null;

          return (
            <SmallLine
              key={label}
              label={label}
              value={formatLevel(value)}
              valueColor={hit ? "#86efac" : "#dbeafe"}
              badge={
                extensionTouched ? (
                  <StatusBadge
                    label={"Hit x" + extensionTouchContext.touchCount + " / Rejected"}
                    color="#fb7185"
                  />
                ) : hit ? (
                  <StatusBadge label="Hit" color="#22c55e" />
                ) : null
              }
            />
          );
        })}
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
        Weakness / chase-risk zones
      </div>

      {safe.slice(0, 4).map(function (z, idx) {
        return (
          <div
            key={(z.label || "zone") + "-" + idx}
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
                fontWeight: 500,
              }}
            >
              {(z.label || "Zone") + ": " + (z.level ?? "—")}
            </div>

            {z.meaning && (
              <div
                style={{
                  ...TEXT_STYLE,
                  color: "#dbeafe",
                  fontWeight: 400,
                }}
              >
                {z.meaning}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ExtensionTouchBlock({ context }) {
  if (!context || context.active !== true) return null;

  const latestTiming = String(
    context.latestSignalTiming || context.timing || ""
  ).toUpperCase();

  const firstTiming = String(context.firstSignalTiming || "").toUpperCase();

  const timingColor =
    latestTiming === "FRESH"
      ? "#22c55e"
      : latestTiming === "DEVELOPING"
      ? "#fbbf24"
      : latestTiming === "LATE"
      ? "#fb7185"
      : "#94a3b8";

  const firstTimingColor =
    firstTiming === "FRESH"
      ? "#22c55e"
      : firstTiming === "DEVELOPING"
      ? "#fbbf24"
      : firstTiming === "LATE"
      ? "#fb7185"
      : "#94a3b8";

  const patternLabel =
    context.pattern === "DOUBLE_TOP_EXTENSION_REJECTION"
      ? "Double-top extension rejection"
      : formatText(context.pattern || "Extension rejection");

  const latestMove = toNumber(context.moveSinceLatestSignalPts);
  const firstMove = toNumber(context.moveSinceFirstSignalPts);

  return (
    <div
      style={{
        ...BOX_STYLE,
        border: "1px solid rgba(251,113,133,0.58)",
        background: "rgba(127,29,29,0.20)",
      }}
    >
      <div
        style={{
          ...TITLE_STYLE,
          color: "#fb7185",
          marginBottom: 2,
        }}
      >
        Extension Rejection Read
      </div>

      <SmallLine
        label="Pattern"
        value={patternLabel}
        valueColor="#fecaca"
        badge={<StatusBadge label={formatText(latestTiming)} color={timingColor} />}
      />

      <SmallLine
        label={(context.levelLabel || "Extension") + " level"}
        value={formatLevel(context.level)}
        valueColor="#f8fafc"
      />

      <SmallLine label="Touches" value={context.touchCount} valueColor="#fecaca" />

      {context.rejectionSignalCount != null && (
        <SmallLine
          label="Rejection signals"
          value={context.rejectionSignalCount}
          valueColor="#fecaca"
        />
      )}

      <SmallLine
        label="Last close"
        value={formatLevel(context.lastClose)}
        valueColor="#f8fafc"
      />

      <SmallLine
        label="Latest signal"
        value={formatLevel(context.latestSignalPrice ?? context.signalPrice)}
        valueColor="#fbbf24"
        badge={
          latestTiming ? (
            <StatusBadge label={formatText(latestTiming)} color={timingColor} />
          ) : null
        }
      />

      <SmallLine
        label="Bars since latest"
        value={context.barsSinceLatestSignal ?? context.barsSinceSignal}
        valueColor={timingColor}
      />

      {latestMove != null && (
        <SmallLine
          label="Move since latest"
          value={latestMove.toFixed(2) + " pts"}
          valueColor={latestMove < 0 ? "#fb7185" : "#22c55e"}
        />
      )}

      <SmallLine
        label="First rejection"
        value={formatLevel(context.firstSignalPrice)}
        valueColor="#fbbf24"
        badge={
          firstTiming ? (
            <StatusBadge label={formatText(firstTiming)} color={firstTimingColor} />
          ) : null
        }
      />

      <SmallLine
        label="Bars since first"
        value={context.barsSinceFirstSignal}
        valueColor={firstTimingColor}
      />

      {firstMove != null && (
        <SmallLine
          label="Move since first"
          value={firstMove.toFixed(2) + " pts"}
          valueColor={firstMove < 0 ? "#fb7185" : "#22c55e"}
        />
      )}

      {context.read && (
        <div
          style={{
            ...TEXT_STYLE,
            color: "#fecaca",
            fontSize: 14,
            lineHeight: 1.35,
            marginTop: 2,
          }}
        >
          {context.read}
        </div>
      )}
    </div>
  );
}

export default function Engine23BehaviorCard({
  visible = true,
  interpretation = null,
  symbol = "ES",
  waveOpportunity = null,
  engine16 = null,
}) {
  if (!visible || !interpretation) return null;

  const health = interpretation.health || "UNKNOWN";
  const color = healthColor(health);

  const recent = interpretation.recentCompletion;
  const active = interpretation.activeStructure;
  const higher = interpretation.higherContext;

  const currentPrice =
    toNumber(waveOpportunity && waveOpportunity.currentPrice) ??
    toNumber(
      engine16 &&
        engine16.regimeLayers &&
        engine16.regimeLayers.trigger10m &&
        engine16.regimeLayers.trigger10m.close
    );

  const direction =
    (waveOpportunity && waveOpportunity.direction) ||
    interpretation.directionBias ||
    "LONG";

  return (
    <div
      style={{
        fontFamily: CARD_FONT,
        position: "absolute",
        top: 150,
        left: "calc(50% + 430px)",
        zIndex: 108,
        width: 430,
        maxWidth: "28%",
        maxHeight: "calc(100vh - 210px)",
        overflowY: "auto",
        borderRadius: 14,
        border: "1px solid " + healthBorder(health),
        background: "rgba(6,10,20,0.96)",
        padding: "13px 16px",
        color: "#e5e7eb",
        backdropFilter: "blur(4px)",
        pointerEvents: "none",
        textAlign: "left",
        boxShadow: "0 8px 24px rgba(0,0,0,0.28)",
        display: "grid",
        gap: 9,
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
              color: color,
              fontSize: 18,
            }}
          >
            Engine 23 — Wave behavior read
          </div>

          <div
            style={{
              ...TEXT_STYLE,
              color: "#f8fafc",
              fontWeight: 400,
              marginTop: 3,
            }}
          >
            {symbol} • {formatText(interpretation.environment)} •{" "}
            {formatText(interpretation.state)}
          </div>
        </div>

        <div
          style={{
            border: "1px solid " + healthBorder(health),
            borderRadius: 999,
            padding: "5px 10px",
            color: color,
            fontFamily: CARD_FONT,
            fontWeight: 500,
            fontSize: 15,
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
          gap: 7,
        }}
      >
        <SmallLine label="Preferred" value={formatText(interpretation.preferredEntry)} />

        <SmallLine label="Active degree" value={formatText(interpretation.activeDegree)} />

        <SmallLine
          label="Recent"
          value={recent ? formatText(recent.degree) + " " + recent.wave : "—"}
        />

        <SmallLine label="Active setup" value={active && active.setup ? active.setup : "—"} />

        <SmallLine
          label="Higher context"
          value={
            higher && higher.label
              ? higher.label
              : interpretation.higherDegreeContext || "—"
          }
        />

        <SmallLine label="Direction" value={formatText(interpretation.directionBias)} />
      </div>

      <ExtensionTouchBlock context={interpretation.extensionTouchContext} />

      <ReclaimActionBlock engine16={engine16} waveOpportunity={waveOpportunity} />

      <LevelsBlock
        interpretation={interpretation}
        targets={interpretation.activeTargets}
        currentPrice={currentPrice}
        direction={direction}
      />

      <WeaknessBlock zones={interpretation.weaknessZones} />
    </div>
  );
}
