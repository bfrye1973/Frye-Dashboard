<LiveLWChart
  symbol={symbol}
  timeframe={timeframe}
  height={620}
  enabledIndicators={[
    "ema10",
    "ema20",
  ]}
  indicatorSettings={{
    ema10: { length: 12, color: "#60a5fa" },
    ema20: { length: 26, color: "#f59e0b" },
  }}
/>
