// src/pages/rows/RowIndexSectors.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { LastUpdated } from "../../components/LastUpdated";
import { useDashboardPoll } from "../../lib/dashboardApi";

// ... (all your helpers stay the same: norm, ALIASES, ORDER, toneFor, Badge, DeltaPill, Sparkline, SectorCard, fetchJSON, etc.)

export default function RowIndexSectors() {
  const { data: live, loading, error } = useDashboardPoll("dynamic");

  // Fetch LIVE intraday sector source (GitHub raw) — used when not in replay
  const [liveSourceJSON, setLiveSourceJSON] = useState(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!process.env.REACT_APP_INTRADAY_SOURCE_URL) return;
        const j = await fetchJSON(
          `${process.env.REACT_APP_INTRADAY_SOURCE_URL}?t=${Date.now()}`
        );
        if (!cancelled) setLiveSourceJSON(j);
      } catch {
        if (!cancelled) setLiveSourceJSON(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Replay bridge
  const [replayOn, setReplayOn] = useState(false);
  const [replayData, setReplayData] = useState(null);
  useEffect(() => {
    function onReplay(e) {
      const detail = e?.detail || {};
      const on = !!detail.on;
      setReplayOn(on);
      setReplayData(on ? detail.data || null : null);
    }
    window.addEventListener("replay:update", onReplay);
    return () => window.removeEventListener("replay:update", onReplay);
  }, []);

  const polled = live || {};
  const base = replayOn && replayData ? replayData : polled;

  // Prefer updatedAt from data, fallback to null
  const ts =
    base?.sectors?.updatedAt ||
    base?.marketMeter?.updatedAt ||
    base?.updated_at ||
    base?.ts ||
    null;

  // Build cards
  const cards = useMemo(() => {
    let list = [];
    if (base?.outlook?.sectorCards) list = base.outlook.sectorCards;
    return list;
  }, [base]);

  // Legend modal
  const [legendOpen, setLegendOpen] = useState(false);

  return (
    <section id="row-4" className="panel index-sectors" aria-label="Index Sectors">
      <div className="panel-head" style={{ alignItems: "center" }}>
        <div className="panel-title">Index Sectors</div>
        <button
          onClick={() => setLegendOpen(true)}
          style={{
            background: "#0b0b0b",
            color: "#e5e7eb",
            border: "1px solid #2b2b2b",
            borderRadius: 6,
            padding: "4px 8px",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            marginLeft: 8,
          }}
          title="Legend"
        >
          Legend
        </button>
        {/* Timestamp right next to Legend */}
        <div style={{ marginLeft: 8, color: "#9ca3af", fontSize: 12 }}>
          Updated {ts || "--"}
        </div>
        <div className="spacer" />
      </div>

      {!base && loading && <div className="small muted">Loading…</div>}
      {error && <div className="small muted">Failed to load sectors.</div>}

      {Array.isArray(cards) && cards.length > 0 ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))",
            gap: 8,
            marginTop: 6,
          }}
        >
          {cards.map((c, i) => (
            <SectorCard
              key={c?.sector || i}
              sector={c?.sector}
              outlook={c?.outlook}
              spark={c?.spark}
              last={c?.last}
              deltaPct={c?.deltaPct}
            />
          ))}
        </div>
      ) : (
        !loading && <div className="small muted">No sector data.</div>
      )}

      {/* Legend modal */}
      {legendOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setLegendOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 60,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(880px, 92vw)",
              background: "#0b0b0c",
              border: "1px solid #2b2b2b",
              borderRadius: 12,
              padding: 16,
              boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
            }}
          >
            <IndexSectorsLegendContent />
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
              <button
                onClick={() => setLegendOpen(false)}
                style={{
                  background: "#eab308",
                  color: "#111827",
                  border: "none",
                  borderRadius: 8,
                  padding: "8px 12px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
