import {createChartLoadProbe, historyEndpoint} from "./engine2ChartLoadProbe";

describe("Engine 2 historical loading metrics", () => {
  test("keeps Engine11 and regular futures paths distinct", () => {
    expect(historyEndpoint("engine11-2020plus")).toBe("/engine2c-private-history/page");
    expect(historyEndpoint("engine11-legacy")).toBe("/engine2c-private-history/page");
    expect(historyEndpoint("futures-ohlc")).toBe("/api/v1/futures/ohlc");
  });

  test("aggregates network, parse and merge without emitting credentials", () => {
    let t = 0, captured;
    const audit = createChartLoadProbe({
      symbol:"ES", timeframe:"5m", visit:2, now:()=>t,
      onReport:r=>{captured=r;},
    });
    audit.source("engine11-2020plus");
    t = 30;
    audit.page({rows:1000, networkMs:20, parseMs:3, transformMs:2, mergeMs:4});
    t = 75;
    audit.page({rows:44, networkMs:25, parseMs:4, transformMs:3, mergeMs:5});
    t = 90;
    audit.fetched();
    audit.sorted(6);
    audit.seedPrepared(4);
    audit.candleSetData(11, 1044);
    audit.volumeSetData(5);
    t = 130;
    audit.finish({visibleTimeRangePresent:true, paintOpportunity:true});
    expect(captured).toMatchObject({
      symbol:"ES", timeframe:"5m", visit:2, repeatedTimeframe:true,
      endpoint:"/engine2c-private-history/page", requests:2,
      rowsDownloaded:1044, rowsPlotted:1044,
      networkMs:45, browserParseMs:7, browserTransformMs:5, browserMergeMs:9,
      historyFetchCompleteMs:90, firstVerifiedPageMs:30,
      candleSetDataMs:11, firstPaintOpportunityMs:130, status:"OK",
    });
    expect(JSON.stringify(captured)).not.toMatch(/accessKey|apiKey|token|timestampUtc|priceBasisVersion/);
  });

  test("1m fallback has a single independent OHLC request", () => {
    let t=0, captured;
    const audit=createChartLoadProbe({
      symbol:"ES", timeframe:"1m", now:()=>t, onReport:r=>captured=r,
    });
    audit.source("futures-ohlc");
    t=42;
    audit.regular({rows:78, rawRows:80, networkMs:25, parseMs:7, normalizeMs:10});
    audit.fetched();
    audit.candleSetData(2,78);
    audit.finish({status:"OK"});
    expect(captured).toMatchObject({
      requests:1, rowsDownloaded:80, rowsPlotted:78,
      endpoint:"/api/v1/futures/ohlc", networkMs:25, browserParseMs:7,
    });
  });

  test("a failure is reported once without claiming a painted candle", () => {
    let t=12, reports=[];
    const audit=createChartLoadProbe({symbol:"ES",timeframe:"10m",now:()=>t,onReport:r=>reports.push(r)});
    audit.source("engine11-2020plus");
    t=23;
    audit.finish({status:"FAILED"});
    audit.finish({status:"OK",paintOpportunity:true});
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({status:"FAILED",firstPaintOpportunityMs:null});
  });
});
