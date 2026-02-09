import { useLayoutEffect, useState } from "react";

/**
 * LockedDashboardCanvas
 * Keeps the exact 32" layout ratio everywhere:
 * - Render dashboard at fixed "design" size (BASE_W x BASE_H)
 * - Scale uniformly to fit the current viewport (no reflow)
 */
const BASE_W = 2560;
const BASE_H = 1392;

export default function LockedDashboardCanvas({ children }) {
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const apply = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      // Fit inside viewport (no cropping)
      const s = Math.min(vw / BASE_W, vh / BASE_H);

      // Keep usable on smaller screens
      const clamped = Math.max(0.55, Math.min(1, s));

      setScale(clamped);
    };

    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, []);

  return (
    <div className="locked-viewport">
      <div
        className="locked-canvas"
        style={{
          width: BASE_W,
          height: BASE_H,
          transform: `scale(${scale})`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
