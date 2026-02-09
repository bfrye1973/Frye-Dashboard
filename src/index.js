// src/index.js
// React 18 entry — minimal, compile-safe

import React from "react";
import { createRoot } from "react-dom/client";

import App from "./App";

// Global styles (keep only files that actually exist)
import "./index.css";
import "./theme.css";

// ✅ Layout scaler wrapper (locks the 32" ratio across screens)
import LockedDashboardCanvas from "./LockedDashboardCanvas";

const container = document.getElementById("root");
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <LockedDashboardCanvas>
      <App />
    </LockedDashboardCanvas>
  </React.StrictMode>
);
