// src/replay/ReplayContext.jsx
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { replayDates, replayTimes, replaySnapshot, replayEvents } from "./replayApi";

const ReplayCtx = createContext(null);

export function ReplayProvider({ children }) {
  const [enabled, setEnabled] = useState(false);

  const [dates, setDates] = useState([]);
  const [date, setDate] = useState("");
  const [times, setTimes] = useState([]);
  const [time, setTime] = useState("");

  const [snapshot, setSnapshot] = useState(null);
  const [events, setEvents] = useState([]);
  const [eventIdx, setEventIdx] = useState(-1);

  // Load available dates when replay enabled
  useEffect(() => {
    if (!enabled) return;
    replayDates()
      .then((r) => {
        const ds = r?.dates || [];
        setDates(ds);
        if (!date && ds.length) setDate(ds[ds.length - 1]);
      })
      .catch(() => setDates([]));
  }, [enabled]);

  // Load times + events when date changes
  useEffect(() => {
    if (!enabled || !date) return;
    replayTimes(date)
      .then((r) => {
        const ts = r?.times || [];
        setTimes(ts);
        if (!time && ts.length) setTime(ts[0]);
      })
      .catch(() => setTimes([]));

    replayEvents(date)
      .then((r) => {
        setEvents(r?.events || []);
        setEventIdx((r?.events?.length ?? 0) ? 0 : -1);
      })
      .catch(() => {
        setEvents([]);
        setEventIdx(-1);
      });
  }, [enabled, date]);

  // Load snapshot when time changes
  useEffect(() => {
    if (!enabled || !date || !time) return;
    replaySnapshot(date, time)
      .then((s) => setSnapshot(s))
      .catch(() => setSnapshot(null));
  }, [enabled, date, time]);

  function nextEvent() {
    if (!events.length) return;
    const idx = Math.min(events.length - 1, eventIdx + 1);
    setEventIdx(idx);
    // Optional: jump to nearest time bucket by parsing event.tsUtc (Phase 1 skip)
  }

  function prevEvent() {
    if (!events.length) return;
    const idx = Math.max(0, eventIdx - 1);
    setEventIdx(idx);
  }

  const value = useMemo(
    () => ({
      replay: {
        enabled,
        setEnabled,
        dates,
        date,
        setDate,
        times,
        time,
        setTime,
        snapshot,
        events,
        eventIdx,
        nextEvent,
        prevEvent,
      },
    }),
    [enabled, dates, date, times, time, snapshot, events, eventIdx]
  );

  return <ReplayCtx.Provider value={value}>{children}</ReplayCtx.Provider>;
}

export function useReplay() {
  const ctx = useContext(ReplayCtx);
  if (!ctx) throw new Error("useReplay must be used inside ReplayProvider");
  return ctx.replay;
}
