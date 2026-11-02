// Engine 2F: read-only, owner-authorized ES Fibonacci display adapter.
// No Fibonacci math, model selection heuristics, or trading authority.
const DEGREES = ["primary", "intermediate", "minor", "minute", "micro"];
const MICRO_PATH = "currentWavelength.degrees.micro.ownerMicroCDownOct31";
const MICRO_VERSION = "engine22.microCDownOct31OwnerWorking.v1";
const MICRO_REGRESSION = [7724, 7668, 7628, 7577.25, 7521.25];

export function normalizeEngine22FibPacket(strategy) {
  const authorized = strategy?.authorizedWorkingStructure;
  const valid = authorized?.schema === "engine22.authorizedWorkingStructure.v1" &&
    authorized?.mode === "READ_ONLY" && authorized?.noExecution === true &&
    Number.isInteger(authorized?.publicationRevision);
  const degrees = {};
  for (const degree of DEGREES) {
    const d = valid ? authorized?.degrees?.[degree] : null;
    const micro = degree === "micro";
    const modelValid = !micro || (
      d?.sourcePath === MICRO_PATH &&
      d?.modelVersion === MICRO_VERSION &&
      d?.activeWave === "C" && d?.direction === "DOWN" &&
      authorized.publicationRevision >= 5
    );
    const levels = d?.available === true && modelValid && Array.isArray(d.levels)
      ? d.levels.map((level, i) => ({
          ratio: String(level?.label ?? level?.ratio ?? level?.key ?? i + 1),
          price: Number(level?.price),
          status: level?.status ?? null,
        })).filter(level => Number.isFinite(level.price) && level.price > 0)
      : [];
    const microValid = !micro || (levels.length === 5 &&
      levels.every((level, i) => level.price === MICRO_REGRESSION[i]));
    degrees[degree] = {
      degree, available: Boolean(d?.available === true && modelValid && microValid && levels.length),
      sourcePath: d?.sourcePath ?? null,
      modelVersion: d?.modelVersion ?? null,
      activeWave: d?.activeWave ?? null,
      direction: d?.direction ?? null,
      levels: microValid ? levels : [],
    };
  }
  return { schema: "engine2f.fibDisplay.v1", publicationRevision: valid ? authorized.publicationRevision : null, degrees };
}
