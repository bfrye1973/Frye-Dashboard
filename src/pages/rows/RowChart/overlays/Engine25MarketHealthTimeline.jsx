// src/pages/rows/RowChart/overlays/Engine25MarketHealthTimeline.jsx

import React, { useEffect, useMemo, useState } from "react";

const RAW_API_BASE =
  (typeof window !== "undefined" && (window.__API_BASE__ || "")) ||
  process.env.REACT_APP_API_BASE ||
  process.env.REACT_APP_API_URL ||
  "https://frye-market-backend-1.onrender.com";

const API_ROOT = RAW_API_BASE.replace(/\/+$/, "").replace(/\/api$/, "");

const ENGINE25_ROUTE = `${API_ROOT}/api/v1/engine25/full-dashboard`;
const MASTER_ROUTE = `${API_ROOT}/api/v1/futures/market-meter?symbol=ES`;

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

function fmtSpread(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}`;
}

function shortText(value, max = 280) {
  const text = String(value || "").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max).trim()}…`;
}

function dateOnlyFromIso(value) {
  if (!value) return null;

  const text = String(value);

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

  const d = new Date(text);
  if (Number.isNaN(d.getTime())) return null;

  return d.toISOString().slice(0, 10);
}

/* =========================
   Shared UI helpers
========================= */

function engine25Border() {
  return "rgba(96,165,250,0.45)";
}

function engine25Background() {
  return "rgba(15,23,42,0.38)";
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
            fontSize: 17,
            fontWeight: 800,
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

function SmallScoreRow({ label, score, inverse = false }) {
  const n = Number(score);
  const width = Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0;
  const color = scoreColor(score, inverse);

  return (
    <div style={{ display: "grid", gap: 5 }}>
      <div
        style={{
          fontFamily: PANEL_FONT,
          display: "flex",
          justifyContent: "space-between",
          gap: 8,
          fontSize: 17,
          lineHeight: 1.42,
          fontWeight: 500,
          color: "#dbeafe",
        }}
      >
        <span>{label}</span>
        <span style={{ color, fontWeight: 800 }}>{fmtScore(score)}</span>
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
            width: `${width}%`,
            height: "100%",
            background: color,
            borderRadius: 999,
          }}
        />
      </div>
    </div>
  );
}

function ChangePill({ label, value, inverse = false }) {
  const n = Number(value);
  let color = "#cbd5e1";

  if (Number.isFinite(n)) {
    if (inverse) {
      color = n > 0 ? "#ef4444" : n < 0 ? "#22c55e" : "#cbd5e1";
    } else {
      color = n > 0 ? "#22c55e" : n < 0 ? "#ef4444" : "#cbd5e1";
    }
  }

  return (
    <div
      style={{
        fontFamily: PANEL_FONT,
        display: "flex",
        justifyContent: "space-between",
        gap: 8,
        fontSize: 17,
        lineHeight: 1.42,
        color: "#dbeafe",
        fontWeight: 500,
      }}
    >
      <span>{label}</span>
      <span style={{ color, fontWeight: 800 }}>{fmtChange(value)}</span>
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
        fontSize: 17,
        lineHeight: 1.42,
        color: "#dbeafe",
        fontWeight: 500,
      }}
    >
      <span>{label}</span>
      <span style={{ color, fontWeight: 800 }}>{value}</span>
    </div>
  );
}

/* =========================
   Divergence Logic
========================= */

function buildMasterComparison(engine25Score, masterScore) {
  const e25 = Number(engine25Score);
  const master = Number(masterScore);

  if (!Number.isFinite(e25) || !Number.isFinite(master)) {
    return {
      ok: false,
      spread: null,
      status: "WAITING FOR MASTER DATA",
      color: "#94a3b8",
      border: "rgba(148,163,184,0.38)",
      background: "rgba(15,23,42,0.38)",
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
      border: "rgba(34,197,94,0.45)",
      background: "rgba(20,83,45,0.13)",
      read:
        "Macro market health and tactical ES dashboard are confirming each other today.",
    };
  }

  if (master - e25 >= 15) {
    return {
      ok: true,
      spread,
      status: "MACRO WARNING DIVERGENCE",
      color: "#f97316",
      border: "rgba(249,115,22,0.55)",
      background: "rgba(124,45,18,0.16)",
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
      border: "rgba(96,165,250,0.50)",
      background: "rgba(30,64,175,0.15)",
      read:
        "Engine 25 macro health is stronger than tactical ES conditions. Short-term weakness may be tactical, not structural.",
    };
  }

  return {
    ok: true,
    spread,
    status: "MILD DIVERGENCE",
    color: "#fbbf24",
    border: "rgba(251,191,36,0.52)",
    background: "rgba(113,63,18,0.14)",
    read:
      "Engine 25 and ES Master are not fully aligned. Treat this as a mixed read and require confirmation.",
  };
}

/* =========================
   Jump Alert Logic
========================= */

function rowByLabel(rows, label) {
  return rows.find((row) => row?.label === label) || null;
}

function buildJumpAlert(rows) {
  const comparisonRows = Array.isArray(rows) ? rows : [];

  const composite = rowByLabel(comparisonRows, "Composite");
  const composite1d = Number(composite?.oneDayChange);
  const composite3d = Number(composite?.threeDayChange);

  let status = "NO MAJOR JUMP";
  let color = "#94a3b8";
  let border = "rgba(148,163,184,0.38)";
  let background = "rgba(15,23,42,0.38)";
  let read =
    "No major Engine 25 score jump is active. Continue watching for confirmation.";

  if (Number.isFinite(composite1d) && composite1d >= 8) {
    status = "FAST 1D UPGRADE";
    color = "#22c55e";
    border = "rgba(34,197,94,0.45)";
    background = "rgba(20,83,45,0.13)";
    read =
      "Engine 25 made a fast one-day upgrade. Market health improved quickly.";
  } else if (Number.isFinite(composite3d) && composite3d >= 10) {
    status = "BULLISH MARKET HEALTH UPGRADE";
    color = "#22c55e";
    border = "rgba(34,197,94,0.45)";
    background = "rgba(20,83,45,0.13)";
    read =
      "Engine 25 has a strong multi-day upgrade. Market health is improving under the surface.";
  } else if (Number.isFinite(composite1d) && composite1d <= -8) {
    status = "FAST 1D WARNING";
    color = "#ef4444";
    border = "rgba(244,63,94,0.60)";
    background = "rgba(127,29,29,0.16)";
    read =
      "Engine 25 made a fast one-day downgrade. Risk conditions worsened quickly.";
  } else if (Number.isFinite(composite3d) && composite3d <= -10) {
    status = "MARKET HEALTH DOWNGRADE";
    color = "#ef4444";
    border = "rgba(244,63,94,0.60)";
    background = "rgba(127,29,29,0.16)";
    read =
      "Engine 25 has a strong multi-day downgrade. Market health is weakening under the surface.";
  } else if (
    (Number.isFinite(composite1d) && Math.abs(composite1d) >= 5) ||
    (Number.isFinite(composite3d) && Math.abs(composite3d) >= 7)
  ) {
    status = "WATCHING CHANGE";
    color = "#fbbf24";
    border = "rgba(251,191,36,0.52)";
    background = "rgba(113,63,18,0.14)";
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
    .slice(0, 3);

  return {
    status,
    color,
    border,
    background,
    read,
    composite1d,
    composite3d,
    drivers,
  };
}

/* =========================
   Freshness Logic
========================= */

function buildFreshness(headline, masterUpdatedAt) {
  const model = dateOnlyFromIso(
    headline?.latestEodDate || headline?.cashProxyDate || headline?.date
  );

  const esSessionDate = dateOnlyFromIso(headline?.esSessionDate);
  const requiredEodDate = dateOnlyFromIso(headline?.requiredEodDate);
  const master = dateOnlyFromIso(masterUpdatedAt);

  const required = requiredEodDate || model || master;

  if (!model) {
    return {
      status: "FRESHNESS UNKNOWN",
      color: "#94a3b8",
      border: "rgba(148,163,184,0.38)",
      background: "rgba(15,23,42,0.38)",
      modelDate: "—",
      masterDate: master || "—",
      esSessionDate: esSessionDate || "—",
      requiredEodDate: required || "—",
      read: "Could not find Engine 25 latest EOD date.",
    };
  }

  if (!required || model >= required) {
    return {
      status: "ENGINE 25 CURRENT",
      color: "#22c55e",
      border: "rgba(34,197,94,0.45)",
      background: "rgba(20,83,45,0.13)",
      modelDate: model,
      masterDate: master || "—",
      esSessionDate: esSessionDate || "—",
      requiredEodDate: required || model,
      read:
        esSessionDate && esSessionDate !== model
          ? "Engine 25 is current. ES futures session date differs from cash-market EOD date, but the latest cash proxy row is included."
          : "Engine 25 is current with the latest completed EOD row.",
    };
  }

  return {
    status: "ENGINE 25 WAITING FOR LATEST EOD ROW",
    color: "#fbbf24",
    border: "rgba(251,191,36,0.52)",
    background: "rgba(113,63,18,0.14)",
    modelDate: model,
    masterDate: master || "—",
    esSessionDate: esSessionDate || "—",
    requiredEodDate: required,
    read:
      "Engine 25 is behind the required latest EOD row. Treat it as stale until the replay file updates.",
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
  const [masterPayload, setMasterPayload] = useState(null);
  const [status, setStatus] = useState("LOADING");
  const [error, setError] = useState(null);
  const [masterError, setMasterError] = useState(null);

  const isES = String(symbol || "").toUpperCase() === "ES";

  useEffect(() => {
    if (!visible || !isES) return;

    let cancelled = false;

    async function load() {
      try {
        setStatus("LOADING");
        setError(null);
        setMasterError(null);

        const [engine25Res, masterRes] = await Promise.all([
          fetch(ENGINE25_ROUTE, { cache: "no-store" }),
          fetch(MASTER_ROUTE, { cache: "no-store" }),
        ]);

        const engine25Json = await engine25Res.json();
        const masterJson = await masterRes.json();

        if (!engine25Res.ok || engine25Json?.ok === false) {
          throw new Error(
            engine25Json?.error ||
              `Engine25 full dashboard HTTP ${engine25Res.status}`
          );
        }

        if (!cancelled) {
          setPayload(engine25Json);
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
  }, [visible, isES]);

  const headline = payload?.headline || {};
  const intraday = payload?.intradayProxyDamage || null;
  const liveEsPermission = payload?.liveEsPermission || null;

  const intradayScore = Number(intraday?.score);
  const intradayLabel = intraday?.label || null;
  const intradayPermission =
    liveEsPermission?.mode || headline?.livePermission || null;
  const intradaySize =
    liveEsPermission?.sizeMultiplier ?? headline?.liveSize ?? null;
  const hasIntradayRead = Boolean(intraday && intradayLabel);

  const breakdown = Array.isArray(payload?.componentBreakdown)
    ? payload.componentBreakdown
    : [];

  const changes = Array.isArray(payload?.underTheHood?.rows)
    ? payload.underTheHood.rows
    : [];

  const zoneRead = payload?.zoneRead || null;

  const lookupChange = useMemo(() => {
    const map = {};
    for (const row of changes) {
      map[row.label] = row;
    }
    return map;
  }, [changes]);

  if (!visible || !isES) return null;

  const score = Number(headline.score);
  const stateColor = scoreColor(score);
  const permission = headline.permissionText || cleanLabel(headline.permission);
  const size = headline.size ?? "—";

  const masterScore = masterPayload?.master?.score;
  const masterState = masterPayload?.master?.state || "—";
  const masterTone = masterPayload?.master?.tone || "—";
  const comparison = buildMasterComparison(score, masterScore);
  const jumpAlert = buildJumpAlert(changes);
  const freshness = buildFreshness(headline, masterPayload?.updated_at_utc);

  const breadth = breakdown.find((item) => item.key === "breadthParticipation");
  const distribution = breakdown.find(
    (item) => item.key === "distributionPressure"
  );
  const macro = breakdown.find((item) => item.key === "macroAwareScore");
  const credit = breakdown.find((item) => item.key === "creditFragility");
  const ai = breakdown.find((item) => item.key === "aiLeadership");

  return (
    <div
      style={{
        fontFamily: PANEL_FONT,
        position: "absolute",
        top: 126,
        left: 820,
        zIndex: 118,
        width: 560,
        maxWidth: "560px",
        maxHeight: "calc(100vh - 190px)",
        overflowY: "auto",
        borderRadius: 14,
        border: `1px solid ${engine25Border()}`,
        background: "rgba(6,10,20,0.95)",
        padding: "12px 14px",
        color: "#e5e7eb",
        backdropFilter: "blur(4px)",
        pointerEvents: "auto",
        textAlign: "left",
        boxShadow: "0 8px 24px rgba(0,0,0,0.28)",
        display: "grid",
        gap: 8,
      }}
      title="Engine 25 Market Health Timeline"
    >
      <div
        style={{
          fontFamily: PANEL_FONT,
          border: `1px solid ${engine25Border()}`,
          borderRadius: 10,
          padding: "8px 10px",
          background: "rgba(30,64,175,0.13)",
          display: "grid",
          gap: 8,
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
                fontFamily: PANEL_FONT,
                fontSize: 17,
                fontWeight: 800,
                color: "#60a5fa",
                letterSpacing: "0.02em",
                textTransform: "uppercase",
              }}
            >
              Engine 25 Market Health
            </div>

            <div
              style={{
                fontFamily: PANEL_FONT,
                fontSize: 17,
                lineHeight: 1.42,
                color: "#dbeafe",
                fontWeight: 500,
                marginTop: 3,
              }}
            >
              Macro · Distribution · Breadth
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
              padding: "6px 9px",
              fontSize: 15,
              fontWeight: 800,
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
              fontFamily: PANEL_FONT,
              color: "#fecaca",
              fontSize: 17,
              lineHeight: 1.42,
              fontWeight: 500,
            }}
          >
            Engine 25 error: {error}
          </div>
        ) : status === "LOADING" && !payload ? (
          <div
            style={{
              fontFamily: PANEL_FONT,
              color: "#cbd5e1",
              fontSize: 17,
              lineHeight: 1.42,
              fontWeight: 500,
            }}
          >
            Loading Engine 25…
          </div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  fontFamily: PANEL_FONT,
                  fontSize: 54,
                  lineHeight: 1,
                  fontWeight: 800,
                  color: stateColor,
                }}
              >
                {fmtScore(headline.score)}
              </div>

              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: PANEL_FONT,
                    fontSize: 20,
                    lineHeight: 1.3,
                    fontWeight: 650,
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
                    fontFamily: PANEL_FONT,
                    fontSize: 17,
                    lineHeight: 1.42,
                    color: "#cbd5e1",
                    fontWeight: 500,
                    marginTop: 3,
                  }}
                >
                  Latest EOD:{" "}
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
                fontFamily: PANEL_FONT,
                border: "1px solid rgba(251,191,36,0.52)",
                background: "rgba(113,63,18,0.14)",
                borderRadius: 10,
                padding: "8px 10px",
                fontSize: 17,
                lineHeight: 1.42,
                color: "#fbbf24",
                fontWeight: 800,
                textTransform: "uppercase",
              }}
            >
              {permission} · Size {size}
            </div>

            {hasIntradayRead && (
              <div
                style={{
                  fontFamily: PANEL_FONT,
                  border: `1px solid ${intradayColor(
                    intradayLabel,
                    intradayScore
                  )}`,
                  background: "rgba(127,29,29,0.18)",
                  borderRadius: 10,
                  padding: "8px 10px",
                  display: "grid",
                  gap: 4,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 10,
                    alignItems: "center",
                  }}
                >
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 900,
                      color: "#fecaca",
                      textTransform: "uppercase",
                      letterSpacing: "0.02em",
                    }}
                  >
                    Intraday Live Read
                  </div>

                  <div
                    style={{
                      fontSize: 20,
                      lineHeight: 1,
                      fontWeight: 950,
                      color: intradayColor(intradayLabel, intradayScore),
                    }}
                  >
                    {Number.isFinite(intradayScore)
                      ? Math.round(intradayScore)
                      : "—"}
                  </div>
                </div>

                <div
                  style={{
                    fontSize: 16,
                    lineHeight: 1.35,
                    color: intradayColor(intradayLabel, intradayScore),
                    fontWeight: 900,
                    textTransform: "uppercase",
                  }}
                >
                  {cleanLabel(intradayLabel)}
                </div>

                <div
                  style={{
                    fontSize: 15,
                    lineHeight: 1.35,
                    color: "#fecaca",
                    fontWeight: 700,
                    textTransform: "uppercase",
                  }}
                >
                  {cleanLabel(intradayPermission)}{" "}
                  {intradaySize !== null && intradaySize !== undefined
                    ? `· Size ${intradaySize}`
                    : ""}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {payload && status !== "ERROR" && (
        <>
          <SectionBox
            title="Freshness"
            titleColor={freshness.color}
            borderColor={freshness.border}
            background={freshness.background}
          >
            <div style={{ display: "grid", gap: 4 }}>
              <CompareRow
                label="Engine 25 EOD"
                value={freshness.modelDate}
                color={freshness.color}
              />
              <CompareRow
                label="Required EOD"
                value={freshness.requiredEodDate}
                color={freshness.color}
              />
              {freshness.esSessionDate !== "—" &&
                freshness.esSessionDate !== freshness.modelDate && (
                  <CompareRow
                    label="ES Session"
                    value={freshness.esSessionDate}
                    color={freshness.color}
                  />
                )}
              <CompareRow
                label="Status"
                value={freshness.status}
                color={freshness.color}
              />

              <div
                style={{
                  fontFamily: PANEL_FONT,
                  marginTop: 5,
                  fontSize: 17,
                  lineHeight: 1.42,
                  color: "#dbeafe",
                  fontWeight: 500,
                }}
              >
                {freshness.read}
              </div>
            </div>
          </SectionBox>

          <SectionBox
            title="Engine 25 Jump Alert"
            titleColor={jumpAlert.color}
            borderColor={jumpAlert.border}
            background={jumpAlert.background}
          >
            <div style={{ display: "grid", gap: 4 }}>
              <CompareRow
                label="Composite 1D"
                value={fmtChange(jumpAlert.composite1d)}
                color={jumpAlert.color}
              />
              <CompareRow
                label="Composite 3D"
                value={fmtChange(jumpAlert.composite3d)}
                color={jumpAlert.color}
              />
              <CompareRow
                label="Status"
                value={jumpAlert.status}
                color={jumpAlert.color}
              />

              {jumpAlert.drivers.length > 0 && (
                <div
                  style={{
                    fontFamily: PANEL_FONT,
                    marginTop: 5,
                    display: "grid",
                    gap: 3,
                    fontSize: 16,
                    lineHeight: 1.35,
                    color: "#dbeafe",
                    fontWeight: 500,
                  }}
                >
                  <div style={{ color: "#94a3b8", fontWeight: 800 }}>
                    Biggest Drivers
                  </div>

                  {jumpAlert.drivers.map((driver) => (
                    <div key={driver.label}>
                      {driver.label}:{" "}
                      <span
                        style={{
                          color:
                            driver.improvement >= 0 ? "#22c55e" : "#ef4444",
                          fontWeight: 800,
                        }}
                      >
                        {fmtChange(driver.change)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div
                style={{
                  fontFamily: PANEL_FONT,
                  marginTop: 5,
                  fontSize: 17,
                  lineHeight: 1.42,
                  color: "#dbeafe",
                  fontWeight: 500,
                  whiteSpace: "pre-line",
                }}
              >
                {jumpAlert.read}
              </div>
            </div>
          </SectionBox>

          <SectionBox
            title="Engine 25 vs Master"
            titleColor={comparison.color}
            borderColor={comparison.border}
            background={comparison.background}
          >
            <div style={{ display: "grid", gap: 4 }}>
              <CompareRow
                label="Engine 25"
                value={fmtScore(headline.score)}
                color={scoreColor(headline.score)}
              />
              <CompareRow
                label="ES Master"
                value={fmtScoreDecimal(masterScore, 2)}
                color={scoreColor(masterScore)}
              />
              <CompareRow
                label="Spread"
                value={fmtSpread(comparison.spread)}
                color={comparison.color}
              />
              <CompareRow
                label="Status"
                value={comparison.status}
                color={comparison.color}
              />

              <div
                style={{
                  fontFamily: PANEL_FONT,
                  marginTop: 5,
                  fontSize: 17,
                  lineHeight: 1.42,
                  color: "#dbeafe",
                  fontWeight: 500,
                  whiteSpace: "pre-line",
                }}
              >
                {comparison.read}
              </div>

              {masterError && (
                <div
                  style={{
                    fontFamily: PANEL_FONT,
                    marginTop: 5,
                    fontSize: 15,
                    lineHeight: 1.35,
                    color: "#fecaca",
                    fontWeight: 500,
                  }}
                >
                  Master error: {masterError}
                </div>
              )}

              <div
                style={{
                  fontFamily: PANEL_FONT,
                  marginTop: 4,
                  fontSize: 15,
                  lineHeight: 1.35,
                  color: "#94a3b8",
                  fontWeight: 500,
                }}
              >
                Master state: {cleanLabel(masterState)} · Tone:{" "}
                {cleanLabel(masterTone)}
              </div>
            </div>
          </SectionBox>

          <SectionBox title="Why?" titleColor="#60a5fa">
            <div style={{ display: "grid", gap: 8 }}>
              <SmallScoreRow
                label="Macro"
                score={macro?.score}
                inverse={macro?.direction === "lower_is_better"}
              />
              <SmallScoreRow
                label="Breadth"
                score={breadth?.score}
                inverse={breadth?.direction === "lower_is_better"}
              />
              <SmallScoreRow
                label="Distribution"
                score={distribution?.score}
                inverse
              />
              <SmallScoreRow
                label="Credit"
                score={credit?.score}
                inverse={credit?.direction === "lower_is_better"}
              />
              <SmallScoreRow
                label="AI"
                score={ai?.score}
                inverse={ai?.direction === "lower_is_better"}
              />
            </div>
          </SectionBox>

          <SectionBox title="1D Change" titleColor="#60a5fa">
            <div style={{ display: "grid", gap: 4 }}>
              <ChangePill
                label="ES"
                value={lookupChange["ES Close"]?.oneDayChange}
              />
              <ChangePill
                label="Composite"
                value={lookupChange["Composite"]?.oneDayChange}
              />
              <ChangePill
                label="Breadth"
                value={lookupChange["Breadth"]?.oneDayChange}
              />
              <ChangePill
                label="Distribution"
                value={lookupChange["Distribution"]?.oneDayChange}
                inverse
              />
              <ChangePill
                label="AI"
                value={lookupChange["AI Leadership"]?.oneDayChange}
              />
            </div>
          </SectionBox>

          <SectionBox title="Desk Note" titleColor="#60a5fa">
            <div
              style={{
                fontFamily: PANEL_FONT,
                display: "grid",
                gap: 4,
                fontSize: 17,
                lineHeight: 1.42,
                color: "#dbeafe",
                fontWeight: 500,
                whiteSpace: "pre-line",
              }}
            >
              {shortText(payload?.deskNote, 320)}
            </div>
          </SectionBox>

          {zoneRead?.zoneState && (
            <SectionBox title="Zone Read" titleColor="#60a5fa">
              <div
                style={{
                  fontFamily: PANEL_FONT,
                  display: "grid",
                  gap: 4,
                  fontSize: 17,
                  lineHeight: 1.42,
                  color: "#dbeafe",
                  fontWeight: 500,
                  whiteSpace: "pre-line",
                }}
              >
                <div>
                  <strong>Zone:</strong>{" "}
                  {cleanLabel(zoneRead.zoneState.state)}
                </div>
                <div>
                  <strong>Permission:</strong>{" "}
                  {cleanLabel(zoneRead.zoneState.permission)}
                </div>
              </div>
            </SectionBox>
          )}
        </>
      )}
    </div>
  );
}
