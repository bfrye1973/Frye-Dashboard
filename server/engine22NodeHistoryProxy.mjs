// Owner-only, same-origin read proxy for the EXISTING Engine 22 node-history API.
// No direct browser access to ENGINE22_WAVE_HISTORY_READ_TOKEN.
// Routes remain disabled until backend release + owner-approved Render env setup.
import { createHash, timingSafeEqual } from "node:crypto";

const PAGE_PATH="/api/engine22/wave-history/nodes";
const CURRENT_PATH="/api/engine22/wave-history/nodes/current";
const sha=(v)=>createHash("sha256").update(v).digest();
const validOwnerAccess=(provided,expected)=>{
  if(typeof expected!=="string" || expected.length<16 ||
     typeof provided!=="string" || provided.length<16 || provided.length>2048) return false;
  return timingSafeEqual(sha(provided),sha(expected));
};
const integer=(s,min,max)=>typeof s==="string" && /^\d+$/.test(s) &&
  Number.isSafeInteger(Number(s)) && Number(s)>=min && Number(s)<=max;
const reply=(res,status,reason)=>{
  res.status(status).json({available:false,reason});
};

export function createEngine22NodeHistoryProxy({
  enabled=process.env.ENGINE22_WAVE_PROXY_ENABLED==="true",
  ownerKey=process.env.ENGINE22_WAVE_PROXY_OWNER_KEY,
  backendToken=process.env.ENGINE22_WAVE_HISTORY_READ_TOKEN,
  apiTarget=process.env.API_TARGET || "https://frye-market-backend-1.onrender.com",
  fetchImpl=globalThis.fetch,
}={}) {
  return async function engine22NodeProxy(req,res){
    res.set("Cache-Control","no-store");
    res.set("X-Content-Type-Options","nosniff");
    if(!enabled || !ownerKey || typeof backendToken!=="string" ||
       backendToken.length<32) return reply(res,503,"ENGINE22_NODE_PROXY_NOT_ENABLED");
    if(!validOwnerAccess(req.get("x-engine2c-access"),ownerKey))
      return reply(res,401,"ENGINE22_NODE_OWNER_ACCESS_REQUIRED");
    const isCurrent=req.path===CURRENT_PATH;
    if(!isCurrent && req.path!==PAGE_PATH)
      return reply(res,404,"ENGINE22_NODE_ROUTE_NOT_FOUND");
    const params=new URLSearchParams();
    if(isCurrent){
      if(Object.keys(req.query||{}).length) return reply(res,400,"INVALID_HISTORY_PAGINATION");
    } else {
      const query=req.query||{};
      if(Object.keys(query).some(k=>!["afterRevision","limit"].includes(k)) ||
         (query.afterRevision!==undefined && !integer(query.afterRevision,0,Number.MAX_SAFE_INTEGER)) ||
         (query.limit!==undefined && !integer(query.limit,1,100)))
        return reply(res,400,"INVALID_HISTORY_PAGINATION");
      params.set("afterRevision",String(query.afterRevision??"0"));
      params.set("limit",String(query.limit??"50"));
    }
    try {
      const backend=new URL(apiTarget);
      if(!["https:","http:"].includes(backend.protocol) || !backend.hostname)
        return reply(res,503,"ENGINE22_NODE_BACKEND_NOT_CONFIGURED");
      const url=new URL(isCurrent?CURRENT_PATH:PAGE_PATH,backend);
      url.search=params.toString();
      const upstream=await fetchImpl(url.toString(),{
        method:"GET",
        headers:{Authorization:`Bearer ${backendToken}`,Accept:"application/json"},
        signal:AbortSignal.timeout(10000),
        redirect:"error",
      });
      if(!upstream.ok){
        const status=upstream.status===503?503:502;
        return reply(res,status,upstream.status===503?
          "ENGINE22_NODE_HISTORY_NOT_AVAILABLE":"ENGINE22_NODE_HISTORY_UPSTREAM_ERROR");
      }
      const contentType=upstream.headers.get("content-type")||"";
      if(!contentType.toLowerCase().includes("application/json"))
        return reply(res,502,"ENGINE22_NODE_HISTORY_INVALID_RESPONSE");
      const body=await upstream.text();
      if(body.length>2000000) return reply(res,502,"ENGINE22_NODE_HISTORY_TOO_LARGE");
      const data=JSON.parse(body);
      if(!data || typeof data!=="object")
        return reply(res,502,"ENGINE22_NODE_HISTORY_INVALID_RESPONSE");
      return res.status(200).json(data);
    } catch {
      return reply(res,503,"ENGINE22_NODE_HISTORY_UNAVAILABLE");
    }
  };
}
