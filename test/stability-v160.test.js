'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{runMaintenance,onceAsync}=require('../stability-v160');
test('maintenance continues after independent task failure',async()=>{
 const seen=[],errors=[];
 const failed=await runMaintenance([['rewards',async()=>{seen.push('rewards');throw Error('offline');}],['progress',async()=>seen.push('progress')],['clans',async()=>seen.push('clans')]],(name,e)=>errors.push([name,e.message]));
 assert.deepEqual(seen,['rewards','progress','clans']);assert.deepEqual(failed,['rewards']);assert.deepEqual(errors,[['rewards','offline']]);
});
test('concurrent and later shutdown requests share a single completion',async()=>{
 let calls=0;const close=onceAsync(async()=>{calls++;return 'closed';});const a=close(),b=close();assert.equal(a,b);assert.equal(await a,'closed');assert.equal(await close(),'closed');assert.equal(calls,1);
});
test('health probes use lightweight database check, never migration, and recover after outage',{timeout:15000},async()=>{
 const {createGame}=require('../server');let probes=0,ready=0,closed=0,fail=false;
 const accounts={health:async()=>{probes++;if(fail)throw Error('offline');},ready:async()=>{ready++;},endpoints(){},close:async()=>{closed++;},auctionSettle:async()=>{},collectClanTaxes:async()=>[],clanTags:async()=>[]};
 const game=createGame({accounts,password:'fixture-only',npcCount:0,boxCount:0});
 try{await new Promise(resolve=>game.server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+game.server.address().port+'/health';
 let r=await fetch(url);assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');assert.equal((await r.json()).database,true);
 fail=true;r=await fetch(url);assert.equal(r.status,503);assert.deepEqual(await r.json(),{ok:false,database:false});
 fail=false;assert.equal((await fetch(url)).status,200);assert.equal(probes,3);assert.equal(ready,0);
 }finally{await Promise.all([game.close(),game.close()]);}
 assert.equal(closed,1);
});
