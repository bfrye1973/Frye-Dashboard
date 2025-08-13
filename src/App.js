import React, { useEffect, useState } from "react";

export default function App() {
  const [status, setStatus] = useState("checking"); // "checking" | "online" | "offline"
  const [ping, setPing] = useState(null);
  const [error, setError] = useState(null);

  // Call the backend health endpoint via the proxy (relative path => no CORS in dev)
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/health", { cache: "no-store" });
        if (!res.ok) throw new Error(`Health ${res.status}`);
        const json = await res.json();
        setStatus(json && json.ok ? "online" : "offline");
      } catch {
        setStatus("offline");
      }
    })();
  }, []);

  const doPing = async () => {
    setError(null);
    setPing(null);
    try {
      const res = await fetch("/api/ping", { cache: "no-store" });
      if (!res.ok) throw new Error(`Ping ${res.status}`);
      const json = await res.json();
      setPing(json);
    } catch (e) {
      setError(e && e.message ? e.message : "Failed to fetch");
    }
  };

  useEffect(() => {
    doPing();
  }, []);

  const badgeColor =
    status === "online" ? "#16a34a" : status === "offline" ? "#dc2626" : "#64748b";
  const badgeText =
    status === "online" ? "Backend: online" : status === "offline" ? "Backend: offline" : "Backend: checking…";

  return (
    <div style={{ padding: 16 }}>
      {/* Status badge */}
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 10px",
          borderRadius: 12,
          background: "#0b1220",
          color: "#e5e7eb",
          fontSize: 14,
          marginBottom: 16,
        }}
      >
        <span
          style={{
            display: "inline-block",
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: badgeColor,
          }}
        />
        <span>{badgeText}</span>
      </div>

      <h1 style={{ margin: "12px 0 4px" }}>Frye Dashboard (Staging)</h1>
      <p style={{ color: "#657287", marginTop: 0 }}>
        Frontend is running. Backend badge is in the top-left.
      </p>

      <div
        style={{
          marginTop: 12,
          padding: 12,
          borderRadius: 12,
          background: "#0b1220",
          color: "#e5e7eb",
          display: "inline-block",
          minWidth: 260,
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Ping check</div>
        {ping && <pre style={{ margin: 0 }}>{JSON.stringify(ping, null, 2)}</pre>}
        {!ping && !error && <div>Loading…</div>}
        {error && <div style={{ color: "#fca5a5" }}>Error: {error}</div>}
      </div>
    </div>
  );
}
