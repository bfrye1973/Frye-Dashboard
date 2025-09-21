// src/pages/rows/RowStrategies/mocks/mockSignals.js
export const mockSignals = {
  alignment: {
    timestamp: new Date().toISOString(),
    strategy: "alignment",
    items: [
      {
        symbol: "SPY",
        score: 88,
        status: "Triggered",
        timeframe: "10m",
        signal_ts: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
        traits: { direction: "long", confirmCount: 8, outliers: 0, squeeze_pct: 42, vix_relation: "below_ema10" }
      },
      {
        symbol: "QQQ",
        score: 84,
        status: "OnDeck",
        timeframe: "10m",
        signal_ts: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
        traits: { direction: "long", confirmCount: 7, outliers: 1, squeeze_pct: 38, vix_relation: "below_ema10" }
      }
    ]
  },
  wave3: {
    timestamp: new Date().toISOString(),
    strategy: "wave3",
    items: [
      {
        symbol: "AAPL",
        score: 86,
        status: "OnDeck",
        timeframe: "D",
        signal_ts: new Date().toISOString(),
        traits: { fib_ok: true, ema_align: "10_20_cross", vol_mult: 1.4, squeeze_pct: 55 }
      },
      {
        symbol: "NVDA",
        score: 78,
        status: "OnDeck",
        timeframe: "D",
        signal_ts: new Date().toISOString(),
        traits: { fib_ok: true, ema_align: "10_20_cross", vol_mult: 1.3, squeeze_pct: 47 }
      }
    ]
  },
  flag: {
    timestamp: new Date().toISOString(),
    strategy: "flag",
    items: [
      {
        symbol: "MSFT",
        score: 82,
        status: "OnDeck",
        timeframe: "D",
        signal_ts: new Date().toISOString(),
        traits: { flag_tightness: 0.22, ema_align: "above_20_50", vol_mult: 1.25 }
      }
    ]
  }
};
