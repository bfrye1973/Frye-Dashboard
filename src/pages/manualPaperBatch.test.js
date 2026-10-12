import {
  buildSevenPaperBuyPlan,isSevenPaperBuyPlan,makePaperBatchTicket,
  SEVEN_PAPER_BUY_PLAN
} from "./manualPaperBatch";

const overview=()=>({ok:true,initialized:true,riskPolicy:{
  simulatedInitialMargin:{MES:1500},feePerContractPerSide:{MES:1.25},
  maxContractsPerAccount:6
},accounts:SEVEN_PAPER_BUY_PLAN.map(x=>({
  accountId:x.accountId,accountMode:"PAPER",availableFunds:10000,
  openContracts:0,positions:{},pendingJournalInstructions:0,tradingBlocked:false
}))});
let n=0;
const request=()=> "PAPER-REQUEST-UUID-"+(++n);
describe("seven manual PAPER buy batch",()=>{
  test("creates exactly seven BUY LONG account instructions totaling eleven MES",()=>{
    const plan=buildSevenPaperBuyPlan({overview:overview(),contract:"MESZ26",
      price:7850,newRequestId:request});
    expect(isSevenPaperBuyPlan(plan)).toBe(true);
    expect(plan.entries.map(x=>x.qty)).toEqual([3,3,1,1,1,1,1]);
    expect(plan.entries.reduce((sum,x)=>sum+x.qty,0)).toBe(11);
    expect(new Set(plan.entries.map(x=>x.idempotencyKey)).size).toBe(7);
    expect(plan.entries.every(x=>x.status==="READY"&&x.action==="BUY"&&x.intent==="OPEN_LONG")).toBe(true);
    const ticket=makePaperBatchTicket(plan.entries[0]);
    expect(ticket).toMatchObject({accountId:"PAPER-01-SUBMICRO",contract:"MESZ26",qty:3,
      price:7850,action:"BUY",intent:"OPEN_LONG",paper:true,ownerConfirmation:"CONFIRM_PAPER"});
  });
  test("rejects absent authentication, absent accounts, invalid expiration or off-tick price",()=>{
    expect(()=>buildSevenPaperBuyPlan({overview:null,contract:"MESZ26",price:7850,newRequestId:request})).toThrow();
    expect(()=>buildSevenPaperBuyPlan({overview:{...overview(),accounts:[]},contract:"MESZ26",price:7850,newRequestId:request})).toThrow();
    expect(()=>buildSevenPaperBuyPlan({overview:overview(),contract:"MES",price:7850,newRequestId:request})).toThrow();
    expect(()=>buildSevenPaperBuyPlan({overview:overview(),contract:"MESZ26",price:7850.1,newRequestId:request})).toThrow();
  });
  test("rejects any open position, pending journal, blocked account or insufficient simulated margin",()=>{
    const open=overview();open.accounts[2].openContracts=1;
    expect(()=>buildSevenPaperBuyPlan({overview:open,contract:"MESZ26",price:7850,newRequestId:request})).toThrow(/SUBMINUTE/);
    const pending=overview();pending.accounts[1].pendingJournalInstructions=1;
    expect(()=>buildSevenPaperBuyPlan({overview:pending,contract:"MESZ26",price:7850,newRequestId:request})).toThrow(/MICRO/);
    const low=overview();low.accounts[0].availableFunds=4000;
    expect(()=>buildSevenPaperBuyPlan({overview:low,contract:"MESZ26",price:7850,newRequestId:request})).toThrow(/SUBMICRO/);
  });
  test("rejects malformed partially completed plan, preserving original IDs on recovery",()=>{
    const plan=buildSevenPaperBuyPlan({overview:overview(),contract:"MESZ26",price:7850,newRequestId:request});
    const partial={...plan,entries:plan.entries.map((x,i)=>i===0?{...x,status:"UNCERTAIN"}:x)};
    expect(isSevenPaperBuyPlan(partial)).toBe(true);
    expect(makePaperBatchTicket(partial.entries[0]).idempotencyKey).toBe(plan.entries[0].idempotencyKey);
    expect(isSevenPaperBuyPlan({...plan,totalContracts:12})).toBe(false);
    expect(isSevenPaperBuyPlan({...plan,entries:plan.entries.slice(1)})).toBe(false);
  });
});
