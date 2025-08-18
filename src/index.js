// src/index.js
import React from "react";
import { createRoot } from "react-dom/client";

// IMPORTANT: match file names exactly (case-sensitive on Render)
import LiveFeeds from "./pages/LiveFeeds.jsx";
import OverlayLab from "./pages/OverlayLab.jsx";

function Root() {
  const hash = typeof window !== "undefined" ? window.location.hash : "";
  // visit .../#/overlay-lab to open the overlay sandbox, otherwise show LiveFeeds
  if (hash.startsWith("#/overlay-lab")) return <OverlayLab />;
  return <LiveFeeds />;
}

const el = document.getElementById("root");
createRoot(el).render(<Root />);

