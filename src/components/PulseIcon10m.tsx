import React, { useMemo } from "react";

type PulseData = {
  signal?: number;
  pulseDelta?: number;
  offenseTilt?: number;
  defensiveTilt?: number;
  risingPct?: number;
};

type Props = {
  /** Root intraday JSON already loaded at this level */
  data: any;
  /** Optional className to match your header row */
  className?: string;
  /** Compact label right of the icon (default true) */
  showLabel?: boolean;
  /** Override thresholds if needed */
  thresholds?: { green: number; red: number };
};

/** Pulls from pulse10m or mirrors in metrics */
function selectPulse10m(root: any): PulseData {
  const p = root?.pulse10m ?? {};
  const m = root?.metrics ?? {};

  const signal =
    typeof p.signal === "number"
      ? p.signal
      : typeof m.pulse10m_signal === "number"
      ? m.pulse10m_signal
      : undefined;

  const pulseDelta =
    typeof p.pulseDelta === "number" ? p.pulseDelta : undefined;

  const offenseTilt =
    typeof p.offenseTilt === "number"
      ? p.offenseTilt
      : typeof m.pulse10m_offenseTilt === "number"
      ? m.pulse10m_offenseTilt
      : undefined;

  const defensiveTilt =
    typeof p.defensiveTilt === "number"
      ? p.defensiveTilt
      : typeof m.pulse10m_defenseTilt === "number"
      ? m.pulse10m_defenseTilt
      : undefined;

  const risingPct =
    typeof p.risingPct === "number"
      ? p.risingPct
      : typeof m.pulse10m_risingPct === "number"
      ? m.pulse10m_risingPct
      : undefined;

  return { signal, pulseDelta, offenseTilt, defensiveTilt, risingPct };
}

/** map 0..100 signal to ok / warn / red */
function bandSignal(v?: number, th={green:60, red:40}): "ok"|"warn"|"red"|"muted" {
  if (typeof v !== "number") return "muted";
  if (v >= th.green) return "ok";
  if (v < th.red) return "red";
  return "warn";
}

/** Simple inline bar-chart glyph (SVG) with band-colored fill */
function BarChartIcon({ band="muted" }:{band:"ok"|"warn"|"red"|"muted"}) {
  const fill =
    band === "ok" ? "#19c37d" :
    band === "red" ? "#ff5a5a" :
    band === "warn" ? "#e5b454" : "#93a1b2";
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden focusable="false">
      <rect x="1"  y="9"  width="3" height="6" rx="1" fill={fill} />
      <rect x="6"  y="6"  width="3" height="9" rx="1" fill={fill} opacity="0.88" />
      <rect x="11" y="3"  width="3" height="12" rx="1" fill={fill} opacity="0.76" />
    </svg>
  );
}

export default function PulseIcon10m({
  data,
  className,
  showLabel = true,
  thresholds = { green: 60, red: 40 },
}: Props) {
  const pulse = useMemo(() => selectPulse10m(data), [data]);
  const band = bandSignal(pulse.signal, thresholds);

  // tiny arrow for delta if available
  const delta = typeof pulse.pulseDelta === "number" ? pulse.pulseDelta : undefined;
  const deltaTxt =
    typeof delta === "number"
      ? (delta > 0 ? `+${delta.toFixed(1)}` : `${delta.toFixed(1)}`)
      : undefined;

  const title =
    `Pulse 10m • Signal: ${pulse.signal ?? "—"}`
    + (typeof pulse.risingPct === "number" ? ` • Rising: ${pulse.risingPct.toFixed(1)}%` : "")
    + (typeof pulse.offenseTilt === "number" ? ` • Off: ${pulse.offenseTilt.toFixed(1)}` : "")
    + (typeof pulse.defensiveTilt === "number" ? ` • Def: ${pulse.defensiveTilt.toFixed(1)}` : "")
    + (typeof delta === "number" ? ` • Δ: ${deltaTxt}` : "");

  const cls = `mmPulse ${className ?? ""} mmPulse--${band}`;

  return (
    <div className={cls} title={title}>
      <div className="mmPulse__icon"><BarChartIcon band={band}/></div>
      <div className="mmPulse__text">
        <span className="mmPulse__val">
          {typeof pulse.signal === "number" ? pulse.signal.toFixed(1) : "—"}
        </span>
        {showLabel && <span className="mmPulse__lbl">Pulse</span>}
      </div>
      {typeof delta === "number" && (
        <div className={`mmPulse__delta ${delta > 0 ? "up" : delta < 0 ? "down" : "flat"}`}>
          {deltaTxt}
        </div>
      )}
    </div>
  );
}
