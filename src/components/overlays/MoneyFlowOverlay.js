// src/components/overlays/MoneyFlowOverlay.js
// DEBUG OVERLAY — draws a visible tint + banner above the chart container.
// Once we confirm it appears, we can switch to the real drawing code.

export default function MoneyFlowOverlay({ chartContainer }) {
  if (!chartContainer) return { update() {}, destroy() {} };

  // Ensure container can host absolute children
  const cs = getComputedStyle(chartContainer);
  if (cs.position === "static") chartContainer.style.position = "relative";

  // Create a full-size absolute layer
  const div = document.createElement("div");
  Object.assign(div.style, {
    position: "absolute",
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0, 255, 136, 0.08)", // faint green tint
    pointerEvents: "none",
    zIndex: 99999, // make sure it sits ABOVE the chart
  });

  // Add a top-left banner to confirm visibility
  const banner = document.createElement("div");
  Object.assign(banner.style, {
    position: "absolute",
    left: "10px",
    top: "10px",
    padding: "6px 10px",
    font: "bold 14px system-ui, -apple-system, Segoe UI, Roboto, Arial",
    color: "#0b0f14",
    background: "#00ff88",
    borderRadius: "6px",
  });
  banner.textContent = "DEBUG: MoneyFlow overlay visible";
  div.appendChild(banner);

  // Keep it sized with the container
  const syncSize = () => {
    // CSS handles sizing since it's absolute to all sides
  };
  const ro = new ResizeObserver(syncSize);
  ro.observe(chartContainer);

  // Mount
  chartContainer.appendChild(div);

  // Public API
  return {
    update() {
      // nothing needed for debug layer
    },
    destroy() {
      try { ro.disconnect(); } catch {}
      try { div.remove(); } catch {}
    },
  };
}
