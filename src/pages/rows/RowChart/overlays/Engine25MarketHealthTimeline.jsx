// src/pages/rows/RowChart/overlays/Engine25MarketHealthTimeline.jsx

import React, { useEffect, useMemo, useState } from "react";

const API_BASE =
  (typeof window !== "undefined" && (window.__API_BASE__ || "")) ||
  process.env.REACT_APP_API_BASE ||
  process.env.REACT_APP_API_URL ||
  "https://frye-market-backend-1.onrender.com";

const ROUTE = `${API_BASE.replace(/\/+$/, "")}/api/v1/engine25/full-dashboard`;

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

function fmtScore(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return Math.round(n);
}

function fmtChange(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  if (n > 0) return `+${n}`;
  return String(n);
}

function shortText(value, max = 280) {
  const text = String(value || "").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max).trim()}…`;
}

/* =========================
   Shared Engine 17-style UI helpers
========================= */

const PANEL_FONT = "Arial, Helvetica, sans-serif";

function engine25Border() {
  return "rgba(96,165,250,0.45)";
}

function engine25Background() {
  return "rgba(15,23,42,0.38)";
}

function SectionBox({ title, children, borderColor, titleColor }) {
  return (
    <div
      style={{
        fontFamily: PANEL_FONT,
        border: `1px solid ${borderColor || engine25Border()}`,
        borderRadius: 10,
        padding: "8px 10px",
        background: engine25Background(),
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

        const res = await fetch(ROUTE, { cache: "no-store" });
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

  const headline = payload?.headline || {};
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

        /*
          Moved far to the right.
          Previous fixed values were too small because the dashboard UI scaler
          makes visual movement look smaller than the raw CSS value.
        */
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
                  {headline.date || "—"} · ES {headline.esClose ?? "—"}
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
          </div>
        )}
      </div>

      {payload && status !== "ERROR" && (
        <>
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
