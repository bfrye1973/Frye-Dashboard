// src/ErrorBoundary.js
import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    // Update state so the next render shows fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // Optional: log to your backend or console
    // fetch('/api/log', { method:'POST', body: JSON.stringify({ error, info }) })
    console.error("ErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      // Fallback: use provided fallback prop, or a simple message
      return this.props.fallback ?? (
        <div style={{ padding: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Something went wrong.</div>
          <div className="small muted">Please refresh the page.</div>
        </div>
      );
    }
    return this.props.children;
  }
}
