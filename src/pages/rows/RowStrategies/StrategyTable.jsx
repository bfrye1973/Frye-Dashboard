import React, { useMemo } from "react";
const setSelection = useSelectionStore((s) => s.setSelection);


const rows = useMemo(() => dataset?.items || [], [dataset]);


return (
<div className="w-full overflow-auto">
<table className="w-full text-sm">
<thead>
<tr className="text-muted" style={{ opacity: 0.8 }}>
<th className="text-left py-2 px-2">Symbol</th>
<th className="text-left py-2 px-2">Score</th>
<th className="text-left py-2 px-2">Status</th>
<th className="text-left py-2 px-2">When</th>
<th className="text-left py-2 px-2">Traits</th>
<th className="text-right py-2 px-2">Action</th>
</tr>
</thead>
<tbody>
{rows.map((r) => (
<tr key={`${strategyKey}-${r.symbol}-${r.signal_ts}`} className="border-t border-[var(--border,#2b2b2b)] hover:bg-[var(--panel,#121212)]/60">
<td className="py-2 px-2 font-medium">{r.symbol}</td>
<td className="py-2 px-2">
<span style={{ color: gradeColor(r.score), fontWeight: 700 }}>{r.score}</span>
</td>
<td className="py-2 px-2">{r.status}</td>
<td className="py-2 px-2">{new Date(r.signal_ts).toLocaleTimeString()}</td>
<td className="py-2 px-2 whitespace-nowrap">
{strategyKey === "alignment" && (
<span>
{r.traits.direction} · idx {r.traits.confirmCount}/8 · VIX {r.traits.vix_relation}
</span>
)}
{strategyKey === "wave3" && (
<span>
Fib {r.traits.fib_ok ? "ok" : "fail"} · EMA {r.traits.ema_align} · Vol×{r.traits.vol_mult}
</span>
)}
{strategyKey === "flag" && (
<span>
Tight {Math.round((r.traits.flag_tightness || 0) * 100)}% · {r.traits.ema_align} · Vol×{r.traits.vol_mult}
</span>
)}
</td>
<td className="py-2 px-2 text-right">
<button
className="px-3 py-1 rounded-md border border-[var(--border,#2b2b2b)] hover:border-[var(--text,#e5e7eb)]"
onClick={() =>
setSelection({
symbol: r.symbol,
strategy: strategyKey,
timeframe: defaultTf,
overlays:
strategyKey === "alignment"
? { showEma10: true, showEma20: true, showEma50: true }
: strategyKey === "wave3"
? { showEma10: true, showEma20: true, showEma50: true, showWave3Fib: true }
: { showEma10: true, showEma20: true, showFlagLevels: true },
})
}
>
View
</button>
</td>
</tr>
))}
{rows.length === 0 && (
<tr>
<td colSpan={6} className="py-6 text-center opacity-60">
No signals yet.
</td>
</tr>
)}
</tbody>
</table>
</div>
);
}
