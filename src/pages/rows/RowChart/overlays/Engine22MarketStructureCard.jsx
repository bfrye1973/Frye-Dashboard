import React from "react";

const FS = {
  title: 14,
  small: 12,
  micro: 10,
  tiny: 11,
};

const DEFAULT_DEGREE_ORDER = ["micro", "subminute", "minute", "minor", "intermediate", "primary"];

function wavePrice(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(2) : "—";
}

function toneForDegree(degree, state) {
  const direction = String(state?.direction || "").toUpperCase();
  const badge = String(state?.badge || "").toUpperCase();

  if (degree === "micro") return "watch";
  if (direction === "DOWN") return "short";
  if (direction === "UP") return "long";
  if (badge.includes("W5") || badge.includes("W3")) return "long";
  return state?.active === true ? "watch" : "wait";
}

function subtitleForDegree(degree, state) {
  if (state?.subtitle) return state.subtitle;
  if (degree === "micro") return "Immediate timing";
  if (degree === "subminute") return "Immediate wave path";
  if (degree === "minute") return "Tactical wave";
  if (degree === "minor") return "Parent impulse candidate";
  if (degree === "intermediate") return "Higher-timeframe context";
  if (degree === "primary") return "Highest-timeframe context";
  return "Structural context";
}

function Badge({ text, tone = "watch" }) {
  const palette =
    tone === "short"
      ? { color: "#fca5a5", border: "#7f1d1d", background: "#2a0d0d" }
      : tone === "long"
      ? { color: "#86efac", border: "#166534", background: "#071b0d" }
      : tone === "wait"
      ? { color: "#94a3b8", border: "#334155", background: "#0f172a" }
      : { color: "#bfdbfe", border: "#1d4ed8", background: "#0b1736" };

  return (
    <span
      style={{
        color: palette.color,
        border: `1px solid ${palette.border}`,
        background: palette.background,
        borderRadius: 999,
        padding: "3px 7px",
        fontSize: FS.micro,
        fontWeight: 1000,
        lineHeight: 1,
        whiteSpace: "nowrap",
      }}
    >
      {text || "CTX"}
    </span>
  );
}

function Engine22Line({ label, value, tone = "default" }) {
  const color =
    tone === "short"
      ? "#fca5a5"
      : tone === "long"
      ? "#86efac"
      : tone === "warning" || tone === "warn" || tone === "watch"
      ? "#fbbf24"
      : tone === "muted"
      ? "#94a3b8"
      : "#e5e7eb";

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "92px minmax(0,1fr)",
        gap: 6,
        alignItems: "start",
        minWidth: 0,
      }}
    >
      <div
        style={{
          color: "#94a3b8",
          fontSize: 11,
          fontWeight: 1000,
          lineHeight: 1.1,
          textTransform: "uppercase",
          letterSpacing: ".025em",
        }}
      >
        {label}
      </div>

      <div
        style={{
          color,
          fontSize: FS.small,
          fontWeight: 1000,
          lineHeight: 1.15,
          wordBreak: "break-word",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function Engine22TargetGrid({ title, levels }) {
  const rows = Array.isArray(levels)
    ? levels.filter((level) => Number.isFinite(Number(level?.price)))
    : [];

  if (!rows.length) return null;

  return (
    <div
      style={{
        border: "1px solid #1f3d20",
        borderRadius: 10,
        background: "#061108",
        padding: 7,
        display: "grid",
        gap: 6,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 6,
          alignItems: "center",
        }}
      >
        <div
          style={{
            color: "#86efac",
            fontSize: FS.micro,
            fontWeight: 1000,
          }}
        >
          {title}
        </div>

        <Badge text="LEVELS" tone="long" />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0,1fr))",
          gap: 5,
        }}
      >
        {rows.map((level, index) => (
          <div
            key={`${level.label || "level"}-${index}`}
            style={{
              border: "1px solid rgba(34,197,94,.35)",
              borderRadius: 8,
              background: "#081509",
              padding: "5px 6px",
              minWidth: 0,
            }}
          >
            <div
              style={{
                color: "#86efac",
                fontSize: 11,
                fontWeight: 1000,
                lineHeight: 1,
              }}
            >
              {level.label}
            </div>

            <div
              style={{
                color: "#f8fafc",
                fontSize: FS.small,
                fontWeight: 1000,
                lineHeight: 1.1,
              }}
            >
              {wavePrice(level.price)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RulesBox({ rules }) {
  if (!Array.isArray(rules) || !rules.length) return null;

  return (
    <div
      style={{
        border: "1px solid #5b3a10",
        borderRadius: 10,
        background: "#171005",
        padding: 7,
        display: "grid",
        gap: 6,
      }}
    >
      <div
        style={{
          color: "#fbbf24",
          fontSize: FS.micro,
          fontWeight: 1000,
        }}
      >
        Structural rules
      </div>

      {rules.map((rule, index) => (
        <Engine22Line
          key={`${index}-${rule}`}
          label={index === 0 ? "Rule" : ""}
          value={rule}
          tone="warn"
        />
      ))}
    </div>
  );
}

function Engine22DegreeCard({ degree, state }) {
  const active = state?.active === true;
  const tone = toneForDegree(degree, state);

  return (
    <div
      style={{
        background: active ? "#101720" : "#0b0f16",
        border:
          tone === "short"
            ? "1px solid #7f1d1d"
            : active
            ? "1px solid #2563eb"
            : "1px solid #1f2937",
        borderTop:
          tone === "short"
            ? "4px solid #ef4444"
            : tone === "long"
            ? "4px solid #22c55e"
            : "4px solid #3b82f6",
        borderRadius: 12,
        padding: 8,
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        gap: 7,
        boxShadow: active ? "0 0 14px rgba(37,99,235,.22)" : "none",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 6,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontWeight: 1000,
              fontSize: FS.small,
              color: "#e5e7eb",
            }}
          >
            {String(state?.label || degree || "").toUpperCase()}
          </div>

          <div
            style={{
              fontWeight: 900,
              fontSize: FS.micro,
              color: "#9ca3af",
            }}
          >
            {subtitleForDegree(degree, state)}
          </div>
        </div>

        <Badge text={state?.badge || "CTX"} tone={tone} />
      </div>

      <div
        style={{
          fontWeight: 1000,
          fontSize: FS.small,
          color:
            tone === "short"
              ? "#fca5a5"
              : active
              ? "#bfdbfe"
              : "#9ca3af",
          lineHeight: 1.15,
        }}
      >
        {state?.headline || `${String(degree || "").toUpperCase()} structure not published.`}
      </div>

      {(state?.rows || []).map((item, index) => (
        <Engine22Line
          key={`${item.label || "row"}-${index}`}
          label={item.label}
          value={item.value}
          tone={item.tone || "default"}
        />
      ))}

      <Engine22TargetGrid
        title={`${String(state?.label || degree || "").toUpperCase()} levels`}
        levels={state?.levels}
      />

      <RulesBox rules={state?.rules} />
    </div>
  );
}

export default function Engine22MarketStructureCard({ engine22Display }) {
  if (
    !engine22Display ||
    engine22Display.version !== "engine22Display.v1" ||
    !engine22Display.degrees
  ) {
    return (
      <div
        style={{
          marginTop: 10,
          border: "1px solid #1f2937",
          borderRadius: 14,
          padding: 10,
          background: "#0b0f16",
          color: "#9ca3af",
          fontWeight: 900,
        }}
      >
        Engine 22 structure not published.
      </div>
    );
  }

  const degreeOrder =
    Array.isArray(engine22Display.degreeOrder) && engine22Display.degreeOrder.length
      ? engine22Display.degreeOrder
      : DEFAULT_DEGREE_ORDER;

  const columnCount = Math.max(1, degreeOrder.length);

  return (
    <div
      style={{
        marginTop: 10,
        border: "1px solid #1f2937",
        borderRadius: 14,
        padding: 10,
        background: "#080d14",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 8,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            fontWeight: 1000,
            fontSize: FS.title,
            color: "#e5e7eb",
          }}
        >
          Engine 22 Wave Degrees
        </div>

        <div
          style={{
            color: "#9ca3af",
            fontSize: FS.tiny,
            fontWeight: 900,
          }}
        >
          Structural display only — no execution permission
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${columnCount}, minmax(0,1fr))`,
          gap: 8,
        }}
      >
        {degreeOrder.map((degree) => (
          <Engine22DegreeCard
            key={degree}
            degree={degree}
            state={
              engine22Display.degrees?.[degree] || {
                degree,
                label: degree,
                active: false,
                headline: `${String(degree).toUpperCase()} structure not published.`,
                rows: [],
                levels: [],
                rules: [],
              }
            }
          />
        ))}
      </div>
    </div>
  );
}
