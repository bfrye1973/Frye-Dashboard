// src/pages/journal/journalAnalytics.js
// Pure analytics only. No React, no API calls, no Engine 10 writes.
import { safeNum, upper } from "./journalFormatters.js";

const gross=t=>safeNum(t?.summary?.grossRealizedPnL)??safeNum(t?.brokerImport?.grossRealizedTradePnL)??safeNum(t?.summary?.realizedPnL);
const net=t=>safeNum(t?.summary?.netRealizedPnL)??safeNum(t?.brokerImport?.netRealizedTradePnL)??gross(t);

export function calculateAnalytics(trades=[]){
  const closed=trades.filter(t=>upper(t?.status)==="CLOSED");
  const pnls=closed.map(t=>net(t)).filter(v=>v!=null);
  const wins=pnls.filter(v=>v>0), losses=pnls.filter(v=>v<0);
  const gp=wins.reduce((a,b)=>a+b,0), gl=Math.abs(losses.reduce((a,b)=>a+b,0));
  const averageWin=wins.length?gp/wins.length:null;
  const averageLoss=losses.length?gl/losses.length:null;
  const winRate=pnls.length?wins.length/pnls.length*100:null;
  const profitFactor=gl>0?gp/gl:gp>0?Infinity:null;
  const winLossRatio=averageWin!=null&&averageLoss>0?averageWin/averageLoss:null;
  const expectancy=winRate!=null&&averageWin!=null?(winRate/100)*averageWin-(pnls.length?losses.length/pnls.length:0)*(averageLoss||0):null;

  let equity=0,peak=0,maxDrawdown=0,currentWinStreak=0,currentLossStreak=0;
  const ordered=[...closed].sort((a,b)=>(Date.parse(a?.summary?.closeTime||a?.updatedAt||0)||0)-(Date.parse(b?.summary?.closeTime||b?.updatedAt||0)||0));
  for(const t of ordered){const p=net(t)??0;equity+=p;peak=Math.max(peak,equity);maxDrawdown=Math.max(maxDrawdown,peak-equity);if(p>0){currentWinStreak++;currentLossStreak=0;}else if(p<0){currentLossStreak++;currentWinStreak=0;}else{currentWinStreak=0;currentLossStreak=0;}}

  const exitPnLs=trades.flatMap(t=>Array.isArray(t?.events)?t.events:[])
    .filter(e=>(safeNum(e?.qtyClosed)||0)>0)
    .map(e=>safeNum(e?.netEventRealizedPnL)??safeNum(e?.grossEventRealizedPnL)??safeNum(e?.eventRealizedPnL))
    .filter(v=>v!=null);
  const exitWins=exitPnLs.filter(v=>v>0), exitLosses=exitPnLs.filter(v=>v<0);
  const egp=exitWins.reduce((a,b)=>a+b,0), egl=Math.abs(exitLosses.reduce((a,b)=>a+b,0));

  return {
    closedCount:closed.length,winRate,profitFactor,averageWin,averageLoss,winLossRatio,expectancy,maxDrawdown,
    winningCampaignPct:closed.length?wins.length/closed.length*100:null,currentWinStreak,currentLossStreak,
    totalExits:exitPnLs.length,profitableExits:exitWins.length,losingExits:exitLosses.length,
    winningExitPct:exitPnLs.length?exitWins.length/exitPnLs.length*100:null,
    totalExitPnL:exitPnLs.reduce((a,b)=>a+b,0),
    averageWinningExit:exitWins.length?egp/exitWins.length:null,
    averageLosingExit:exitLosses.length?egl/exitLosses.length:null,
    exitProfitFactor:egl>0?egp/egl:egp>0?Infinity:null
  };
}
