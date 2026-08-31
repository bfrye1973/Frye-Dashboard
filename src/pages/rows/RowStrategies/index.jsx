function getDegreeStates(snapshot) {
  return (
    snapshot?.strategies?.[STRATEGY_ID_MAP.SCALP]?.engine22WaveStrategy
      ?.degreeStates || null
  );
}

function firstNumber(...values) {
  for (const value of values) {
    if (Number.isFinite(Number(value))) return Number(value);
  }
  return null;
}

function firstText(...values) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return null;
}

function displayPrice(value) {
  return Number.isFinite(Number(value)) ? fmt2(value) : "—";
}

function displayTime(value) {
  const text = String(value ?? "").trim();
  return text || "—";
}

function compactHeadline(text, fallback = "—") {
  const value = String(text ?? "").trim();
  if (!value) return fallback;
  return value.length > 96 ? `${value.slice(0, 93)}...` : value;
}

function getInternalC(state = {}) {
  return (
    state?.cWaveInternalStructure ||
    state?.targetModel?.internalCStructure ||
    state?.activeFibModel?.internalCStructure ||
    state?.internalStructure?.internalCStructure ||
    state?.internalCStructure ||
    null
  );
}

function getMinuteCLevels(internal = {}, state = {}) {
  return (
    internal?.minuteC?.targetModel?.levels ||
    internal?.cC?.targetModel?.levels ||
    state?.targetModel?.internalCStructure?.minuteC?.targetModel?.levels ||
    state?.targetModel?.internalCStructure?.cC?.targetModel?.levels ||
    null
  );
}

function getMinuteCDisplayLevels(internal = {}, state = {}) {
  const direct =
    internal?.minuteC?.targetModel?.displayLevels ||
    internal?.cC?.targetModel?.displayLevels ||
    state?.targetModel?.internalCStructure?.minuteC?.targetModel?.displayLevels ||
    state?.targetModel?.internalCStructure?.cC?.targetModel?.displayLevels ||
    null;

  if (Array.isArray(direct) && direct.length) return direct;

  const levels = getMinuteCLevels(internal, state) || {};
  const mapped = [
    ["C 1.000", levels.cc100],
    ["C 1.272", levels.cc1272],
    ["C 1.618", levels.cc1618],
    ["C 2.000", levels.cc200],
    ["C 2.618", levels.cc2618],
  ]
    .filter(([, price]) => Number.isFinite(Number(price)))
    .map(([label, price]) => ({ label, price }));

  return mapped;
}

function getLargerCLevels(state = {}, internal = {}) {
  return (
    internal?.largerCDownTargets ||
    internal?.cC?.largerCTargets ||
    state?.targetModel?.cDownTargets ||
    state?.activeFibModel?.levels ||
    null
  );
}

function getGenericDisplayLevels(state = {}) {
  const levels =
    state?.activeFibModel?.displayLevels ||
    state?.targetModel?.displayLevels ||
    [];
  return Array.isArray(levels) ? levels.filter((level) => level?.price != null) : [];
}

function Engine22MiniFibGrid({ title, levels = [], tone = "long" }) {
  if (!levels.length) return null;

  const border = tone === "short" ? "#5b1f1f" : "#1f3d20";
  const bg = tone === "short" ? "#170808" : "#061108";
  const labelColor = tone === "short" ? "#fca5a5" : "#86efac";

  return (
    <div
      style={{
        border: `1px solid ${border}`,
        borderRadius: 10,
        padding: 7,
        background: bg,
        display: "flex",
        flexDirection: "column",
        gap: 5,
      }}
    >
      <div style={{ color: labelColor, fontWeight: 1000, fontSize: FS.micro }}>
        {title}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0,1fr))",
          gap: 5,
        }}
      >
        {levels.map((level, idx) => (
          <div
            key={`${level?.label || "fib"}-${idx}`}
            style={{
              border: `1px solid ${border}`,
              borderRadius: 8,
              padding: "5px 6px",
              background: "rgba(0,0,0,.18)",
              minWidth: 0,
            }}
          >
            <div
              style={{
                color: labelColor,
                fontSize: FS.micro,
                fontWeight: 1000,
                lineHeight: 1,
              }}
            >
              {level?.label || "—"}
            </div>
            <div
              style={{
                color: "#e5e7eb",
                fontSize: FS.small,
                fontWeight: 1000,
                lineHeight: 1.1,
              }}
            >
              {displayPrice(level?.price)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function WaveDegreeContextCard({ degree, state }) {
  const active = state?.active === true;
  const genericLevels = getGenericDisplayLevels(state).slice(0, 6);
  const isPrimary = degree === "primary";
  const isIntermediate = degree === "intermediate";
  const tone = upper(state?.direction, "") === "DOWN" ? "short" : "long";

  return (
    <div
      style={{
        background: active ? "#101720" : "#0b0f16",
        border: active ? "1px solid #2563eb" : "1px solid #1f2937",
        borderRadius: 12,
        padding: 8,
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        gap: 6,
        boxShadow: active ? "0 0 14px rgba(37,99,235,.22)" : "none",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
        <div>
          <div style={{ fontWeight: 1000, fontSize: FS.small, color: "#e5e7eb" }}>
            {degree.toUpperCase()}
          </div>
          <div style={{ fontWeight: 900, fontSize: FS.micro, color: "#9ca3af" }}>
            {state?.tf || "—"}
          </div>
        </div>
        <Badge text={state?.activeWave || "—"} tone={active ? "watch" : "wait"} />
      </div>

      <div
        style={{
          fontWeight: 1000,
          fontSize: FS.small,
          color: active ? "#bfdbfe" : "#9ca3af",
          lineHeight: 1.15,
        }}
      >
        {compactHeadline(state?.headline || state?.currentRead)}
      </div>

      <KV label="Role" value={isPrimary || isIntermediate ? "Higher timeframe context" : "Structure context"} />
      <KV label="Stage" value={prettyEnum(state?.stage)} />
      <KV label="Direction" value={prettyEnum(state?.direction)} />
      <KV label="Action" value={prettyEnum(state?.action)} />

      <Engine22MiniFibGrid
        title={isPrimary ? "Primary Targets" : isIntermediate ? "Intermediate Targets" : "Structural Levels"}
        levels={genericLevels}
        tone={tone === "short" ? "short" : "long"}
      />
    </div>
  );
}

function SubminuteWaveCard({ state }) {
  const active = state?.active === true;
  const internal = state?.internalStructure || {};
  const reference = internal?.internalReference || {};

  return (
    <div
      style={{
        background: active ? "#101720" : "#0b0f16",
        border: active ? "1px solid #2563eb" : "1px solid #1f2937",
        borderRadius: 12,
        padding: 8,
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        gap: 6,
        boxShadow: active ? "0 0 14px rgba(37,99,235,.22)" : "none",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
        <div>
          <div style={{ fontWeight: 1000, fontSize: FS.small, color: "#e5e7eb" }}>
            SUBMINUTE
          </div>
          <div style={{ fontWeight: 900, fontSize: FS.micro, color: "#9ca3af" }}>
            {state?.tf || "10m"}
          </div>
        </div>
        <Badge text="CTX" tone="wait" />
      </div>

      <div style={{ color: "#bfdbfe", fontSize: FS.small, fontWeight: 1000 }}>
        Context only — do not force count
      </div>

      <KV label="Status" value={prettyEnum(state?.stage || "UNRESOLVED")} />
      <KV label="Current" value={prettyEnum(internal?.classification || state?.currentRead)} />
      <KV label="Parent" value="Minute C-down" />
      <KV label="Invalidation" value={`Above ${displayPrice(reference?.minuteBUpHigh ?? internal?.invalidationLevel ?? 7782)} reclaim / hold`} />
    </div>
  );
}

function MinorWaveCard({ state, minuteState }) {
  const internal = getInternalC(minuteState || {}) || {};
  const levels = getLargerCLevels(minuteState || {}, internal) || {};
  const fibs = [
    ["C 1.000", levels.c100],
    ["C 1.272", levels.c1272],
    ["C 1.618", levels.c1618],
    ["C 2.000", levels.c200],
    ["C 2.618", levels.c2618],
  ]
    .filter(([, price]) => Number.isFinite(Number(price)))
    .map(([label, price]) => ({ label, price }));

  const largerInvalidation = firstNumber(
    internal?.largerInvalidationLevel,
    internal?.parentStructure?.invalidationLevel,
    minuteState?.targetModel?.reclaimInvalidationLevel,
    state?.invalidationLevel,
    7840
  );

  return (
    <div
      style={{
        background: "#101720",
        border: "1px solid #2563eb",
        borderRadius: 12,
        padding: 8,
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        gap: 6,
        boxShadow: "0 0 14px rgba(37,99,235,.22)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
        <div>
          <div style={{ fontWeight: 1000, fontSize: FS.small, color: "#e5e7eb" }}>
            MINOR
          </div>
          <div style={{ fontWeight: 900, fontSize: FS.micro, color: "#9ca3af" }}>
            Parent correction
          </div>
        </div>
        <Badge text="W4" tone="watch" />
      </div>

      <div style={{ color: "#bfdbfe", fontSize: FS.small, fontWeight: 1000 }}>
        Minor W4 expanded flat — Minor C-down active
      </div>

      <KV label="Parent" value="Minor W4 expanded flat" />
      <KV label="Active Leg" value="Minor C-down" />
      <KV label="Invalidation" value={`Above ${displayPrice(largerInvalidation)} reclaim / hold`} />
      <KV label="Role" value="Parent map for current Minute C-down" />

      <Engine22MiniFibGrid title="Minor C-down targets" levels={fibs} tone="short" />
    </div>
  );
}

function MinuteWaveCard({ state }) {
  const internal = getInternalC(state || {}) || {};
  const minuteA = internal?.minuteA || internal?.finalMinuteABC?.waveA || internal?.cA || {};
  const minuteB = internal?.minuteB || internal?.finalMinuteABC?.waveB || internal?.cB || {};
  const minuteC = internal?.minuteC || internal?.finalMinuteABC?.waveC || internal?.cC || {};

  const minuteALow = firstNumber(minuteA?.low, minuteA?.price, minuteA?.completionTouchPrice);
  const minuteATime = firstText(minuteA?.time, minuteA?.completionTouchTime);
  const minuteBHigh = firstNumber(minuteB?.high, minuteB?.price, internal?.invalidationLevel);
  const minuteBTime = firstText(minuteB?.time);
  const minuteCStart = firstNumber(minuteC?.start, minuteBHigh);
  const minuteCState = firstText(minuteC?.state, internal?.cWaveState, "ACTIVE");
  const minuteCLevels = getMinuteCDisplayLevels(internal, state);
  const currentInvalidation = firstNumber(
    minuteB?.invalidationLevel,
    minuteC?.targetModel?.invalidationLevel,
    internal?.invalidationLevel,
    minuteBHigh
  );

  return (
    <div
      style={{
        background: "#101720",
        border: "1px solid #ef4444",
        borderRadius: 12,
        padding: 8,
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        gap: 6,
        boxShadow: "0 0 14px rgba(239,68,68,.20)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
        <div>
          <div style={{ fontWeight: 1000, fontSize: FS.small, color: "#e5e7eb" }}>
            MINUTE
          </div>
          <div style={{ fontWeight: 900, fontSize: FS.micro, color: "#9ca3af" }}>
            Tactical map
          </div>
        </div>
        <Badge text="C DOWN" tone="short" />
      </div>

      <div style={{ color: "#fca5a5", fontSize: FS.small, fontWeight: 1000 }}>
        Minute C-down active from {displayPrice(minuteCStart)}
      </div>

      <KV label="Current" value={firstText(internal?.currentInternalWave, "Minute-C")} />
      <KV label="State" value={prettyEnum(minuteCState)} />
      <KV label="A Low" value={`${displayPrice(minuteALow)} @ ${displayTime(minuteATime)}`} />
      <KV label="B High" value={`${displayPrice(minuteBHigh)} @ ${displayTime(minuteBTime)}`} />
      <KV label="Invalidation" value={`Above ${displayPrice(currentInvalidation)} reclaim / hold`} />

      <Engine22MiniFibGrid title="Minute C-down targets" levels={minuteCLevels} tone="short" />
    </div>
  );
}

function WaveDegreeRow({ snapshot }) {
  const degreeStates = getDegreeStates(snapshot);

  if (!degreeStates) {
    return (
      <div
        style={{
          marginTop: 10,
          border: "1px solid #1f2937",
          borderRadius: 14,
          padding: 10,
          background: "#0b0f16",
          color: "#9ca3af",
          fontWeight: 900,
        }}
      >
        Engine 22 Wave Degrees unavailable
      </div>
    );
  }

  const minuteState = degreeStates?.minute || {};

  return (
    <div
      style={{
        marginTop: 10,
        border: "1px solid #1f2937",
        borderRadius: 14,
        padding: 10,
        background: "#080d14",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <style>{`
        .engine22-degree-grid-clean {
          display: grid;
          grid-template-columns: 0.78fr 1.18fr 1.18fr 0.95fr 0.95fr;
          gap: 8px;
          align-items: stretch;
        }

        @media (max-width: 1750px) {
          .engine22-degree-grid-clean {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 1180px) {
          .engine22-degree-grid-clean {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 760px) {
          .engine22-degree-grid-clean {
            grid-template-columns: minmax(0, 1fr);
          }
        }
      `}</style>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 8,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontWeight: 1000, fontSize: FS.title, color: "#e5e7eb" }}>
            Engine 22 Wave Degrees
          </div>
          <div style={{ color: "#94a3b8", fontSize: FS.tiny, fontWeight: 900 }}>
            Top degrees are context. Minor is parent correction. Minute is tactical map.
          </div>
        </div>
        <Badge text="STRUCTURAL ONLY" tone="watch" />
      </div>

      <div className="engine22-degree-grid-clean">
        <SubminuteWaveCard state={degreeStates?.subminute || { degree: "subminute" }} />
        <MinuteWaveCard state={minuteState} />
        <MinorWaveCard state={degreeStates?.minor || { degree: "minor" }} minuteState={minuteState} />
        <WaveDegreeContextCard degree="intermediate" state={degreeStates?.intermediate || { degree: "intermediate" }} />
        <WaveDegreeContextCard degree="primary" state={degreeStates?.primary || { degree: "primary" }} />
      </div>
    </div>
  );
}
