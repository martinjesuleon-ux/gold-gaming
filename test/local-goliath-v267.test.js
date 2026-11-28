'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const code=fs.readFileSync(require('node:path').join(__dirname,'../public/local-goliath-v267.js'),'utf8');
test('local Goliath matches atlas headings, never changes GOLD, and restores fallback',async()=>{
 let theme='classic',revoked=0,fallback=0,dimensions=[3024,2000];
 const window={ggVisualTheme:{current:()=>theme},ggClassicPack:{draw(){fallback++;return false},shop(){return false}},URL:{createObjectURL:()=> 'blob:local',revokeObjectURL(){revoked++}},Image:class{set src(v){[this.naturalWidth,this.naturalHeight]=dimensions;this.onload();}}};
 vm.runInNewContext(code,{window});
 const a=window.ggLocalGoliath;
 assert.deepEqual([0,Math.PI/2,Math.PI,-Math.PI/2].map(a.frame),[60,90,0,30]);
 const calls=[],c={save(){},restore(){},rotate(v){calls.push(v)},drawImage(...v){calls.push(v)}};
 assert.equal(a.draw(c,0),false);
 await a.load({type:'image/webp',size:500000});assert.equal(revoked,1);
 assert.equal(window.ggClassicPack.draw(c,'sprite:classic-ship-goliath',{angle:Math.PI/2,rotated:true}),true);
 assert.equal(calls[0],-Math.PI/2);assert.deepEqual(calls[1].slice(1,5),[1512,1400,252,200]);
 theme='gold';assert.equal(window.ggClassicPack.draw(c,'sprite:classic-ship-goliath'),false);
 theme='classic';assert.equal(window.ggClassicPack.draw(c,'sprite:classic-ship-phoenix'),false);
 a.clear();assert.equal(window.ggClassicPack.draw(c,'sprite:classic-ship-goliath'),false);assert.equal(fallback,3);
 await assert.rejects(a.load({type:'application/zip',size:1}),/atlas PNG/);
 dimensions=[1664,672];await a.load({type:'image/png',size:900000});assert.equal(revoked,2);
 assert.deepEqual([0,Math.PI/2,Math.PI,-Math.PI/2].map(a.frame),[16,24,0,8]);
 calls.length=0;assert.equal(window.ggClassicPack.draw(c,'sprite:classic-ship-goliath',{angle:Math.PI/2,rotated:true}),true);
 assert.deepEqual(calls[1].slice(1,5),[0,504,208,168]);
 dimensions=[1024,1024];await assert.rejects(a.load({type:'image/png',size:10}),/Atlas inválido/);assert.equal(a.loaded(),true);

});
