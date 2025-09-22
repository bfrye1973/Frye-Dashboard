import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")).render(<App />);
/* Reserve a small gap so overlays don't cover the time axis */
:root { --axis-gap: 18px; }  /* you can tweak 16–22px */

#row-6 .tv-lightweight-charts {
  position: relative; /* ensure overlay absolute insets work */
}
