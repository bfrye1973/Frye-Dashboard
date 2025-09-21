import React from "react";
import StrategyTable from "./StrategyTable";


function Pill({ color, children }) {
return (
<span style={{
background: color,
color: "#0a0a0a",
padding: "2px 8px",
borderRadius: 999,
fontSize: 12,
fontWeight: 700,
marginRight: 8,
}}>{children}</span>
);
}


export default function StrategyTabs({ data, counts }) {
const [tab, setTab] = React.useState("alignment"); // alignment | wave3 | flag


const cards = {
alignment: {
title: "SPY/QQQ Index Alignment (10m)",
subtitle: "All indices align vs EMA10; VIX opposite.",
defaultTf: "10m",
stats: counts.alignment || { total: 0, ondeck: 0, triggered: 0 },
},
wave3: {
title: "Wave 3 Breakout (Daily)",
subtitle: "Fib 38–61% pullback, EMA 10/20 cross, breakout.",
defaultTf: "D",
stats: counts.wave3 || { total: 0, ondeck: 0, triggered: 0 },
},
flag: {
title: "Flagpole Breakout (Daily)",
subtitle: "Tight range + volume → measured move.",
defaultTf: "D",
stats: counts.flag || { total: 0, ondeck: 0, triggered: 0 },
},
};


const current = cards[tab];


return (
<div className="flex flex-col gap-3">
{/* Tabs */}
<div className="flex items-center gap-2">
{Object.keys(cards).map((k) => (
<button
key={k}
onClick={() => setTab(k)}
className={`px-3 py-2 rounded-md border ${tab === k ? "border-[var(--text,#e5e7eb)]" : "border-[var(--border,#2b2b2b)]"}`}
>
{cards[k].title.split(" (")[0]}
</button>
))}
</div>


{/* Header card */}
<div className="rounded-xl border border-[var(--border,#2b2b2b)] p-3">
<div className="flex items-center justify-between flex-wrap gap-3">
<div>
<div className="text-lg font-semibold">{current.title}</div>
<div className="opacity-70 text-sm">{current.subtitle}</div>
</div>
<div className="flex items-center gap-2">
<Pill color="#22c55e">On Deck {current.stats.ondeck}</Pill>
<Pill color="#0ea5e9">Total {current.stats.total}</Pill>
<Pill color="#f59e0b">Triggered {current.stats.triggered}</Pill>
</div>
</div>
</div>


{/* Table */}
<StrategyTable strategyKey={tab} dataset={data?.[tab]} defaultTf={current.defaultTf} />
</div>
);
}
