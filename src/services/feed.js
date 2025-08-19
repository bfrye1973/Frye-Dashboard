// placeholder feed service

export function getFeed(symbol, timeframe) {
  return {
    async history() {
      return []; // empty candles
    },
    subscribe() {
      return () => {};
    },
    close() {}
  };
}
