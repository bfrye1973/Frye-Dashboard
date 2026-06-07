// src/pages/engine25/Engine25FullDashboard.jsx
// Engine 25H Full Dashboard Layout v5
// Wider + tighter control-room layout.
// Keeps all detail panels but compresses headline, why bars, composite chart,
// under-the-hood table, and lower panels so the page is not cut off.

import React, { useEffect, useMemo, useState } from "react";

const API_BASE =
  (typeof window !== "undefined" && (window.__API_BASE__ || "")) ||
  process.env.REACT_APP_API_BASE ||
  process.env.REACT_APP_API_URL ||
  "https://frye-market-backend-1.onrender.com";

const API_ROOT = API_BASE.replace(/\/+$/, "").replace(/\/api$/, "");

const ROUTE = `${API_ROOT}/api/v1/engine25/full-dashboard`;
const MASTER_ROUTE = `${API_ROOT}/api/v1/futures/market-meter?symbol=ES`;

const FONT = "Arial, Helvetica, sans-serif";

const FULL = {
  cardPadding: 14,
  sectionTitle: 16,
  body: 16,
  table: 15,
  tableHeader: 14,
  kv: 15,
  chartHeight: 230,
  headlineScore: 56,
};

function colorFor(value, inverse = false) {
  const n = Number(value);

  if (!Number.isFinite(n)) return "#64748b";

  if (inverse) {
    if (n < 30) return "#22c55e";
    if (n < 50) return "#f59e0b";
    if (n < 70) return "#ef4444";
    return "#7f1d1d";
  }

  if (n >= 70) return "#22c55e";
  if (n >= 50) return "#eab308";
  if (n >= 35) return "#f97316";
  return "#ef4444";
}

function labelColor(value, score) {
  const text = String(value || "").toUpperCase();

  if (
    text.includes("WEAK") ||
    text.includes("RISK_OFF") ||
    text.includes("NO_BLIND") ||
    text.includes("DISTRIBUTION_ACTIVE") ||
    text.includes("AT_RISK") ||
    text.includes("BLOCKED") ||
    text.includes("DOWNGRADE")
  ) {
    return "#ef4444";
  }

  if (
    text.includes("WATCH") ||
    text.includes("MIXED") ||
    text.includes("A_PLUS") ||
    text.includes("SECONDARY") ||
    text.includes("RECLAIM") ||
    text.includes("FALLBACK")
  ) {
    return "#fbbf24";
  }

  if (
    text.includes("SUPPORTIVE") ||
    text.includes("CONFIRMED") ||
    text.includes("ACCUMULATION") ||
    text.includes("UPGRADE") ||
    text.includes("ALIGNED")
  ) {
    return "#22c55e";
  }

  return colorFor(score);
}

function fmt(value, decimals = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(decimals);
}

function fmtMaybe(value, decimals = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return value ?? "—";
  return n.toFixed(decimals);
}

function fmtChange(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  if (n > 0) return `+${n}`;
  return String(n);
}

function fmtPct(value, decimals = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(decimals)}%`;
}

function cleanLabel(value) {
  return String(value || "—")
    .replaceAll("_", " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactLabel(value) {
  return cleanLabel(value).toUpperCase();
}

function changeColor(value, inverse = false) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "#cbd5e1";

  if (inverse) {
    if (n > 0) return "#ef4444";
    if (n < 0) return "#22c55e";
    return "#cbd5e1";
  }

  if (n > 0) return "#22c55e";
  if (n < 0) return "#ef4444";
  return "#cbd5e1";
}

function rowByLabel(rows, label) {
  return rows.find((row) => row?.label === label) || null;
}

function Card({ children, style = {} }) {
  return (
    <div
      style={{
        border: "1px solid rgba(148,163,184,0.28)",
        borderRadius: 14,
        background: "rgba(15,23,42,0.76)",
        boxShadow: "0 8px 22px rgba(0,0,0,0.24)",
        padding: FULL.cardPadding,
        minWidth: 0,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function SectionTitle({ children, color = "#93c5fd" }) {
  return (
    <div
      style={{
        fontFamily: FONT,
        fontSize: FULL.sectionTitle,
        lineHeight: 1.25,
        fontWeight: 900,
        color,
        letterSpacing: "0.02em",
        textTransform: "uppercase",
        marginBottom: 8,
      }}
    >
      {children}
    </div>
  );
}

function BodyText({ children, color = "#dbeafe" }) {
  return (
    <div
      style={{
        fontFamily: FONT,
        fontSize: FULL.body,
        lineHeight: 1.38,
        fontWeight: 500,
        color,
        whiteSpace: "pre-line",
      }}
    >
      {children}
    </div>
  );
}

function KV({ label, value, color = "#dbeafe" }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        fontFamily: FONT,
        fontSize: FULL.kv,
        lineHeight: 1.32,
        fontWeight: 500,
        color: "#dbeafe",
      }}
    >
      <span style={{ color: "#cbd5e1" }}>{label}</span>
      <span style={{ color, fontWeight: 850, textAlign: "right" }}>{value}</span>
    </div>
  );
}

function ScoreBar({ label, score, color, inverse = false }) {
  const n = Number(score);
  const width = Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0;
  const c = color || colorFor(score, inverse);

  return (
    <div style={{ display: "grid", gap: 5 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          fontFamily: FONT,
          fontSize: 15,
          lineHeight: 1.25,
          fontWeight: 500,
          color: "#dbeafe",
        }}
      >
        <span>{label}</span>
        <span style={{ color: c, fontWeight: 850 }}>
          {Number.isFinite(n) ? Math.round(n) : "—"}
        </span>
      </div>

      <div
        style={{
          height: 7,
          borderRadius: 999,
          background: "rgba(148,163,184,0.18)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${width}%`,
            background: c,
            borderRadius: 999,
          }}
        />
      </div>
    </div>
  );
}

function MiniCompositeChart({ rows = [], available = true }) {
  const chart = useMemo(() => {
    const clean = rows
      .filter(
        (row) =>
          Number.isFinite(Number(row.time)) &&
          Number.isFinite(Number(row.engine25CompositeScore))
      )
      .map((row) => ({
        time: Number(row.time),
        value: Number(row.engine25CompositeScore),
      }));

    const width = 1500;
    const height = FULL.chartHeight;
    const padX = 70;
    const padY = 36;

    if (clean.length < 2) {
      return { width, height, path: "" };
    }

    const usableW = width - padX * 2;
    const usableH = height - padY * 2;

    const path = clean
      .map((point, index) => {
        const x = padX + (index / (clean.length - 1)) * usableW;
        const y = padY + (1 - point.value / 100) * usableH;
        return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(" ");

    return { width, height, path };
  }, [rows]);

  return (
    <Card>
      <SectionTitle>Engine 25 Composite Overlay — 6 Months</SectionTitle>

      {!available || !chart.path ? (
        <BodyText color="#fbbf24">
          Daily composite overlay is unavailable on this instance. Live Engine 25
          fallback is active, so the dashboard can still show live market health,
          sector breadth, zone classification, and zone-aware context.
        </BodyText>
      ) : (
        <svg
          width="100%"
          viewBox={`0 0 ${chart.width} ${chart.height}`}
          style={{ display: "block", height: FULL.chartHeight }}
        >
          {[25, 50, 75].map((level) => {
            const y = 36 + (1 - level / 100) * (chart.height - 72);
            return (
              <g key={level}>
                <line
                  x1="70"
                  x2={chart.width - 70}
                  y1={y}
                  y2={y}
                  stroke="rgba(148,163,184,0.24)"
                  strokeWidth="1.2"
                />
                <text
                  x="20"
                  y={y + 5}
                  fill="#94a3b8"
                  fontSize="16"
                  fontFamily={FONT}
                  fontWeight="500"
                >
                  {level}
                </text>
              </g>
            );
          })}

          <line
            x1="70"
            x2={chart.width - 70}
            y1={36 + (1 - 55 / 100) * (chart.height - 72)}
            y2={36 + (1 - 55 / 100) * (chart.height - 72)}
            stroke="rgba(245,158,11,0.6)"
            strokeDasharray="8 8"
          />

          <path
            d={chart.path}
            fill="none"
            stroke="#f97316"
            strokeWidth="4"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
      )}
    </Card>
  );
}

function UnderTheHoodTable({ rows = [], interpretation }) {
  return (
    <Card style={{ overflow: "hidden" }}>
      <SectionTitle>Under The Hood Change</SectionTitle>

      {!rows.length ? (
        <BodyText color="#fbbf24">
          Daily comparison rows are unavailable because the composite overlay is
          missing. Live fallback is active.
        </BodyText>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "separate",
              borderSpacing: 0,
              fontFamily: FONT,
              fontSize: FULL.table,
              lineHeight: 1.25,
              color: "#dbeafe",
            }}
          >
            <thead>
              <tr
                style={{
                  color: "#93c5fd",
                  textAlign: "right",
                  fontSize: FULL.tableHeader,
                  textTransform: "uppercase",
                  letterSpacing: "0.02em",
                }}
              >
                {[
                  ["Metric", "left"],
                  ["Current", "right"],
                  ["1D Ago", "right"],
                  ["1D Change", "right"],
                  ["3D Ago", "right"],
                  ["3D Change", "right"],
                ].map(([label, align]) => (
                  <th
                    key={label}
                    style={{
                      textAlign: align,
                      padding: "8px 10px",
                      fontWeight: 850,
                      borderBottom: "1px solid rgba(148,163,184,0.26)",
                    }}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {rows.map((row, index) => {
                const isES = row.label === "ES Close";
                const inverse =
                  row.label === "Distribution" ||
                  row.label === "Credit Fragility";

                return (
                  <tr
                    key={row.label}
                    style={{
                      background:
                        index % 2 === 0
                          ? "rgba(2,6,23,0.18)"
                          : "rgba(15,23,42,0.24)",
                    }}
                  >
                    <td
                      style={{
                        textAlign: "left",
                        padding: "8px 10px",
                        fontWeight: 700,
                        color: "#f8fafc",
                        borderBottom: "1px solid rgba(148,163,184,0.13)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {row.label}
                    </td>

                    <td
                      style={{
                        textAlign: "right",
                        padding: "8px 10px",
                        fontWeight: 500,
                        borderBottom: "1px solid rgba(148,163,184,0.13)",
                      }}
                    >
                      {fmt(row.current, isES ? 2 : 0)}
                    </td>

                    <td
                      style={{
                        textAlign: "right",
                        padding: "8px 10px",
                        fontWeight: 500,
                        borderBottom: "1px solid rgba(148,163,184,0.13)",
                      }}
                    >
                      {fmt(row.oneDayAgo, isES ? 2 : 0)}
                    </td>

                    <td
                      style={{
                        textAlign: "right",
                        padding: "8px 10px",
                        color: changeColor(row.oneDayChange, inverse),
                        fontWeight: 850,
                        borderBottom: "1px solid rgba(148,163,184,0.13)",
                      }}
                    >
                      {fmtChange(row.oneDayChange)}
                    </td>

                    <td
                      style={{
                        textAlign: "right",
                        padding: "8px 10px",
                        fontWeight: 500,
                        borderBottom: "1px solid rgba(148,163,184,0.13)",
                      }}
                    >
                      {fmt(row.threeDaysAgo, isES ? 2 : 0)}
                    </td>

                    <td
                      style={{
                        textAlign: "right",
                        padding: "8px 10px",
                        color: changeColor(row.threeDayChange, inverse),
                        fontWeight: 850,
                        borderBottom: "1px solid rgba(148,163,184,0.13)",
                      }}
                    >
                      {fmtChange(row.threeDayChange)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {interpretation && (
        <div
          style={{
            marginTop: 10,
            border: "1px solid rgba(245,158,11,0.3)",
            background: "rgba(120,53,15,0.2)",
            color: "#fed7aa",
            borderRadius: 10,
            padding: 10,
            fontFamily: FONT,
            fontSize: 15,
            lineHeight: 1.35,
            fontWeight: 650,
          }}
        >
          {interpretation}
        </div>
      )}
    </Card>
  );
}

function SectorBreadthDetail({ sectorBreadth }) {
  const tactical = sectorBreadth?.tactical1h || null;
  const regime = sectorBreadth?.regime4h || null;
  const combined = sectorBreadth?.combinedRead || null;

  return (
    <Card>
      <SectionTitle color={labelColor(combined?.label, combined?.score)}>
        Sector Breadth Detail
      </SectionTitle>

      <div style={{ display: "grid", gap: 10 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 14,
          }}
        >
          <div style={{ display: "grid", gap: 6 }}>
            <SectionTitle color="#93c5fd">1H Tactical</SectionTitle>
            <KV
              label="Label"
              value={compactLabel(tactical?.classification?.label)}
              color={labelColor(tactical?.classification?.label)}
            />
            <KV
              label="Score"
              value={fmtMaybe(tactical?.classification?.score, 2)}
              color={labelColor(tactical?.classification?.label)}
            />
            <KV
              label="NH / NL"
              value={`${tactical?.summary?.totalNh ?? "—"} / ${
                tactical?.summary?.totalNl ?? "—"
              }`}
            />
            <KV
              label="Weak sectors"
              value={`${tactical?.summary?.sectorsWeak ?? "—"} of ${
                tactical?.summary?.sectorCount ?? "—"
              }`}
              color="#ef4444"
            />
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <SectionTitle color="#93c5fd">4H Regime</SectionTitle>
            <KV
              label="Label"
              value={compactLabel(regime?.classification?.label)}
              color={labelColor(regime?.classification?.label)}
            />
            <KV
              label="Score"
              value={fmtMaybe(regime?.classification?.score, 2)}
              color={labelColor(regime?.classification?.label)}
            />
            <KV
              label="Risk-on %"
              value={fmtPct(regime?.summary?.riskOnBreadthPct, 0)}
              color={labelColor(regime?.summary?.riskOnState)}
            />
            <KV
              label="Risk-on state"
              value={compactLabel(regime?.summary?.riskOnState)}
              color={labelColor(regime?.summary?.riskOnState)}
            />
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <SectionTitle color="#93c5fd">Combined Read</SectionTitle>
            <KV
              label="Available"
              value={combined?.available === false ? "NO" : "YES"}
              color={combined?.available === false ? "#ef4444" : "#22c55e"}
            />
            <KV
              label="Label"
              value={compactLabel(combined?.label)}
              color={labelColor(combined?.label, combined?.score)}
            />
            <KV
              label="Score"
              value={fmtMaybe(combined?.score, 2)}
              color={labelColor(combined?.label, combined?.score)}
            />
            <KV
              label="Impact"
              value={compactLabel(combined?.permissionImpact)}
              color={labelColor(combined?.permissionImpact)}
            />
          </div>
        </div>

        <BodyText color="#cbd5e1">
          Sector card breadth is still proxy breadth. It uses 1H tactical and 4H
          regime sector-card data. Historical sector-card replay remains disabled
          until real sector snapshots exist.
        </BodyText>
      </div>
    </Card>
  );
}

function ZoneClassificationDetail({ zoneClassification, zoneDecisionRead }) {
  const finalClass = zoneClassification?.finalZoneClassification || {};
  const accumulation = zoneClassification?.accumulationRead || {};
  const distribution = zoneClassification?.distributionRead || {};

  return (
    <Card>
      <SectionTitle color={labelColor(finalClass?.state)}>
        Zone Classification Detail
      </SectionTitle>

      <div style={{ display: "grid", gap: 6 }}>
        <KV
          label="Final classification"
          value={compactLabel(finalClass?.state)}
          color={labelColor(finalClass?.state)}
        />
        <KV
          label="Permission impact"
          value={compactLabel(finalClass?.permissionImpact)}
          color={labelColor(finalClass?.permissionImpact)}
        />
        <KV
          label="Confidence"
          value={compactLabel(finalClass?.confidence || zoneClassification?.confidence)}
          color={labelColor(finalClass?.confidence || zoneClassification?.confidence)}
        />
        <KV
          label="Zone priority"
          value={compactLabel(zoneDecisionRead?.label)}
          color={labelColor(zoneDecisionRead?.label)}
        />
        <KV
          label="Zone permission"
          value={compactLabel(zoneDecisionRead?.permission)}
          color={labelColor(zoneDecisionRead?.permission)}
        />
        <KV
          label="Accumulation"
          value={compactLabel(accumulation?.state)}
          color={labelColor(accumulation?.state)}
        />
        <KV
          label="Accumulation score"
          value={fmtMaybe(accumulation?.score, 0)}
          color={labelColor(accumulation?.state)}
        />
        <KV
          label="Distribution"
          value={compactLabel(distribution?.state)}
          color={labelColor(distribution?.state)}
        />
        <KV
          label="Distribution score"
          value={fmtMaybe(distribution?.score, 0)}
          color={labelColor(distribution?.state)}
        />
        <KV
          label="Zone volume"
          value={
            zoneDecisionRead?.zoneAwareVolumeAvailable
              ? "AVAILABLE"
              : "NOT AVAILABLE YET"
          }
          color={
            zoneDecisionRead?.zoneAwareVolumeAvailable ? "#22c55e" : "#94a3b8"
          }
        />
      </div>

      <div
        style={{
          marginTop: 10,
          borderTop: "1px solid rgba(148,163,184,0.18)",
          paddingTop: 10,
        }}
      >
        <BodyText>
          {zoneClassification?.plainEnglish ||
            zoneDecisionRead?.priorityRead ||
            "Zone classification detail is available."}
        </BodyText>
      </div>
    </Card>
  );
}

function DataFreshnessDetail({ data }) {
  const sectorBreadth = data?.sectorBreadth || {};
  const zoneRead = data?.zoneRead || {};
  const zoneClassification = data?.zoneClassification || {};

  return (
    <Card>
      <SectionTitle color={data?.compositeFallbackActive ? "#fbbf24" : "#22c55e"}>
        Cron / Data Freshness Detail
      </SectionTitle>

      <div style={{ display: "grid", gap: 6 }}>
        <KV
          label="Daily composite available"
          value={data?.dailyCompositeAvailable ? "YES" : "NO"}
          color={data?.dailyCompositeAvailable ? "#22c55e" : "#fbbf24"}
        />
        <KV
          label="Composite fallback active"
          value={data?.compositeFallbackActive ? "YES" : "NO"}
          color={data?.compositeFallbackActive ? "#fbbf24" : "#22c55e"}
        />
        <KV
          label="Fallback reason"
          value={compactLabel(data?.compositeFallbackReason || "NONE")}
          color={data?.compositeFallbackActive ? "#fbbf24" : "#22c55e"}
        />
        <KV
          label="Sector snapshot date"
          value={
            sectorBreadth?.latestSnapshotDate ||
            sectorBreadth?.latestSnapshotKey ||
            "—"
          }
        />
        <KV
          label="Zone class time"
          value={
            zoneClassification?.generatedAtUtc ||
            zoneClassification?.generatedAt ||
            zoneClassification?.updatedAt ||
            "—"
          }
        />
        <KV
          label="Zone context source"
          value={compactLabel(zoneRead?.context?.contextSource)}
          color={labelColor(zoneRead?.context?.contextSource)}
        />
        <KV label="Route engine" value={data?.engine || "—"} color="#93c5fd" />
      </div>

      <div style={{ marginTop: 10 }}>
        <BodyText color="#cbd5e1">
          Daily cron builds the heavy 6-month replay and composite overlay.
          Hourly cron refreshes live market health, ES zone-aware read,
          sector-card proxy breadth, zone classification, and ES overlay.
        </BodyText>
      </div>
    </Card>
  );
}

function buildJumpAlert(rows) {
  const comparisonRows = Array.isArray(rows) ? rows : [];

  const composite = rowByLabel(comparisonRows, "Composite");
  const composite1d = Number(composite?.oneDayChange);
  const composite3d = Number(composite?.threeDayChange);

  let status = "NO MAJOR JUMP";
  let color = "#94a3b8";
  let read =
    "No major Engine 25 score jump is active. Continue watching for confirmation.";

  if (Number.isFinite(composite1d) && composite1d >= 8) {
    status = "FAST 1D UPGRADE";
    color = "#22c55e";
    read =
      "Engine 25 made a fast one-day upgrade. Market health improved quickly.";
  } else if (Number.isFinite(composite3d) && composite3d >= 10) {
    status = "BULLISH MARKET HEALTH UPGRADE";
    color = "#22c55e";
    read =
      "Engine 25 has a strong multi-day upgrade. Market health is improving under the surface.";
  } else if (Number.isFinite(composite1d) && composite1d <= -8) {
    status = "FAST 1D WARNING";
    color = "#ef4444";
    read =
      "Engine 25 made a fast one-day downgrade. Risk conditions worsened quickly.";
  } else if (Number.isFinite(composite3d) && composite3d <= -10) {
    status = "MARKET HEALTH DOWNGRADE";
    color = "#ef4444";
    read =
      "Engine 25 has a strong multi-day downgrade. Market health is weakening under the surface.";
  } else if (
    (Number.isFinite(composite1d) && Math.abs(composite1d) >= 5) ||
    (Number.isFinite(composite3d) && Math.abs(composite3d) >= 7)
  ) {
    status = "WATCHING CHANGE";
    color = "#fbbf24";
    read =
      "Engine 25 is moving, but not enough for a major jump alert yet.";
  }

  const driverLabels = [
    "Macro Aware",
    "Breadth",
    "Distribution",
    "Market Trend",
    "Credit Fragility",
    "AI Leadership",
  ];

  const drivers = driverLabels
    .map((label) => {
      const row = rowByLabel(comparisonRows, label);
      const one = Number(row?.oneDayChange);
      const three = Number(row?.threeDayChange);
      const displayChange = Number.isFinite(three) ? three : one;

      if (!row || !Number.isFinite(displayChange)) return null;

      const isDistribution = label === "Distribution";
      const improvement = isDistribution ? -displayChange : displayChange;

      return {
        label,
        change: displayChange,
        improvement,
        abs: Math.abs(displayChange),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.abs - a.abs)
    .slice(0, 5);

  return {
    status,
    color,
    read,
    composite1d,
    composite3d,
    drivers,
  };
}

function JumpAlertDetail({ rows }) {
  const jump = buildJumpAlert(rows);

  return (
    <Card>
      <SectionTitle color={jump.color}>Engine 25 Jump Alert</SectionTitle>

      <div style={{ display: "grid", gap: 6 }}>
        <KV label="Status" value={jump.status} color={jump.color} />
        <KV
          label="Composite"
          value={`1D ${fmtChange(jump.composite1d)} · 3D ${fmtChange(
            jump.composite3d
          )}`}
          color={jump.color}
        />

        {jump.drivers.length > 0 && (
          <div
            style={{
              borderTop: "1px solid rgba(148,163,184,0.18)",
              paddingTop: 8,
              display: "grid",
              gap: 6,
            }}
          >
            {jump.drivers.map((driver) => (
              <KV
                key={driver.label}
                label={driver.label}
                value={fmtChange(driver.change)}
                color={driver.improvement >= 0 ? "#22c55e" : "#ef4444"}
              />
            ))}
          </div>
        )}

        <BodyText color="#cbd5e1">{jump.read}</BodyText>
      </div>
    </Card>
  );
}

function buildMasterComparison(engine25Score, masterScore) {
  const e25 = Number(engine25Score);
  const master = Number(masterScore);

  if (!Number.isFinite(e25) || !Number.isFinite(master)) {
    return {
      ok: false,
      spread: null,
      status: "WAITING FOR MASTER DATA",
      color: "#94a3b8",
      read: "Master Dashboard score is not available yet.",
    };
  }

  const spread = e25 - master;
  const abs = Math.abs(spread);

  if (abs <= 7) {
    return {
      ok: true,
      spread,
      status: "ALIGNED",
      color: "#22c55e",
      read:
        "Macro market health and tactical ES dashboard are confirming each other.",
    };
  }

  if (master - e25 >= 15) {
    return {
      ok: true,
      spread,
      status: "MACRO WARNING DIVERGENCE",
      color: "#f97316",
      read:
        "Tactical ES dashboard is stronger than Engine 25. Price action may be running ahead of deeper market health.",
    };
  }

  if (e25 - master >= 15) {
    return {
      ok: true,
      spread,
      status: "TACTICAL WEAKNESS / MACRO SUPPORTIVE",
      color: "#60a5fa",
      read:
        "Engine 25 market health is stronger than tactical ES conditions. Short-term weakness may be tactical, not structural.",
    };
  }

  return {
    ok: true,
    spread,
    status: "MILD DIVERGENCE",
    color: "#fbbf24",
    read:
      "Engine 25 and ES Master are not fully aligned. Treat this as a mixed read and require confirmation.",
  };
}

function MasterComparisonDetail({ headline, masterPayload, masterError }) {
  const masterScore = masterPayload?.master?.score;
  const masterState = masterPayload?.master?.state || "—";
  const masterTone = masterPayload?.master?.tone || "—";
  const comparison = buildMasterComparison(headline?.score, masterScore);

  return (
    <Card>
      <SectionTitle color={comparison.color}>Engine 25 vs Master</SectionTitle>

      <div style={{ display: "grid", gap: 6 }}>
        <KV
          label="Engine 25"
          value={fmt(headline?.score)}
          color={colorFor(headline?.score)}
        />
        <KV
          label="ES Master"
          value={fmt(masterScore, 2)}
          color={colorFor(masterScore)}
        />
        <KV
          label="Spread"
          value={
            Number.isFinite(Number(comparison.spread))
              ? fmtChange(comparison.spread)
              : "—"
          }
          color={comparison.color}
        />
        <KV label="Status" value={comparison.status} color={comparison.color} />
        <KV label="Master state" value={cleanLabel(masterState)} />
        <KV label="Master tone" value={cleanLabel(masterTone)} />

        {masterError && (
          <BodyText color="#fecaca">Master error: {masterError}</BodyText>
        )}

        <BodyText color="#cbd5e1">{comparison.read}</BodyText>
      </div>
    </Card>
  );
}

function ZoneMarketHealthRead({ zoneRead }) {
  return (
    <Card style={{ display: "grid", gap: 10 }}>
      <SectionTitle>Zone + Market Health Read</SectionTitle>

      <BodyText>
        {zoneRead?.plainEnglish || "No zone-aware read available."}
      </BodyText>

      {zoneRead?.nearestZone && (
        <div
          style={{
            display: "grid",
            gap: 6,
            borderTop: "1px solid rgba(148,163,184,0.18)",
            paddingTop: 10,
          }}
        >
          <KV label="Nearest Zone" value={zoneRead.nearestZone.id} />
          <KV
            label="Institutional"
            value={`${zoneRead.nearestZone.institutional?.lo}–${zoneRead.nearestZone.institutional?.hi}`}
          />
          <KV
            label="Negotiated"
            value={`${zoneRead.nearestZone.negotiated?.lo}–${zoneRead.nearestZone.negotiated?.hi}`}
          />
          <KV
            label="Zone State"
            value={cleanLabel(zoneRead?.zoneState?.state)}
            color={labelColor(zoneRead?.zoneState?.state)}
          />
          <KV
            label="Permission"
            value={cleanLabel(zoneRead?.zoneState?.permission)}
            color={labelColor(zoneRead?.zoneState?.permission)}
          />
        </div>
      )}
    </Card>
  );
}

export default function Engine25FullDashboard() {
  const [data, setData] = useState(null);
  const [masterPayload, setMasterPayload] = useState(null);
  const [status, setStatus] = useState("LOADING");
  const [error, setError] = useState(null);
  const [masterError, setMasterError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setStatus("LOADING");
        setError(null);
        setMasterError(null);

        const [engine25Res, masterRes] = await Promise.all([
          fetch(ROUTE, { cache: "no-store" }),
          fetch(MASTER_ROUTE, { cache: "no-store" }),
        ]);

        const engine25Json = await engine25Res.json();
        const masterJson = await masterRes.json();

        if (!engine25Res.ok || engine25Json?.ok === false) {
          throw new Error(
            engine25Json?.error ||
              `Engine 25 full dashboard HTTP ${engine25Res.status}`
          );
        }

        if (!cancelled) {
          setData(engine25Json);
          setStatus("READY");

          if (!masterRes.ok || masterJson?.ok === false) {
            setMasterPayload(null);
            setMasterError(
              masterJson?.error || `Master meter HTTP ${masterRes.status}`
            );
          } else {
            setMasterPayload(masterJson);
            setMasterError(null);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || String(err));
          setStatus("ERROR");
        }
      }
    }

    load();

    const timer = setInterval(load, 60_000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const headline = data?.headline || {};

  const breakdown = Array.isArray(data?.componentBreakdown)
    ? data.componentBreakdown
    : [];

  const comparison = Array.isArray(data?.underTheHood?.rows)
    ? data.underTheHood.rows
    : [];

  const overlayRows = Array.isArray(data?.overlay?.rows)
    ? data.overlay.rows
    : [];

  const overlayAvailable =
    data?.overlay?.available !== false && overlayRows.length > 0;

  const zoneRead = data?.zoneRead || null;
  const zoneDecisionRead = data?.zoneDecisionRead || null;
  const sectorBreadth = data?.sectorBreadth || null;
  const zoneClassification = data?.zoneClassification || null;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#020617",
        color: "#e5e7eb",
        padding: "20px 28px 34px",
        fontFamily: FONT,
        overflowX: "auto",
      }}
    >
      <div
        style={{
          maxWidth: 2350,
          width: "96vw",
          margin: "0 auto",
          display: "grid",
          gap: 14,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 18,
            alignItems: "center",
            borderBottom: "1px solid rgba(148,163,184,0.26)",
            paddingBottom: 10,
          }}
        >
          <div>
            <div
              style={{
                fontFamily: FONT,
                fontSize: 28,
                lineHeight: 1.15,
                fontWeight: 900,
                color: "#f8fafc",
              }}
            >
              ENGINE 25 — U.S. MARKET HEALTH MODEL
            </div>

            <div
              style={{
                color: "#cbd5e1",
                marginTop: 4,
                fontSize: 15,
                lineHeight: 1.25,
                fontWeight: 500,
              }}
            >
              Full dashboard · Composite overlay · Sector breadth · Zone
              classification · Data freshness · Full Layout v5
            </div>
          </div>

          <button
            onClick={() => window.close()}
            style={{
              background: "#0f172a",
              border: "1px solid rgba(148,163,184,0.38)",
              color: "#e5e7eb",
              borderRadius: 9,
              padding: "8px 13px",
              fontSize: 14,
              fontWeight: 850,
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>

        {status === "ERROR" && (
          <div
            style={{
              border: "1px solid rgba(239,68,68,0.35)",
              background: "rgba(127,29,29,0.35)",
              borderRadius: 12,
              padding: 14,
              color: "#fecaca",
              fontSize: 16,
              lineHeight: 1.35,
              fontWeight: 500,
            }}
          >
            Engine 25 full dashboard error: {error}
          </div>
        )}

        {status === "LOADING" && !data && (
          <div
            style={{
              color: "#94a3b8",
              fontSize: 16,
              lineHeight: 1.35,
              fontWeight: 500,
            }}
          >
            Loading Engine 25 full dashboard…
          </div>
        )}

        {data && (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "minmax(520px, 0.85fr) minmax(900px, 1.15fr)",
                gap: 14,
              }}
            >
              <Card style={{ display: "grid", gap: 10 }}>
                <SectionTitle>Headline</SectionTitle>

                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div
                    style={{
                      fontSize: FULL.headlineScore,
                      lineHeight: 1,
                      fontWeight: 900,
                      color: colorFor(headline.score),
                    }}
                  >
                    {fmt(headline.score)}
                  </div>

                  <div>
                    <div
                      style={{
                        fontSize: 20,
                        lineHeight: 1.25,
                        fontWeight: 750,
                        color: "#f8fafc",
                      }}
                    >
                      {cleanLabel(headline.label || headline.state)}
                    </div>

                    <div
                      style={{
                        color: "#cbd5e1",
                        marginTop: 3,
                        fontSize: 15,
                        lineHeight: 1.25,
                        fontWeight: 500,
                      }}
                    >
                      {headline.date} · ES {fmt(headline.esClose, 2)}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    border: "1px solid rgba(245,158,11,0.35)",
                    background: "rgba(120,53,15,0.25)",
                    borderRadius: 10,
                    padding: 10,
                    fontSize: 15,
                    lineHeight: 1.3,
                    fontWeight: 850,
                    color: "#fed7aa",
                    textTransform: "uppercase",
                  }}
                >
                  {headline.permissionText}
                  {headline.size !== null && headline.size !== undefined
                    ? ` · Size ${headline.size}`
                    : ""}
                </div>

                <BodyText>{headline.interpretation}</BodyText>
              </Card>

              <Card>
                <SectionTitle>Why Is Engine 25 Saying This?</SectionTitle>

                <div style={{ display: "grid", gap: 9 }}>
                  {breakdown.map((item) => (
                    <ScoreBar
                      key={item.key}
                      label={item.label}
                      score={item.score}
                      color={item.color === "darkRed" ? "#7f1d1d" : undefined}
                      inverse={item.direction === "lower_is_better"}
                    />
                  ))}
                </div>
              </Card>
            </div>

            <MiniCompositeChart rows={overlayRows} available={overlayAvailable} />

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "minmax(1200px, 1.55fr) minmax(650px, 0.45fr)",
                gap: 14,
              }}
            >
              <UnderTheHoodTable
                rows={comparison}
                interpretation={data?.underTheHood?.interpretation}
              />

              <ZoneMarketHealthRead zoneRead={zoneRead} />
            </div>

            <div
              style={{
                display: "grid",
                gap: 14,
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1.15fr) minmax(0, 0.85fr)",
                  gap: 14,
                }}
              >
                <SectorBreadthDetail sectorBreadth={sectorBreadth} />

                <ZoneClassificationDetail
                  zoneClassification={zoneClassification}
                  zoneDecisionRead={zoneDecisionRead}
                />
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)",
                  gap: 14,
                }}
              >
                <DataFreshnessDetail data={data} />

                <JumpAlertDetail rows={comparison} />

                <MasterComparisonDetail
                  headline={headline}
                  masterPayload={masterPayload}
                  masterError={masterError}
                />
              </div>
            </div>

            <Card
              style={{
                border: "1px solid rgba(59,130,246,0.3)",
              }}
            >
              <SectionTitle color="#93c5fd">Desk Note</SectionTitle>

              <div
                style={{
                  fontSize: FULL.body,
                  lineHeight: 1.38,
                  color: "#dbeafe",
                  fontWeight: 500,
                }}
              >
                {data?.deskNote}
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
