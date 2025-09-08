// src/lib/delta.js
import { useRef, useEffect, useState } from "react";

/** Tracks change since previous render of the same value. */
export function useDelta(value) {
  const prevRef = useRef(value);
  const [delta, setDelta] = useState(0);
  useEffect(() => {
    const prev = prevRef.current;
    if (typeof value === "number" && typeof prev === "number") {
      setDelta(value - prev);
    } else {
      setDelta(0);
    }
    prevRef.current = value;
  }, [value]);
  return delta;
}

/** Formats a small +/-X display. */
export function formatDelta(delta, digits = 1) {
  if (!Number.isFinite(delta) || delta === 0) return "0";
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toFixed(digits)}`;
}

/** Returns ↑ / ↓ / → arrow for deltas. */
export function deltaArrow(delta) {
  if (!Number.isFinite(delta) || delta === 0) return "→";
  return delta > 0 ? "↑" : "↓";
}
