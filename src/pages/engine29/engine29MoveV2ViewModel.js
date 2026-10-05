// Canonical Engine 29 MOVE v2 frontend selector.
// All headline MOVE truth flows from marketCharacter.move.parent first.
// Legacy fields are fallback-only during migration.

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null) ?? null;
}

function parentStateFromLegacy(data, display) {
  return firstDefined(
    data?.marketCharacter?.move?.moveCharacter,
    data?.moveCharacter?.moveCharacter,
    display?.marketCharacter?.move?.moveCharacter,
    display?.thirtyMinute?.moveCharacter,
    "NO_ACTIVE_MOVE"
  );
}

function parentDirectionFromLegacy(data, display) {
  return firstDefined(
    data?.marketCharacter?.move?.direction,
    data?.moveCharacter?.direction,
    display?.marketCharacter?.move?.direction,
    "FLAT"
  );
}

export function selectEngine29MoveV2View(data = {}, summary = null) {
  const display = data?.display || summary?.display || {};
  const canonicalMove =
    data?.marketCharacter?.move ||
    display?.marketCharacter?.move ||
    {};

  const parent = canonicalMove?.parent || null;
  const parentState = parent
    ? (
        parent?.active === true
          ? parent?.direction === "UP"
            ? "UPSIDE_MOVE_ACTIVE"
            : parent?.direction === "DOWN"
              ? "DOWNSIDE_MOVE_ACTIVE"
              : "NO_ACTIVE_MOVE"
          : "NO_ACTIVE_MOVE"
      )
    : parentStateFromLegacy(data, display);

  const parentDirection = parent
    ? (
        parent?.active === true &&
        (parent?.direction === "UP" || parent?.direction === "DOWN")
          ? parent.direction
          : "FLAT"
      )
    : parentDirectionFromLegacy(data, display);

  const character =
    canonicalMove?.character ||
    data?.moveCharacter?.character ||
    null;

  const liveCondition =
    canonicalMove?.liveCondition ||
    {
      state:
        data?.liveMonitor?.state ||
        display?.liveMonitor?.state ||
        null,
      direction:
        data?.liveMonitor?.direction ||
        display?.liveMonitor?.direction ||
        null,
      contextVsParent:
        data?.liveMonitor?.contextVsParent ||
        display?.liveMonitor?.contextVsParent ||
        null,
      participation:
        data?.liveMonitor?.participation ||
        display?.liveMonitor?.participation ||
        null,
      authority:
        data?.liveMonitor?.authority ||
        display?.liveMonitor?.authority ||
        "DIAGNOSTIC_ONLY",
    };

  return {
    snapshotTimestamp:
      data?.timestamp ||
      summary?.timestamp ||
      null,

    degraded:
      data?.dataDegraded === true ||
      summary?.dataDegraded === true,

    parent: {
      raw: parent,
      state: parentState || "NO_ACTIVE_MOVE",
      direction: parentDirection || "FLAT",
      active: parent?.active === true ||
        ["UPSIDE_MOVE_ACTIVE", "DOWNSIDE_MOVE_ACTIVE"].includes(parentState),
      source: parent
        ? "marketCharacter.move.parent"
        : "legacy-fallback",
    },

    character: {
      type: character?.type || null,
      squeeze: {
        active: character?.squeeze?.active === true,
        direction: character?.squeeze?.direction || "FLAT",
        counterToParent:
          character?.squeeze?.counterToParent === true,
      },
      broadConfirmation: {
        state:
          character?.broadConfirmation?.state ||
          null,
        targetDirection:
          character?.broadConfirmation?.targetDirection ||
          parentDirection ||
          "FLAT",
        confirmed:
          character?.broadConfirmation?.confirmed === true,
      },
      participationQuality:
        character?.participationQuality ||
        null,
    },

    liveCondition: {
      state: liveCondition?.state || null,
      direction: liveCondition?.direction || null,
      contextVsParent:
        liveCondition?.contextVsParent || null,
      participation:
        liveCondition?.participation || null,
      authority:
        liveCondition?.authority || "DIAGNOSTIC_ONLY",
    },

    oneHour: {
      state:
        display?.oneHour?.state ||
        data?.tacticalState ||
        summary?.tacticalState ||
        null,
      authority:
        data?.tactical?.authority ||
        "ONE_HOUR_TACTICAL_ONLY",
    },

    fastTactical: {
      state:
        display?.thirtyMinute?.state ||
        data?.fastTacticalState ||
        summary?.fastTacticalState ||
        null,
      authority:
        data?.fastTactical?.authority ||
        "THIRTY_MINUTE_PRESSURE_ONLY",
    },

    liquidity:
      data?.marketCharacter?.liquidity ||
      display?.marketCharacter?.liquidity ||
      data?.trapDetection?.liquidity ||
      null,

    trap:
      data?.marketCharacter?.trap ||
      display?.marketCharacter?.trap ||
      data?.trapDetection?.trap ||
      null,
  };
}

export function sameCanonicalSnapshot(a, b) {
  return (
    a?.snapshotTimestamp != null &&
    b?.snapshotTimestamp != null &&
    a.snapshotTimestamp === b.snapshotTimestamp &&
    a?.parent?.state === b?.parent?.state &&
    a?.parent?.direction === b?.parent?.direction
  );
}
