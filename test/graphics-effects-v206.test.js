'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const src=fs.readFileSync(path.join(__dirname,'../public/game.js'),'utf8');
test('effect compaction preserves live object identities and expiration boundaries',()=>{
 const a=src.indexOf('function pruneEffects('),b=src.indexOf('function drawLasers(',a);
 assert.ok(a>=0&&b>a);
 const prune=vm.runInNewContext(src.slice(a,b)+';pruneEffects');
 const old={born:20},live={born:40},fresh={born:90},items=[old,live,fresh];
 prune(items,100,65);assert.equal(items.length,2);assert.equal(items[0],live);assert.equal(items[1],fresh);
 prune(items,155,65);assert.equal(items.length,0);prune(items,200,65);assert.equal(items.length,0);
 assert.ok(src.includes("label=d.renderLabel??(d.renderLabel=fmt(d.amount))"));
 assert.ok(src.includes("entities.get('n'+d.targetId)||entities.get('p'+d.targetId)"));
});