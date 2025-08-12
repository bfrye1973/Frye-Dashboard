// src/App.js
import React, { useEffect, useState } from "react";
import { getHealth } from "./services/api";

export default function App() {
  const [status, setStatus] = useState("checking…");
  const [error, setError] = useState("");

  async function check() {
    // Debug: make sure env vars are coming through Webpack
    console.log("API_BASE_URL =", process.env.API_BASE_URL);

    setStatus("checking…");
    setError("");

    try {
      const data = await getHealth(); // expects { ok: true }
      setStatus(data?.ok ? "ok ✅" : "unexpected response ❓");
    } catch (e) {
      setStatus("failed ❌");
      setError(e?.message ? String(e.message) : String(e));
    }
  }

  useEffect(() => {
    check();
  }, []);

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: 24 }}>
      <h1>Frye Dashboard</h1>

      <p style={{ marginTop: 4 }}>
        <strong>Backend health:</strong>{" "}
        <span>{status}</span>
      </p>

      {error && (
        <pre
          style={{
            background: "#111",
            color: "#fff",
            padding: 12,
            borderRadius: 8,
            maxWidth: 680,
            overflow: "auto",
          }}
        >
          {error}
        </pre>
      )}

      <button onClick={check} style={{ padding: "8px 12px", marginTop: 8 }}>
        Re‑check
      </button>

      <p style={{ marginTop: 18, color: "#666" }}>
        If this says <em>ok</em>, your frontend ↔ backend connection is working.
      </p>
    </div>
  );
}
