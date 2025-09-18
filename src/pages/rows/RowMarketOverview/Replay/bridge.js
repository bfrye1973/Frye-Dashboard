export function emitReplayUpdate({ on, ts, granularity, data }) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("replay:update", { detail: { on, ts, granularity, data } })
    );
  }
}
