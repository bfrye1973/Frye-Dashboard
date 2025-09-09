// src/pages/rows/RowStrategies.jsx
import React from "react";
import StrategiesPanel from "../../components/StrategiesPanel";

export default function RowStrategies() {
  return (
    <section id="row-5" className="panel strategies" style={{ minHeight: 240, marginTop: 12 }}>
      <div className="panel-head">
        <div className="panel-title">Strategies</div>
      </div>
      <StrategiesPanel />
    </section>
  );
}
