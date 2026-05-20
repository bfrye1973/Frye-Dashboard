// src/pages/rows/RowChart/overlays/Engine25MarketHealthTimeline.jsx

import React, { useEffect, useMemo, useState } from "react";

const API_BASE =
  (typeof window !== "undefined" && (window.__API_BASE__ || "")) ||
  process.env.REACT_APP_API_BASE ||
  process.env.REACT_APP_API_URL ||
  "https://frye-market-backend-1.onrender.com";

const ROUTE = `${API_BASE.replace(/\/+$/, "")}/api/v1/engine25/full-dashboard`;

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

function shortText(value, max = 190) {
  const text = String(value || "").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max).trim()}…`;
}

function SmallScoreRow({ label, score, inverse = false }) {
  const n = Number(score);
  const width = Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0;
  const color = scoreColor(score, inverse);

  return (
    <div style={{ display: "grid", gap: 4 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 8,
          fontSize: 10,
          fontWeight: 850,
          color: "#dbeafe",
        }}
      >
        <span>{label}</span>
        <span style={{ color }}>{fmtScore(score)}</span>
      </div>

      <div
        style={{
          height: 5,
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
        display: "flex",
        justifyContent: "space-between",
        gap: 8,
        fontSize: 10,
        color: "#94a3b8",
      }}
    >
      <span>{label}</span>
      <span style={{ color, fontWeight: 900 }}>{fmtChange(value)}</span>
    </div>
  );
}

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
          throw new Error(json?.error || `Engine25 full dashboard HTTP ${res.status}`);
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
  const distribution = breakdown.find((item) => item.key === "distributionPressure");
  const macro = breakdown.find((item) => item.key === "macroAwareScore");
  const credit = breakdown.find((item) => item.key === "creditFragility");
  const ai = breakdown.find((item) => item.key === "aiLeadership");

  return (
    <div
      style={{
        position: "absolute",
        top: 88,
        left: 330,
        zIndex: 118,
        width: 330,
        maxWidth: "calc(100vw - 700px)",
        border: "1px solid rgba(59,130,246,0.28)",
        borderRadius: 14,
        background:
          "linear-gradient(180deg, rgba(15,23,42,0.94), rgba(2,6,23,0.90))",
        color: "#e5e7eb",
        boxShadow: "0 14px 32px rgba(0,0,0,0.42)",
        backdropFilter: "blur(7px)",
        overflow: "hidden",
        pointerEvents: "auto",
      }}
      title="Engine 25 Market Health Timeline"
    >
      <div
        style={{
          padding: "9px 11px",
          borderBottom: "1px solid rgba(148,163,184,0.16)",
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          alignItems: "flex-start",
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 950,
              color: "#7dd3fc",
              letterSpacing: 0.5,
            }}
          >
            ENGINE 25 MARKET HEALTH
          </div>
          <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>
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
            background: "rgba(15,23,42,0.92)",
            border: "1px solid rgba(125,211,252,0.35)",
            color: "#bae6fd",
            borderRadius: 8,
            padding: "5px 7px",
            fontSize: 10,
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
        <div style={{ padding: 12, color: "#fecaca", fontSize: 12 }}>
          Engine 25 error: {error}
        </div>
      ) : status === "LOADING" && !payload ? (
        <div style={{ padding: 12, color: "#cbd5e1", fontSize: 12 }}>
          Loading Engine 25…
        </div>
      ) : (
        <div style={{ padding: 11, display: "grid", gap: 10 }}>
          <div
            style={{
              border: `1px solid ${stateColor}55`,
              background: "rgba(15,23,42,0.58)",
              borderRadius: 12,
              padding: 10,
              display: "grid",
              gap: 7,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  fontSize: 38,
                  lineHeight: 1,
                  fontWeight: 950,
                  color: stateColor,
                }}
              >
                {fmtScore(headline.score)}
              </div>

              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 950,
                    color: "#f8fafc",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {cleanLabel(headline.label || headline.state)}
                </div>
                <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>
                  {headline.date || "—"} · ES {headline.esClose ?? "—"}
                </div>
              </div>
            </div>

            <div
              style={{
                border: "1px solid rgba(245,158,11,0.28)",
                background: "rgba(120,53,15,0.22)",
                borderRadius: 9,
                padding: "6px 8px",
                fontSize: 11,
                color: "#fed7aa",
                fontWeight: 900,
              }}
            >
              {permission} · Size {size}
            </div>
          </div>

          <div
            style={{
              border: "1px solid rgba(148,163,184,0.16)",
              borderRadius: 12,
              padding: 10,
              background: "rgba(2,6,23,0.45)",
              display: "grid",
              gap: 8,
            }}
          >
            <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 900 }}>
              WHY?
            </div>

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

          <div
            style={{
              border: "1px solid rgba(148,163,184,0.16)",
              borderRadius: 12,
              padding: 10,
              background: "rgba(2,6,23,0.45)",
              display: "grid",
              gap: 5,
            }}
          >
            <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 900 }}>
              1D CHANGE
            </div>

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

          <div
            style={{
              border: "1px solid rgba(59,130,246,0.18)",
              background: "rgba(30,58,138,0.14)",
              borderRadius: 12,
              padding: 10,
              display: "grid",
              gap: 7,
            }}
          >
            <div style={{ fontSize: 10, color: "#93c5fd", fontWeight: 900 }}>
              DESK NOTE
            </div>

            <div style={{ fontSize: 11, lineHeight: 1.45, color: "#dbeafe" }}>
              {shortText(payload?.deskNote, 230)}
            </div>
          </div>

          {zoneRead?.zoneState && (
            <div
              style={{
                fontSize: 10,
                color: "#cbd5e1",
                borderTop: "1px solid rgba(148,163,184,0.14)",
                paddingTop: 7,
                display: "grid",
                gap: 3,
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
          )}
        </div>
      )}
    </div>
  );
}
