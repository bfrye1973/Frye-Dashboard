export const assertSeconds = (bars) => {
  if (!Array.isArray(bars) || !bars.length) return;
  if (bars.some(b => b.time > 2_000_000_000)) {
    throw new Error("MS timestamps detected. Convert to seconds before setData/update.");
  }
};
