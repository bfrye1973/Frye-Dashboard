// src/pages/rows/RowModeToggle.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useViewMode, ViewModes } from "../../context/ModeContext";

// Backend base URL
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

  // AI Listen state
  const [aiBusy, setAiBusy] = useState(false);
  const [aiText, setAiText] = useState("");
  const [aiError, setAiError] = useState("");

  // Load dates when Replay ON
  useEffect(() => {
    if (!replayOn) return;

    fetch(`${CORE_BASE}/api/v1/replay/dates`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        const ds = Array.isArray(j?.dates) ? j.dates : [];
        setDates(ds);
        if (!date && ds.length) setDate(ds[ds.length - 1]);
      })
      .catch(() => setDates([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replayOn]);

  // Load times + events when date changes
  useEffect(() => {
    if (!replayOn || !date) return;

    fetch(`${CORE_BASE}/api/v1/replay/times?date=${encodeURIComponent(date)}`, {
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((j) => {
        const ts = Array.isArray(j?.times) ? j.times : [];
        setTimes(ts);
        if (ts.length) setTime(ts[ts.length - 1]);
      })
      .catch(() => setTimes([]));

    fetch(`${CORE_BASE}/api/v1/replay/events?date=${encodeURIComponent(date)}`, {
      cache: "no-store",
    })
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
        onMouseEnter={(e) => {
          e.currentTarget.style.background = active ? "#1e293b" : "#1a1a1a";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = active ? "#0f172a" : "#0b0b0b";
        }}
      >
        {children}
      </button>
    );
  };

  async function captureChartPng() {
    const canvas = document.querySelector("canvas");
    if (!canvas) throw new Error("Chart canvas not found.");
    return canvas.toDataURL("image/png");
  }

  async function onListenAI() {
    setAiBusy(true);
    setAiError("");
    setAiText("");

    try {
      // Facts (3 paragraphs already)
      const narrator = await fetch(
        `${CORE_BASE}/api/v1/market-narrator?symbol=SPY&tf=1h&style=descriptive`,
        { cache: "no-store" }
      ).then((r) => r.json());

      // Screenshot
      const chartImage = await captureChartPng();

      // AI interpreter
      const ai = await fetch(`${CORE_BASE}/api/v1/market-narrator-ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ narratorJson: narrator, chartImage }),
      }).then((r) => r.json());

      if (!ai?.ok) {
        const detail = ai?.detail ? JSON.stringify(ai.detail).slice(0, 500) : "";
        throw new Error(`${ai?.error || "OPENAI_CALL_FAILED"} ${detail}`);
      }

      const text = ai?.narrativeText || "No narrative returned.";
      setAiText(text);

      // Speak aloud (browser TTS)
      try {
        if (window.speechSynthesis) {
          const utter = new SpeechSynthesisUtterance(text);
          utter.rate = 1;
          utter.pitch = 1;
          utter.volume = 1;

          window.speechSynthesis.cancel();
          window.speechSynthesis.speak(utter);
        }
      } catch (speechErr) {
        // non-fatal
        console.warn("Speech synthesis failed:", speechErr);
      }
    } catch (e) {
      setAiError(String(e?.message || e));
    } finally {
      setAiBusy(false);
    }
  }

  function onClearAI() {
    setAiText("");
    setAiError("");
    try {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    } catch {}
  }

  return (
    <section id="view-modes" className="panel" style={{ padding: 8 }}>
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

        {/* Replay Mode controls */}
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

        {/* AI Listen controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            onClick={onListenAI}
            disabled={aiBusy}
            style={{
              borderRadius: 10,
              padding: "6px 12px",
              border: `1px solid ${aiBusy ? "#334155" : "#475569"}`,
              background: aiBusy ? "#111827" : "#0b0b0b",
              color: "#e5e7eb",
              fontWeight: 900,
              cursor: aiBusy ? "not-allowed" : "pointer",
            }}
            title="Capture chart + run AI market interpretation"
          >
            {aiBusy ? "Listening…" : "🎧 Listen (AI)"}
          </button>

          <button
            type="button"
            onClick={onClearAI}
            style={{
              borderRadius: 10,
              padding: "6px 10px",
              border: "1px solid #2b2b2b",
              background: "#0b0b0b",
              color: "#9ca3af",
              fontWeight: 800,
              cursor: "pointer",
            }}
            title="Clear narrative"
          >
            Clear
          </button>
        </div>
      </div>

      {/* AI Narrative Output */}
      {(aiError || aiText) && (
        <div
          style={{
            marginTop: 10,
            border: "1px solid #1f2937",
            borderRadius: 12,
            padding: 12,
            background: "#070a10",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <div style={{ color: "#e5e7eb", fontWeight: 900 }}>Market Read (AI)</div>
            {aiBusy && <div style={{ color: "#fbbf24", fontWeight: 800 }}>Running…</div>}
          </div>

          {aiError ? (
            <div style={{ color: "#fca5a5", fontWeight: 700 }}>{aiError}</div>
          ) : (
            <div style={{ color: "#cbd5e1", whiteSpace: "pre-wrap", lineHeight: 1.45 }}>
              {aiText}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
