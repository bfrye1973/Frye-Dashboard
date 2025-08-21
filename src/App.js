const [enabled, setEnabled] = useState({
  ema10: true,
  ema20: true,
  mfp:  false,
  sr:   false,
  swing:false,
+ squeeze:false,
+ smi:false,
+ vol:false,
});

const enabledIndicators = useMemo(() => {
  const out = [];
  if (enabled.ema10) out.push("ema10");
  if (enabled.ema20) out.push("ema20");
  if (enabled.mfp)   out.push("mfp");
  if (enabled.sr)    out.push("sr");
  if (enabled.swing) out.push("swing");
+ if (enabled.squeeze) out.push("squeeze");
+ if (enabled.smi)     out.push("smi");
+ if (enabled.vol)     out.push("vol");
  return out;
}, [enabled]);
