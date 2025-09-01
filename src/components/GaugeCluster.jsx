import React from "react";
import { useDashboardPoll } from "../lib/dashboardApi";

export default function GaugeCluster() {
  const { data, loading, error, refresh } = useDashboardPoll(5000);

  if (loading) {
    return (
      <div className="p-4 rounded-xl border border-gray-700 bg-black/40 text-gray-200">
        <div className="text-lg">Loading dashboard…</div>
        <div className="text-xs opacity-70">Polling /api/dashboard</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-4 rounded-xl border border-red-700 bg-red-900/30 text-red-200">
        <div className="font-semibold">Error</div>
        <div className="text-sm">{error || "No data"}</div>
        <button
          className="mt-3 px-3 py-1 rounded bg-red-600 hover:bg-red-500 text-white"
          onClick={refresh}
        >
          Retry
        </button>
      </div>
    );
  }

  const { gauges = {}, odometers = {}, signals = {}, outlook = {}, meta = {} } = data;

  const lights = [
    ["sigBreakout", "Breakout"],
    ["sigDistribution", "Distribution"],
    ["sigTurbo", "Turbo"],
    ["sigCompression", "Compression"],
    ["sigExpansion", "Expansion"],
    ["sigDivergence", "Divergence"],
    ["sigOverheat", "Overheat"],
    ["sigLowLiquidity", "Low Liquidity"],
  ];

  return (
    <div className="p-4 rounded-2xl border border-gray-700 bg-black text-gray-100 space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-xl font-semibold">Ferrari Cluster — Live</div>
        <div className="text-xs opacity-70">ts: {meta.ts || "—"}</div>
      </div>

      {/* Gauges (text for now) */}
      <div className="grid grid-cols-5 gap-3 text-sm">
        <Stat label="RPM" value={gauges.rpm} />
        <Stat label="Speed" value={gauges.speed} />
        <Stat label="Fuel %" value={gauges.fuelPct} />
        <Stat label="Water °F" value={gauges.waterTemp} />
        <Stat label="Oil PSI" value={gauges.oilPsi} />
      </div>

      {/* Odometers */}
      <div className="grid grid-cols-3 gap-3 text-sm">
        <Stat label="Breadth Odometer" value={odometers.breadthOdometer} />
        <Stat label="Momentum Odometer" value={odometers.momentumOdometer} />
        <Stat label="Squeeze" value={String(odometers.squeeze || "none")} />
      </div>

      {/* Engine lights */}
      <div className="mt-2">
        <div className="text-xs uppercase tracking-wide opacity-70 mb-1">Engine Lights</div>
        <div className="flex flex-wrap gap-2">
          {lights.map(([key, label]) => {
            const s = signals[key] || {};
            const active = !!s.active;
            const sev = s.severity || "info";
            const color =
              !active ? "bg-gray-700 text-gray-300"
              : sev === "danger" ? "bg-red-600 text-white"
              : sev === "warn" ? "bg-yellow-500 text-black"
              : "bg-emerald-500 text-black";
            return (
              <span
                key={key}
                className={`px-2 py-1 rounded-full text-xs font-semibold ${color}`}
                title={key}
              >
                {label} {active ? "●" : "○"}
              </span>
            );
          })}
        </div>
      </div>

      {/* Sector cards (simple list for now) */}
      <div className="mt-2">
        <div className="text-xs uppercase tracking-wide opacity-70 mb-1">Sectors</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {(outlook.sectorCards || []).map((c, i) => (
            <div key={i} className="p-3 rounded-xl border border-gray-700 bg-zinc-900">
              <div className="flex items-center justify-between">
                <div className="font-semibold">{c.sector}</div>
                <div className="text-xs opacity-70">{c.outlook}</div>
              </div>
              <div className="text-xs mt-1 opacity-80">
                spark: {Array.isArray(c.spark) ? c.spark.join(", ") : "—"}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="p-3 rounded-xl border border-gray-700 bg-zinc-900">
      <div className="text-xs opacity-70">{label}</div>
      <div className="text-lg font-semibold">{value ?? "—"}</div>
    </div>
  );
}
