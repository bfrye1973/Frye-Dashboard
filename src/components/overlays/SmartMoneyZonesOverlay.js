// src/components/overlays/SmartMoneyZonesOverlay.js
//
// LEGACY OVERLAY (DISABLED)
//
// This file previously drew a yellow canvas overlay using zones.json.
// It conflicts with the new SMZ system that renders:
// - structure / pocket / micro tiers
// - negotiationMid (pink line)
// via SMZLevelsOverlay.js pulling from /api/v1/smz-levels.
//
// We keep the same API (seed/update/destroy) so RowChart can still call it,
// but it intentionally does nothing.

export default function createSmartMoneyZonesOverlay() {
  return {
    seed() {},
    update() {},
    destroy() {},
  };
}
