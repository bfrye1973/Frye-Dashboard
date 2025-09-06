{/* Gauges — minis split left/right, big dials centered */}
<Panel
  title="Gauges — RPM = Breadth (yellow), SPEED = Momentum (red), WATER = Volatility (°F), OIL = Liquidity (PSI), FUEL = Squeeze Pressure (% + PSI), ALT = Breadth Trend"
  className="carbon-fiber"
  style={{ height: 380, maxHeight: 520, overflow: "hidden" }}
>
  <div
    style={{
      display: "grid",
      gridTemplateColumns: "320px 1fr 320px", // minis-left | big pair | minis-right
      gap: 18,
      alignItems: "center",
      justifyItems: "center",
      justifyContent: "center",
      height: "100%",
    }}
  >
    {/* LEFT minis (WATER top, FUEL bottom) */}
    <div
      style={{
        width: "100%",
        display: "grid",
        gridTemplateRows: "1fr 1fr",
        gap: 14,
        alignContent: "center",
        justifyItems: "center",
      }}
    >
      <MiniGauge label="WATER" caption="Volatility (°F)" value={data.gauges?.waterTemp} min={160} max={260} />
      <MiniGauge
        label="FUEL"
        caption="Squeeze Pressure"
        value={data.gauges?.fuelPct}
        min={0}
        max={100}
        extra={
          <div className="mini-psi">
            PSI {Number.isFinite(Number(data.gauges?.fuelPct)) ? Math.round(data.gauges.fuelPct) : "—"}
          </div>
        }
      />
    </div>

    {/* CENTER: RPM + SPEED as a tight, centered pair */}
    <div
      style={{
        width: "100%",
        maxWidth: 600,            // keeps the pair tight
        margin: "0 auto",
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 28,
        alignItems: "center",
        justifyItems: "center",
      }}
    >
      <BigGauge
        theme="tach"
        label="RPM (Breadth)"
        title="Breadth Index (RPM)"
        angle={rpmAngle}
        withLogo
        stateClass={`state-${(data?.lights?.breadth || "neutral")}`}
        scale={0.98}
      />
      <BigGauge
        theme="speed"
        label="SPEED (Momentum)"
        title="Momentum Index (SPEED)"
        angle={speedAngle}
        stateClass={`state-${(data?.lights?.momentum || "neutral")}`}
        scale={0.98}
      />
    </div>

    {/* RIGHT minis (OIL top, ALT bottom) */}
    <div
      style={{
        width: "100%",
        display: "grid",
        gridTemplateRows: "1fr 1fr",
        gap: 14,
        alignContent: "center",
        justifyItems: "center",
      }}
    >
      <MiniGauge label="OIL" caption="Liquidity (PSI)" value={data.gauges?.oilPsi} min={0} max={120} />
      <MiniGauge label="ALT" caption="Breadth Trend (ALT)" value={0} min={-100} max={100} />
    </div>
  </div>
</Panel>
