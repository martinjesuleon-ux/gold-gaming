'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'../public',f),'utf8');
test('special chest visuals use the existing event only; normal loot keys are unchanged',()=>{
 const game=read('game.js'),start=game.indexOf('function pirateVisualKey'),end=game.indexOf('function drawBoxes',start),c={};vm.runInNewContext(game.slice(start,end)+';this.key=pirateVisualKey;',c);
 assert.equal(c.key({kind:'pirate',id:'1'},false),'loot:pirate');assert.equal(c.key({kind:'pirate',id:'1'},true),'loot:pirate-apis');assert.equal(c.key({kind:'pirate',id:'2'},true),'loot:pirate-zeus');for(const kind of ['bonus','cargo','paladio'])assert.equal(c.key({kind,id:'1'},true),'loot:'+kind);
 assert.ok(game.includes("key!=='loot:'+b.kind"));
});
test('local gallery covers all 14 RC79 entries and warns that it is a preview',()=>{const code=read('local-pack-v274.js');for(const key of ['pirate-blue','pirate-red','pirate-gold','pirate-obsidian','pirate-apocalypse','pirate-apis','pirate-zeus','event-halloween','event-christmas'])assert.ok(code.includes("'loot:"+key+"'"));for(const key of ['blue','red','gold','obsidian','apocalypse'])assert.ok(code.includes("'shop:consumables:"+key+"-key'"));assert.match(code,/pendientes de reglas y activación/);});
