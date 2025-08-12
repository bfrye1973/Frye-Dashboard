// Build fixed-interval OHLC bars from ticks.
// Call emit(bar) when a bar finishes (bucket changes). You can also call emit(cur) occasionally to show live forming bars.
export function createAggregator(intervalSec, emit) {
  let cur = null;

  function startBucket(bucketTime, priceOrBar) {
    if (typeof priceOrBar === "number") {
      cur = { time: bucketTime, open: priceOrBar, high: priceOrBar, low: priceOrBar, close: priceOrBar };
    } else {
      const b = priceOrBar;
      cur = { time: bucketTime, open: +b.open, high: +b.high, low: +b.low, close: +b.close };
    }
  }

  return {
    tick({ time, price }) {
      const bucket = Math.floor(time / intervalSec) * intervalSec;
      if (!cur || cur.time !== bucket) {
        if (cur) emit({ ...cur });          // finalize previous bar
        startBucket(bucket, price);
      } else {
        cur.high = Math.max(cur.high, price);
        cur.low  = Math.min(cur.low,  price);
        cur.close = price;
      }
      // (optional) live preview: emit({ ...cur });
    },

    bar(b) {
      const bucket = Math.floor(b.time / intervalSec) * intervalSec;
      if (!cur || cur.time !== bucket) {
        if (cur) emit({ ...cur });
        startBucket(bucket, b);
      } else {
        // merge/refresh current forming bar
        cur.open  = cur.open ?? +b.open;
        cur.high  = Math.max(cur.high, +b.high);
        cur.low   = Math.min(cur.low,  +b.low);
        cur.close = +b.close;
      }
      // (optional) live preview: emit({ ...cur });
    },

    flush() { if (cur) emit({ ...cur }); }
  };
}
