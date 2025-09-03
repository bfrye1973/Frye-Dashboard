import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import ErrorBoundary from "./ErrorBoundary";

// surface runtime errors to console & boundary
window.addEventListener("error",  (e) => console.error("[window.error]", e.error || e.message || e));
window.addEventListener("unhandledrejection", (e) => console.error("[unhandledrejection]", e.reason || e));

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
