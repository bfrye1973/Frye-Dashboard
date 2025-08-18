// src/index.js
import React from "react";
import { createRoot } from "react-dom/client";
import LiveFeedsPage from "./pages/livefeeds.jsx";

const el = document.getElementById("root");
createRoot(el).render(<LiveFeedsPage />);
