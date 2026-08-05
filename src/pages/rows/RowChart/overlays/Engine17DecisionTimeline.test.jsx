import { __engine22cTestUtils } from "./Engine17DecisionTimeline";

const { normalizeMinuteStructure, buildEngine22CompactStructureSection, normalizeTimelineData } =
  __engine22cTestUtils;

function minuteFixture(overrides = {}) {
  return {
    activeWave: "W3",
    stage: "EXTENSION_MATURITY_WATCH",
    currentRead: "MINUTE_W3_ACTIVE",
    targetModel: {
      e1618: 7696.75,
      e200: 7760.25,
      e2618: 7863,
      nextTarget: 7863,
    },
    internalStructure: {
      parentDegree: "Minute",
      parentWave: "W3",
      currentInternalWave: "iii",
      nextExpectedInternalWave: "iv",
      classification: "FAST_IMPULSE_EXTENSION",
      parentWaveStillValid: true,
      parentWaveComplete: false,
      parentTransitionPossible: false,
      supportLevel: 7696.74,
      invalidationLevel: 7427.75,
      ...overrides.internalStructure,
    },
    ...overrides,
  };
}

function overlayWithMinute(minute, extras = {}) {
  return {
    ok: true,
    fib: {
      engine22WaveStrategy: {
        degreeStates: minute ? { minute } : {},
      },
      permission: extras.permission || null,
      confluence: extras.confluence || null,
      engine27TraderDecision: extras.engine27TraderDecision || null,
      ...extras,
    },
  };
}

describe("Engine 22C canonical Minute timeline", () => {
  test("normalizes Minute W3 / iii / iv next", () => {
    const result = normalizeMinuteStructure(minuteFixture());
    expect(result.stateLabel).toBe("W3 active");
    expect(result.structureLabel).toBe("Fast impulse extension");
    expect(result.waveLabel).toBe("W3 / iii / iv next");
    expect(result.statusLabel).toBe("Extension maturity watch");
    expect(result.parentWaveComplete).toBe(false);
    expect(result.parentTransitionPossible).toBe(false);
  });

  test("internal iv points to v next without creating parent W4", () => {
    const minute = minuteFixture({
      internalStructure: {
        currentInternalWave: "iv",
        nextExpectedInternalWave: "v",
        parentWaveComplete: false,
        parentTransitionPossible: false,
      },
    });
    const section = buildEngine22CompactStructureSection({ minute });
    expect(section.lines.join(" ")).toContain("internal iv → v");
    expect(section.lines.join(" ")).toContain("Parent transition: not active");
    expect(section.lines.join(" ")).not.toContain("Minute W4");
  });

  test("internal v does not create parent W4", () => {
    const minute = minuteFixture({
      internalStructure: {
        currentInternalWave: "v",
        nextExpectedInternalWave: null,
        parentWaveComplete: false,
        parentTransitionPossible: false,
      },
    });
    const section = buildEngine22CompactStructureSection({ minute });
    expect(section.lines.join(" ")).toContain("Parent transition: not active");
    expect(section.lines.join(" ")).not.toContain("Minute W4");
  });

  test("parent transition appears only after canonical completion or transition", () => {
    const minute = minuteFixture({
      internalStructure: {
        currentInternalWave: "v",
        nextExpectedInternalWave: "W4",
        parentWaveComplete: true,
        parentTransitionPossible: true,
      },
    });
    const section = buildEngine22CompactStructureSection({ minute });
    expect(section.lines.join(" ")).toContain(
      "Parent transition: canonical completion/transition condition published"
    );
  });

  test("missing degreeStates.minute displays canonical unavailable state", () => {
    const section = buildEngine22CompactStructureSection({});
    expect(section.lines).toEqual([
      "Minute structure unavailable.",
      "Waiting for canonical Engine 22 degree state.",
    ]);
  });

  test("permission does not erase canonical structure", () => {
    const timeline = normalizeTimelineData({
      overlayData: overlayWithMinute(minuteFixture(), {
        permission: {
          permission: "REDUCE",
          executable: false,
          paper: { decision: "FAST_INTRADAY_PAPER_ALLOW", allowed: true },
        },
      }),
    });
    expect(timeline.structure.stateLabel).toBe("W3 active");
    expect(timeline.structure.waveLabel).toBe("W3 / iii / iv next");
    expect(timeline.permission.permission).toBe("REDUCE");
  });

  test("compatibility text cannot replace canonical degree state", () => {
    const timeline = normalizeTimelineData({
      overlayData: overlayWithMinute(minuteFixture(), {
        currentLifecycleState: { headline: "Minute W4 pullback watch" },
        waveOpportunity: { currentRead: "ABC_DOWN_B_BOUNCE_C_DOWN_WATCH" },
      }),
    });
    expect(timeline.structure.waveLabel).toBe("W3 / iii / iv next");
    expect(JSON.stringify(timeline.sections)).not.toMatch(/ABC_DOWN|C-down|Minute W4 pullback/i);
  });

  test("failed SHORT reaction does not redefine parent structure", () => {
    const timeline = normalizeTimelineData({
      overlayData: overlayWithMinute(minuteFixture(), {
        confluence: {
          context: {
            reaction: {
              paperScalpReaction: {
                active: true,
                direction: "SHORT",
                state: "FAILED_RECLAIM",
                reactionConfirmed: false,
              },
            },
          },
        },
      }),
    });
    expect(timeline.structure.stateLabel).toBe("W3 active");
    expect(timeline.structure.parentWave).toBe("W3");
  });

  test("replay-like archived fields do not replace live Minute", () => {
    const timeline = normalizeTimelineData({
      overlayData: overlayWithMinute(minuteFixture(), {
        replay: {
          archivedState: {
            activeWave: "W4",
            internalStructure: { currentInternalWave: "a" },
          },
        },
      }),
    });
    expect(timeline.structure.stateLabel).toBe("W3 active");
    expect(timeline.structure.currentInternalWave).toBe("iii");
  });

  test("missing downstream objects do not create downstream results", () => {
    const timeline = normalizeTimelineData({
      overlayData: overlayWithMinute(minuteFixture()),
    });
    const text = JSON.stringify(timeline.sections);
    expect(text).toContain("No downstream result has been invented");
    expect(text).not.toContain('"Order created","YES"');
    expect(text).not.toContain('"Fill created","YES"');
  });
});
