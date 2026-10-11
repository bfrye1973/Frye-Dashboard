// Engine 2B preview-only static React host with SPA fallback. No trading routes.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../build");
const mime={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",
".css":"text/css; charset=utf-8",".json":"application/json",".png":"image/png",
".svg":"image/svg+xml",".ico":"image/x-icon",".txt":"text/plain",".woff2":"font/woff2"};
const server=http.createServer((req,res)=>{
  if(req.method!=="GET" && req.method!=="HEAD"){res.writeHead(405);return res.end();}
  const url=new URL(req.url,"http://preview.local");
  const requested=decodeURIComponent(url.pathname);
  const target=path.resolve(base,"."+requested);
  let file=path.join(base,"index.html");
  if(target.startsWith(base+path.sep)&&fs.existsSync(target)&&fs.statSync(target).isFile())file=target;
  if(!fs.existsSync(file)){res.writeHead(503);return res.end("Preview build unavailable");}
  res.writeHead(200,{"Content-Type":mime[path.extname(file)]||"application/octet-stream",
    "Cache-Control":file.endsWith("index.html")?"no-store":"public,max-age=300"});
  if(req.method==="HEAD")return res.end();
  fs.createReadStream(file).pipe(res);
});
const port=Number(process.env.PORT||10000);
server.listen(port,"0.0.0.0",()=>console.log("Engine2B React preview SPA host ready",port));
