import {deriveIndicativeAccount,readLastFuturesBar} from "./ManualPaperAccounts";

describe("read-only manual PAPER valuation",()=>{
  const make=(positions={})=>({equity:10000,cashBalance:9998.75,
    positions,realizedPnL:-1.25});
  test("one MES LONG gains $5 per point without changing source account",()=>{
    const original=make({MESZ26:{symbol:"MESZ26",side:"LONG",qty:1,averageEntryPrice:7850}});
    const result=deriveIndicativeAccount(original,{MESZ26:{price:7860}});
    expect(result.available).toBe(true);
    expect(result.unrealizedPnL).toBe(50);
    expect(result.equity).toBe(10048.75);
    expect(original.equity).toBe(10000);
  });
  test("three MES SHORTs use the $5 multiplier and direction",()=>{
    const result=deriveIndicativeAccount(make({MESZ26:{
      symbol:"MESZ26",side:"SHORT",qty:3,averageEntryPrice:7850
    }}),{MESZ26:{price:7840}});
    expect(result.unrealizedPnL).toBe(150);
  });
  test("ES uses $50 multiplier but never net positions across accounts",()=>{
    expect(deriveIndicativeAccount(make({ESZ26:{
      symbol:"ESZ26",side:"LONG",qty:1,averageEntryPrice:7850
    }}),{ESZ26:{price:7860}}).unrealizedPnL).toBe(500);
  });
  test("missing mark for an open contract does not fabricate zero unrealized P&L",()=>{
    const result=deriveIndicativeAccount(make({MESZ26:{
      symbol:"MESZ26",side:"LONG",qty:1,averageEntryPrice:7850
    }}),{});
    expect(result.available).toBe(false);
  });
  test("empty account uses official Engine 10 equity unchanged",()=>{
    expect(deriveIndicativeAccount(make(),{}).equity).toBe(10000);
  });
  test("1-minute bars need a valid fresh timestamp",()=>{
    const now=Date.parse("2026-10-12T18:00:00Z");
    expect(readLastFuturesBar([{close:7850.25,time:now/1000-300}],now))
      .toEqual({price:7850.25,barTime:"2026-10-12T17:55:00.000Z"});
    expect(readLastFuturesBar([{close:7850.25,time:now/1000-3600}],now)).toBeNull();
    expect(readLastFuturesBar([{close:7850.25}],now)).toBeNull();
  });
});
