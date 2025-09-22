// src/index.js
// React 18 entry — minimal, compile-safe

import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

// Global styles (keep only files that actually exist)
import "./index.css";
import "./theme.css";
// If you created layout.dashboard.css, uncomment the next line:
// import "./layout.dashboard.css";

const container = document.getElementById("root");
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
