// CI-only loopback research page server. Restricts historical pages to localhost;
// never uploads datasets/screenshots or serves the private directory as static files.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(process.cwd(),'build'),privateRoot=path.resolve(process.env.ENGINE2C_PRIVATE_PAGES||'/tmp/engine2c-private-artifact/pages');
const views={UNADJUSTED:'continuousRaw',ADJUSTED_RESEARCH:'continuousAdjustedClose',ACTUAL_CONTRACT:'actualESZ2026'};
const catalog={};
for(const [view,folder] of Object.entries(views))catalog[view]=JSON.parse(fs.readFileSync(path.join(privateRoot,folder,folder+'-catalog.json')));
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.png':'image/png'};
const port=Number(process.env.ENGINE2C_PRIVATE_PORT||8197);
http.createServer((req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1:'+port),send=(code,body,type='application/json')=>{res.writeHead(code,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(body);};
 if(url.pathname==='/engine2c-private-history/page'){
  const view=url.searchParams.get('view'),frame=url.searchParams.get('frame'),c=catalog[view];
  if(!c||!c.frames[frame]||url.searchParams.get('datasetVersion')!==c.datasetVersion||url.searchParams.get('priceBasisVersion')!==c.priceBasisVersion||url.searchParams.get('direction')!=='DESC'||url.searchParams.get('limit')!=='1000')return send(400,'{"error":"CONTEXT_INVALID"}');
  const cursor=url.searchParams.get('cursor'),metadata=c.frames[frame].pages.find(p=>p.requestCursor===(cursor===null?null:cursor));
  if(!metadata)return send(404,'{"error":"CURSOR_NOT_FOUND"}');
  const full=path.join(privateRoot,views[view],metadata.name);
  return send(200,fs.readFileSync(full));
 }
 const target=path.resolve(root,'.'+decodeURIComponent(url.pathname));
 if(!target.startsWith(root+path.sep)&&target!==root)return send(403,'blocked','text/plain');
 let file=target;try{if(fs.statSync(file).isDirectory())file=path.join(file,'index.html');}catch{}
 if(!fs.existsSync(file)||!fs.statSync(file).isFile())file=path.join(root,'index.html');
 if(url.pathname==='/engine2c-research/index.html'){
  const html=fs.readFileSync(file,'utf8').replace('<script src="./app.js"></script>','<script>window.__ENGINE2C_HISTORY_ENDPOINT__="/engine2c-private-history/page";</script><script src="./app.js"></script>');
  return send(200,html,'text/html; charset=utf-8');
 }
 return send(200,fs.readFileSync(file),types[path.extname(file)]||'application/octet-stream');
}).listen(port,'127.0.0.1',()=>console.log('loopback historical preview ready'));
