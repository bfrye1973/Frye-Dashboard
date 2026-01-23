// src/pages/rows/RowTradePermission.jsx
// Row — Engine 6 Trade Permission
// Safe: does not depend on existing dashboard polling.
// Uses Engine6TradePermission which fetches what it needs.

import React from "react";
import Engine6TradePermission from "../../components/Engine6TradePermission";

export default function RowTradePermission() {
  return (
    <section id="row-engine6" className="panel" style={{ padding: 10 }}>
      <div className="panel-head" style={{ alignItems: "center" }}>
        <div className="panel-title">Engine 6 — Trade Permission Matrix</div>
        <div className="spacer" />
        <div style={{ color: "#9ca3af", fontSize: 12 }}>
          ALLOW / REDUCE / STAND_DOWN (new entries)
        </div>
      </div>

      <div style={{ marginTop: 10, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Engine6TradePermission symbol="SPY" tf="1h" intentAction="NEW_ENTRY" />
        <Engine6TradePermission symbol="SPY" tf="30m" intentAction="NEW_ENTRY" />
      </div>

      <div style={{ marginTop: 10, color: "#9ca3af", fontSize: 12, lineHeight: 1.35 }}>
        <div>
          <strong>Negotiated zones</strong> are primary execution locations. Entries must occur inside zone (no chasing).
        </div>
        <div>
          <strong>EOD Risk-Off</strong> = STAND_DOWN for new entries. Exits/risk reduction always allowed.
        </div>
      </div>
    </section>
  );
}
