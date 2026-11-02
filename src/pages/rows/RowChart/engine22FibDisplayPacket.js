// Engine 2F: read-only, owner-authorized ES Fibonacci display adapter.
// No Fibonacci math, model selection heuristics, or trading authority.
// The backend authorized selection owns current model identity and price updates.
const DEGREES = ["primary", "intermediate", "minor", "minute", "micro"];

export function normalizeEngine22FibPacket(strategy) {
  const authorized = strategy?.authorizedWorkingStructure;
  const valid = authorized?.schema === "engine22.authorizedWorkingStructure.v1" &&
    authorized?.mode === "READ_ONLY" && authorized?.noExecution === true &&
    Number.isInteger(authorized?.publicationRevision);
  const degrees = {};
  for (const degree of DEGREES) {
    const d = valid ? authorized?.degrees?.[degree] : null;
    const levels = d?.available === true && Array.isArray(d.levels)
      ? d.levels.map((level, i) => ({
          ratio: String(level?.label ?? level?.ratio ?? level?.key ?? i + 1),
          price: Number(level?.price),
          status: level?.status ?? null,
        })).filter(level => Number.isFinite(level.price) && level.price > 0)
      : [];
    degrees[degree] = {
      degree, available: Boolean(d?.available === true && levels.length > 0),
      sourcePath: d?.sourcePath ?? null,
      modelVersion: d?.modelVersion ?? null,
      activeWave: d?.activeWave ?? null,
      direction: d?.direction ?? null,
      levels,
    };
  }
  return { schema: "engine2f.fibDisplay.v1", publicationRevision: valid ? authorized.publicationRevision : null, degrees };
}
