// src/index.js
import React from "react";
import { createRoot } from "react-dom/client";

import App from "./App";

import "./index.css";
import "./theme.css";

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
