// src/pages/rows/RowModeToggle.jsx
import React, { useEffect, useMemo, useState } from "react";
import MarketNarrator from "../../components/MarketNarrator";
import { useViewMode, ViewModes } from "../../context/ModeContext";

// IMPORTANT:
// Set this to your backend-1 base.
// If you already have an env var in the frontend for backend base, swap it here.
const CORE_BASE =
  import.meta?.env?.VITE_CORE_BASE_URL || "https://frye-market-backend-1.onrender.com";

export default function RowModeToggle() {
  const { mode, setMode } = useViewMode();

  // Replay UI state (MVP)
  const [replayOn, setReplayOn] = useState(false);
  const [dates, setDates] = useState([]);
  const [date, setDate] = useState("");
  const [times, setTimes] = useState([]);
  const [time, setTime] = useState("");
  const [events, setEvents] = useState([]);
  const [eventIdx, setEventIdx] = useState(-1);

  // Load dates when Replay ON
  useEffect(() => {
    if (!replayOn) return;

    fetch(`${CORE_BASE}/api/v1/replay/dates`)
      .then((r) => r.json())
      .then((j) => {
        const ds = Array.isArray(j?.dates) ? j.dates : [];
        setDates(ds);
        // Default = most recent date
        if (!date && ds.length) setDate(ds[ds.length - 1]);
      })
      .catch(() => setDates([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replayOn]);

  // Load times + events when date changes
  useEffect(() => {
    if (!replayOn || !date) return;

    fetch(`${CORE_BASE}/api/v1/replay/times?date=${encodeURIComponent(date)}`)
      .then((r) => r.json())
      .then((j) => {
        const ts = Array.isArray(j?.times) ? j.times : [];
        setTimes(ts);
        // Default = most recent time
        if (ts.length) setTime(ts[ts.length - 1]);
      })
      .catch(() => setTimes([]));

    fetch(`${CORE_BASE}/api/v1/replay/events?date=${encodeURIComponent(date)}`)
      .then((r) => r.json())
      .then((j) => {
        const ev = Array.isArray(j?.events) ? j.events : [];
        setEvents(ev);
        setEventIdx(ev.length ? 0 : -1);
      })
      .catch(() => {
        setEvents([]);
        setEventIdx(-1);
      });
  }, [replayOn, date]);

  const canPrev = useMemo(() => {
    if (!replayOn) return false;
    const idx = times.indexOf(time);
    return idx > 0;
  }, [replayOn, times, time]);

  const canNext = useMemo(() => {
    if (!replayOn) return false;
    const idx = times.indexOf(time);
    return idx >= 0 && idx < times.length - 1;
  }, [replayOn, times, time]);

  function prevTime() {
    const idx = times.indexOf(time);
    if (idx > 0) setTime(times[idx - 1]);
  }
  function nextTime() {
    const idx = times.indexOf(time);
    if (idx >= 0 && idx < times.length - 1) setTime(times[idx + 1]);
  }

  const Btn = ({ id, children, title }) => {
    const active = mode === id;
    return (
      <button
        type="button"
        onClick={() => setMode(id)}
        aria-pressed={active}
        title={title}
        className="btn"
        style={{
          background: active ? "#0f172a" : "#0b0b0b",
          color: "#e5e7eb",
          border: `1px solid ${active ? "#475569" : "#2b2b2b"}`,
          borderRadius: 8,
          padding: "6px 12px",
          fontWeight: 600,
          cursor: "pointer",
          transition: "background 0.2s, border 0.2s",
        }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.background = active ? "#1e293b" : "#1a1a1a")
        }
        onMouseLeave={(e) =>
          (e.currentTarget.style.background = active ? "#0f172a" : "#0b0b0b")
        }
      >
        {children}
      </button>
    );
  };

  return (
    <section id="view-modes" className="panel" style={{ padding: 8 }}>
      {/* Banner when replay is ON */}
      {replayOn && (
        <div
          style={{
            marginBottom: 8,
            padding: "8px 10px",
            borderRadius: 10,
            border: "1px solid #7c2d12",
            background: "#1f130a",
            color: "#fbbf24",
            fontWeight: 800,
            letterSpacing: 0.3,
          }}
        >
          ⚠ REPLAY MODE ACTIVE — LIVE DATA DISABLED
        </div>
      )}

      <div className="panel-head" style={{ alignItems: "center", gap: 10 }}>
        <div className="panel-title">View Modes</div>

        <div className="small" style={{ display: "flex", gap: 8 }}>
          <Btn id={ViewModes.METER_TILES} title="Show Market Meter + tiles layout">
            Meter + Tiles
          </Btn>

          <Btn id={ViewModes.TRAFFIC} title="Compact traffic-light chips">
            Traffic Lights
          </Btn>

          <Btn id={ViewModes.ARROWS} title="Arrow scorecards vs baseline">
            Arrow Scorecards
          </Btn>
        </div>

        {/* Replay Mode controls (right of View Modes) */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 14 }}>
          <div
            style={{
              color: "#e5e7eb",
              fontWeight: 800,
              fontSize: 12,
              opacity: 0.9,
              marginRight: 4,
            }}
          >
            Replay Mode
          </div>

          <button
            type="button"
            onClick={() => setReplayOn((v) => !v)}
            style={{
              borderRadius: 999,
              padding: "6px 10px",
              border: `1px solid ${replayOn ? "#f59e0b" : "#2b2b2b"}`,
              background: replayOn ? "#2a1b06" : "#0b0b0b",
              color: replayOn ? "#fbbf24" : "#e5e7eb",
              fontWeight: 800,
              cursor: "pointer",
            }}
            title="Toggle Replay Mode"
          >
            {replayOn ? "ON" : "OFF"}
          </button>

          {replayOn && (
            <>
              <label style={{ display: "flex", alignItems: "center", gap: 6, color: "#cbd5e1" }}>
                Date
                <select
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  style={{
                    background: "#0b0b0b",
                    color: "#e5e7eb",
                    border: "1px solid #2b2b2b",
                    borderRadius: 8,
                    padding: "6px 8px",
                  }}
                >
                  {dates.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: 6, color: "#cbd5e1" }}>
                Time
                <select
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  style={{
                    background: "#0b0b0b",
                    color: "#e5e7eb",
                    border: "1px solid #2b2b2b",
                    borderRadius: 8,
                    padding: "6px 8px",
                  }}
                >
                  {times.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                onClick={prevTime}
                disabled={!canPrev}
                style={{
                  borderRadius: 8,
                  padding: "6px 10px",
                  border: "1px solid #2b2b2b",
                  background: "#0b0b0b",
                  color: canPrev ? "#e5e7eb" : "#6b7280",
                  fontWeight: 700,
                  cursor: canPrev ? "pointer" : "not-allowed",
                }}
              >
                ◀ Prev
              </button>

              <button
                type="button"
                onClick={nextTime}
                disabled={!canNext}
                style={{
                  borderRadius: 8,
                  padding: "6px 10px",
                  border: "1px solid #2b2b2b",
                  background: "#0b0b0b",
                  color: canNext ? "#e5e7eb" : "#6b7280",
                  fontWeight: 700,
                  cursor: canNext ? "pointer" : "not-allowed",
                }}
              >
                Next ▶
              </button>

              <div style={{ color: "#9ca3af", fontSize: 12, marginLeft: 6 }}>
                {eventIdx >= 0 && events[eventIdx]
                  ? `${events[eventIdx].type}`
                  : `Events: ${events.length}`}
              </div>
            </>
          )}
        </div>

        <div className="spacer" />

        <MarketNarrator />
      </div>
    </section>
  );
}
