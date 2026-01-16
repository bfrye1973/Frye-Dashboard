// src/components/engine3/ReactionQualityCard.jsx
import React, { useEffect, useMemo, useState } from "react";

/**
 * Props:
 *  - apiBase: string (e.g. process.env.REACT_APP_API_BASE)
 *  - bars: array of OHLCV (chronological)
 *  - zone: { lo, hi, side?, id?, type? }
 *  - atr: number OR array aligned to bars
 *  - tf: string (e.g. "1h")
 *  - windowBars?: number
 */
export default function ReactionQualityCard({
  apiBase,
  bars,
  zone,
  atr,
  tf = "1h",
  windowBars = 6,
}) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(false);

  const canRun = useMemo(() => {
    return (
      typeof apiBase === "string" &&
      apiBase.length > 0 &&
      Array.isArray(bars) &&
      bars.length >= 10 &&
      zone &&
      typeof zone.lo === "number" &&
      typeof zone.hi === "number" &&
      (typeof atr === "number" || Array.isArray(atr))
    );
  }, [apiBase, bars, zone, atr]);

  useEffect(() => {
    if (!canRun) return;

    let alive = true;
    setLoading(true);
    setErr(null);

    fetch(`${apiBase}/api/v1/reaction-quality`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bars,
        zone,
        atr,
        opts: { tf, windowBars },
      }),
    })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j?.message || "Request failed");
        return j;
      })
      .then((j) => {
        if (!alive) return;
        setData(j);
      })
      .catch((e) => {
        if (!alive) return;
        setErr(e?.message || String(e));
        setData(null);
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [apiBase, bars, zone, atr, tf, windowBars, canRun]);

  const score = data?.reactionScore ?? 0;
  const state = data?.structureState || "—";

  const badge = (() => {
    if (!data) return { text: loading ? "Computing…" : "No data", cls: "bg-zinc-700 text-zinc-100" };
    if (state === "FAILURE") return { text: "FAILURE", cls: "bg-red-600 text-white" };
    if (state === "FAKEOUT_RECLAIM") return { text: "RECLAIM", cls: "bg-amber-500 text-black" };
    if (state === "HOLD") return { text: "HOLD", cls: "bg-emerald-500 text-black" };
    return { text: state, cls: "bg-zinc-700 text-zinc-100" };
  })();

  const scoreColor = (() => {
    if (!data) return "text-zinc-200";
    if (score >= 8) return "text-emerald-400";
    if (score >= 6) return "text-amber-300";
    if (score >= 4) return "text-orange-300";
    return "text-red-400";
  })();

  const flags = data?.flags || {};

  const flagPills = [
    ["FAST_REJECTION", "⚡ Fast reject"],
    ["STRONG_DISPLACEMENT", "📏 Clean displacement"],
    ["STRUCTURE_HELD", "🧱 Held"],
    ["FAKEOUT_RECLAIM", "🎣 Sweep + reclaim"],
    ["ABSORPTION_RISK", "🧊 Absorption risk"],
    ["ZONE_FAILURE", "❌ Failed"],
    ["REENTERED_SOON", "↩ Re-entered"],
    ["VOLUME_SPIKE_NEAR_TOUCH", "🔊 Volume spike"],
    ["NO_TOUCH", "— No touch"],
  ]
    .filter(([k]) => flags?.[k])
    .map(([k, label]) => (
      <span
        key={k}
        className="px-2 py-1 rounded-full text-xs bg-zinc-800 text-zinc-100 border border-zinc-700"
        title={k}
      >
        {label}
      </span>
    ));

  return (
    <div className="rounded-2xl bg-zinc-900 border border-zinc-800 shadow p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm text-zinc-400">Engine 3</div>
          <div className="text-lg font-semibold text-zinc-100">Reaction Quality</div>
          <div className="text-xs text-zinc-500 mt-1">
            Zone: {zone?.id ? zone.id : `${zone?.lo?.toFixed?.(2)}–${zone?.hi?.toFixed?.(2)}`} · TF: {tf}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${badge.cls}`}>
            {badge.text}
          </span>
          <div className={`text-3xl font-bold leading-none ${scoreColor}`}>
            {loading ? "…" : score.toFixed(1)}
            <span className="text-sm text-zinc-400 font-medium"> / 10</span>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <Metric label="Exit Bars" value={data?.exitBars ?? "—"} />
        <Metric label="Disp (ATR)" value={data ? (data.displacementAtrRaw?.toFixed?.(2) ?? "—") : "—"} />
        <Metric label="Touch Index" value={data?.touchIndex ?? "—"} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {flagPills.length ? flagPills : (
          <span className="text-xs text-zinc-500">
            {err ? `Error: ${err}` : (loading ? "Measuring reaction…" : "No active flags")}
          </span>
        )}
      </div>

      {data && (
        <div className="mt-4 text-xs text-zinc-500 leading-relaxed">
          <div>
            <span className="text-zinc-400">Score breakdown:</span>{" "}
            Speed <span className="text-zinc-200">{data.rejectionSpeedPoints?.toFixed?.(1)}</span>{" "}
            + Disp <span className="text-zinc-200">{data.displacementPoints?.toFixed?.(1)}</span>{" "}
            + Structure <span className="text-zinc-200">{data.structurePoints?.toFixed?.(1)}</span>
          </div>
          {data.structureState === "FAILURE" && (
            <div className="text-red-400 mt-1">
              FAILURE cap applied (max score 2.0).
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-xl bg-zinc-950 border border-zinc-800 p-3">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="text-lg font-semibold text-zinc-100 mt-1">{value}</div>
    </div>
  );
}
