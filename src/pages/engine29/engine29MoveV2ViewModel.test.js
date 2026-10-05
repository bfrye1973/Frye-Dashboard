import fs from "fs";
import path from "path";

import {
  selectEngine29MoveV2View,
  sameCanonicalSnapshot,
} from "./engine29MoveV2ViewModel";

const liveFixture = {
  timestamp: "2026-10-05T13:45:02.199Z",
  dataDegraded: true,
  tacticalState: "CAUTION",
  fastTacticalState: "STABILIZING",
  marketCharacter: {
    move: {
      parent: {
        active: true,
        direction: "UP",
        reason: "PARENT_PERSISTED_THROUGH_COMPLETED_30M_PAUSE",
      },
      character: {
        type: "MIXED_CONFIRMATION",
        squeeze: {
          active: false,
          direction: "FLAT",
          counterToParent: false,
        },
        broadConfirmation: {
          state: "MIXED_CONFIRMATION",
          targetDirection: "UP",
          confirmed: false,
        },
        participationQuality: "MIXED_CONFIRMATION",
      },
      liveCondition: {
        authority: "DIAGNOSTIC_ONLY",
        direction: "UP",
        state: "UPSIDE_MOMENTUM_WEAKENING",
        contextVsParent: "ALIGNED_WITH_PARENT",
        participation: "NARROW",
      },

      // Conflicting legacy values prove canonical parent wins.
      moveCharacter: "POSSIBLE_DOWNSIDE_SQUEEZE",
      direction: "DOWN",
    },
    liquidity: {
      state: "SWEEP_HIGH",
      side: "HIGH",
      auctionResult: "SWEPT_HIGH",
    },
    trap: {
      state: "NO_ACTIVE_TRAP",
      side: "NONE",
    },
  },
  display: {
    oneHour: { state: "CAUTION" },
    thirtyMinute: { state: "STABILIZING" },
  },
};

test("canonical parent owns ES MOVE even when legacy fields conflict", () => {
  const view = selectEngine29MoveV2View(liveFixture);

  expect(view.parent.state).toBe("UPSIDE_MOVE_ACTIVE");
  expect(view.parent.direction).toBe("UP");
  expect(view.parent.source).toBe("marketCharacter.move.parent");

  expect(view.character.type).toBe("MIXED_CONFIRMATION");
  expect(view.character.broadConfirmation.targetDirection).toBe("UP");

  expect(view.liveCondition.state).toBe("UPSIDE_MOMENTUM_WEAKENING");
  expect(view.liveCondition.authority).toBe("DIAGNOSTIC_ONLY");

  expect(view.oneHour.state).toBe("CAUTION");
  expect(view.fastTactical.state).toBe("STABILIZING");
  expect(view.liquidity.state).toBe("SWEEP_HIGH");
  expect(view.trap.state).toBe("NO_ACTIVE_TRAP");
  expect(view.degraded).toBe(true);
});

test("home compact and full page use identical canonical snapshot truth", () => {
  const home = selectEngine29MoveV2View(liveFixture);
  const full = selectEngine29MoveV2View(liveFixture);

  expect(sameCanonicalSnapshot(home, full)).toBe(true);
  expect(home).toEqual(full);
});

test("legacy fallback remains available only when canonical parent is absent", () => {
  const legacy = {
    timestamp: "2026-10-05T13:00:00.000Z",
    moveCharacter: {
      moveCharacter: "DOWNSIDE_MOVE_ACTIVE",
      direction: "DOWN",
    },
    tacticalState: "CAUTION",
    fastTacticalState: "SELLING_PRESSURE_INCREASING",
  };

  const view = selectEngine29MoveV2View(legacy);

  expect(view.parent.state).toBe("DOWNSIDE_MOVE_ACTIVE");
  expect(view.parent.direction).toBe("DOWN");
  expect(view.parent.source).toBe("legacy-fallback");
});

test("shared component contract keeps Redline home compact and full page on same component", () => {
  const fullPath = path.resolve(
    process.cwd(),
    "src/pages/engine29/Engine29FullDashboard.jsx"
  );
  const previewPath = path.resolve(
    process.cwd(),
    "src/pages/engine25/Engine25MarketXrayPreview.jsx"
  );
  const appPath = path.resolve(process.cwd(), "src/App.js");

  const fullSource = fs.readFileSync(fullPath, "utf8");
  const previewSource = fs.readFileSync(previewPath, "utf8");
  const appSource = fs.readFileSync(appPath, "utf8");

  expect(fullSource).toContain("selectEngine29MoveV2View");
  expect(fullSource).toContain("homeCompact");
  expect(previewSource).toContain("<Engine29FullDashboard homeCompact");
  expect(appSource).toContain('path="/engine29-full"');
  expect(appSource).toContain("<Engine29FullDashboard />");
});
