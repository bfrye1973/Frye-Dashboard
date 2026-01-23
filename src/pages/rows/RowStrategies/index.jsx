// src/pages/rows/RowStrategies/index.jsx
// Strategy Section — 3 Strategy Cards (equal size) powered by:
// - Engine 5: /api/v1/confluence-score (live scoring)
// - Market context: /live feeds (if env URLs exist)
// - Engine 6: /api/v1/trade-permission (real permission)
//
// LOCKED UX:
// - 3 equal cards: Scalp / Minor / Intermediate
// - Poll every 15s (fast feel; engines update on cron anyway)
// - Entry Target = zone midpoint
// - Exit Target (institutional-only) = show both hi/lo
// - Engine 6 uses Engine 5 + Market Meter summary + Zone context

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

const API_BASE = env("REACT_APP_API_BASE", "https://frye-market-backend-1.onrender.com");

// /live feeds (already used by MarketOverview; optional here)
const INTRADAY_URL = env("REACT_APP_INTRADAY_URL", "");
const HOURLY_URL = env("REACT_APP_HOURLY_URL", "");
const H4_URL = env("REACT_APP_4H_URL", "");
const EOD_URL = env("REACT_APP_EOD_URL", "");

const AZ_TZ = "America/Phoenix";

/* -------------------- endpoints -------------------- */
const E5_URL = (tf) => `${API_BASE}/api/v1/confluence-score?symbol=SPY&tf=${encodeURIComponent(tf)}`;
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

function inRange(p, lo, hi) {
  if (!Number.isFinite(p) || !Number.isFinite(lo) || !Number.isFinite(hi)) return false;
  const a = Math.min(lo, hi);
  const b = Math.max(lo, hi);
  return p >= a && p <= b;
}

function grade(score) {
  const s = clamp100(score);
  if (s >= 90) return "A+";
  if (s >= 80) return "A";
  if (s >= 70) return "B";
  if (s >= 60) return "C";
  return "IGNORE";
}

function midpoint(lo, hi) {
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return NaN;
  return (Number(lo) + Number(hi)) / 2;
}

async function fetchJson(url) {
  const r = await fetch(url, { cache: "no-store", headers: { "Cache-Control": "no-store" } });
  const j = await r.json();
  return { ok: r.ok, status: r.status, json: j };
}

function riskFromPct(riskOnPct) {
  const v = Number(riskOnPct);
  if (!Number.isFinite(v)) return "MIXED";
  if (v < 45) return "RISK_OFF";
  if (v >= 70) return "RISK_ON";
  return "MIXED";
}

function stateFromPsi(psi) {
  const v = Number(psi);
  if (!Number.isFinite(v)) return "NEUTRAL";
  if (v >= 85) return "CONTRACTING";
  if (v < 15) return "EXPANDING";
  return "NEUTRAL";
}

function biasFromOverall(score) {
  const v = Number(score);
  if (!Number.isFinite(v)) return "NEUTRAL";
  if (v >= 60) return "BULL";
  if (v < 45) return "BEAR";
  return "NEUTRAL";
}

function top3(arr) {
  const a = Array.isArray(arr) ? arr : [];
  return a.slice(0, 3);
}

/* -------------------- Extract zone used from Engine 5 --------------------
We accept a few likely shapes to avoid breaking when payload evolves.
Required fields for our targets:
- zoneLo, zoneHi
- price (optional)
------------------------------------------------------------------------- */
function extractZoneUsed(e5) {
  const z =
    e5?.context?.zoneUsed ||
    e5?.zoneUsed ||
    e5?.zone ||
    e5?.context?.zone ||
    null;

  const lo = Number(z?.lo ?? z?.low ?? z?.bottom ?? z?.zoneLo);
  const hi = Number(z?.hi ?? z?.high ?? z?.top ?? z?.zoneHi);

  // Try to find a zone type label if present
  const zoneType =
    z?.zoneType ||
    z?.type ||
    z?.kind ||
    e5?.context?.zoneType ||
    "INSTITUTIONAL";

  return {
    zoneType: String(zoneType || "INSTITUTIONAL"),
    zoneId: z?.id || z?.zoneId || z?.structureKey || null,
    lo: Number.isFinite(lo) ? lo : NaN,
    hi: Number.isFinite(hi) ? hi : NaN,
  };
}

/* -------------------- Build ZoneContext for Engine 6 --------------------
Engine 6 MUST NOT guess lateness. We pass upstream flags only.
We consider "withinZone" by price vs zoneLo/zoneHi (safe + deterministic).
------------------------------------------------------------------------- */
function buildZoneContextFromE5(e5) {
  const zone = extractZoneUsed(e5);

  const price =
    Number(e5?.diagnostics?.price) ||
    Number(e5?.price) ||
    Number(e5?.diagnostics?.last) ||
    NaN;

  const withinZone = Number.isFinite(price) && Number.isFinite(zone.lo) && Number.isFinite(zone.hi)
    ? inRange(price, zone.lo, zone.hi)
    : false;

  const flags = e5?.flags || e5?.signals || {};
  const degraded = !!(flags.degraded || flags.late || flags.zoneDegraded || flags.zoneExpired);
  const liquidityFail = !!(flags.liquidityFail || flags.liqFail);
  const reactionFailed = !!(flags.reactionFailed || flags.failedReaction);

  const meta = e5?.meta || e5?.diagnostics || {};

  return {
    zoneType: zone.zoneType || "INSTITUTIONAL",
    zoneId: zone.zoneId,
    withinZone,
    flags: {
      degraded,
      liquidityFail,
      reactionFailed,
    },
    meta: {
      touchCount: Number(meta.touchCount ?? meta.touches ?? NaN),
      minutesSinceLastReaction: Number(meta.minutesSinceLastReaction ?? NaN),
    },
    _zone: zone,
    _price: price,
  };
}

/* -------------------- MarketMeter summary (optional) --------------------
If /live URLs exist, we pull them and build the object Engine 6 expects.
If not available, we send neutral defaults (Engine 6 still works, just conservative).
------------------------------------------------------------------------- */
function neutralMarketMeter() {
  return {
    m10: { state: "NEUTRAL", bias: "NEUTRAL" },
    h1:  { state: "NEUTRAL", bias: "NEUTRAL" },
    h4:  { state: "NEUTRAL", bias: "NEUTRAL" },
    eod: { risk: "MIXED", psi: null, state: "NEUTRAL", bias: "NEUTRAL" },
  };
}

async function fetchMarketMeter() {
  // If any required /live URL missing, just return neutral (do not error)
  if (!INTRADAY_URL || !HOURLY_URL || !H4_URL || !EOD_URL) return neutralMarketMeter();

  try {
    const [d10, d1h, d4h, dd] = await Promise.all([
      fetchJson(`${INTRADAY_URL}?t=${Date.now()}`),
      fetchJson(`${HOURLY_URL}?t=${Date.now()}`),
      fetchJson(`${H4_URL}?t=${Date.now()}`),
      fetchJson(`${EOD_URL}?t=${Date.now()}`),
    ]);

    const live10 = d10.json || {};
    const live1h = d1h.json || {};
    const live4h = d4h.json || {};
    const liveEod = dd.json || {};

    const m10 = live10.metrics || {};
    const m1h = live1h.metrics || {};
    const m4h = live4h.metrics || {};
    const dMetrics = liveEod.metrics || {};
    const daily = liveEod.daily || {};
    const overallEOD = daily?.overallEOD || liveEod.overallEOD || {};
    const eodStateText =
      overallEOD?.state || dMetrics?.overall_eod_state || daily?.state || "neutral";

    const eodPsi = Number(dMetrics?.daily_squeeze_pct ?? daily?.squeezePsi);
    const eodRiskOn =
      Number(dMetrics?.risk_on_daily_pct ?? daily?.riskOnPct ?? liveEod?.rotation?.riskOnPct);

    return {
      m10: {
        state: stateFromPsi(Number(m10.squeeze_psi_10m_pct ?? m10.squeeze_psi ?? m10.psi)),
        bias: biasFromOverall(Number(live10?.intraday?.overall10m?.score ?? live10?.engineLights?.["10m"]?.score)),
      },
      h1: {
        state: stateFromPsi(Number(m1h.squeeze_psi_1h_pct ?? m1h.squeeze_psi_1h ?? m1h.squeeze_psi)),
        bias: biasFromOverall(Number(live1h?.hourly?.overall1h?.score)),
      },
      h4: {
        state: stateFromPsi(Number(m4h.squeeze_psi_4h_pct ?? m4h.squeeze_psi_4h ?? m4h.squeeze_psi)),
        bias: biasFromOverall(Number(live4h?.fourHour?.overall4h?.score ?? m4h.trend_strength_4h_pct)),
      },
      eod: {
        risk: riskFromPct(eodRiskOn),
        psi: Number.isFinite(eodPsi) ? eodPsi : null,
        state: stateFromPsi(eodPsi),
        bias:
          String(eodStateText || "").toLowerCase() === "bull"
            ? "BULL"
            : String(eodStateText || "").toLowerCase() === "bear"
            ? "BEAR"
            : "NEUTRAL",
      },
    };
  } catch {
    return neutralMarketMeter();
  }
}

/* -------------------- Next Trigger (simple) -------------------- */
function nextTriggerText({ e6, zoneContext, e5 }) {
  // Priority: not in zone, invalidated, waiting for inRetraceZone, etc.
  const within = !!zoneContext?.withinZone;
  const invalid = !!(e5?.invalid || e5?.signals?.invalidated || e6?.debug?.invalid);
  const fibInZone = !!(e5?.signals?.inRetraceZone);
  const near50 = !!(e5?.signals?.near50);

  if (invalid) return "Waiting: fib invalidation cleared (74% rule).";
  if (!within) return "Waiting: price to enter zone (no chase).";
  if (!fibInZone) return "Waiting: retrace into fib zone.";
  if (!near50) return "Waiting: near-50% validation.";
  if (e6?.permission === "REDUCE") return "Waiting: stronger reaction/volume confirmation.";
  if (e6?.permission === "ALLOW") return "Ready: execute from zone per allowed trade type.";
  return "Waiting: more data.";
}

/* ===================== Main Component ===================== */
export default function RowStrategies() {
  const { selection, setSelection } = useSelection();

  const [active, setActive] = useState("SCALP"); // SCALP | MINOR | INTERMEDIATE

  const [marketMeter, setMarketMeter] = useState(neutralMarketMeter());
  const [lastMM, setLastMM] = useState(null);

  // Per-strategy states
  const [cards, setCards] = useState({
    SCALP: { e5: null, e6: null, err: null, lastFetch: null },
    MINOR: { e5: null, e6: null, err: null, lastFetch: null },
    INTERMEDIATE: { e5: null, e6: null, err: null, lastFetch: null },
  });

  // TF mapping (LOCKED)
  const STRATS = useMemo(
    () => [
      { id: "SCALP", name: "Scalp — Minor Intraday", tf: "10m", sub: "10m primary • 1h gate" },
      { id: "MINOR", name: "Minor — Swing", tf: "1h", sub: "1h primary • 4h confirm" },
      { id: "INTERMEDIATE", name: "Intermediate — Long", tf: "4h", sub: "4h primary • EOD gate" },
    ],
    []
  );

  // Poll loop
  useEffect(() => {
    let alive = true;

    async function pullAll() {
      if (typeof document !== "undefined" && document.hidden) return;

      try {
        // Market meter
        const mm = await fetchMarketMeter();
        if (!alive) return;
        setMarketMeter(mm);
        setLastMM(nowIso());

        // For each strategy: fetch Engine 5 -> build inputs -> fetch Engine 6
        const updates = {};

        for (const s of STRATS) {
          try {
            const e5Res = await fetchJson(`${E5_URL(s.tf)}&t=${Date.now()}`);
            const e5 = e5Res.json;

            const zoneContext = buildZoneContextFromE5(e5);

            // Engine 6 expects engine5 + marketMeter + zoneContext (+ intent)
            const engine5Input = {
              invalid: !!(e5?.invalid || e5?.signals?.invalidated),
              total: clamp100(e5?.total ?? e5?.scores?.total ?? e5?.score),
              reasonCodes: Array.isArray(e5?.reasonCodes) ? e5?.reasonCodes : [],
            };

            const qEngine5 = encodeURIComponent(JSON.stringify(engine5Input));
            const qMM = encodeURIComponent(JSON.stringify(mm));
            const qZone = encodeURIComponent(JSON.stringify({
              zoneType: zoneContext.zoneType,
              zoneId: zoneContext.zoneId,
              withinZone: zoneContext.withinZone,
              flags: zoneContext.flags,
              meta: zoneContext.meta,
            }));
            const qIntent = encodeURIComponent(JSON.stringify({ action: "NEW_ENTRY" }));

            const e6Res = await fetchJson(
              `${E6_URL}?symbol=SPY&tf=${encodeURIComponent(s.tf)}&engine5=${qEngine5}&marketMeter=${qMM}&zoneContext=${qZone}&intent=${qIntent}&t=${Date.now()}`
            );

            const e6 = e6Res.json;

            updates[s.id] = {
              e5,
              e6,
              zoneContext,
              err: null,
              lastFetch: nowIso(),
            };
          } catch (err) {
            updates[s.id] = {
              e5: null,
              e6: null,
              zoneContext: null,
              err: String(err?.message || err),
              lastFetch: nowIso(),
            };
          }
        }

        if (!alive) return;
        setCards((prev) => ({ ...prev, ...updates }));
      } catch (err) {
        // catastrophic pull error
        if (!alive) return;
        const msg = String(err?.message || err);
        setCards((prev) => ({
          ...prev,
          SCALP: { ...prev.SCALP, err: msg, lastFetch: nowIso() },
          MINOR: { ...prev.MINOR, err: msg, lastFetch: nowIso() },
          INTERMEDIATE: { ...prev.INTERMEDIATE, err: msg, lastFetch: nowIso() },
        }));
      }
    }

    pullAll();
    const id = setInterval(pullAll, 15000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [STRATS]);

  function load(sym, tf) {
    setSelection({ symbol: sym, timeframe: tf, strategy: "smz" });
  }

  function permissionTone(p) {
    if (p === "ALLOW") return { bg: "#22c55e", fg: "#0b1220" };
    if (p === "REDUCE") return { bg: "#fbbf24", fg: "#0b1220" };
    if (p === "STAND_DOWN") return { bg: "#ef4444", fg: "#0b1220" };
    return { bg: "#334155", fg: "#e5e7eb" };
  }

  return (
    <section id="row-5" className="panel" style={{ padding: 10 }}>
      <div className="panel-head" style={{ alignItems: "center" }}>
        <div className="panel-title">Strategies — Engine 5 Score + Engine 6 Permission</div>
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
          MM: <b>{lastMM ? toAZ(lastMM, true) : "—"}</b>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 10, marginTop: 10 }}>
        {STRATS.map((s) => {
          const st = cards[s.id] || {};
          const e5 = st.e5 || {};
          const e6 = st.e6 || {};
          const zc = st.zoneContext || buildZoneContextFromE5(e5);

          const score = clamp100(e5?.total ?? e5?.scores?.total ?? e5?.score);
          const label = grade(score);

          const perm = e6?.permission || "—";
          const tone = permissionTone(perm);

          const zone = zc?._zone || extractZoneUsed(e5);
          const lo = Number(zone?.lo);
          const hi = Number(zone?.hi);
          const mid = midpoint(lo, hi);

          const price = Number(zc?._price);
          const within = !!zc?.withinZone;

          const entryTarget = Number.isFinite(mid)
            ? within
              ? `IN ZONE ✅ (mid ${fmt2(mid)})`
              : `MIDPOINT ${fmt2(mid)}`
            : "—";

          const exitTarget = Number.isFinite(hi) && Number.isFinite(lo)
            ? `HIGH ${fmt2(hi)} • LOW ${fmt2(lo)}`
            : "—";

          const fibInvalid = !!(e5?.signals?.invalidated);
          const fibInZone = !!(e5?.signals?.inRetraceZone);
          const fibNear50 = !!(e5?.signals?.near50);

          const allowedTypes = Array.isArray(e6?.allowedTradeTypes) ? e6.allowedTradeTypes : [];
          const sizeMult = Number(e6?.sizeMultiplier);

          const reasons = top3(e6?.reasonCodes || e5?.reasonCodes || []);

          const nextTxt = nextTriggerText({ e6, zoneContext: zc, e5 });

          // Live dot status
          const fresh = minutesAgo(st.lastFetch) <= 1.5;
          const liveStatus = st.err ? "red" : fresh ? "green" : "yellow";
          const liveTip =
            st.err
              ? `Error: ${st.err}`
              : `Last fetch: ${st.lastFetch ? toAZ(st.lastFetch, true) : "—"} • Price: ${
                  Number.isFinite(price) ? fmt2(price) : "—"
                }`;

          const activeGlow =
            active === s.id ? "0 0 0 2px rgba(59,130,246,.65) inset, 0 10px 30px rgba(0,0,0,.25)" : "0 10px 30px rgba(0,0,0,.25)";

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
              {/* Header */}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <div style={{ fontWeight: 900, fontSize: 14, lineHeight: "16px" }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 700 }}>{s.sub}</div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div
                    style={{
                      background: tone.bg,
                      color: tone.fg,
                      fontWeight: 950,
                      fontSize: 12,
                      padding: "6px 10px",
                      borderRadius: 999,
                      border: "2px solid #0c1320",
                      minWidth: 106,
                      textAlign: "center",
                    }}
                    title="Engine 6 Permission"
                  >
                    {perm}
                  </div>
                  <LiveDot status={liveStatus} tip={liveTip} />
                </div>
              </div>

              {/* Targets */}
              <div style={{ display: "grid", gap: 4 }}>
                <div style={{ fontSize: 12, color: "#cbd5e1" }}>
                  <b>Entry Target:</b> {entryTarget}
                </div>
                <div style={{ fontSize: 12, color: "#cbd5e1" }}>
                  <b>Exit Target:</b> {exitTarget}
                </div>
              </div>

              {/* Score */}
              <div style={{ display: "grid", gridTemplateColumns: "44px 1fr 40px", alignItems: "center", gap: 8, marginTop: 4 }}>
                <div style={{ color: "#9ca3af", fontSize: 10, fontWeight: 900 }}>Score</div>
                <div style={{ background: "#1f2937", borderRadius: 8, height: 8, overflow: "hidden", border: "1px solid #334155" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${Math.max(0, Math.min(100, Math.round(score)))}%`,
                      background:
                        "linear-gradient(90deg,#22c55e 0%,#84cc16 40%,#f59e0b 70%,#ef4444 100%)",
                    }}
                  />
                </div>
                <div style={{ textAlign: "right", fontWeight: 900, fontSize: 12 }}>
                  {Math.round(score)}
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 11, color: "#cbd5e1" }}>
                <div>
                  <span style={{ color: "#9ca3af", fontWeight: 800 }}>Label:</span> {label} (A+≥90 A≥80 B≥70 C≥60)
                </div>
                <div>
                  <span style={{ color: "#9ca3af", fontWeight: 800 }}>TF:</span> {s.tf}
                </div>
              </div>

              {/* Status chips */}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 11, marginTop: 2 }}>
                <Chip ok={!fibInvalid} label="Fib Valid (74%)" />
                <Chip ok={fibInZone} label="In Retrace Zone" />
                <Chip ok={fibNear50} label="Near 50%" />
                <Chip ok={within} label="Within Zone" />
              </div>

              {/* Engine 6 outputs */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 2 }}>
                <MiniBox label="Allowed Trade Types" value={allowedTypes.length ? allowedTypes.join(" • ") : "—"} />
                <MiniBox label="Size" value={Number.isFinite(sizeMult) ? `${sizeMult.toFixed(1)}x` : "—"} />
              </div>

              {/* Reasons + Next */}
              <div style={{ marginTop: 2 }}>
                <div style={{ color: "#9ca3af", fontSize: 11, fontWeight: 900 }}>Reasons (top 3)</div>
                <div style={{ color: "#e5e7eb", fontSize: 12, lineHeight: 1.35, minHeight: 40 }}>
                  {reasons.length ? (
                    <ul style={{ margin: 0, paddingLeft: 16 }}>
                      {reasons.map((r, i) => (
                        <li key={`${r}-${i}`}>{r}</li>
                      ))}
                    </ul>
                  ) : (
                    <div style={{ color: "#94a3b8" }}>—</div>
                  )}
                </div>

                <div style={{ color: "#9ca3af", fontSize: 11, fontWeight: 900, marginTop: 6 }}>Next trigger</div>
                <div style={{ color: "#cbd5e1", fontSize: 12 }}>{nextTxt}</div>
              </div>

              {/* Actions */}
              <div style={{ marginTop: "auto", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ background: "#0b1220", border: "1px solid #1f2937", color: "#93c5fd", padding: "4px 8px", borderRadius: 999, fontSize: 11, fontWeight: 900 }}>
                  PAPER ONLY
                </span>

                <button
                  onClick={() => load("SPY", s.tf)}
                  style={btn()}
                  title="Load SPY chart at this strategy TF"
                >
                  Load SPY
                </button>
                <button
                  onClick={() => load("QQQ", s.tf)}
                  style={btn()}
                  title="Load QQQ chart at this strategy TF"
                >
                  Load QQQ
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* -------------------- UI helpers -------------------- */
function Chip({ ok, label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ fontWeight: 900, color: ok ? "#86efac" : "#94a3b8" }}>
        {ok ? "✓" : "•"}
      </span>
      <span style={{ color: "#cbd5e1" }}>{label}</span>
    </div>
  );
}

function MiniBox({ label, value }) {
  return (
    <div style={{ background: "#0b0b0b", border: "1px solid #2b2b2b", borderRadius: 10, padding: 8 }}>
      <div style={{ color: "#9ca3af", fontSize: 11, fontWeight: 900 }}>{label}</div>
      <div style={{ color: "#e5e7eb", fontSize: 12.5, fontWeight: 900, marginTop: 2 }}>{value}</div>
    </div>
  );
}

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
