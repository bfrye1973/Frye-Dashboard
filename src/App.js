// src/App.js
import React from "react";
import "./index.css";

export default function App() {
  const card = (id, h) => (
    <div id={id} className="panel" style={{
      minHeight: h, marginTop: 12, outline: "2px dashed #33c3ff",
      background: "rgba(255,255,255,0.03)", display: "block", position: "relative", zIndex: 2, padding: 10
    }}>
      <div style={{ color:"#8bdcff", fontWeight:700 }}>{id} — smoke test</div>
    </div>
  );

  return (
    <div style={{ padding: 12 }}>
      {card("row-5", 220)}
      {card("row-6", 520)}
      {card("row-7", 220)}
    </div>
  );
}
