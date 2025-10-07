// src/components/ErrorBoundary.jsx
import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    // optional: console logging only (no external calls)
    // eslint-disable-next-line no-console
    console.error("ErrorBoundary caught:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 16, color: "#fca5a5" }}>
          <strong>Something went wrong.</strong>
          <div style={{ marginTop: 8, color: "#9ca3af" }}>
            {String(this.state.error || "")}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
