// src/App.js
import React from "react";
import LiveFeeds from "./pages/LiveFeeds";

export default function App() {
  // Keep it simple for now: render the LiveFeeds page which includes
  // the chart + overlays and its own controls/tiles.
  return (
    <div>
      <LiveFeeds />
    </div>
  );
}
