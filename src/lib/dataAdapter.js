export function toCandle(anyBar) {
  let t = anyBar?.time ?? anyBar?.t ?? null;
  if (typeof t !== "number") return null;
  if (t > 2_000_000_000) t = Math.floor(t / 1000); // ms -> s
  const o = anyBar.open ?? anyBar.o;
  const h = anyBar.high ?? anyBar.h;
  const l = anyBar.low  ?? anyBar.l;
  const c = anyBar.close?? anyBar.c;
  if ([o,h,l,c].some(v => v == null || Number.isNaN(+v))) return null;
  return { time: t, open: +o, high: +h, low: +l, close: +c };
}

export function sortAndDedupe(bars) {
  const map = new Map();
  for (const b of bars) map.set(b.time, b);
  return [...map.values()].sort((a,b) => a.time - b.time);
}
