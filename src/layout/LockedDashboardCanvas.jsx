import { useLayoutEffect, useState } from "react";

/**
 * LockedDashboardCanvas
 * - Keeps the exact 32" layout ratio everywhere by rendering at a fixed "design size"
 * - Then scales uniformly to fit current viewport (no reflow)
 */
const BASE_W = 2560; // 32" design width (from your outerWidth)
const BASE_H = 1392; // 32" design height (from your outerHeight)

export default function LockedDashboardCanvas({ children }) {
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const apply = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      // Uniform scale to preserve the design ratio
      const s = Math.min(vw / BASE_W, vh / BASE_H);

      // Keep it usable on smaller monitors
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
