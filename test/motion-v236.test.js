'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {record,position,angle}=require('../public/motion-v236');
const p=(x,y=0,angle=0)=>({x,y,angle});
test('remote movement fills the gaps between authoritative snapshots',()=>{
 let h=record(null,p(0),1000,0);h=record(h,p(100),1100,100);
 assert.equal(position(h,170).x,50);assert.equal(position(h,190).x,70);
});
test('local visual lead is bounded during dropped packets',()=>{
 let h=record(null,p(0),1000,0);h=record(h,p(100),1100,100);
 assert.equal(position(h,120,true).x,120);assert.equal(position(h,900,true).x,148);
 assert.equal(position(h,1000,true).x,148);
});
test('stopped ships do not continue to drift',()=>{
 let h=record(null,p(40),1000,0);h=record(h,p(40),1100,100);
 assert.equal(position(h,500,true).x,40);
});
test('rotation uses the shortest angular path',()=>assert.ok(Math.abs(angle(Math.PI-.1,-Math.PI+.1,.5)-Math.PI)<1e-8));
test('stale packets do not replace history; long gaps and teleports reset it',()=>{
 let h=record(null,p(0),1000,0);h=record(h,p(100),1100,100);
 assert.equal(record(h,p(99),1050,120),h);assert.equal(h.samples.length,2);
 h=record(h,p(5000),1200,200);assert.equal(h.samples.length,1);assert.equal(position(h,200).x,5000);
 h=record(h,p(5001),2200,1200);assert.equal(h.samples.length,1);
});
test('history stays bounded and render clock does not reverse on jitter',()=>{
 let h=null;for(let i=0;i<30;i++)h=record(h,p(i*10),1000+i*100,i*100+(i%2)*25);
 assert.equal(h.samples.length,8);const a=position(h,2950);const b=position(h,2940);assert.ok(b.x>=a.x);
});
test('render integration leaves server data untouched and loads helper first',()=>{
 const game=fs.readFileSync(require.resolve('../public/game.js'),'utf8'),html=fs.readFileSync(require.resolve('../public/index.html'),'utf8');
 assert.ok(game.includes('ggMotion236?.record'));assert.ok(game.includes('ggMotion236?.position'));
 assert.ok(html.indexOf('motion-v236.js')<html.indexOf('game.js?v=2360'));assert.ok(game.includes('old.data=o'));
});
