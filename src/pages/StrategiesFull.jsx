import React, { useMemo, useState } from "react";
import { useDashboardSnapshot } from "../hooks/useDashboardSnapshot";

/* -------------------- env/helpers -------------------- */
const AZ_TZ = "America/Phoenix";

function toAZ(iso, withSeconds = false) {
  try {
    return (
      new Date(iso).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: withSeconds ? "2-digit" : undefined,
        timeZone: AZ_TZ,
      }) + " AZ"
    );
  } catch {
    return "—";
  }
}

function clamp100(x) {
  const n = Number(x);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function fmt2(x) {
  return Number.isFinite(x) ? Number(x).toFixed(2) : "—";
}

function grade(score) {
  const s = clamp100(score);
  if (s >= 90) return "A+";
  if (s >= 80) return "A";
  if (s >= 70) return "B";
  if (s >= 60) return "C";
  return "IGNORE";
}

function permStyle(permission) {
  if (permission === "ALLOW") return { background: "#22c55e", color: "#0b1220", border: "2px solid #0c1320" };
  if (permission === "REDUCE") return { background: "#fbbf24", color: "#0b1220", border: "2px solid #0c1320" };
  if (permission === "STAND_DOWN") return { background: "#ef4444", color: "#0b1220", border: "2px solid #0c1320" };
  return { background: "#0b0b0b", color: "#93c5fd", border: "1px solid #2b2b2b" };
}

function btn() {
  return {
    background: "#141414",
    color: "#e5e7eb",
    border: "1px solid #2a2a2a",
    borderRadius: 10,
    padding: "8px 12px",
    fontSize: 13,
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
  };
}

function openFullChart(symbol = "SPY", tf = "10m") {
  const url = `/chart?symbol=${encodeURIComponent(symbol)}&tf=${encodeURIComponent(tf)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

/* -------------------- Compact engine stack (bigger readable) -------------------- */
/**
 * IMPORTANT:
 * E2 must use node.engine2 (dashboard truth), not confluence.context.fib
 */
function EngineStackBig({ confluence, permission, engine2Card }) {
  const loc = confluence?.location?.state || "—";

  let e2Text = "NO_ANCHORS";
  let e2Color = "#e5e7eb";
  if (engine2Card && engine2Card.ok === true) {
    const degree = engine2Card.degree || "—";
    const tf = engine2Card.tf || "—";
    const phase = engine2Card.phase || "UNKNOWN";
    const fibScore = Number(engine2Card.fibScore || 0);
    const invalidated = engine2Card.invalidated === true;

    e2Text = `${degree} ${tf} — ${phase} — Fib ${fibScore}/20 — inv:${invalidated ? "true" : "false"}`;

    if (invalidated) e2Color = "#fca5a5";
    else if (fibScore >= 20) e2Color = "#86efac";
    else if (fibScore >= 10) e2Color = "#fbbf24";
    else e2Color = "#cbd5e1";
  }

  const reaction = confluence?.context?.reaction || {};
  const e3Text = `${Number(reaction?.reactionScore ?? 0).toFixed(1)} ${reaction?.structureState || "HOLD"}`;

  const volume = confluence?.context?.volume || {};
  const vFlags = volume?.flags || {};
  const e4State = confluence?.volumeState || "NO_SIGNAL";
  const e4Flags = `trap:${vFlags?.liquidityTrap ? "Y" : "N"} init:${vFlags?.initiativeMoveConfirmed ? "Y" : "N"}`;

  const score = clamp100(confluence?.scores?.total ?? 0);
  const label = confluence?.scores?.label || grade(score);
  const comp = confluence?.compression || {};
  const e5Text = `${Math.round(score)} (${label}) • ${comp?.state || "NONE"} ${Number.isFinite(Number(comp?.score)) ? Math.round(Number(comp?.score)) : 0}`;

  const e6Text = `${permission?.permission || "—"} • ${Number.isFinite(Number(permission?.sizeMultiplier)) ? Number(permission.sizeMultiplier).toFixed(2) : "—"}x`;

  const row = (k, v, color = "#e5e7eb") => (
    <div style={{ display: "grid", gridTemplateColumns: "34px 1fr", gap: 10, alignItems: "center" }}>
      <div style={{ color: "#9ca3af", fontWeight: 900 }}>{k}</div>
      <div style={{ color, fontWeight: 900, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={v}>
        {v}
      </div>
    </div>
  );

  return (
    <div style={{ border: "1px solid #243244", borderRadius: 12, padding: 12, background: "#0b0f17" }}>
      <div style={{ color: "#93c5fd", fontWeight: 900, marginBottom: 8 }}>ENGINE STACK</div>
      <div style={{ display: "grid", gap: 6, fontSize: 13 }}>
        {row("E1", loc)}
        {row("E2", e2Text, e2Color)}
        {row("E3", e3Text)}
        {row("E4", `${e4State} • ${e4Flags}`)}
        {row("E5", e5Text)}
        {row("E6", e6Text)}
      </div>
    </div>
  );
}

/* -------------------- Main Page -------------------- */
export default function StrategiesFull() {
  const qs = useMemo(() => new URLSearchParams(window.location.search), []);
  const symbol = (qs.get("symbol") || "SPY").toUpperCase();

  const STRATS = useMemo(
    () => [
      { title: "Scalp — Minor Intraday", tf: "10m", strategyId: "intraday_scalp@10m" },
      { title: "Minor — Swing", tf: "1h", strategyId: "minor_swing@1h" },
      { title: "Intermediate — Long", tf: "4h", strategyId: "intermediate_long@4h" },
    ],
    []
  );

  // ✅ Shared snapshot polling (single truth)
  const { data, err, lastFetch, refreshNow } = useDashboardSnapshot(symbol, {
    pollMs: 20000,
    timeoutMs: 20000,
    includeContext: 1,
  });

  const snapshotTs = lastFetch ? toAZ(lastFetch, true) : "—";

  return (
    <div style={{ background: "#05070b", minHeight: "100vh", padding: 14, color: "#e5e7eb" }}>
      {/* Top Bar */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: "#05070b",
          paddingBottom: 10,
          marginBottom: 10,
          borderBottom: "1px solid #1f2937",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "grid", gap: 2 }}>
          <div style={{ fontWeight: 900, fontSize: 18 }}>Full Strategies — {symbol}</div>
          <div style={{ color: "#9ca3af", fontSize: 12 }}>
            Snapshot: <b>{snapshotTs}</b> • Poll 20s
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={refreshNow} style={btn()} title="Refresh now">Refresh</button>
          <button onClick={() => window.close()} style={btn()} title="Close tab">Close Tab</button>
        </div>
      </div>

      {err && (
        <div style={{ marginBottom: 10, color: "#fca5a5", fontWeight: 900 }}>
          Error: {err}
        </div>
      )}

      {/* Big readable stacked cards */}
      <div style={{ display: "grid", gap: 14 }}>
        {STRATS.map((s) => {
          const node = data?.strategies?.[s.strategyId] || {};
          const confluence = node?.confluence || {};
          const permission = node?.permission || {};
          const engine2Card = node?.engine2 || null;

          const score = clamp100(confluence?.scores?.total ?? 0);
          const label = confluence?.scores?.label || grade(score);

          const z = confluence?.context?.activeZone || {};
          const lo = Number(z?.lo);
          const hi = Number(z?.hi);

          const targets = confluence?.targets || {};
          const entryTarget = Number(targets?.entryTarget);
          const exitTarget = Number(targets?.exitTarget);

          const perm = permission?.permission || "—";

          return (
            <div
              key={s.strategyId}
              style={{
                border: "1px solid #243244",
                borderRadius: 14,
                background: "#0b0f17",
                padding: 14,
                boxShadow: "0 12px 30px rgba(0,0,0,.35)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <div style={{ fontWeight: 900, fontSize: 16 }}>{s.title}</div>
                  <span style={{ fontSize: 12, color: "#9ca3af", fontWeight: 900 }}>TF: {s.tf}</span>
                  <span style={{ fontSize: 11, fontWeight: 900, padding: "4px 10px", borderRadius: 999, ...permStyle(perm) }}>
                    {perm}
                  </span>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button onClick={() => openFullChart(symbol, s.tf)} style={btn()} title="Open chart in new tab">
                    Open Full Chart
                  </button>
                </div>
              </div>

              {/* score bar */}
              <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "54px 1fr 70px", alignItems: "center", gap: 10 }}>
                <div style={{ color: "#9ca3af", fontWeight: 900 }}>Score</div>
                <div style={{ background: "#111827", border: "1px solid #243244", borderRadius: 999, height: 12, overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${Math.round(score)}%`,
                      background: "linear-gradient(90deg,#22c55e 0%,#84cc16 40%,#f59e0b 70%,#ef4444 100%)",
                    }}
                  />
                </div>
                <div style={{ textAlign: "right", fontWeight: 900 }}>
                  {Math.round(score)} ({label})
                </div>
              </div>

              {/* two-column info */}
              <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 420px", gap: 14, alignItems: "start" }}>
                {/* left info */}
                <div style={{ display: "grid", gap: 8 }}>
                  <div style={{ fontSize: 13, color: "#cbd5e1" }}>
                    <b>Active Zone:</b>{" "}
                    <span style={{ color: "#fbbf24", fontWeight: 900 }}>
                      {z?.zoneType || "—"}
                    </span>{" "}
                    <span style={{ color: "#94a3b8" }}>
                      {Number.isFinite(lo) ? fmt2(lo) : "—"}–{Number.isFinite(hi) ? fmt2(hi) : "—"}
                    </span>
                  </div>

                  <div style={{ display: "grid", gap: 4, fontSize: 13, color: "#cbd5e1" }}>
                    <div><b>Entry:</b> {Number.isFinite(entryTarget) ? fmt2(entryTarget) : "—"}</div>
                    <div><b>Exit:</b> {Number.isFinite(exitTarget) ? fmt2(exitTarget) : "—"}</div>
                  </div>

                  <div style={{ display: "grid", gap: 4, fontSize: 13 }}>
                    <div style={{ color: "#9ca3af", fontWeight: 900 }}>Reasons (E5)</div>
                    <div style={{ color: "#e5e7eb" }}>
                      {Array.isArray(confluence?.reasonCodes) && confluence.reasonCodes.length
                        ? confluence.reasonCodes.slice(0, 3).join(" • ")
                        : "—"}
                    </div>

                    <div style={{ color: "#9ca3af", fontWeight: 900, marginTop: 6 }}>Reasons (E6)</div>
                    <div style={{ color: "#e5e7eb" }}>
                      {Array.isArray(permission?.reasonCodes) && permission.reasonCodes.length
                        ? permission.reasonCodes.slice(0, 3).join(" • ")
                        : "—"}
                    </div>
                  </div>

                  <div style={{ marginTop: 6, fontSize: 13, color: "#cbd5e1" }}>
                    <b>Next:</b> {confluence ? (confluence.invalid ? "Waiting: invalid cleared." : "Waiting: stronger confluence signals.") : "—"}
                  </div>
                </div>

                {/* right engine stack + strategy snapshot */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <EngineStackBig confluence={confluence} permission={permission} engine2Card={engine2Card} />

                  <div
                    style={{
                      border: "1px solid #243244",
                      borderRadius: 12,
                      padding: 12,
                      background: "#0b0f17",
                      fontSize: 12,
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                    }}
                  >
                    <div style={{ fontWeight: 900, color: "#93c5fd", fontSize: 11 }}>
                      STRATEGY SNAPSHOT
                    </div>

                    <div><b>Wave Phase:</b> {engine2Card?.phase || "—"}</div>
                    <div><b>Fib Score:</b> {Number.isFinite(engine2Card?.fibScore) ? `${engine2Card.fibScore}/20` : "—"}</div>
                    <div><b>Invalidated:</b> {engine2Card?.invalidated ? "YES ❌" : "NO"}</div>
                    <div><b>Degree:</b> {engine2Card?.degree || "—"} {engine2Card?.tf || ""}</div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
