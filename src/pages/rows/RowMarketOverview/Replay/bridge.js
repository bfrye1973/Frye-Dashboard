export function emitReplayUpdate({ on, ts, granularity }){
if (typeof window !== "undefined") {
window.dispatchEvent(new CustomEvent("replay:update", { detail: { on, ts, granularity } }));
}
}
