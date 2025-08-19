// src/services/feed.js
export function getFeed(symbol, timeframe) {
  return {
    async history() { return []; },
    subscribe() { return () => {}; },
    close() {}
  };
}
