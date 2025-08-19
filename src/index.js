// src/index.js
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

// 🔵 Build tag from React bundle (hard to miss)
document.title = "Frye Dashboard • BUILD RB2";

function BuildBanner() {
  return (
    <div style={{
      background:"#111827",
      borderBottom:"1px solid #334155",
      padding:"6px 10px",
      font:"12px/1.4 system-ui",
      color:"#93a3b8"
    }}>
      BUILD TAG: <strong>RB2</strong>
    </div>
  );
}

const root = createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <BuildBanner />
    <App />
  </React.StrictMode>
);


