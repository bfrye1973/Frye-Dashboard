export const sampleStrategies = [
  { id: 'flagpole', name: 'Flagpole Breakout', version: 'v1.0', status: 'ready' },
  { id: 'wave3', name: 'Wave 3 Breakout', version: 'v1.0', status: 'ready' },
  { id: 'ema10', name: 'Daily/Weekly 10 EMA Run', version: 'v1.0', status: 'ready' },
];

export function runMockSignal(symbol = 'SPY') {
  return {
    symbol,
    timestamp: new Date().toISOString(),
    strategy: 'wave3',
    score: Math.round(70 + Math.random() * 30),
    notes: 'Mock signal from strategies folder',
  };
}
