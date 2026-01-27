// src/pages/rows/RowStrategies/index.jsx
// Strategies — Engine 5 Confluence Cards (Phase 2) + Engine 6 Permission (POST)
//
// ✅ CHANGESET (per your locked game plan):
// 1) KEEP EVERYTHING on LEFT side exactly as-is
// 2) ONLY move Score bar directly under STAND_DOWN pill
// 3) Add a RIGHT COLUMN (fixed width) showing ENGINE STACK (E1–E6) always visible
// 4) Add "Open Full Strategies" button (new tab) — same on all cards
//
// 🔒 Layout safety:
// - Card height does NOT increase
// - Right column fixed width, compact text, no wrapping, no scrollbars

import React, { useEffect, useMemo, useState } from "react";
import { useSelection } from "../../../context/ModeContext";
import LiveDot from "../../../components/LiveDot";

/* -------------------- env helpers (CRA-safe) -------------------- */
function env(name, fb = "") {
  try {
    if (typeof process !== "undefined" && process.env && name in process.env) {
      return String(process.env[name] || "").trim();
    }
  } catch {}
  return fb;
}

function normalizeApiBase(x) {
  const raw = String(x || "").trim();
  if (!raw) return "https://frye-market-backend-1.onrender.com";
  let out = raw.replace(/\/+$/, "");
  out = out.replace(/\/api\/v1$/i, "");
  out = out.replace(/\/api$/i, "");
  return out;
}

const API_BASE = normalizeApiBase(env("REACT_APP_API_BASE", ""));
const AZ_TZ = "America/Phoenix";

/* -------------------- endpoints -------------------- */
const E5_URL = ({ symbol = "SPY", tf, degree, wave = "W1" }) =>
  `${API_BASE}/api/v1/confluence-score?symbol=${encodeURIComponent(symbol)}&tf=${encodeURIComponent(
    tf
  )}&degree=${encodeURIComponent(degree)}&wave=${encodeURIComponent(wave)}`;

const E6_URL = `${API_BASE}/api/v1/trade-permission`;

/* -------------------- utils -------------------- */
const nowIso = () => new Date().toISOString();

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

function minutesAgo(iso) {
  if (!iso) return Infinity;
  const ms = Date.now() - new Date(iso).getTime();
  return ms / 60000;
}

function clamp100(x) {
  const n = Number(x);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function fmt2(x) {
  return Number.isFinite(x) ? Number(x).toFixed(2) : "—";
}

function top3(arr) {
  const a = Array.isArray(arr) ? arr : [];
  return a.slice(0, 3);
}

function grade(score) {
  const s = clamp100(score);
  if (s >= 90) return "A+";
  if (s >= 80) return "A";
  if (s >= 70) return "B";
  if (s >= 60) return "C";
  return "IGNORE";
}

/* -------------------- Golden Coil badge rule (LOCKED) -------------------- */
function showGoldenCoil(confluence) {
  return (
    confluence?.invalid !== true &&
    confluence?.flags?.goldenIgnition === true &&
    confluence?.compression?.active === true &&
    confluence?.compression?.state === "COILING"
  );
}

/* -------------------- robust fetch helpers -------------------- */
async function safeFetchJson(url, opts = {}) {
  const res = await fetch(url, {
    cache: "no-store",
    headers: { accept: "application/json", ...(opts.headers || {}) },
    ...opts,
  });

  const text = await res.text().catch(() => "");
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!res.ok) {
    const msg =
      json?.error ||
      json?.detail ||
      (typeof json === "string" ? json : null) ||
      text?.slice(0, 200) ||
      `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return json;
}

/* -------------------- Safe extraction from Engine 5 payload -------------------- */
function extractActiveZone(confluence) {
  const z = confluence?.context?.activeZone || null;
  const lo = Number(z?.lo);
  const hi = Number(z?.hi);
  const mid = Number(z?.mid);

  return {
    zoneType: z?.zoneType || z?.type || "—",
    id: z?.id || null,
    lo: Number.isFinite(lo) ? lo : NaN,
    hi: Number.isFinite(hi) ? hi : NaN,
    mid: Number.isFinite(mid) ? mid : NaN,
  };
}

function extractTargets(confluence) {
  const t = confluence?.targets || {};
  const entryTarget = Number(t?.entryTarget);
  const exitTarget = Number(t?.exitTarget);
  const exitTargetHi = Number(t?.exitTargetHi);
  const exitTargetLo = Number(t?.exitTargetLo);

  return {
    entryTarget: Number.isFinite(entryTarget) ? entryTarget : NaN,
    exitTarget: Number.isFinite(exitTarget) ? exitTarget : NaN,
    exitTargetHi: Number.isFinite(exitTargetHi) ? exitTargetHi : NaN,
    exitTargetLo: Number.isFinite(exitTargetLo) ? exitTargetLo : NaN,
  };
}

function extractCompression(confluence) {
  const c = confluence?.compression || {};
  return {
    active: c?.active === true,
    tier: c?.tier || "—",
    score: Number.isFinite(Number(c?.score)) ? Number(c?.score) : NaN,
    state: c?.state || "—",
    widthAtrRatio: Number.isFinite(Number(c?.widthAtrRatio)) ? Number(c?.widthAtrRatio) : NaN,
    quiet: c?.quiet === true,
    reasons: Array.isArray(c?.reasons) ? c.reasons : [],
  };
}

function extractVolume(confluence) {
  const v = confluence?.volume || {};
  const volScore = Number(v?.volumeScore);
  const confirmed = v?.volumeConfirmed === true;
  const state = confluence?.volumeState || "—";

  return {
    state,
    volumeScore: Number.isFinite(volScore) ? volScore : NaN,
    volumeConfirmed: confirmed,
  };
}

function nextTriggerText(confluence) {
  const invalid = confluence?.invalid === true;
  const codes = Array.isArray(confluence?.reasonCodes) ? confluence.reasonCodes : [];
  const hasZone = !!confluence?.context?.activeZone;
  const comp = confluence?.compression;
  const volState = String(confluence?.volumeState || "");

  if (invalid) {
    if (codes.includes("NO_ZONE_NO_TRADE")) return "Waiting: zone context (no zone → no trade).";
    if (codes.includes("FIB_INVALIDATION_74")) return "Waiting: fib invalidation cleared (74% rule).";
    return "Waiting: invalid condition cleared.";
  }

  if (!hasZone) return "Waiting: active zone selection (negotiated/shelf/institutional).";

  if (comp?.active === true && comp?.state === "COILING") {
    if (volState === "NO_SIGNAL") return "Waiting: initiative volume / confirmation.";
    return "Waiting: breakout/launch confirmation.";
  }

  return "Waiting: stronger confluence signals.";
}

/* -------------------- Engine 6 POST helper -------------------- */
async function fetchEngine6({ symbol, tf, confluence }) {
  const engine5 = {
    invalid: confluence?.invalid === true,
    total: clamp100(confluence?.scores?.total ?? confluence?.total ?? 0),
    reasonCodes: Array.isArray(confluence?.reasonCodes) ? confluence.reasonCodes : [],
  };

  const z = confluence?.context?.activeZone || null;

  const payload = {
    symbol,
    tf,
    engine5,
    marketMeter: null,
    zoneContext: {
      zoneType: z?.zoneType || "UNKNOWN",
      zoneId: z?.id || null,
      withinZone: !!z,
      flags: {
        degraded: false,
        liquidityFail: confluence?.flags?.liquidityTrap === true,
        reactionFailed: false,
      },
      meta: {},
    },
    intent: { action: "NEW_ENTRY" },
  };

  return safeFetchJson(E6_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

/* -------------------- permission pill styling -------------------- */
function permStyle(permission) {
  if (permission === "ALLOW") {
    return { background: "#22c55e", color: "#0b1220", border: "2px solid #0c1320" };
  }
  if (permission === "REDUCE") {
    return { background: "#fbbf24", color: "#0b1220", border: "2px solid #0c1320" };
  }
  if (permission === "STAND_DOWN") {
    return { background: "#ef4444", color: "#0b1220", border: "2px solid #0c1320" };
  }
  return { background: "#0b0b0b", color: "#93c5fd", border: "1px solid #2b2b2b" };
}

/* -------------------- Open Full Strategies (new tab) -------------------- */
function openFullStrategies(symbol = "SPY") {
  const url = `/strategies/full?symbol=${encodeURIComponent(symbol)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

/* -------------------- Small UI helpers -------------------- */
function btn() {
  return {
    background: "#141414",
    color: "#e5e7eb",
    border: "1px solid #2a2a2a",
    borderRadius: 10,
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
  };
}

function MiniRow({ label, left, right, tone = "muted" }) {
  const t = (kind) => {
    switch (String(kind || "").toUpperCase()) {
      case "OK":
        return { background: "#06220f", color: "#86efac", borderColor: "#166534" };
      case "WARN":
        return { background: "#1b1409", color: "#fbbf24", borderColor: "#92400e" };
      case "DANGER":
        return { background: "#2b0b0b", color: "#fca5a5", borderColor: "#7f1d1d" };
      default:
        return { background: "#0b0b0b", color: "#94a3b8", borderColor: "#2b2b2b" };
    }
  };
  const toneMap = tone === "ok" ? "OK" : tone === "warn" ? "WARN" : tone === "danger" ? "DANGER" : "MUTED";
  const pill = t(toneMap);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "92px 1fr auto", gap: 8, alignItems: "center" }}>
      <div style={{ color: "#9ca3af", fontSize: 11, fontWeight: 900 }}>{label}</div>
      <div style={{ color: "#cbd5e1", fontSize: 12, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {left}
      </div>
      <span
        style={{
          fontSize: 10,
          fontWeight: 900,
          padding: "3px 8px",
          borderRadius: 999,
          border: `1px solid ${pill.borderColor}`,
          background: pill.background,
          color: pill.color,
          whiteSpace: "nowrap",
        }}
      >
        {right}
      </span>
    </div>
  );
}

/* -------------------- Engine Stack (RIGHT COLUMN) -------------------- */
function EngineStack({ confluence, e6 }) {
  const loc = confluence?.location || {};
  const fib = confluence?.context?.fib || {};
  const fs = fib?.signals || null;
  const reaction = confluence?.context?.reaction || {};
  const volume = confluence?.context?.volume || {};
  const vFlags = volume?.flags || {};
  const comp = confluence?.compression || {};
  const score = clamp100(confluence?.scores?.total ?? 0);
  const label = confluence?.scores?.label || grade(score);

  // E2 display
  let e2Text = "NO_ANCHORS";
  if (fib?.ok === false && String(fib?.reason || "") === "NO_ANCHORS") e2Text = "NO_ANCHORS";
  else if (fs) {
    if (fs.invalidated) e2Text = "INVALID ❌";
    else if (fs.inRetraceZone || fs.near50) e2Text = `VALID ✅ ${fs.inRetraceZone ? "RETRACE" : ""}${fs.near50 ? " 50" : ""}`.trim();
    else e2Text = "VALID ✅";
  }

  const e3Text = `${Number(reaction?.reactionScore ?? 0).toFixed(1)} ${reaction?.structureState || "HOLD"}`;
  const e4State = confluence?.volumeState || "NO_SIGNAL";
  const e4Flags = `trap:${vFlags?.liquidityTrap ? "Y" : "N"} init:${vFlags?.initiativeMoveConfirmed ? "Y" : "N"}`;

  const e5Text = `${Math.round(score)} (${label})`;
  const e5Comp = `${comp?.state || "NONE"} ${Number.isFinite(Number(comp?.score)) ? Math.round(Number(comp?.score)) : 0}`;

  const perm = e6?.permission || "—";
  const size = Number.isFinite(Number(e6?.sizeMultiplier)) ? Number(e6.sizeMultiplier).toFixed(2) : "—";

  return (
    <div
      style={{
        border: "1px solid #1f2937",
        borderRadius: 10,
        padding: 8,
        background: "#0b0b0b",
        height: 168, // fixed to avoid height creep
        display: "grid",
        gridTemplateRows: "auto repeat(6, 1fr)",
        gap: 4,
        overflow: "hidden",
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 900, color: "#93c5fd" }}>ENGINE STACK</div>

      <div style={stackRow()}>
        <span style={stackK()}>E1</span>
        <span style={stackV()} title={loc?.state || "—"}>{loc?.state || "—"}</span>
      </div>

      <div style={stackRow()}>
        <span style={stackK()}>E2</span>
        <span style={stackV()} title={e2Text}>{e2Text}</span>
      </div>

      <div style={stackRow()}>
        <span style={stackK()}>E3</span>
        <span style={stackV()} title={e3Text}>{e3Text}</span>
      </div>

      <div style={stackRow()}>
        <span style={stackK()}>E4</span>
        <span style={stackV()} title={`${e4State} ${e4Flags}`}>{e4State} • {e4Flags}</span>
      </div>

      <div style={stackRow()}>
        <span style={stackK()}>E5</span>
        <span style={stackV()} title={`${e5Text} • ${e5Comp}`}>{e5Text} • {e5Comp}</span>
      </div>

      <div style={stackRow()}>
        <span style={stackK()}>E6</span>
        <span style={stackV()} title={`${perm} • ${size}x`}>{perm} • {size}x</span>
      </div>
    </div>
  );
}

function stackRow() {
  return {
    display: "grid",
    gridTemplateColumns: "22px 1fr",
    gap: 6,
    alignItems: "center",
    minWidth: 0,
  };
}
function stackK() {
  return { fontWeight: 900, fontSize: 11, color: "#9ca3af" };
}
function stackV() {
  return {
    fontWeight: 900,
    fontSize: 11,
    color: "#e5e7eb",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    minWidth: 0,
  };
}

/* ===================== Main Component ===================== */
export default function RowStrategies() {
  const { setSelection } = useSelection();

  const STRATS = useMemo(
    () => [
      { id: "SCALP", name: "Scalp — Minor Intraday", tf: "10m", degree: "minute", wave: "W1", sub: "10m primary • 1h gate" },
      { id: "MINOR", name: "Minor — Swing", tf: "1h", degree: "minor", wave: "W1", sub: "1h primary • 4h confirm" },
      { id: "INTERMEDIATE", name: "Intermediate — Long", tf: "4h", degree: "intermediate", wave: "W1", sub: "4h primary • EOD gate" },
    ],
    []
  );

  const [active, setActive] = useState("SCALP");

  const [state, setState] = useState({
    SCALP: { data: null, e6: null, err: null, lastFetch: null },
    MINOR: { data: null, e6: null, err: null, lastFetch: null },
    INTERMEDIATE: { data: null, e6: null, err: null, lastFetch: null },
  });

  // Poll Engine 5 + Engine 6 per strategy (serialized, no overlap)
  useEffect(() => {
    let alive = true;
    let inFlight = false;

    async function pullOnce() {
      if (!alive) return;
      if (inFlight) return;
      if (typeof document !== "undefined" && document.hidden) return;

      inFlight = true;
      const updates = {};

      for (const s of STRATS) {
        try {
          const url = `${E5_URL({ symbol: "SPY", tf: s.tf, degree: s.degree, wave: s.wave })}&t=${Date.now()}`;
          const confluence = await safeFetchJson(url, { headers: { "Cache-Control": "no-store" } });

          let e6 = null;
          try {
            e6 = await fetchEngine6({ symbol: "SPY", tf: s.tf, confluence });
          } catch (e) {
            e6 = { permission: "—", reasonCodes: [`ENGINE6_FETCH_FAIL:${String(e?.message || e)}`] };
          }

          updates[s.id] = { data: confluence, e6, err: null, lastFetch: nowIso() };
        } catch (e) {
          updates[s.id] = { data: null, e6: null, err: String(e?.message || e), lastFetch: nowIso() };
        }
      }

      if (!alive) return;
      setState((prev) => ({ ...prev, ...updates }));
      inFlight = false;
    }

    pullOnce();
    const id = setInterval(pullOnce, 15_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [STRATS]);

  function load(sym, tf) {
    setSelection({ symbol: sym, timeframe: tf, strategy: "smz" });
  }

  return (
    <section id="row-5" className="panel" style={{ padding: 10 }}>
      <div className="panel-head" style={{ alignItems: "center" }}>
        <div className="panel-title">Strategies — Engine 5 Score + Engine 6 Permission</div>

        {/* Active selector */}
        <div style={{ marginLeft: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
          {STRATS.map((s) => (
            <button
              key={s.id}
              onClick={() => setActive(s.id)}
              style={{
                background: active === s.id ? "#1f2937" : "#0b0b0b",
                color: "#e5e7eb",
                border: active === s.id ? "1px solid #3b82f6" : "1px solid #2b2b2b",
                boxShadow: active === s.id ? "0 0 0 1px #3b82f6 inset" : "none",
                borderRadius: 10,
                padding: "6px 10px",
                fontWeight: 900,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              {s.id}
            </button>
          ))}
        </div>

        <div className="spacer" />
        <div style={{ color: "#9ca3af", fontSize: 12 }}>
          Poll: <b>15s</b>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 10, marginTop: 10 }}>
        {STRATS.map((s) => {
          const st = state[s.id] || {};
          const confluence = st.data || null;
          const e6 = st.e6 || null;

          const activeGlow =
            active === s.id
              ? "0 0 0 2px rgba(59,130,246,.65) inset, 0 10px 30px rgba(0,0,0,.25)"
              : "0 10px 30px rgba(0,0,0,.25)";

          const fresh = minutesAgo(st.lastFetch) <= 1.5;
          const liveStatus = st.err ? "red" : fresh ? "green" : "yellow";
          const liveTip = st.err ? `Error: ${st.err}` : `Last fetch: ${st.lastFetch ? toAZ(st.lastFetch, true) : "—"}`;

          const score = clamp100(confluence?.scores?.total ?? confluence?.scores?.sum ?? confluence?.total ?? 0);
          const label = confluence?.scores?.label || grade(score);

          const reasonsE5 = top3(confluence?.reasonCodes || []);
          const reasonsE6 = top3(e6?.reasonCodes || []);
          const zone = extractActiveZone(confluence);
          const targets = extractTargets(confluence);
          const compression = extractCompression(confluence);
          const volume = extractVolume(confluence);

          const golden = showGoldenCoil(confluence);

          const entryTxt = Number.isFinite(targets.entryTarget) ? fmt2(targets.entryTarget) : "—";
          let exitTxt = "—";
          if (Number.isFinite(targets.exitTarget)) {
            exitTxt = fmt2(targets.exitTarget);
          } else {
            const hi = Number.isFinite(targets.exitTargetHi) ? `Hi ${fmt2(targets.exitTargetHi)}` : null;
            const lo = Number.isFinite(targets.exitTargetLo) ? `Lo ${fmt2(targets.exitTargetLo)}` : null;
            exitTxt = [hi, lo].filter(Boolean).join(" • ") || "—";
          }

          const perm = e6?.permission || "—";

          return (
            <div
              key={s.id}
              style={{
                background: "#101010",
                border: "1px solid #262626",
                borderRadius: 12,
                padding: 10,
                color: "#e5e7eb",
                boxShadow: activeGlow,
                minHeight: 320,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {/* CARD BODY: 2 columns */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 220px", gap: 10, alignItems: "start" }}>
                {/* LEFT COLUMN: keep everything */}
                <div style={{ minWidth: 0 }}>
                  {/* Header row */}
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <div style={{ fontWeight: 900, fontSize: 14, lineHeight: "16px" }}>{s.name}</div>

                        {/* Permission pill (Engine 6) */}
                        <span
                          style={{ fontSize: 11, fontWeight: 900, padding: "4px 10px", borderRadius: 999, ...permStyle(perm) }}
                          title="Engine 6 trade permission"
                        >
                          {perm}
                        </span>

                        {/* Golden Coil badge */}
                        {golden && (
                          <span
                            style={{
                              background: "linear-gradient(135deg,#ffb703,#ff8800)",
                              color: "#1a1a1a",
                              fontWeight: 900,
                              padding: "4px 10px",
                              borderRadius: 8,
                              boxShadow: "0 0 10px rgba(255,183,3,.55)",
                              border: "1px solid rgba(255,255,255,.18)",
                            }}
                            title="Golden Coil: golden ignition + coiling compression"
                          >
                            🔥 GOLDEN COIL
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 700 }}>{s.sub}</div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <LiveDot status={liveStatus} tip={liveTip} />
                    </div>
                  </div>

                  {/* ✅ MOVED: Score bar directly under STAND_DOWN */}
                  <div style={{ display: "grid", gridTemplateColumns: "44px 1fr 40px", alignItems: "center", gap: 8, marginTop: 8 }}>
                    <div style={{ color: "#9ca3af", fontSize: 10, fontWeight: 900 }}>Score</div>
                    <div style={{ background: "#1f2937", borderRadius: 8, height: 8, overflow: "hidden", border: "1px solid #334155" }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${Math.max(0, Math.min(100, Math.round(score)))}%`,
                          background: "linear-gradient(90deg,#22c55e 0%,#84cc16 40%,#f59e0b 70%,#ef4444 100%)",
                        }}
                      />
                    </div>
                    <div style={{ textAlign: "right", fontWeight: 900, fontSize: 12 }}>{Math.round(score)}</div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 11, color: "#cbd5e1" }}>
                    <div>
                      <span style={{ color: "#9ca3af", fontWeight: 800 }}>Label:</span>{" "}
                      {label || "—"}{" "}
                      <span style={{ color: "#9ca3af" }}>(A+≥90 A≥80 B≥70 C≥60)</span>
                    </div>
                    <div>
                      <span style={{ color: "#9ca3af", fontWeight: 800 }}>TF:</span> {s.tf}
                    </div>
                  </div>

                  {/* Entry/Exit targets */}
                  <div style={{ display: "grid", gap: 4, marginTop: 6 }}>
                    <div style={{ fontSize: 12, color: "#cbd5e1" }}>
                      <b>Entry Target:</b> {entryTxt}
                    </div>
                    <div style={{ fontSize: 12, color: "#cbd5e1" }}>
                      <b>Exit Target:</b> {exitTxt}
                    </div>
                  </div>

                  {/* Zone + Compression + Volume (unchanged) */}
                  <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
                    <div style={{ fontSize: 12, color: "#cbd5e1" }}>
                      <b>Active Zone:</b>{" "}
                      {zone?.zoneType ? (
                        <>
                          <span style={{ color: "#fbbf24", fontWeight: 900 }}>{zone.zoneType}</span>{" "}
                          <span style={{ color: "#94a3b8" }}>
                            {Number.isFinite(zone.lo) ? fmt2(zone.lo) : "—"}–{Number.isFinite(zone.hi) ? fmt2(zone.hi) : "—"}
                          </span>
                        </>
                      ) : (
                        "—"
                      )}
                    </div>

                    <MiniRow
                      label="Compression"
                      left={`${compression.active ? "ACTIVE" : "OFF"} • ${compression.tier} • ${compression.state}`}
                      right={`score ${Number.isFinite(compression.score) ? Math.round(compression.score) : "—"} • ATR ratio ${
                        Number.isFinite(compression.widthAtrRatio) ? compression.widthAtrRatio.toFixed(2) : "—"
                      }`}
                      tone={compression.active ? "warn" : "muted"}
                    />

                    <MiniRow
                      label="Volume"
                      left={`${volume.state || "—"} • score ${Number.isFinite(volume.volumeScore) ? Math.round(volume.volumeScore) : "—"}`}
                      right={`${volume.volumeConfirmed ? "CONFIRMED" : "unconfirmed"}`}
                      tone={volume.volumeConfirmed ? "ok" : "muted"}
                    />
                  </div>
                </div>

                {/* RIGHT COLUMN: Engine Stack */}
                <div style={{ minWidth: 0 }}>
                  <EngineStack confluence={confluence} e6={e6} />
                </div>
              </div>

              {/* Reasons + Next trigger (unchanged) */}
              <div style={{ marginTop: 2 }}>
                <div style={{ color: "#9ca3af", fontSize: 11, fontWeight: 900 }}>Reasons (E5 top 3)</div>
                <div style={{ color: "#e5e7eb", fontSize: 12, lineHeight: 1.35, minHeight: 32 }}>
                  {st.err ? (
                    <div style={{ color: "#fca5a5", fontWeight: 900 }}>{st.err}</div>
                  ) : reasonsE5.length ? (
                    <ul style={{ margin: 0, paddingLeft: 16 }}>
                      {reasonsE5.map((r, i) => (
                        <li key={`${r}-${i}`}>{r}</li>
                      ))}
                    </ul>
                  ) : (
                    <div style={{ color: "#94a3b8" }}>—</div>
                  )}
                </div>

                <div style={{ color: "#9ca3af", fontSize: 11, fontWeight: 900, marginTop: 6 }}>Reasons (E6 top 3)</div>
                <div style={{ color: "#e5e7eb", fontSize: 12, lineHeight: 1.35, minHeight: 32 }}>
                  {reasonsE6.length ? (
                    <ul style={{ margin: 0, paddingLeft: 16 }}>
                      {reasonsE6.map((r, i) => (
                        <li key={`${r}-${i}`}>{r}</li>
                      ))}
                    </ul>
                  ) : (
                    <div style={{ color: "#94a3b8" }}>—</div>
                  )}
                </div>

                <div style={{ color: "#9ca3af", fontSize: 11, fontWeight: 900, marginTop: 6 }}>Next trigger</div>
                <div style={{ color: "#cbd5e1", fontSize: 12 }}>{nextTriggerText(confluence)}</div>
              </div>

              {/* Actions (unchanged + Open Full Strategies) */}
              <div style={{ marginTop: "auto", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <span
                  style={{
                    background: "#0b1220",
                    border: "1px solid #1f2937",
                    color: "#93c5fd",
                    padding: "4px 8px",
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 900,
                  }}
                >
                  PAPER ONLY
                </span>

                <button onClick={() => load("SPY", s.tf)} style={btn()} title="Load SPY chart at this strategy TF">
                  Load SPY
                </button>
                <button onClick={() => load("QQQ", s.tf)} style={btn()} title="Load QQQ chart at this strategy TF">
                  Load QQQ
                </button>

                <button onClick={() => openFullStrategies("SPY")} style={btn()} title="Open all strategies in a large readable view">
                  Open Full Strategies
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
