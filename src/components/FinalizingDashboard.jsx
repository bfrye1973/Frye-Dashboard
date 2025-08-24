// src/components/FinalizingDashboard.jsx
import React from "react";

export default function FinalizingDashboard() {
  const Card = ({ title, children }) => (
    <div style={{
      border: "1px solid #1f2a44",
      background: "#0e1526",
      borderRadius: 12,
      padding: 12,
      marginBottom: 12
    }}>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 13, opacity: 0.95 }}>{children}</div>
    </div>
  );

  const Row = ({ label, children }) => (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      padding: "8px 0",
      borderBottom: "1px dashed #1f2a44"
    }}>
      <div style={{ opacity: 0.85 }}>{label}</div>
      <div>{children}</div>
    </div>
  );

  const Tag = ({ text, tone="info" }) => {
    const colors = {
      info:  { bg:"#0b1220", bd:"#334155", fg:"#93c5fd" },
      ok:    { bg:"#052e1b", bd:"#14532d", fg:"#34d399" },
      warn:  { bg:"#2a1f05", bd:"#7c5806", fg:"#fbbf24" },
      todo:  { bg:"#13151b", bd:"#313244", fg:"#cbd5e1" },
    }[tone] || { bg:"#0b1220", bd:"#334155", fg:"#e5e7eb" };
    return (
      <span style={{
        padding: "4px 8px",
        borderRadius: 8,
        border: `1px solid ${colors.bd}`,
        background: colors.bg,
        color: colors.fg,
        fontSize: 12
      }}>{text}</span>
    );
  };

  return (
    <div>
      {/* Summary */}
      <Card title="Finalizing Dashboard — Status">
        <div style={{ display:"flex", gap: 8, flexWrap:"wrap" }}>
          <Tag text="Visuals: In Progress" tone="info" />
          <Tag text="Mini Gauges: Included" tone="ok" />
          <Tag text="Engine Lights: Demo ON" tone="info" />
          <Tag text="Data Wiring: Next" tone="todo" />
        </div>
        <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
          This tab is where we lock visuals, then wire data (breadth→RPM, momentum→Speed, PSI→Fuel), then finalize interactions.
        </div>
      </Card>

      {/* Visual Checklist */}
      <Card title="Visual QA Checklist">
        <Row label="Tach (yellow): red perimeter under ticks">
          <Tag text="Confirm" tone="info" />
        </Row>
        <Row label="Tach: 8–10 red band thickness">
          <Tag text="Confirm" tone="info" />
        </Row>
        <Row label="SPEED (red): white numerals, black label">
          <Tag text="Confirm" tone="info" />
        </Row>
        <Row label="Branding text outside tach (bezel zone)">
          <Tag text="Confirm" tone="info" />
        </Row>
        <Row label="Gauge spacing (tight Ferrari layout)">
          <Tag text="Adjust if needed" tone="warn" />
        </Row>
      </Card>

      {/* Data Wiring Plan (next step) */}
      <Card title="Data Wiring Plan (Next)">
        <Row label="RPM needle source">
          <Tag text="Breadth" tone="todo" />
        </Row>
        <Row label="SPEED needle source">
          <Tag text="Momentum" tone="todo" />
        </Row>
        <Row label="FUEL gauge source">
          <Tag text="100 − PSI (Squeeze)" tone="todo" />
        </Row>
        <Row label="Engine lights">
          <Tag text="Trading signals → glow" tone="todo" />
        </Row>
      </Card>

      {/* Actions */}
      <Card title="Actions">
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          <button style={btn}>Mark Visuals Approved</button>
          <button style={btn}>Wire Live Data</button>
          <button style={btn}>Enable Needle Animation</button>
          <button style={btn}>Export Screenshot</button>
        </div>
      </Card>
    </div>
  );
}

const btn = {
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid #334155",
  background: "#0b1220",
  color: "#e5e7eb",
  fontSize: 13,
  cursor: "pointer"
};
