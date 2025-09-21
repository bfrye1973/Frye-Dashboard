import React from "react";
import useStrategies from "./hooks/useStrategies";
import StrategyTabs from "./StrategyTabs";


export default function RowStrategies() {
const { loading, error, data, counts, reload } = useStrategies();


return (
<section id="row-5" className="w-full">
<div className="flex items-center justify-between mb-2">
<h2 className="text-xl font-bold">Strategies</h2>
<div className="flex items-center gap-2">
<button className="px-3 py-1 rounded-md border border-[var(--border,#2b2b2b)]" onClick={reload}>Refresh</button>
{loading && <span className="text-xs opacity-70">Loading…</span>}
{error && <span className="text-xs text-red-400">{error}</span>}
</div>
</div>
<StrategyTabs data={data} counts={counts} />
</section>
);
}
