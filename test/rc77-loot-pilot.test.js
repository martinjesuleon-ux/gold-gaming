'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=n=>fs.readFileSync(path.join(__dirname,'../public',n),'utf8');
test('classic cargo becomes orange, bonus becomes gold; other art and alpha stay unchanged',()=>{
 const window={ggClassicPack:{draw(){},shop(){},cover(){}}};vm.runInNewContext(read('local-pack-v274.js'),{window});
 const original=[30,150,220,255,255,255,255,128,15,120,200,0,210,95,20,255];
 for(const [key,expected] of [['loot:cargo',[220,121,30,255]],['loot:bonus',[220,174,30,255]],['loot:paladio',original.slice(0,4)]]){
  const data=new Uint8ClampedArray(original);window.ggLocalPack.warmLootPixels(data,key);
  assert.deepEqual([...data],expected.concat(original.slice(4)));
 }
});
test('incorrect local skill assignments are bypassed and names are visible',()=>{
 const code=read('gold-v13.js');assert.ok(code.includes("!['alien','optics','absorption'].includes(k.id)"));assert.ok(code.includes("id==='alien'"));assert.ok(code.includes("el('span',k.name,'gg-pilot-skill-name')"));
 assert.match(read('gold-v13.css'),/grid-template-rows:auto minmax/);
});
