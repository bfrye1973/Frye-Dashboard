import React, { useEffect, useMemo, useState } from "react";

const API_BASE =
  (typeof window !== "undefined" && (window.__API_BASE__ || "")) ||
  process.env.REACT_APP_API_BASE ||
  process.env.REACT_APP_API_URL ||
  "https://frye-market-backend-1.onrender.com";

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function round2(value) {
  const n = toNumber(value);
  if (n === null) return null;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function roundToTick(value, tickSize = 0.25) {
  const n = toNumber(value);
  if (n === null) return "";
  return round2(Math.round(n / tickSize) * tickSize);
}

function formatNumber(value, digits = 2) {
  const n = toNumber(value);
  if (n === null) return "—";
  return n.toFixed(digits);
}

function calcPreview({ direction, entryPrice, stopPrice, p1, p2, runner }) {
  const side = String(direction || "").toUpperCase();
  const entry = toNumber(entryPrice);
  const stop = toNumber(stopPrice);
  const targets = [p1, p2, runner].map(toNumber);

  if (!["LONG", "SHORT"].includes(side)) {
    return { valid: false, reason: "Pick LONG or SHORT" };
  }

  if (entry === null) return { valid: false, reason: "Entry required" };
  if (stop === null) return { valid: false, reason: "Stop required" };
  if (targets.some((x) => x === null)) {
    return { valid: false, reason: "P1, P2, and Runner required" };
  }

  if (side === "SHORT" && stop <= entry) {
    return { valid: false, reason: "Short stop must be above entry" };
  }

  if (side === "LONG" && stop >= entry) {
    return { valid: false, reason: "Long stop must be below entry" };
  }

  const badTarget =
    side === "SHORT"
      ? targets.some((target) => target >= entry)
      : targets.some((target) => target <= entry);

  if (badTarget) {
    return {
      valid: false,
      reason:
        side === "SHORT"
          ? "Short targets must be below entry"
          : "Long targets must be above entry",
    };
  }

  const risk = side === "SHORT" ? stop - entry : entry - stop;

  if (!Number.isFinite(risk) || risk <= 0) {
    return { valid: false, reason: "Risk must be positive" };
  }

  const rows = targets.map((target, index) => {
    const reward = side === "SHORT" ? entry - target : target - entry;
    const rr = reward / risk;
    return {
      label: index === 0 ? "P1" : index === 1 ? "P2" : "RUNNER",
      target,
      reward: round2(reward),
      rr: round2(rr),
    };
  });

  return {
    valid: true,
    reason: null,
    risk: round2(risk),
    p2Rr: rows[1]?.rr ?? null,
    bestRr: Math.max(...rows.map((row) => row.rr)),
    rows,
  };
}

const fieldStyle = {
  width: "100%",
  background: "rgba(2,6,23,0.95)",
  border: "1px solid rgba(148,163,184,0.35)",
  borderRadius: 6,
  color: "#e5e7eb",
  fontSize: 12,
  fontWeight: 800,
  padding: "6px 7px",
  outline: "none",
};

const labelStyle = {
  fontSize: 10,
  fontWeight: 900,
  color: "#93c5fd",
  textTransform: "uppercase",
  letterSpacing: 0.45,
};

function PriceInput({ label, value, onChange }) {
  return (
    <label style={{ display: "grid", gap: 4 }}>
      <span style={labelStyle}>{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="decimal"
        style={fieldStyle}
      />
    </label>
  );
}

export default function Engine26TradeGeometryTool({
  visible = true,
  symbol = "ES",
  strategyId = "intraday_scalp@10m",
  latestPrice = null,
}) {
  const [open, setOpen] = useState(true);
  const [direction, setDirection] = useState("SHORT");
  const [entryPrice, setEntryPrice] = useState("");
  const [stopPrice, setStopPrice] = useState("");
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [runner, setRunner] = useState("");
  const [contracts, setContracts] = useState("3");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    const lp = toNumber(latestPrice);
    if (!Number.isFinite(lp)) return;
    if (entryPrice !== "") return;

    const entry = roundToTick(lp);
    setEntryPrice(String(entry));

    if (direction === "SHORT") {
      setStopPrice(String(roundToTick(entry + 10)));
      setP1(String(roundToTick(entry - 7)));
      setP2(String(roundToTick(entry - 22)));
      setRunner(String(roundToTick(entry - 41)));
    } else {
      setStopPrice(String(roundToTick(entry - 10)));
      setP1(String(roundToTick(entry + 7)));
      setP2(String(roundToTick(entry + 22)));
      setRunner(String(roundToTick(entry + 41)));
    }
  }, [latestPrice, direction, entryPrice]);

  const preview = useMemo(
    () =>
      calcPreview({
        direction,
        entryPrice,
        stopPrice,
        p1,
        p2,
        runner,
      }),
    [direction, entryPrice, stopPrice, p1, p2, runner]
  );

  const isES = String(symbol || "").toUpperCase() === "ES";

  if (!visible) return null;

  async function takePaperTrade() {
    setResult(null);

    const payload = {
      symbol,
      strategyId,
      direction,
      entryPrice: toNumber(entryPrice),
      stopPrice: toNumber(stopPrice),
      targets: [toNumber(p1), toNumber(p2), toNumber(runner)],
      contracts: Number(contracts || 3),
      rawText: "CHART_GEOMETRY_TOOL",
    };

    setSubmitting(true);

    try {
      const url = `${API_BASE.replace(
        /\/+$/,
        ""
      )}/api/v1/engine26/manual-hard-signal`;

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(payload),
      });

      const json = await response.json().catch(() => null);

      if (!response.ok || json?.ok !== true) {
        setResult({
          ok: false,
          message:
            json?.rejectedReason ||
            json?.error ||
            `Request failed ${response.status}`,
          raw: json,
        });
        return;
      }

      setResult({
        ok: true,
        message: `Paper ${direction} filled: ${json?.execution?.filledQty || contracts} @ ${
          json?.execution?.avgPrice ?? payload.entryPrice
        }`,
        raw: json,
      });
    } catch (err) {
      setResult({
        ok: false,
        message: err?.message || String(err),
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        position: "absolute",
        top: 56,
        right: 12,
        zIndex: 160,
        width: open ? 270 : 170,
        pointerEvents: "auto",
        color: "#e5e7eb",
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <div
        style={{
          border: "1px solid rgba(59,130,246,0.45)",
          borderRadius: 12,
          background: "rgba(3,7,18,0.94)",
          boxShadow: "0 14px 40px rgba(0,0,0,0.45)",
          overflow: "hidden",
        }}
      >
        <button
          onClick={() => setOpen((x) => !x)}
          style={{
            width: "100%",
            border: 0,
            background: "rgba(15,23,42,0.98)",
            color: "#e5e7eb",
            padding: "8px 10px",
            fontSize: 12,
            fontWeight: 1000,
            letterSpacing: 0.5,
            textAlign: "left",
            cursor: "pointer",
          }}
        >
          ENGINE 26 TRADE TOOL {open ? "▾" : "▸"}
        </button>

        {open ? (
          <div style={{ padding: 10, display: "grid", gap: 9 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 6,
              }}
            >
              {["SHORT", "LONG"].map((side) => (
                <button
                  key={side}
                  onClick={() => {
                    setDirection(side);
                    setResult(null);
                    setEntryPrice("");
                  }}
                  style={{
                    border: `1px solid ${
                      direction === side
                        ? side === "SHORT"
                          ? "#ef4444"
                          : "#22c55e"
                        : "rgba(148,163,184,0.35)"
                    }`,
                    borderRadius: 8,
                    background:
                      direction === side
                        ? side === "SHORT"
                          ? "rgba(127,29,29,0.72)"
                          : "rgba(20,83,45,0.72)"
                        : "rgba(15,23,42,0.9)",
                    color: "#fff",
                    padding: "7px 8px",
                    fontSize: 12,
                    fontWeight: 1000,
                    cursor: "pointer",
                  }}
                >
                  {side}
                </button>
              ))}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 7,
              }}
            >
              <PriceInput label="Entry" value={entryPrice} onChange={setEntryPrice} />
              <PriceInput label="Stop" value={stopPrice} onChange={setStopPrice} />
              <PriceInput label="P1" value={p1} onChange={setP1} />
              <PriceInput label="P2" value={p2} onChange={setP2} />
              <PriceInput label="Runner" value={runner} onChange={setRunner} />
              <PriceInput
                label="Contracts"
                value={contracts}
                onChange={setContracts}
              />
            </div>

            <div
              style={{
                border: "1px solid rgba(148,163,184,0.24)",
                borderRadius: 10,
                padding: 8,
                background: "rgba(15,23,42,0.72)",
                display: "grid",
                gap: 5,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 11,
                  fontWeight: 900,
                }}
              >
                <span>{symbol} / {strategyId}</span>
                <span>{isES ? "PAPER ES" : "PAPER"}</span>
              </div>

              {preview.valid ? (
                <>
                  <div style={{ fontSize: 12, fontWeight: 1000 }}>
                    Risk {formatNumber(preview.risk)} pts · P2 R/R{" "}
                    {formatNumber(preview.p2Rr)}
                  </div>
                  {preview.rows.map((row) => (
                    <div
                      key={row.label}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 11,
                        color: "#cbd5e1",
                      }}
                    >
                      <span>
                        {row.label} {formatNumber(row.target)}
                      </span>
                      <span>
                        +{formatNumber(row.reward)} pts / {formatNumber(row.rr)}R
                      </span>
                    </div>
                  ))}
                  <div
                    style={{
                      fontSize: 11,
                      color: "#fde68a",
                      fontWeight: 900,
                      marginTop: 2,
                    }}
                  >
                    Runner best R/R {formatNumber(preview.bestRr)}
                  </div>
                </>
              ) : (
                <div style={{ color: "#fecaca", fontSize: 12, fontWeight: 900 }}>
                  {preview.reason}
                </div>
              )}
            </div>

            <button
              disabled={!preview.valid || submitting}
              onClick={takePaperTrade}
              style={{
                border: 0,
                borderRadius: 10,
                background:
                  !preview.valid || submitting
                    ? "rgba(71,85,105,0.8)"
                    : "linear-gradient(135deg, #f97316, #dc2626)",
                color: "#fff",
                padding: "10px 10px",
                fontSize: 13,
                fontWeight: 1000,
                cursor: !preview.valid || submitting ? "not-allowed" : "pointer",
                boxShadow:
                  !preview.valid || submitting
                    ? "none"
                    : "0 8px 20px rgba(220,38,38,0.35)",
              }}
            >
              {submitting ? "SENDING PAPER TRADE..." : "TAKE PAPER TRADE"}
            </button>

            <div
              style={{
                fontSize: 10,
                lineHeight: 1.35,
                color: "#94a3b8",
                borderTop: "1px solid rgba(148,163,184,0.16)",
                paddingTop: 7,
              }}
            >
              Paper only. Engine 8 paper fill. No Schwab. No real execution.
            </div>

            {result ? (
              <div
                style={{
                  border: `1px solid ${
                    result.ok ? "rgba(34,197,94,0.45)" : "rgba(239,68,68,0.45)"
                  }`,
                  background: result.ok
                    ? "rgba(20,83,45,0.45)"
                    : "rgba(127,29,29,0.45)",
                  borderRadius: 8,
                  padding: 7,
                  fontSize: 11,
                  fontWeight: 900,
                  color: "#fff",
                }}
              >
                {result.ok ? "✅ " : "❌ "}
                {result.message}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
