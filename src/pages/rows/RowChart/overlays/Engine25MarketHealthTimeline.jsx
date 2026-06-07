// src/pages/rows/RowChart/overlays/Engine25MarketHealthTimeline.jsx

import React, { useEffect, useState } from "react";

const RAW_API_BASE =
  (typeof window !== "undefined" && (window.__API_BASE__ || "")) ||
  process.env.REACT_APP_API_BASE ||
  process.env.REACT_APP_API_URL ||
  "https://frye-market-backend-1.onrender.com";

const API_ROOT = RAW_API_BASE.replace(/\/+$/, "").replace(/\/api$/, "");
const ENGINE25_ROUTE = `${API_ROOT}/api/v1/engine25/full-dashboard`;

const PANEL_FONT = "Arial, Helvetica, sans-serif";

/* =========================
   Formatters
========================= */

function cleanLabel(value) {
  return String(value || "—")
    .replaceAll("_", " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactLabel(value) {
  return cleanLabel(value).toUpperCase();
}

function scoreColor(score, inverse = false) {
  const n = Number(score);

  if (!Number.isFinite(n)) return "#94a3b8";

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

function labelColor(label, score) {
  const text = String(label || "").toUpperCase();

  if (
    text.includes("WEAK") ||
    text.includes("RISK_OFF") ||
    text.includes("NO_BLIND") ||
    text.includes("DISTRIBUTION_ACTIVE") ||
    text.includes("AT_RISK") ||
    text.includes("BLOCKED")
  ) {
    return "#ef4444";
  }

  if (
    text.includes("WATCH") ||
    text.includes("MIXED") ||
    text.includes("A_PLUS") ||
    text.includes("SECONDARY")
  ) {
    return "#fbbf24";
  }

  if (
    text.includes("EXPANDING") ||
    text.includes("SUPPORTIVE") ||
    text.includes("CONFIRMED") ||
    text.includes("ACCUMULATION")
  ) {
    return "#22c55e";
  }

  return scoreColor(score);
}

function intradayColor(label, score) {
  const text = String(label || "").toUpperCase();
  const n = Number(score);

  if (text.includes("DISTRIBUTION_ACTIVE")) return "#ef4444";
  if (text.includes("DAMAGE_ELEVATED")) return "#f97316";
  if (text.includes("DAMAGE_WATCH")) return "#fbbf24";
  if (Number.isFinite(n)) return scoreColor(n);

  return "#94a3b8";
}

function fmtScore(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return Math.round(n);
}

function fmtScoreDecimal(value, decimals = 2) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(decimals);
}

function fmtChange(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  if (n > 0) return `+${n}`;
  return String(n);
}

function shortLevel(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return value ?? "required";
  return n % 1 === 0 ? String(n) : n.toFixed(1);
}

function rowByLabel(rows, label) {
  return rows.find((row) => row?.label === label) || null;
}

/* =========================
   Shared UI
========================= */

function engine25Border() {
  return "rgba(96,165,250,0.45)";
}

function engine25Background() {
  return "rgba(15,23,42,0.38)";
}

function sectionBorder(label, score) {
  const color = labelColor(label, score);

  if (color === "#22c55e") return "rgba(34,197,94,0.50)";
  if (color === "#fbbf24") return "rgba(251,191,36,0.55)";
  if (color === "#f97316") return "rgba(249,115,22,0.55)";
  if (color === "#ef4444") return "rgba(244,63,94,0.62)";

  return engine25Border();
}

function sectionBackground(label, score) {
  const color = labelColor(label, score);

  if (color === "#22c55e") return "rgba(20,83,45,0.13)";
  if (color === "#fbbf24") return "rgba(113,63,18,0.14)";
  if (color === "#f97316") return "rgba(124,45,18,0.16)";
  if (color === "#ef4444") return "rgba(127,29,29,0.16)";

  return engine25Background();
}

function SectionBox({ title, children, borderColor, titleColor, background }) {
  return (
    <div
      style={{
        fontFamily: PANEL_FONT,
        border: `1px solid ${borderColor || engine25Border()}`,
        borderRadius: 10,
        padding: "8px 10px",
        background: background || engine25Background(),
        textAlign: "left",
      }}
    >
      {title && (
        <div
          style={{
            fontFamily: PANEL_FONT,
            fontSize: 15,
            fontWeight: 900,
            color: titleColor || "#60a5fa",
            marginBottom: 5,
            letterSpacing: "0.02em",
            textTransform: "uppercase",
          }}
        >
          {title}
        </div>
      )}

      {children}
    </div>
  );
}

function CompareRow({ label, value, color = "#dbeafe" }) {
  return (
    <div
      style={{
        fontFamily: PANEL_FONT,
        display: "flex",
        justifyContent: "space-between",
        gap: 8,
        fontSize: 14,
        lineHeight: 1.28,
        color: "#dbeafe",
        fontWeight: 650,
      }}
    >
      <span>{label}</span>
      <span style={{ color, fontWeight: 900, textAlign: "right" }}>{value}</span>
    </div>
  );
}

function MiniRead({ label, value, color = "#dbeafe" }) {
  return (
    <div style={{ display: "grid", gap: 1, minWidth: 0 }}>
      <div
        style={{
          fontSize: 11,
          color: "#94a3b8",
          fontWeight: 900,
          textTransform: "uppercase",
          letterSpacing: "0.02em",
        }}
      >
        {label}
      </div>

      <div
        style={{
          fontSize: 13,
          lineHeight: 1.18,
          color,
          fontWeight: 950,
          textTransform: "uppercase",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {value}
      </div>
    </div>
  );
}

/* =========================
   Jump Alert Logic
========================= */

function buildJumpAlert(rows) {
  const comparisonRows = Array.isArray(rows) ? rows : [];

  const composite = rowByLabel(comparisonRows, "Composite");
  const composite1d = Number(composite?.oneDayChange);
  const composite3d = Number(composite?.threeDayChange);

  let status = "NO MAJOR JUMP";
  let color = "#94a3b8";
  let border = "rgba(148,163,184,0.38)";
  let background = "rgba(15,23,42,0.38)";

  if (Number.isFinite(composite1d) && composite1d >= 8) {
    status = "FAST 1D UPGRADE";
    color = "#22c55e";
    border = "rgba(34,197,94,0.45)";
    background = "rgba(20,83,45,0.13)";
  } else if (Number.isFinite(composite3d) && composite3d >= 10) {
    status = "BULLISH MARKET HEALTH UPGRADE";
    color = "#22c55e";
    border = "rgba(34,197,94,0.45)";
    background = "rgba(20,83,45,0.13)";
  } else if (Number.isFinite(composite1d) && composite1d <= -8) {
    status = "FAST 1D WARNING";
    color = "#ef4444";
    border = "rgba(244,63,94,0.60)";
    background = "rgba(127,29,29,0.16)";
  } else if (Number.isFinite(composite3d) && composite3d <= -10) {
    status = "MARKET HEALTH DOWNGRADE";
    color = "#ef4444";
    border = "rgba(244,63,94,0.60)";
    background = "rgba(127,29,29,0.16)";
  } else if (
    (Number.isFinite(composite1d) && Math.abs(composite1d) >= 5) ||
    (Number.isFinite(composite3d) && Math.abs(composite3d) >= 7)
  ) {
    status = "WATCHING CHANGE";
    color = "#fbbf24";
    border = "rgba(251,191,36,0.52)";
    background = "rgba(113,63,18,0.14)";
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
    .slice(0, 3);

  return {
    status,
    color,
    border,
    background,
    composite1d,
    composite3d,
    drivers,
  };
}

/* =========================
   Main Export
========================= */

export default function Engine25MarketHealthTimeline({
  visible = true,
  symbol = "ES",
}) {
  const [payload, setPayload] = useState(null);
  const [status, setStatus] = useState("LOADING");
  const [error, setError] = useState(null);

  const isES = String(symbol || "").toUpperCase() === "ES";

  useEffect(() => {
    if (!visible || !isES) return;

    let cancelled = false;

    async function load() {
      try {
        setStatus("LOADING");
        setError(null);

        const res = await fetch(ENGINE25_ROUTE, { cache: "no-store" });
        const json = await res.json();

        if (!res.ok || json?.ok === false) {
          throw new Error(
            json?.error || `Engine25 full dashboard HTTP ${res.status}`
          );
        }

        if (!cancelled) {
          setPayload(json);
          setStatus("READY");
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
  }, [visible, isES]);

  if (!visible || !isES) return null;

  const headline = payload?.headline || {};
  const intraday = payload?.intradayProxyDamage || null;
  const liveEsPermission = payload?.liveEsPermission || null;
  const sectorBreadth = payload?.sectorBreadth || null;
  const zoneDecisionRead = payload?.zoneDecisionRead || null;
  const zoneClassification = payload?.zoneClassification || null;

  const tactical1h = sectorBreadth?.tactical1h || null;
  const regime4h = sectorBreadth?.regime4h || null;
  const combinedSector = sectorBreadth?.combinedRead || null;

  const changes = Array.isArray(payload?.underTheHood?.rows)
    ? payload.underTheHood.rows
    : [];

  const jumpAlert = buildJumpAlert(changes);

  const score = Number(headline.score);
  const stateColor = scoreColor(score);
  const permission = headline.permissionText || cleanLabel(headline.permission);
  const size = headline.size ?? headline.liveSize ?? "—";

  const intradayScore = Number(intraday?.score);
  const intradayLabel = intraday?.label || null;
  const intradayPermission =
    liveEsPermission?.mode || headline?.livePermission || null;
  const intradaySize =
    liveEsPermission?.sizeMultiplier ?? headline?.liveSize ?? null;
  const hasIntradayRead = Boolean(intraday && intradayLabel);

  const sectorColor = labelColor(combinedSector?.label, combinedSector?.score);

  const finalClass = zoneClassification?.finalZoneClassification || null;
  const accumulation = zoneClassification?.accumulationRead || null;
  const distribution = zoneClassification?.distributionRead || null;

  const confirmationItems = Array.isArray(zoneDecisionRead?.nextConfirmation)
    ? zoneDecisionRead.nextConfirmation
    : [];

  return (
    <div
      style={{
        fontFamily: PANEL_FONT,
        position: "absolute",
        top: 126,
        left: 820,
        zIndex: 118,
        width: 520,
        maxWidth: "520px",
        maxHeight: "calc(100vh - 150px)",
        overflowY: "auto",
        borderRadius: 14,
        border: `1px solid ${engine25Border()}`,
        background: "rgba(6,10,20,0.95)",
        padding: "10px 12px",
        color: "#e5e7eb",
        backdropFilter: "blur(4px)",
        pointerEvents: "auto",
        textAlign: "left",
        boxShadow: "0 8px 24px rgba(0,0,0,0.28)",
        display: "grid",
        gap: 7,
      }}
      title="Engine 25 Market Health Timeline"
    >
      <div
        style={{
          border: `1px solid ${engine25Border()}`,
          borderRadius: 10,
          padding: "8px 10px",
          background: "rgba(30,64,175,0.13)",
          display: "grid",
          gap: 7,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
            alignItems: "flex-start",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 15,
                fontWeight: 900,
                color: "#60a5fa",
                letterSpacing: "0.02em",
                textTransform: "uppercase",
              }}
            >
              Engine 25 Market Health
            </div>

            <div
              style={{
                fontSize: 13,
                lineHeight: 1.25,
                color: "#dbeafe",
                fontWeight: 650,
                marginTop: 2,
              }}
            >
              Macro · Distribution · Breadth · Zones
            </div>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              window.open("/engine25-full", "_blank");
            }}
            style={{
              fontFamily: PANEL_FONT,
              background: "rgba(15,23,42,0.92)",
              border: "1px solid rgba(125,211,252,0.35)",
              color: "#bae6fd",
              borderRadius: 8,
              padding: "5px 8px",
              fontSize: 12,
              fontWeight: 900,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
            title="Open full Engine 25 dashboard"
          >
            Open Full Chart
          </button>
        </div>

        {status === "ERROR" ? (
          <div
            style={{
              color: "#fecaca",
              fontSize: 14,
              lineHeight: 1.35,
              fontWeight: 700,
            }}
          >
            Engine 25 error: {error}
          </div>
        ) : status === "LOADING" && !payload ? (
          <div
            style={{
              color: "#cbd5e1",
              fontSize: 14,
              lineHeight: 1.35,
              fontWeight: 700,
            }}
          >
            Loading Engine 25…
          </div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
              <div
                style={{
                  fontSize: 46,
                  lineHeight: 1,
                  fontWeight: 900,
                  color: stateColor,
                }}
              >
                {fmtScore(headline.score)}
              </div>

              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 18,
                    lineHeight: 1.2,
                    fontWeight: 850,
                    color: "#f8fafc",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {cleanLabel(headline.label || headline.state)}
                </div>

                <div
                  style={{
                    fontSize: 12,
                    lineHeight: 1.28,
                    color: "#cbd5e1",
                    fontWeight: 650,
                    marginTop: 2,
                  }}
                >
                  EOD{" "}
                  {headline.latestEodDate ||
                    headline.cashProxyDate ||
                    headline.date ||
                    "—"}{" "}
                  · ES {headline.esClose ?? "—"}
                </div>
              </div>
            </div>

            <div
              style={{
                border: "1px solid rgba(251,191,36,0.52)",
                background: "rgba(113,63,18,0.14)",
                borderRadius: 9,
                padding: "6px 8px",
                fontSize: 13,
                lineHeight: 1.25,
                color: "#fbbf24",
                fontWeight: 950,
                textTransform: "uppercase",
              }}
            >
              {permission} · Size {size}
            </div>
          </>
        )}
      </div>

      {payload && status !== "ERROR" && (
        <>
          {hasIntradayRead && (
            <SectionBox
              title="Live Read"
              titleColor={intradayColor(intradayLabel, intradayScore)}
              borderColor={intradayColor(intradayLabel, intradayScore)}
              background="rgba(127,29,29,0.18)"
            >
              <div style={{ display: "grid", gap: 4 }}>
                <CompareRow
                  label="Intraday"
                  value={`${compactLabel(intradayLabel)} · ${fmtScore(
                    intradayScore
                  )}`}
                  color={intradayColor(intradayLabel, intradayScore)}
                />

                <CompareRow
                  label="Permission"
                  value={`${compactLabel(intradayPermission)}${
                    intradaySize !== null && intradaySize !== undefined
                      ? ` · Size ${intradaySize}`
                      : ""
                  }`}
                  color={intradayColor(intradayLabel, intradayScore)}
                />
              </div>
            </SectionBox>
          )}

          {combinedSector && (
            <SectionBox
              title="Sector Breadth"
              titleColor={sectorColor}
              borderColor={sectionBorder(combinedSector?.label, combinedSector?.score)}
              background={sectionBackground(combinedSector?.label, combinedSector?.score)}
            >
              <div style={{ display: "grid", gap: 7 }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 8,
                  }}
                >
                  <MiniRead
                    label="1H Tactical"
                    value={`${cleanLabel(
                      tactical1h?.classification?.label
                    )} · ${fmtScoreDecimal(
                      tactical1h?.classification?.score,
                      2
                    )}`}
                    color={labelColor(
                      tactical1h?.classification?.label,
                      tactical1h?.classification?.score
                    )}
                  />

                  <MiniRead
                    label="4H Regime"
                    value={`${cleanLabel(
                      regime4h?.classification?.label
                    )} · ${fmtScoreDecimal(
                      regime4h?.classification?.score,
                      2
                    )}`}
                    color={labelColor(
                      regime4h?.classification?.label,
                      regime4h?.classification?.score
                    )}
                  />
                </div>

                <CompareRow
                  label="Combined"
                  value={`${compactLabel(
                    combinedSector.label
                  )} · ${fmtScoreDecimal(combinedSector.score, 2)}`}
                  color={sectorColor}
                />

                <CompareRow
                  label="Impact"
                  value={compactLabel(combinedSector.permissionImpact)}
                  color={sectorColor}
                />
              </div>
            </SectionBox>
          )}

          {zoneDecisionRead?.available && (
            <SectionBox
              title="Zone / Classification"
              titleColor={labelColor(finalClass?.state || zoneDecisionRead.label)}
              borderColor={sectionBorder(finalClass?.state || zoneDecisionRead.label)}
              background={sectionBackground(finalClass?.state || zoneDecisionRead.label)}
            >
              <div style={{ display: "grid", gap: 5 }}>
                <CompareRow
                  label="Zone"
                  value={compactLabel(zoneDecisionRead.label)}
                  color={labelColor(zoneDecisionRead.label)}
                />

                <CompareRow
                  label="Class"
                  value={compactLabel(finalClass?.state || "UNKNOWN")}
                  color={labelColor(finalClass?.state)}
                />

                <CompareRow
                  label="Accumulation"
                  value={compactLabel(accumulation?.state || "UNKNOWN")}
                  color={labelColor(accumulation?.state)}
                />

                <CompareRow
                  label="Distribution"
                  value={compactLabel(distribution?.state || "UNKNOWN")}
                  color={labelColor(distribution?.state)}
                />

                <CompareRow
                  label="Permission"
                  value={compactLabel(zoneDecisionRead.permission)}
                  color={labelColor(zoneDecisionRead.permission)}
                />

                <div
                  style={{
                    marginTop: 2,
                    color: "#dbeafe",
                    fontWeight: 650,
                    fontSize: 13,
                    lineHeight: 1.3,
                  }}
                >
                  {zoneDecisionRead.priorityRead ||
                    zoneClassification?.plainEnglish ||
                    "Zone read is available."}
                </div>
              </div>
            </SectionBox>
          )}

          {confirmationItems.length > 0 && (
            <SectionBox title="Next Confirmation" titleColor="#2dd4bf">
              <div style={{ display: "grid", gap: 5 }}>
                {confirmationItems.map((item, idx) => (
                  <div
                    key={`${item.label}-${idx}`}
                    style={{
                      display: "grid",
                      gap: 1,
                      borderTop:
                        idx === 0 ? "none" : "1px solid rgba(148,163,184,0.16)",
                      paddingTop: idx === 0 ? 0 : 5,
                    }}
                  >
                    <CompareRow
                      label={item.label}
                      value={
                        item.level !== null && item.level !== undefined
                          ? shortLevel(item.level)
                          : "required"
                      }
                      color="#2dd4bf"
                    />

                    <div
                      style={{
                        fontSize: 12,
                        lineHeight: 1.25,
                        color: "#94a3b8",
                        fontWeight: 650,
                      }}
                    >
                      {item.note}
                    </div>
                  </div>
                ))}
              </div>
            </SectionBox>
          )}

          <SectionBox
            title="Engine 25 Jump Alert"
            titleColor={jumpAlert.color}
            borderColor={jumpAlert.border}
            background={jumpAlert.background}
          >
            <div style={{ display: "grid", gap: 5 }}>
              <CompareRow
                label="Status"
                value={jumpAlert.status}
                color={jumpAlert.color}
              />

              <CompareRow
                label="Composite"
                value={`1D ${fmtChange(jumpAlert.composite1d)} · 3D ${fmtChange(
                  jumpAlert.composite3d
                )}`}
                color={jumpAlert.color}
              />

              {jumpAlert.drivers.length > 0 && (
                <div
                  style={{
                    display: "grid",
                    gap: 3,
                    fontSize: 12,
                    lineHeight: 1.3,
                    color: "#dbeafe",
                    fontWeight: 650,
                  }}
                >
                  <div style={{ color: "#94a3b8", fontWeight: 900 }}>
                    Biggest Drivers
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      columnGap: 10,
                      rowGap: 3,
                    }}
                  >
                    {jumpAlert.drivers.map((driver) => (
                      <span key={driver.label}>
                        {driver.label}:{" "}
                        <span
                          style={{
                            color:
                              driver.improvement >= 0 ? "#22c55e" : "#ef4444",
                            fontWeight: 900,
                          }}
                        >
                          {fmtChange(driver.change)}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </SectionBox>
        </>
      )}
    </div>
  );
}
