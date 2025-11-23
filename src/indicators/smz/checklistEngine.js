// checklistEngine.js
// Evaluates a zone from Smart Money Engine using our 10 rules

export function evaluateZoneChecklist(zone) {
  if (!zone || !zone.checks) {
    return { score: 0, passed: [], failed: [] };
  }

  const c = zone.checks;

  // define all 10 checks
  const checks = [
    { key: "hrHits3", label: "1H Wick Tests ≥ 3", weight: 0.10 },
    { key: "m10Hits7", label: "10m Wick Tests ≥ 7", weight: 0.10 },
    { key: "wickSide", label: "Correct Wick Direction", weight: 0.10 },
    { key: "bodiesOutside", label: "Bodies Stay Outside Zone", weight: 0.10 },
    { key: "effortVsResult", label: "Volume Absorption (Effort≠Result)", weight: 0.15 },
    { key: "sweep", label: "Liquidity Sweep Present", weight: 0.10 },
    { key: "thrust", label: "Displacement Candle", weight: 0.10 },
    { key: "trueGap", label: "True Gap Magnet on 4H", weight: 0.10 },
    { key: "confirm4h", label: "4H Promotion / Confirmation", weight: 0.10 },
    { key: "notExhausted", label: "Zone Not Exhausted", weight: 0.05 },
  ];

  let score = 0;
  const passed = [];
  const failed = [];

  // convert “status !== exhausted” into “notExhausted”
  const zoneNotExhausted = zone.status !== "exhausted";

  // apply checks
  for (const item of checks) {
    let value = c[item.key];

    // special handling
    if (item.key === "notExhausted") {
      value = zoneNotExhausted;
    }
    if (item.key === "wickSide") {
      value = c.wickSide === zone.side;
    }

    if (value) {
      score += item.weight * 100;
      passed.push(item.label);
    } else {
      failed.push(item.label);
    }
  }

  return {
    zoneId: zone.id,
    type: zone.side === "bear" ? "Distribution" : "Accumulation",
    score: Math.round(score),
    passed,
    failed,
  };
}
