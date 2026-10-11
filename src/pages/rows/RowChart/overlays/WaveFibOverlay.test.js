import WaveFibOverlay from "./WaveFibOverlay";

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

const payload = {
  ok: true,
  symbol: "ES",
  schemaVersion: "engine2.chartOverlays.v1",
  degrees: {
    primary: { drawable: true, lines: [{ id: "l", price: 7800, label: "1.618" }], marks: [] },
    micro: { drawable: false, reason: "NO_CANONICAL_MICRO_LEVELS", lines: [], marks: [] },
  },
};
const mockChart = () => {
  const ts = {
    timeToCoordinate: jest.fn(() => 100),
    subscribeVisibleTimeRangeChange: jest.fn(),
    unsubscribeVisibleTimeRangeChange: jest.fn(),
  };
  return { chart: { timeScale: () => ts }, ts };
};

describe("Engine 2B WaveFibOverlay lifecycle", () => {
  let oldFetch, oldRaf, oldCancel, getContext;
  beforeEach(() => {
    jest.useFakeTimers();
    oldFetch = global.fetch;
    oldRaf = global.requestAnimationFrame;
    oldCancel = global.cancelAnimationFrame;
    global.requestAnimationFrame = jest.fn(() => 123);
    global.cancelAnimationFrame = jest.fn();
    global.fetch = jest.fn(async () => ({
      ok: true, status: 200, headers: { get: () => null },
      json: async () => payload,
    }));
    getContext = jest.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => ({
      setTransform: jest.fn(), clearRect: jest.fn(),
      measureText: jest.fn(() => ({ width: 40 })),
      fillRect: jest.fn(), fillText: jest.fn(),
      beginPath: jest.fn(), moveTo: jest.fn(), lineTo: jest.fn(),
      stroke: jest.fn(), setLineDash: jest.fn(), arc: jest.fn(),
    }));
  });
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    getContext.mockRestore();
    global.fetch = oldFetch;
    global.requestAnimationFrame = oldRaf;
    global.cancelAnimationFrame = oldCancel;
  });

  test("five-degree architecture shares a single poll request across enabled overlays", async () => {
    const { chart, ts } = mockChart();
    const host = document.createElement("div");
    host.getBoundingClientRect = () => ({ width: 800, height: 450 });
    document.body.appendChild(host);
    const series = { priceToCoordinate: () => 150 };
    const primary = WaveFibOverlay({ chart, priceSeries: series, chartContainer: host, symbol: "ES", degree: "primary", enabled: true });
    const micro = WaveFibOverlay({ chart, priceSeries: series, chartContainer: host, symbol: "ES", degree: "micro", enabled: true });
    primary.seed([]);
    micro.seed([]);
    await flush();
    expect(global.fetch).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(30000);
    await flush();
    expect(global.fetch).toHaveBeenCalledTimes(2);
    primary.destroy();
    micro.destroy();
    expect(ts.unsubscribeVisibleTimeRangeChange).toHaveBeenCalledTimes(2);
    expect(host.querySelectorAll("[data-engine2b-degree]")).toHaveLength(0);
    jest.advanceTimersByTime(90000);
    await flush();
    expect(global.fetch).toHaveBeenCalledTimes(2);
    host.remove();
  });

  test("disabled overlay does not fetch or attach listeners", () => {
    const { chart, ts } = mockChart();
    const host = document.createElement("div");
    const overlay = WaveFibOverlay({ chart, priceSeries: {}, chartContainer: host, degree: "micro", enabled: false });
    overlay.seed([]);
    overlay.destroy();
    expect(global.fetch).not.toHaveBeenCalled();
    expect(ts.subscribeVisibleTimeRangeChange).not.toHaveBeenCalled();
  });
});
