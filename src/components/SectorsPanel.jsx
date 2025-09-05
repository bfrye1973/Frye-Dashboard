// src/components/SectorsPanel.jsx
import React, { useEffect, useState } from "react";

export default function SectorsPanel() {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const r = await fetch("/api/dashboard");
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const json = await r.json();

        // handle either { ok, data:{...} } or raw object
        const payload = json?.data ?? json;
        const sectorCards =
          payload?.sectorCards ?? payload?.outlook?.sectorCards ?? [];

        if (!cancelled) setRows(Array.isArray(sectorCards) ? sectorCards : []);
      } catch (e) {
        if (!cancelled) setErr(String(e.message || e));
      }
    }

    load();
    // optional: refresh every 60s
    const t = setInterval(load, 60000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  return (
    <section id="sectors" style={{ position: "relative", zIndex: 10 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8 }}>
        <h3 style={{ margin: 0 }}>Sectors</h3>
        <small style={{ opacity: 0.7 }}>
          {rows.length ? `(${rows.length})` : err ? "• error" : "• loading…"}
        </small>
      </div>

      {err && (
        <div style={{ color: "#f87171", marginBottom: 8 }}>
          Error: {err}
        </div>
      )}

      {!rows.length && !err ? (
        <div style={{ opacity: 0.7 }}>Loading…</div>
      ) : rows.length ? (
        <div style={{
          border: "1px solid #1f2a44",
          borderRadius: 8,
          overflow: "hidden"
        }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead style={{ background: "#0e1526" }}>
              <tr>
                <th style={th}>Group</th>
                <th style={th}>Momentum (U/D)</th>
                <th style={th}>Breadth (NH/NL)</th>
                <th style={th}>Net</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.sector || i} style={{ background: i % 2 ? "#0a1120" : "#0c1424" }}>
                  <td style={td}>{r.sector || "—"}</td>
                  <td style={td}>{r.u ?? 0} / {r.d ?? 0}</td>
                  <td style={td}>{r.nh ?? 0} / {r.nl ?? 0}</td>
                  <td style={td}>
                    NetNH {Number(r.netNH ?? (r.nh - r.nl) || 0)} ·
                    NetUD {Number(r.netUD ?? (r.u - r.d) || 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

const th = { textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #1f2a44" };
const td = { padding: "10px 12px", borderBottom: "1px solid #0f1b33" };
