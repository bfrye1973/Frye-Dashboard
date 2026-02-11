// src/replay/ReplayContext.jsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
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

    let cancelled = false;

    replayDates()
      .then((r) => {
        if (cancelled) return;
        const ds = Array.isArray(r?.dates) ? r.dates : [];
        setDates(ds);
        // Default to most recent date ONLY if none selected yet
        setDate((prev) => (prev ? prev : ds.length ? ds[ds.length - 1] : ""));
      })
      .catch(() => {
        if (!cancelled) setDates([]);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  // Load times + events when date changes
  useEffect(() => {
    if (!enabled || !date) return;

    let cancelled = false;

    replayTimes(date)
      .then((r) => {
        if (cancelled) return;
        const ts = Array.isArray(r?.times) ? r.times : [];
        setTimes(ts);
        // Default to most recent time ONLY if none selected yet
        setTime((prev) => (prev ? prev : ts.length ? ts[ts.length - 1] : ""));
      })
      .catch(() => {
        if (!cancelled) setTimes([]);
      });

    replayEvents(date)
      .then((r) => {
        if (cancelled) return;
        const ev = Array.isArray(r?.events) ? r.events : [];
        setEvents(ev);
        setEventIdx(ev.length ? 0 : -1);
      })
      .catch(() => {
        if (!cancelled) {
          setEvents([]);
          setEventIdx(-1);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, date]);

  // Load snapshot when time changes
  useEffect(() => {
    if (!enabled || !date || !time) return;

    let cancelled = false;

    replaySnapshot(date, time)
      .then((s) => {
        if (!cancelled) setSnapshot(s);
      })
      .catch(() => {
        if (!cancelled) setSnapshot(null);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, date, time]);

  const nextEvent = useCallback(() => {
    setEventIdx((prev) => {
      if (!events.length) return prev;
      return Math.min(events.length - 1, prev + 1);
    });
  }, [events.length]);

  const prevEvent = useCallback(() => {
    setEventIdx((prev) => {
      if (!events.length) return prev;
      return Math.max(0, prev - 1);
    });
  }, [events.length]);

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
    [
      enabled,
      dates,
      date,
      times,
      time,
      snapshot,
      events,
      eventIdx,
      nextEvent,
      prevEvent,
    ]
  );

  return <ReplayCtx.Provider value={value}>{children}</ReplayCtx.Provider>;
}

export function useReplay() {
  const ctx = useContext(ReplayCtx);

  // ✅ SAFE FALLBACK:
  // If ReplayProvider isn't mounted yet, treat Replay as OFF (prevents site crash)
  if (!ctx) {
    return {
      enabled: false,
      setEnabled: () => {},
      dates: [],
      date: "",
      setDate: () => {},
      times: [],
      time: "",
      setTime: () => {},
      snapshot: null,
      events: [],
      eventIdx: -1,
      nextEvent: () => {},
      prevEvent: () => {},
    };
  }

  return ctx.replay;
}
