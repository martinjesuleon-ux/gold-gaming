'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {groupByZone}=require('../npc-targeting-v163');
test('mine checks preserve zone isolation, expiration and blast behavior',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../server.js'),'utf8');
 const start=source.indexOf(' function updateMines(now){'),end=source.indexOf(' function initMap(zone){',start);
 assert.ok(start>=0&&end>start);
 const pilot={id:'p',zone:'5-1',x:0,y:0,hp:100,shield:0};
 const other={id:'q',zone:'5-3',x:0,y:0,hp:100,shield:0};
 const npc={id:'n',zone:'5-1',x:0,y:0,hp:100,shield:0};
 const players=new Map([['p',pilot],['q',other]]),npcs=new Map([['n',npc]]);
 const mines=new Map([['expired',{id:'expired',zone:'5-1',x:0,y:0,expires:10}],['live',{id:'live',zone:'5-1',x:0,y:0,expires:Infinity,armedAt:0,code:'ACM-01'}],['remote',{id:'remote',zone:'4-4',x:0,y:0,expires:Infinity,armedAt:0,code:'ACM-01'}]]);
 let blasts=0,respawns=0;
 const update=vm.runInNewContext(source.slice(start,end)+';updateMines',{players,npcs,mines,groupByZone,safeZone:()=>false,immune:()=>false,MR:{triggerRadius:10,blastRadius:20},MINES:[{id:'ACM-01',fraction:.2}],distance:(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),mineImpact:v=>({hp:v.hp-20}),io:{to:()=>({emit:()=>blasts++})},later:()=>respawns++});
 update(100);
 assert.equal(pilot.hp,80);assert.equal(other.hp,100);assert.equal(npc.hp,100);
 assert.equal(mines.has('expired'),false);assert.equal(mines.has('live'),false);assert.equal(mines.has('remote'),true);
 assert.equal(blasts,1);assert.equal(respawns,1);
});
