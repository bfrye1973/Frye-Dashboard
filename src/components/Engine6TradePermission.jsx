// src/components/Engine6TradePermission.jsx
// Engine 6 — Trade Permission (UI + fetch)
// Self-contained: pulls Engine5 confluence + Market Meter (live feeds) + zone metadata,
// then calls /api/v1/trade-permission and renders ALLOW/REDUCE/STAND_DOWN.
//
// IMPORTANT:
// - Does NOT modify any existing polling system
// - Does NOT guess lateness (expects flags/meta from confluence if present)
// - If inputs missing, shows STAND_DOWN with clear reason

import React from "react";

const CORE_BASE =
  process.env.REACT_APP_CORE_API_BASE ||
  process.env.REACT_APP_API_BASE ||
  ""; // allow relative if proxied

const INTRADAY_URL = process.env.REACT_APP_INTRADAY_URL; // /live/intraday
const HOURLY_URL = process.env.REACT_APP_HOURLY_URL; // /live/hourly
const H4_URL = process.env.REACT_APP_4H_URL; // /live/4h
const EOD_URL = process.env.REACT_APP_EOD_URL; // /live/eod

function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function fmtIso(ts) {
  if (!ts) return "—";
  try {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return String(ts);
    return d.toLocaleString();
  } catch {
    return String(ts);
  }
}

function toneForPermission(p) {
  if (p === "ALLOW") return { bg: "#22c55e", fg: "#0b1220", glow: "rgba(34,197,94,.45)" };
  if (p === "REDUCE") return { bg: "#fbbf24", fg: "#0b1220", glow: "rgba(251,191,36,.45)" };
  if (p === "STAND_DOWN") return { bg: "#ef4444", fg: "#0b1220", glow: "rgba(239,68,68,.45)" };
  return { bg: "#334155", fg: "#e5e7eb", glow: "rgba(51,65,85,.35)" };
}

// Minimal “risk” + “state” mapping from your live feeds
// We DO NOT invent fancy logic — we keep it simple and consistent:
function mapRiskFromPct(riskOnPct) {
  const v = safeNum(riskOnPct);
  if (!Number.isFinite(v)) return "MIXED";
  // Engine 6 hard block uses RISK_OFF only at EOD.
  // Use your Master logic thresholds: >=70 OK, 45–69 warn, <45 danger.
  if (v < 45) return "RISK_OFF";
  if (v >= 70) return "RISK_ON";
  return "MIXED";
}

function mapStateFromPsi(psi) {
  const v = safeNum(psi);
  if (!Number.isFinite(v)) return "NEUTRAL";
  // Lux PSI is “tightness”: high PSI means coil / contraction risk
  // Your UI tone: psi>=85 danger; 15..85 warn; <15 ok
  // Engine 6 contracting = caution; multi-TF contracting = stand down
  if (v >= 85) return "CONTRACTING";
  if (v < 15) return "EXPANDING";
  return "NEUTRAL";
}

function mapBiasFromOverall(overallScore) {
  const v = safeNum(overallScore);
  if (!Number.isFinite(v)) return "NEUTRAL";
  if (v >= 60) return "BULL";
  if (v < 45) return "BEAR";
  return "NEUTRAL";
}

// Attempt to extract zoneContext from a confluence response.
// We do NOT guess — if not present, we mark missing and Engine 6 will STAND_DOWN.
function extractZoneContextFromConfluence(j) {
  const z = j?.zoneContext || j?.zone || j?.context?.zone || null;

  if (!z) {
    return {
      zoneType: "UNKNOWN",
      zoneId: null,
      withinZone: false,
      flags: {
        degraded: true, // if missing, we treat as not safe for entry
        liquidityFail: false,
        reactionFailed: false,
      },
      meta: {},
      _missing: true,
    };
  }

  // Normalize common fields safely
  const zoneType = z.zoneType || z.type || z.kind || "UNKNOWN";
  const zoneId = z.zoneId || z.id || z.structureKey || null;
  const withinZone = !!(z.withinZone ?? z.isWithinZone ?? z.insideZone);

  const flags = z.flags || {};
  const meta = z.meta || {};

  return {
    zoneType,
    zoneId,
    withinZone,
    flags: {
      degraded: !!(flags.degraded ?? flags.late ?? flags.isDegraded),
      liquidityFail: !!(flags.liquidityFail ?? flags.liqFail),
      reactionFailed: !!(flags.reactionFailed ?? flags.failedReaction),
    },
    meta: {
      touchCount: safeNum(meta.touchCount ?? z.touchCount),
      minutesSinceLastReaction: safeNum(meta.minutesSinceLastReaction ?? z.minutesSinceLastReaction),
    },
    _missing: false,
  };
}

async function fetchJson(url) {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
  return r.json();
}

export default function Engine6TradePermission({
  symbol = "SPY",
  tf = "1h",
  intentAction = "NEW_ENTRY",
  pollMs = 15000,
}) {
  const [state, setState] = React.useState({
    loading: true,
    err: null,
    engine6: null,
    last: null,
    inputs: null,
  });

  React.useEffect(() => {
    let stop = false;

    async function pull() {
      try {
        // 1) Engine 5 confluence
        // Use your core route: /api/v1/confluence-score?symbol=SPY&tf=1h
        const confluenceUrl = `${CORE_BASE}/api/v1/confluence-score?symbol=${encodeURIComponent(
          symbol
        )}&tf=${encodeURIComponent(tf)}&t=${Date.now()}`;

        const confluence = await fetchJson(confluenceUrl);

        const engine5 = {
          invalid: !!(confluence?.invalid ?? confluence?.signals?.invalidated ?? false),
          total: safeNum(
            confluence?.total ??
              confluence?.scores?.total ??
              confluence?.score ??
              confluence?.scores?.sum
          ),
          reasonCodes: confluence?.reasonCodes || confluence?.reasons || [],
        };

        // 2) Market Meter live feeds (same ones your RowMarketOverview uses)
        const [live10, live1h, live4h, liveEod] = await Promise.all([
          INTRADAY_URL ? fetchJson(`${INTRADAY_URL}?t=${Date.now()}`) : Promise.resolve(null),
          HOURLY_URL ? fetchJson(`${HOURLY_URL}?t=${Date.now()}`) : Promise.resolve(null),
          H4_URL ? fetchJson(`${H4_URL}?t=${Date.now()}`) : Promise.resolve(null),
          EOD_URL ? fetchJson(`${EOD_URL}?t=${Date.now()}`) : Promise.resolve(null),
        ]);

        // Pull key metrics like your MarketOverview does
        const m10 = live10?.metrics || {};
        const m1h = live1h?.metrics || {};
        const m4h = live4h?.metrics || {};
        const dMetrics = liveEod?.metrics || {};
        const daily = liveEod?.daily || {};
        const overallEOD = liveEod?.daily?.overallEOD || liveEod?.overallEOD || {};
        const eodState =
          overallEOD?.state || dMetrics?.overall_eod_state || daily?.state || "neutral";

        const mm = {
          // 10m
          m10: {
            state: mapStateFromPsi(m10.squeeze_psi_10m_pct ?? m10.squeeze_psi ?? m10.psi),
            bias: mapBiasFromOverall(live10?.intraday?.overall10m?.score ?? live10?.engineLights?.["10m"]?.score),
          },
          // 1h
          h1: {
            state: mapStateFromPsi(m1h.squeeze_psi_1h_pct ?? m1h.squeeze_psi_1h ?? m1h.squeeze_psi),
            bias: mapBiasFromOverall(live1h?.hourly?.overall1h?.score),
          },
          // 4h
          h4: {
            state: mapStateFromPsi(
              m4h.squeeze_psi_4h_pct ?? m4h.squeeze_psi_4h ?? m4h.squeeze_psi
            ),
            bias: mapBiasFromOverall(live4h?.fourHour?.overall4h?.score ?? m4h.trend_strength_4h_pct),
          },
          // EOD (includes risk + PSI danger)
          eod: {
            risk: mapRiskFromPct(
              dMetrics?.risk_on_daily_pct ??
                daily?.riskOnPct ??
                liveEod?.rotation?.riskOnPct
            ),
            psi: safeNum(dMetrics?.daily_squeeze_pct ?? daily?.squeezePsi),
            state: mapStateFromPsi(dMetrics?.daily_squeeze_pct ?? daily?.squeezePsi),
            bias: (String(eodState || "neutral").toLowerCase() === "bull"
              ? "BULL"
              : String(eodState || "neutral").toLowerCase() === "bear"
              ? "BEAR"
              : "NEUTRAL"),
          },
        };

        // 3) Zone context from confluence response (authoritative metadata)
        const zoneContext = extractZoneContextFromConfluence(confluence);

        // 4) Call Engine 6 backend (GET with JSON query payloads)
        const qEngine5 = encodeURIComponent(JSON.stringify(engine5));
        const qMM = encodeURIComponent(JSON.stringify(mm));
        const qZone = encodeURIComponent(JSON.stringify(zoneContext));
        const qIntent = encodeURIComponent(JSON.stringify({ action: intentAction }));

        const engine6Url = `${CORE_BASE}/api/v1/trade-permission?symbol=${encodeURIComponent(
          symbol
        )}&tf=${encodeURIComponent(tf)}&engine5=${qEngine5}&marketMeter=${qMM}&zoneContext=${qZone}&intent=${qIntent}&t=${Date.now()}`;

        const engine6 = await fetchJson(engine6Url);

        if (stop) return;

        setState({
          loading: false,
          err: null,
          engine6,
          last: new Date().toISOString(),
          inputs: { engine5, marketMeter: mm, zoneContext },
        });
      } catch (err) {
        if (stop) return;
        setState((s) => ({
          ...s,
          loading: false,
          err: String(err?.message || err),
          last: new Date().toISOString(),
        }));
      }
    }

    pull();
    const id = setInterval(pull, pollMs);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [symbol, tf, intentAction, pollMs]);

  const e6 = state.engine6 || {};
  const permission = e6.permission || "—";
  const sz = e6.sizeMultiplier;
  const types = Array.isArray(e6.allowedTradeTypes) ? e6.allowedTradeTypes : [];
  const reasons = Array.isArray(e6.reasonCodes) ? e6.reasonCodes : [];
  const style = toneForPermission(permission);

  return (
    <div
      style={{
        background: "#0b0b0c",
        border: "1px solid #2b2b2b",
        borderRadius: 14,
        padding: 14,
        minWidth: 420,
        boxShadow: "0 10px 30px rgba(0,0,0,.25)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            width: 54,
            height: 54,
            borderRadius: "50%",
            background: style.bg,
            boxShadow: `0 0 14px ${style.glow}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "4px solid #0c1320",
          }}
          title="Engine 6 Permission"
        >
          <div style={{ fontWeight: 900, color: style.fg, fontSize: 12 }}>
            E6
          </div>
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ color: "#e5e7eb", fontWeight: 900, fontSize: 16 }}>
            Engine 6 — Trade Permission
          </div>
          <div style={{ color: "#9ca3af", fontSize: 12 }}>
            {symbol} • {tf} • Updated: <strong>{fmtIso(state.last)}</strong>
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={{ color: "#9ca3af", fontSize: 12 }}>Permission</div>
          <div style={{ color: "#e5e7eb", fontWeight: 900, fontSize: 18 }}>
            {state.loading ? "…" : permission}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
        <div
          style={{
            background: "#0f172a",
            border: "1px solid #1f2937",
            borderRadius: 12,
            padding: "10px 12px",
            minWidth: 130,
          }}
        >
          <div style={{ color: "#9ca3af", fontSize: 12 }}>Size</div>
          <div style={{ color: "#e5e7eb", fontWeight: 900, fontSize: 16 }}>
            {Number.isFinite(sz) ? `${sz.toFixed(1)}x` : "—"}
          </div>
        </div>

        <div
          style={{
            background: "#0f172a",
            border: "1px solid #1f2937",
            borderRadius: 12,
            padding: "10px 12px",
            minWidth: 210,
            flex: 1,
          }}
        >
          <div style={{ color: "#9ca3af", fontSize: 12 }}>Allowed trade types</div>
          <div style={{ color: "#e5e7eb", fontWeight: 800, fontSize: 13, marginTop: 2 }}>
            {types.length ? types.join(" • ") : "—"}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <div style={{ color: "#9ca3af", fontSize: 12, marginBottom: 6 }}>Reasons</div>
        <div
          style={{
            background: "#0b1220",
            border: "1px solid #1f2937",
            borderRadius: 12,
            padding: 10,
            color: "#e5e7eb",
            fontSize: 12.5,
            lineHeight: 1.35,
            maxHeight: 120,
            overflow: "auto",
          }}
        >
          {state.err ? (
            <div style={{ color: "#fca5a5", fontWeight: 800 }}>
              Error: {state.err}
            </div>
          ) : reasons.length ? (
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              {reasons.map((r, i) => (
                <li key={`${r}-${i}`}>{r}</li>
              ))}
            </ul>
          ) : (
            <div style={{ color: "#9ca3af" }}>—</div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 10, color: "#9ca3af", fontSize: 12 }}>
        <strong>Rule:</strong> New entries are blocked when EOD is RISK_OFF, PSI≥90, or multi-TF contracting.
      </div>
    </div>
  );
}
