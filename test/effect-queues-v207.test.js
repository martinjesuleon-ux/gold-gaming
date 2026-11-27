'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
test('effect queues stay bounded even without rendering and discard expired entries',()=>{
 const src=fs.readFileSync(path.join(__dirname,'../public/game.js'),'utf8');
 const a=src.indexOf('function pruneEffects('),b=src.indexOf('function drawLasers(',a);
 assert.ok(a>=0&&b>a);
 const append=vm.runInNewContext(src.slice(a,b)+';appendEffect');
 const items=[];
 for(let i=0;i<1000;i++)append(items,{x:i,y:20},850,64,100);
 assert.equal(items.length,64);assert.equal(items[0].x,936);assert.equal(items[63].x,999);
 append(items,{x:1000,y:20},850,64,950);assert.equal(items.length,1);assert.equal(items[0].x,1000);
 append(items,{x:NaN,y:2},850,64,951);append(items,null,850,64,951);assert.equal(items.length,1);
});
