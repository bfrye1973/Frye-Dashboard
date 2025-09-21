// … keep previous content …

// Add prop: smi = false
export default function IndicatorsToolbar({
  showEma, ema10 = true, ema20 = true, ema50 = true,
  volume = false,
  moneyFlow = false, luxSr = false, swingLiquidity = false,
  smi = false,                 // NEW
  onChange,
}) {
  // … inside the menu, after Volume …
  {/* Oscillators (separate pane) */}
  <div style={{ color: "#9ca3af", fontSize: 12, margin: "10px 0 4px" }}>Oscillators</div>
  <label>
    <input type="checkbox" checked={smi} onChange={e=>onChange({ smi: e.target.checked })}/>
    {" "}SMI (K=12, D=7, EMA=5)
  </label>

  // … rest unchanged …
}
