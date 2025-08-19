// Shared helpers for money flow indicators
export function typicalPrice(h, l, c) {
  return (h + l + c) / 3;
}

export function rollingSum(arr, length) {
  const out = new Array(arr.length).fill(null);
  let sum = 0;
  for (let i = 0; i < arr.length; i++) {
    sum += arr[i];
    if (i >= length) sum -= arr[i - length];
    if (i >= length - 1) out[i] = sum;
  }
  return out;
}

