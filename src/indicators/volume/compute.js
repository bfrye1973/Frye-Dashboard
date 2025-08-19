export function volumeCompute(candles) {
  if (!candles?.length) return [];
  return candles.map(c => ({ time: c.time, value: c.volume ?? 0, color: (c.close >= c.open) ? undefined : undefined }));
}
