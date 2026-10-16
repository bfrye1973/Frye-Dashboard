// Engine2C research-only ZIP reader. Reads the existing verified GitHub Actions
// package locally in the browser, without uploading market prices or adding a server.
// ZIP central-directory lookup lets us inflate ONLY the requested 1,000-candle page.
(function () {
  'use strict';
  const utf8 = new TextDecoder();
  const u16=(v,p)=>v.getUint16(p,true),u32=(v,p)=>v.getUint32(p,true);
  async function open(file){
    if(!file || !/\.zip$/i.test(file.name))throw Error('SELECT_GITHUB_HISTORY_ZIP');
    const tailLength=Math.min(file.size,65557),tail=new DataView(await file.slice(file.size-tailLength).arrayBuffer());
    let eocd=-1;
    for(let p=tail.byteLength-22;p>=0;p--){
      if(u32(tail,p)===0x06054b50 && p+22+u16(tail,p+20)===tail.byteLength){eocd=p;break;}
    }
    if(eocd<0)throw Error('ZIP_END_RECORD_MISSING');
    const count=u16(tail,eocd+10),directorySize=u32(tail,eocd+12),directoryOffset=u32(tail,eocd+16);
    if(count===0xffff||directorySize===0xffffffff||directoryOffset===0xffffffff || count>3000 || directorySize>500000)throw Error('ZIP_DIRECTORY_UNSUPPORTED');
    const dir=new DataView(await file.slice(directoryOffset,directoryOffset+directorySize).arrayBuffer());
    const entries=new Map();let pos=0;
    for(let n=0;n<count;n++){
      if(pos+46>dir.byteLength||u32(dir,pos)!==0x02014b50)throw Error('ZIP_DIRECTORY_INVALID');
      const flags=u16(dir,pos+8),method=u16(dir,pos+10),compressed=u32(dir,pos+20),plain=u32(dir,pos+24);
      const nameLength=u16(dir,pos+28),extra=u16(dir,pos+30),comment=u16(dir,pos+32),offset=u32(dir,pos+42);
      if(flags&1)throw Error('ENCRYPTED_ZIP_UNSUPPORTED');
      if(method!==0&&method!==8)throw Error('ZIP_METHOD_UNSUPPORTED');
      if(plain>2500000||compressed>2500000)throw Error('ZIP_PAGE_TOO_LARGE');
      if(pos+46+nameLength+extra+comment>dir.byteLength)throw Error('ZIP_ENTRY_TRUNCATED');
      const name=utf8.decode(new Uint8Array(dir.buffer,dir.byteOffset+pos+46,nameLength));
      if(name.includes('..')||name.startsWith('/')||name.includes('\\'))throw Error('ZIP_ENTRY_NAME_INVALID');
      if(!name.endsWith('/'))entries.set(name,{method,compressed,plain,offset});
      pos+=46+nameLength+extra+comment;
    }
    async function read(name){
      const item=entries.get(name);if(!item)throw Error('ZIP_HISTORY_PAGE_MISSING: '+name);
      const head=new DataView(await file.slice(item.offset,item.offset+30).arrayBuffer());
      if(head.byteLength<30||u32(head,0)!==0x04034b50)throw Error('ZIP_LOCAL_HEADER_INVALID');
      const start=item.offset+30+u16(head,26)+u16(head,28);
      const blob=file.slice(start,start+item.compressed);
      const out=item.method===0?blob:blob.stream().pipeThrough(new DecompressionStream('deflate-raw'));
      const bytes=new Uint8Array(await new Response(out).arrayBuffer());
      if(bytes.length!==item.plain)throw Error('ZIP_HISTORY_PAGE_SIZE_MISMATCH');
      return bytes;
    }
    async function json(name){return JSON.parse(utf8.decode(await read(name)));}
    const dirs={UNADJUSTED:'continuousRaw',ADJUSTED_RESEARCH:'continuousAdjustedClose',ACTUAL_CONTRACT:'actualESZ2026'};
    const catalogs={};const roots={};
    for(const [view,folder] of Object.entries(dirs)){
      const matches=[...entries.keys()].filter(p=>p.endsWith('/'+folder+'/'+folder+'-catalog.json'));
      if(matches.length!==1)throw Error('ZIP_RESEARCH_CATALOG_MISSING: '+view);
      roots[view]=matches[0].slice(0,-(folder+'-catalog.json').length);
      catalogs[view]=await json(matches[0]);
      if(catalogs[view].view!==folder||catalogs[view].researchOnly!==true||
        catalogs[view].executionPriceAuthority!==false||
        catalogs[view].structuralEligible!==false)throw Error('ZIP_RESEARCH_CATALOG_INVALID');
    }
    return {
      catalog:view=>catalogs[view],
      async page(view,frame,cursor,pins){
        const c=catalogs[view],group=c.frames?.[frame];
        if(!group||c.datasetVersion!==pins[0]||c.priceBasisVersion!==pins[1])throw Error('ZIP_RESEARCH_CONTEXT_MISMATCH');
        const d=group.pages.find(p=>p.requestCursor===cursor);
        if(!d||!/^[A-Za-z0-9_-]+\.json$/.test(d.name))throw Error('ZIP_RESEARCH_CURSOR_NOT_FOUND');
        const bytes=await read(roots[view]+d.name);
        const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(n=>n.toString(16).padStart(2,'0')).join('');
        if(digest!==d.sha256)throw Error('ZIP_RESEARCH_PAGE_CHECKSUM_MISMATCH');
        const page=JSON.parse(utf8.decode(bytes));
        if(page.requestCursor!==cursor||page.nextCursor!==d.nextCursor||page.rows?.length!==d.rows)throw Error('ZIP_RESEARCH_PAGE_INTEGRITY');
        return page;
      }
    };
  }
  window.Engine2CLocalHistoryZip={open};
})();
