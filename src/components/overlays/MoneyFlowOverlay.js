/* ----------------------------- Overlays — DEBUG MoneyFlow ---------------------------- */
// This bypasses the overlay module and just paints a visible layer directly.
// If this shows up, layering is fine and the problem is in the overlay module/import.
// If this does NOT show up, the toggle isn't flipping or the container needs positioning.
useEffect(() => {
  const container = containerRef.current;
  if (!container) return;

  // ensure container can host absolute children
  const cs = getComputedStyle(container);
  if (cs.position === "static") {
    container.style.position = "relative";
  }

  // toggle OFF → remove if present
  if (!state.moneyFlow) {
    const el = moneyFlowRef.current;
    if (el && el.nodeType === 1) {
      try { el.remove(); } catch {}
    }
    moneyFlowRef.current = null;
    return;
  }

  // toggle ON → create once
  if (!moneyFlowRef.current) {
    const div = document.createElement("div");
    Object.assign(div.style, {
      position: "absolute",
      left: 0,
      top: 0,
      right: 0,
      bottom: 0,
      background: "rgba(0, 255, 136, 0.08)", // faint green tint
      pointerEvents: "none",
      zIndex: 99999, // stack above everything
    });

    // banner to prove visibility
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

    container.appendChild(div);
    moneyFlowRef.current = div;
  }

  // on bars change we don't need to do anything for this debug layer
}, [state.moneyFlow, bars]);
