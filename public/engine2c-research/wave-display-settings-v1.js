/* Engine 2D: per-degree display preferences only. Never authorizes plotting. */
(function(root){
'use strict';
const DEGREES=['submicro','micro','subminute','minute','minor','intermediate','primary'];
const COLORS=['#f59e0b','#38bdf8','#22c55e','#a78bfa','#ef4444','#f472b6','#facc15'];
const KEY='engine2d.waveDisplaySettings.v1';
const defaults=()=>Object.fromEntries(DEGREES.map((d,i)=>[d,{visible:true,color:COLORS[i],fontSize:12,lineWidth:2,anchors:true,fibs:true,review:false,scenarios:{OPTION_1_ABC_C_DOWN:true,OPTION_2_A_DOWN_B_UP_PENDING:true},fibGroups:{WICK:true,BODY:true}}]));
const validColor=x=>typeof x==='string'&&/^#[0-9a-fA-F]{6}$/.test(x);
const clamp=(x,a,b,base)=>Number.isFinite(Number(x))?Math.min(b,Math.max(a,Math.round(Number(x)))):base;
function normalize(raw){
 const base=defaults();
 for(const d of DEGREES){
  const r=raw?.[d];if(!r||typeof r!=='object')continue;
  const v=base[d];
  for(const k of ['visible','anchors','fibs','review'])if(typeof r[k]==='boolean')v[k]=r[k];
  if(validColor(r.color))v.color=r.color;
  v.fontSize=clamp(r.fontSize,9,24,12);v.lineWidth=clamp(r.lineWidth,1,6,2);
  for(const k of Object.keys(v.scenarios))if(typeof r.scenarios?.[k]==='boolean')v.scenarios[k]=r.scenarios[k];
  for(const k of Object.keys(v.fibGroups))if(typeof r.fibGroups?.[k]==='boolean')v.fibGroups[k]=r.fibGroups[k];
 }
 return base;
}
function read(storage){
 try{return normalize(JSON.parse(storage?.getItem(KEY)||'null'));}catch{return defaults();}
}
function write(storage,state){try{storage?.setItem(KEY,JSON.stringify(normalize(state)));return true;}catch{return false;}}
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function mount(host,storage,notify=()=>{}){
 if(!host)return null;
 let state=read(storage);
 function draw(){
  const wasOpen=host.querySelector('details')?.open??false;
  host.innerHTML='<details><summary style="cursor:pointer;font-weight:700;padding:9px">Elliott Wave overlay settings (seven degrees)</summary>'+
   '<p style="font-size:12px;color:#fbbf24">Display preferences only. Engine 22 price-basis verification is still required before any wave or Fibonacci plotting.</p>'+
   DEGREES.map(d=>{const s=state[d];return '<fieldset data-degree="'+d+'" style="border:1px solid #334155;border-radius:6px;margin:8px 0;padding:9px">'+
    '<legend style="color:'+s.color+';font-weight:700">'+esc(d.toUpperCase())+'</legend>'+
    '<label><input type="checkbox" data-field="visible" '+(s.visible?'checked':'')+'> Show degree</label> '+
    '<label><input type="checkbox" data-field="anchors" '+(s.anchors?'checked':'')+'> Anchors</label> '+
    '<label><input type="checkbox" data-field="fibs" '+(s.fibs?'checked':'')+'> Fibonacci</label> '+
    '<label><input type="checkbox" data-field="review" '+(s.review?'checked':'')+'> Review references</label><div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:8px">'+
    '<label>Color <input type="color" data-field="color" value="'+s.color+'"></label>'+
    '<label>Font size <input type="number" data-field="fontSize" min="9" max="24" value="'+s.fontSize+'" style="width:55px"></label>'+
    '<label>Line width <input type="number" data-field="lineWidth" min="1" max="6" value="'+s.lineWidth+'" style="width:48px"></label></div>'+
    (d==='submicro'?'<div><label><input type="checkbox" data-field="scenarios.OPTION_1_ABC_C_DOWN" '+(s.scenarios.OPTION_1_ABC_C_DOWN?'checked':'')+'> Option 1 ABC DOWN</label> <label><input type="checkbox" data-field="scenarios.OPTION_2_A_DOWN_B_UP_PENDING" '+(s.scenarios.OPTION_2_A_DOWN_B_UP_PENDING?'checked':'')+'> Option 2 A DOWN</label></div>':'')+
    (d==='subminute'?'<div><label><input type="checkbox" data-field="fibGroups.WICK" '+(s.fibGroups.WICK?'checked':'')+'> WICK Fib</label> <label><input type="checkbox" data-field="fibGroups.BODY" '+(s.fibGroups.BODY?'checked':'')+'> BODY Fib</label></div>':'')+
    '</fieldset>';}).join('')+'<button type="button" data-reset>Reset display settings</button></details>';
  if(wasOpen)host.querySelector('details').open=true;
 }
 host.addEventListener('change',e=>{
  const el=e.target,field=el?.dataset?.field,d=el?.closest?.('[data-degree]')?.dataset?.degree;
  if(!field||!DEGREES.includes(d))return;
  const parts=field.split('.');const value=el.type==='checkbox'?el.checked:el.value;
  if(parts.length===2){state[d][parts[0]][parts[1]]=value;}
  else state[d][field]=value;
  state=normalize(state);write(storage,state);notify(state);draw();
 });
 host.addEventListener('click',e=>{if(!e.target?.matches?.('[data-reset]'))return;state=defaults();write(storage,state);notify(state);draw();});
 draw();
 return {get:()=>normalize(state),reset:()=>{state=defaults();write(storage,state);notify(state);draw();}};
}
const API={DEGREES,defaults,normalize,read,write,mount};
if(typeof module!=='undefined'&&module.exports)module.exports=API;
if(root)root.Engine2DWaveDisplaySettings=API;
})(typeof window!=='undefined'?window:null);
