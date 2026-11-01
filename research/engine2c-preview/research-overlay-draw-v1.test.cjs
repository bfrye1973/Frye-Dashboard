const test=require('node:test');
const assert=require('node:assert/strict');
const owner=require('../../public/engine2c-research/owner-anchors-v1.js');
const fib=require('../../public/engine2c-research/research-fib-overlay-v1.js');
const settings=require('../../public/engine2c-research/wave-display-settings-v1.js');
function ctx(){
 let strokes=0;
 return {save(){},restore(){},beginPath(){},rect(){},clip(){},setLineDash(){},moveTo(){},lineTo(){},stroke(){strokes++},fillText(){},arc(){},fill(){},get strokes(){return strokes}};
}
test('owner-provided coordinate renders on exact Arizona timestamp without OHLC snap',()=>{
 const a=owner.anchors[0],c=ctx(),ns=String(Date.parse(a.timestampUtc)*1000000);
 const result=owner.draw({ctx:c,visible:[{timestampNs:ns,prices:{high:7800,low:7600}}],
  plot:{left:20,right:600,top:10,bottom:350,lo:7500,hi:7900},degree:'SUBMICRO',prefs:settings.defaults()});
 assert.equal(result.drawn,1);assert.ok(c.strokes>0);
});
test('working Fibonacci level actually renders when explicitly enabled',()=>{
 const c=ctx(),packet={schema:'engine22.chartAnchors.v1',authority:'ENGINE22',noExecution:true,plotAllowed:false,degrees:{
  micro:{available:true,fibGroups:[{groupId:'SELECTED',levels:[{price:7750,label:'0.618'}]}],scenarios:[]}
 }};
 const result=fib.draw({ctx:c,packet,prefs:settings.defaults(),degree:'MICRO',
  plot:{left:20,right:600,top:10,bottom:350,lo:7500,hi:7900},enabled:true});
 assert.equal(result.drawn,1);assert.ok(c.strokes>0);
 assert.equal(packet.plotAllowed,false);
});
