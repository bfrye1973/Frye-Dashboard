import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import ErrorBoundary from "./ErrorBoundary";

// catch any unhandled runtime errors (shows in console + boundary UI)
window.addEventListener("error",  (e) => console.error("[window.error]", e.error || e.message || e));
window.addEventListener("unhandledrejection", (e) => console.error("[unhandledrejection]", e.reason || e));

console.log("[bootstrap] mounting App…");

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
