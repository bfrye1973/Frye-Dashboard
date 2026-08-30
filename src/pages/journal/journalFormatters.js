// src/pages/journal/journalFormatters.js
import { AZ_TZ, COLORS } from "./journalConstants.js";

export const upper=v=>String(v||"").trim().toUpperCase();
export function safeNum(v){const n=Number(v);return Number.isFinite(n)?n:null;}
export function fmtNum(v,d=2){const n=safeNum(v);return n==null?"—":n.toFixed(d);}
export function fmtMoney(v){const n=safeNum(v);return n==null?"—":`${n>=0?"+":"-"}$${Math.abs(n).toFixed(2)}`;}
export function fmtNegativeMoney(v){const n=safeNum(v);return n==null?"—":`-$${Math.abs(n).toFixed(2)}`;}
export function fmtPct(v){const n=safeNum(v);return n==null?"—":`${n.toFixed(1)}%`;}
export function pnlColor(v){const n=safeNum(v);return n==null||n===0?COLORS.text:n>0?COLORS.green:COLORS.red;}
export function toAz(iso,seconds=false){if(!iso)return"—";try{return new Date(iso).toLocaleString("en-US",{timeZone:AZ_TZ,month:"2-digit",day:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",second:seconds?"2-digit":undefined});}catch{return String(iso);}}
export function toAzTime(iso){if(!iso)return"—";try{return new Date(iso).toLocaleTimeString("en-US",{timeZone:AZ_TZ,hour:"numeric",minute:"2-digit",second:"2-digit"});}catch{return"—";}}
export function dayKey(iso){if(!iso)return null;try{return new Intl.DateTimeFormat("en-CA",{timeZone:AZ_TZ,year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(iso));}catch{return null;}}
export const todayKey=()=>dayKey(new Date().toISOString());
