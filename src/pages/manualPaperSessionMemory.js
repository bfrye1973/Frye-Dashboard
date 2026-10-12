// Volatile PAPER-only token held in this JavaScript runtime while the SPA is open.
// Never persisted to localStorage, sessionStorage, cookies, or URL parameters.
// Hard reload intentionally clears the token; server expiration still applies.
let paperSessionToken="";
export function readVolatilePaperToken(){return paperSessionToken;}
export function storeVolatilePaperToken(token){
  const value=String(token||"");
  if(!/^[A-Za-z0-9_-]{40,128}$/.test(value))throw Error("INVALID_PAPER_SESSION_TOKEN");
  paperSessionToken=value;
}
export function clearVolatilePaperToken(){paperSessionToken="";}
