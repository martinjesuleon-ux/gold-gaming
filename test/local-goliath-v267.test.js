'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const code=fs.readFileSync(require('node:path').join(__dirname,'../public/local-goliath-v267.js'),'utf8');
test('local Goliath matches atlas headings, never changes GOLD, and restores fallback',async()=>{
 let theme='classic',reads=0,fallback=0,dimensions=[3024,2000];
 const window={ggVisualTheme:{current:()=>theme},ggClassicPack:{draw(){fallback++;return false},shop(){return false}},FileReader:class{readAsDataURL(file){reads++;this.result='data:'+file.type+';base64,AA==';this.onload();}},Image:class{set src(v){assert.match(v,/^data:image\/(png|webp);base64,/);[this.naturalWidth,this.naturalHeight]=dimensions;this.onload();}}};
 vm.runInNewContext(code,{window});
 const a=window.ggLocalGoliath;
 assert.deepEqual([0,Math.PI/2,Math.PI,-Math.PI/2].map(a.frame),[60,90,0,30]);
 const calls=[],c={save(){},restore(){},rotate(v){calls.push(v)},drawImage(...v){calls.push(v)}};
 assert.equal(a.draw(c,0),false);
 await a.load({type:'image/webp',size:500000});assert.equal(reads,1);
 assert.equal(window.ggClassicPack.draw(c,'sprite:classic-ship-goliath',{angle:Math.PI/2,rotated:true}),true);
 assert.equal(calls[0],-Math.PI/2);assert.deepEqual(calls[1].slice(1,5),[1512,1400,252,200]);
 theme='gold';assert.equal(window.ggClassicPack.draw(c,'sprite:classic-ship-goliath'),false);
 theme='classic';assert.equal(window.ggClassicPack.draw(c,'sprite:classic-ship-phoenix'),false);
 a.clear();assert.equal(window.ggClassicPack.draw(c,'sprite:classic-ship-goliath'),false);assert.equal(fallback,3);
 await assert.rejects(a.load({type:'application/zip',size:1}),/atlas PNG/);
 dimensions=[1664,672];await a.load({type:'image/png',size:900000});assert.equal(reads,2);
 assert.deepEqual([0,Math.PI/2,Math.PI,-Math.PI/2].map(a.frame),[0,8,16,24]);
 calls.length=0;assert.equal(window.ggClassicPack.draw(c,'sprite:classic-ship-goliath',{angle:Math.PI/2,rotated:true}),true);
 assert.deepEqual(calls[1].slice(1,5),[0,168,208,168]);
 dimensions=[1024,1024];await assert.rejects(a.load({type:'image/png',size:10}),/Atlas inválido/);assert.equal(a.loaded(),true);
 dimensions=[1664,1152];await a.load({type:'image/png',size:1500000});
 calls.length=0;assert.equal(a.iris(c,6,Math.PI/2,true),true);assert.equal(calls[0],-Math.PI/2);assert.deepEqual(calls[1].slice(1,5),[960,1092,60,60]);
 for(let rank=1;rank<=6;rank++){calls.length=0;assert.equal(a.iris(c,rank,0,false),true);assert.deepEqual(calls[0].slice(1,5),[((rank-1)%3)*480,792+Math.floor((rank-1)/3)*240,60,60]);}
 // Iris original sheet requires a 16-frame offset at every heading.
 for(let n=0;n<32;n++){const angle=n*Math.PI/16,irisFrame=(n+16)%32;assert.equal(a.frame(angle),n);calls.length=0;assert.equal(a.iris(c,6,angle,true),true);assert.equal(calls[0],-angle);assert.deepEqual(calls[1].slice(1,5),[960+(irisFrame%8)*60,912+Math.floor(irisFrame/8)*60,60,60]);}
 assert.equal(a.rank(c,1),false);
 const before=a.revision();dimensions=[1664,1184];await a.load({type:'image/png',size:1500000});assert.equal(a.revision(),before+1);
 for(let rank=1;rank<=21;rank++){calls.length=0;assert.equal(a.rank(c,rank),true);assert.deepEqual(calls[0].slice(1,5),[rank*16,1152,16,16]);}
 assert.equal(a.rank(c,22),false);assert.equal(a.rank(c,23),false);
 theme='gold';assert.equal(a.rank(c,21),false);theme='classic';
 assert.equal(a.drone(c,'apis',6,null),false);
 dimensions=[1664,6464];await a.load({type:'image/webp',size:4500000});
 const models=['iris','flax','apis','zeus'],designs=[null,'Havoc','Hercules'];
 for(let m=0;m<4;m++)for(let d=0;d<3;d++)for(let rank=1;rank<=6;rank++)for(let n=0;n<32;n++){
  calls.length=0;assert.equal(a.drone(c,models[m],rank,designs[d],n*Math.PI/16,true),true);
  const q=(n+16)%32,r=rank-1,group=(m*3+d)*6+r-6;
  const expected=m===0&&d===0?[(r%3)*480+(q%8)*60,672+Math.floor(r/3)*240+Math.floor(q/8)*60,60,60]:[(group%3)*480+(q%8)*60,1184+Math.floor(group/3)*240+Math.floor(q/8)*60,60,60];
  assert.deepEqual(calls[1].slice(1,5),expected);assert.ok(expected[1]+60<=6464);
 }
 assert.equal(a.drone(c,'iris',6,'Spartan'),false);assert.equal(a.drone(c,'unknown',6,'Havoc'),false);
 assert.equal(a.rank(c,21),true);theme='gold';assert.equal(a.drone(c,'zeus',6,'Havoc'),false);theme='classic';
 theme='gold';assert.equal(a.iris(c,6,0),false);theme='classic';a.clear();assert.equal(a.iris(c,6,0),false);

});
