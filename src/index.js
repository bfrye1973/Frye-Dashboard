import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
createRoot(document.getElementById("root")).render(<App />);
#row-5, #row-6, #row-7 { position: relative; z-index: 2; margin-top: 12px; }
#row-6.chart-card { position: relative; height: 520px; overflow: hidden; }
#row-6.chart-card canvas {
  position: relative !important;
  width: 100% !important;
  height: 100% !important;
  max-height: 520px !important;
  z-index: 0 !important;
}
