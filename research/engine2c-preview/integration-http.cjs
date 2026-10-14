// CI-only static asset server. Existing files take priority over SPA fallback.
// Prevents generic "/* => index.html" rules from swallowing engine2c-research assets.
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(process.cwd(),'build');
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png'};
http.createServer((req,res)=>{
  const requested=new URL(req.url,'http://localhost').pathname;
  const target=path.resolve(root,'.'+decodeURIComponent(requested));
  if(!target.startsWith(root+path.sep)&&target!==root){res.writeHead(403);res.end();return;}
  let file=target;
  try{if(fs.statSync(file).isDirectory())file=path.join(file,'index.html');}catch{}
  if(!fs.existsSync(file)||!fs.statSync(file).isFile())file=path.join(root,'index.html');
  res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});
  fs.createReadStream(file).pipe(res);
}).listen(8193,'127.0.0.1',()=>console.log('ENGINE2C_INTEGRATION_HTTP_READY'));
