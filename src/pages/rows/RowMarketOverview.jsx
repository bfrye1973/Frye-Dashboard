// src/pages/rows/RowMarketOverview.jsx
import React from "react";

/**
 * RowMarketOverview
 *
 * Props (all optional; defaults prevent "not defined" errors):
 * - breadthPct: number (0..100)
 * - breadthDelta: number (change % or pts)
 * - momentumPct: number (0..100)
 * - momentumDelta: number
 * - squeezePct: number (0..100)
 * - squeezeDelta: number
 *
 * Example:
 * <RowMarketOverview
 *   breadthPct={69}   breadthDelta={+19}
 *   momentumPct={74}  momentumDelta={+24}
 *   squeezePct={82.4} squeezeDelta={+12.4}
 * />
 */

export default function RowMarketOverview() {
  const { data } = useDashboardContext?.() ?? {}; // if you use a context, keep your existing hook
  const od = data?.odometers ?? {};
  const gg = data?.gauges ?? {};
  const ts = data?.meta?.ts ?? null;

  // Core odometers (already normalized 0..100 by dashboardApi)
  const breadth  = Number(od?.breadthOdometer ?? 50);
  const momentum = Number(od?.momentumOdometer ?? 50);

  // Intraday squeeze (compression 0..100). Expansion = 100 - compression
  const squeezeIntra = Number(od?.squeezeCompressionPct ?? 50);

  // Daily squeeze (compression). Backend mirrors this under gauges.squeezeDaily.pct
  const squeezeDaily = Number.isFinite(gg?.squeezeDaily?.pct)
    ? Number(gg.squeezeDaily.pct)
    : null;

  // Liquidity (PSI) and Volatility (%)
  // Prefer canonical locations; fall back to legacy mirrors when present.
  const liquidity = Number.isFinite(gg?.oil?.psi)
    ? Number(gg.oil.psi)
    : Number.isFinite(gg?.oilPsi)
      ? Number(gg.oilPsi)
      : NaN;

  const volatility = Number.isFinite(gg?.volatilityPct)
    ? Number(gg.volatilityPct)
    : Number.isFinite(gg?.water?.pct)
      ? Number(gg.water.pct)
      : NaN;

  // Daily baselines (for arrows/contexts)
  const bBreadth   = useDailyBaseline("breadth",         breadth);
  const bMomentum  = useDailyBaseline("momentum",        momentum);
  const bSqueezeIn = useDailyBaseline("squeezeIntraday", squeezeIntra);
  const bSqueezeDy = useDailyBaseline("squeezeDaily",    squeezeDaily);
  const bLiquidity = useDailyBaseline("liquidity",       liquidity);
  const bVol       = useDailyBaseline("volatility",      volatility);

  // ----- Market Meter (center gauge) -----
  // Blend breadth + momentum + expansion, then weight toward neutral by daily squeeze.
  const expansion = 100 - clamp01(squeezeIntra);
  const baseMeter = 0.4 * breadth + 0.4 * momentum + 0.2 * expansion;

  // Daily squeeze weight 0..1
  const Sdy = Number.isFinite(squeezeDaily) ? clamp01(squeezeDaily) / 100 : 0;

  // Blend toward 50 as squeezeDaily approaches 100
  const blended = (1 - Sdy) * baseMeter + Sdy * 50;
  const meterValue = Math.round(blended);

  return (
    <section id="row-2" className="panel" style={{ padding: 8 }}>
      {/* … your existing JSX for the three left stoplights, center meter, and right pills … */}
      {/* Use breadth/momentum/squeezeIntra, meterValue, liquidity, volatility, and baselines above */}
    </section>
  );
}
