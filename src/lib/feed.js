import { toCandle } from "./dataAdapter";

export function attachCandleFeed(series) {
  let pending = [];
  let raf = 0;

  const flush = () => {
    pending.sort((a,b) => a.time - b.time);
    const last = pending[pending.length - 1];
    if (last) series.update(last);
    pending = [];
    raf = 0;
  };

  return {
    seed(rawBars) {
      const parsed = rawBars.map(toCandle).filter(Boolean);
      parsed.sort((a,b) => a.time - b.time);
      series.setData(parsed);
    },
    tick(raw) {
      const bar = toCandle(raw);
      if (!bar) return;
      pending.push(bar);
      if (!raf) raf = requestAnimationFrame(flush);
    }
  };
}
