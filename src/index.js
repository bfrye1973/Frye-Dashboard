// src/index.js
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import OverlayLab from "./pages/OverlayLab.jsx";

function Root() {
  const hash = typeof window !== "undefined" ? window.location.hash : "";
  if (hash.startsWith("#/overlay-lab")) {
    return <OverlayLab />;
  }
  return <App />;
}

const el = document.getElementById("root");
createRoot(el).render(<Root />);
