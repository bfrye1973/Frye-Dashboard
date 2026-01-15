import React, { useEffect, useMemo, useState } from "react";

/**
 * FibLevelsOverlay
 * - Reads backend-1: /api/v1/fib-levels?symbol=SPY&tf=1h
 * - Draws: anchors (low/high) + fib lines (38.2/50/61.8) + invalidation (74% gate)
 * - Minimal clutter: thin lines + compact labels on right edge
 *
 * Expected chart props (same pattern as other overlays):
 * - width, height
 * - yScale: function(price)->y (or { priceToY })
 * - chartPadding: { left, right, top, bottom } (optional)
 * - symbol (default "SPY")
 * - tf (default "1h")
 * - apiBase (optional) e.g. process.env.REACT_APP_API_BASE
 * - enabled (boolean)
 */
export default function FibLevelsOverlay({
  enabled = false,
  width,
  height,
  yScale,
  chartPadding,
  symbol = "SPY",
  tf = "1h",
  apiBase,
}) {
  const [data, setData] = useState(null);

  const pad = chartPadding || { left: 0, right: 0, top: 0, bottom: 0 };
  const leftX = pad.left + 4;
  const rightX = (width ?? 0) - pad.right - 4;

  const priceToY = useMemo(() => {
    // Support either a function or object style.
    if (!yScale) return null;
    if (typeof yScale === "function") return yScale;
    if (typeof yScale.priceToY === "function") return yScale.priceToY;
    return null;
  }, [yScale]);

  useEffect(() => {
    if (!enabled) return;

    let alive = true;

    const base =
      apiBase ||
      process.env.REACT_APP_API_BASE ||
      ""; // allow relative in same origin setups

    const url = `${base}/api/v1/fib-levels?symbol=${encodeURIComponent(
      symbol
    )}&tf=${encodeURIComponent(tf)}`;

    fetch(url)
      .then((r) => r.json())
      .then((json) => {
        if (!alive) return;
        setData(json);
      })
      .catch(() => {
        if (!alive) return;
        setData({ ok: false, reason: "FETCH_FAILED" });
      });

    return () => {
      alive = false;
    };
  }, [enabled, apiBase, symbol, tf]);

  if (!enabled) return null;
  if (!width || !height) return null;
  if (!priceToY) return null;

  if (!data || data.ok !== true) {
    return null; // keep it quiet (no clutter)
  }

  const anchors = data.anchors || {};
  const fib = data.fib || {};
  const signals = data.signals || {};

  const levels = [
    // Anchors
    { key: "A_LOW", price: anchors.low, label: `A Low ${fmt(anchors.low)}`, kind: "anchor" },
    { key: "A_HIGH", price: anchors.high, label: `A High ${fmt(anchors.high)}`, kind: "anchor" },

    // Fibs
    { key: "R382", price: fib.r382, label: `0.382 ${fmt(fib.r382)}`, kind: "fib" },
    { key: "R500", price: fib.r500, label: `0.500 ${fmt(fib.r500)}`, kind: "fib" },
    { key: "R618", price: fib.r618, label: `0.618 ${fmt(fib.r618)}`, kind: "fib" },

    // Gate
    { key: "INV", price: fib.invalidation, label: `INV(74) ${fmt(fib.invalidation)}`, kind: "gate" },
  ].filter((x) => Number.isFinite(x.price));

  const contextTag = anchors.context || signals.tag || null; // manual only (W2/W4)
  const header = contextTag ? `FIB ${contextTag}` : "FIB";

  return (
    <g className="fib-levels-overlay" style={{ pointerEvents: "none" }}>
      {/* Small header top-right */}
      <text
        x={rightX}
        y={pad.top + 14}
        textAnchor="end"
        fontSize="11"
        fill="rgba(255,255,255,0.75)"
      >
        {header}
      </text>

      {levels.map((lv) => {
        const y = priceToY(lv.price);
        if (!Number.isFinite(y)) return null;

        const isGate = lv.kind === "gate";
        const isAnchor = lv.kind === "anchor";

        const stroke =
          isGate ? "rgba(255,90,90,0.95)" :
          isAnchor ? "rgba(255,255,255,0.80)" :
          "rgba(120,210,255,0.85)";

        const dash =
          isGate ? "6 3" :
          isAnchor ? "2 4" :
          "0";

        const strokeWidth = isGate ? 1.6 : 1.1;

        return (
          <g key={lv.key}>
            {/* Horizontal line */}
            <line
              x1={pad.left}
              x2={(width ?? 0) - pad.right}
              y1={y}
              y2={y}
              stroke={stroke}
              strokeWidth={strokeWidth}
              strokeDasharray={dash}
            />

            {/* Right-side label */}
            <rect
              x={rightX - 95}
              y={y - 9}
              width={95}
              height={16}
              rx={3}
              fill="rgba(0,0,0,0.45)"
              stroke="rgba(255,255,255,0.10)"
            />
            <text
              x={rightX - 6}
              y={y + 3}
              textAnchor="end"
              fontSize="11"
              fill={stroke}
            >
              {lv.label}
            </text>

            {/* Anchor tick marks (small) */}
            {isAnchor ? (
              <circle
                cx={pad.left + 10}
                cy={y}
                r={3.2}
                fill={stroke}
                stroke="rgba(0,0,0,0.6)"
                strokeWidth={1}
              />
            ) : null}
          </g>
        );
      })}
    </g>
  );
}

function fmt(x) {
  if (!Number.isFinite(x)) return "";
  return x.toFixed(2);
}
