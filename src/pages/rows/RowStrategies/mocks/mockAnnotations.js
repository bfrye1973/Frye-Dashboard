export function mockAnnotations({ symbol, strategy, tf }) {
if (strategy === "alignment") {
return {
symbol,
strategy,
overlays: {
ema: [10, 20, 50],
levels: [
{ kind: "stop", price: 0.995 },
{ kind: "target", price: 1.008 },
],
zones: [],
},
};
}
if (strategy === "wave3") {
return {
symbol,
strategy,
overlays: {
ema: [10, 20, 50],
levels: [{ kind: "breakout", price: 1.0 }],
zones: [
{ kind: "fib_pullback", low: 0.962, high: 0.982, range: [0.382, 0.618] },
],
},
};
}
// flag
return {
symbol,
strategy,
overlays: {
ema: [10, 20],
levels: [
{ kind: "flag_high", price: 1.0 },
{ kind: "flag_low", price: 0.98 },
{ kind: "breakout", price: 1.002 },
],
zones: [
{ kind: "flag_box", low: 0.98, high: 1.0 },
],
},
};
}
