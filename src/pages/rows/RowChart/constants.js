export const SYMBOLS = ["SPY","QQQ","IWM","DIA","AAPL","MSFT","AMZN","GOOGL","META","TSLA","NVDA"];
export const TIMEFRAMES = ["1m","5m","15m","30m","1h","4h","1d"];

export function resolveApiBase(explicit) {
  const env = (process.env.REACT_APP_API_BASE || "").replace(/\/$/,"");
  const prop = (explicit || "").replace(/\/$/,"");
  return prop || env || window.location.origin;
}
