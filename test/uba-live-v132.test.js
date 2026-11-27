'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {setTimeout:delay}=require('node:timers/promises');
const {io}=require('socket.io-client');
const {createGame}=require('../server');
async function until(fn,label,ms=12000){const end=Date.now()+ms;while(Date.now()<end){const v=fn();if(v)return v;await delay(100);}throw Error('Timeout: '+label);}
function send(s,event,data){return new Promise((resolve,reject)=>s.timeout(4000).emit(event,data,(err,r)=>err?reject(err):resolve(r)));}
test('two local UBA sockets exchange arena state and return to origin',{timeout:60000},async()=>{
 const oldLobby=process.env.GG_UBA_LOBBY_ENABLED,oldCombat=process.env.GG_UBA_COMBAT_ENABLED;
 process.env.GG_UBA_LOBBY_ENABLED='1';process.env.GG_UBA_COMBAT_ENABLED='1';
 let count=0,stock=100;const results=[],clients=[],states=[{},{}];
 const accounts={
 endpoints(){},close:async()=>{},authenticate:async()=>({id:'fixture-'+(++count),username:'Pilot '+count,ship:'scout',level:14,credits:1000,experience:10000,honor:100}),
 boosterRead:async()=>({}),combatLoadout:async()=>({ship:'phoenix',hp:100000,shield:100000,speed:500,damage:150,absorption:.8,lasers:1,active:0}),
 upgradeStatus:async()=>({upgrades:{}}),assemblyStatus:async()=>({active:{}}),location:async()=>({company:1,company_chosen:true,map:'1-1'}),
 dailyClaim:async()=>({balance:{credits:1000},already:true}),gateStatus:async()=>({gates:[],states:{}}),
 ubaAuthorizeAmmo:async(key,plans)=>Object.fromEntries(plans.map(p=>[p.accountId,--stock])),
 ubaSettle:async(id,winner,loser)=>{results.push({id,winner,loser});return {winnerScore:60,loserScore:50};},
 auctionSettle:async()=>{},collectClanTaxes:async()=>[],clanTags:async()=>[]
 };
 const game=createGame({accounts,npcCount:0,boxCount:0});
 try{
 await new Promise(resolve=>game.server.listen(0,'127.0.0.1',resolve));
 const url='http://127.0.0.1:'+game.server.address().port;
 for(let i=0;i<2;i++){
  const s=io(url,{autoConnect:false,transports:['websocket'],reconnection:false});clients.push(s);
  s.on('v127:ubaState',v=>states[i].lobby=v);s.on('v129:arena',v=>states[i].arena=v);s.on('state',v=>states[i].world=v);s.connect();
  await until(()=>s.connected,'connected');assert.equal((await send(s,'join',{})).ok,true);
 }
 const [a,b]=clients;await until(()=>states.every(v=>v.world?.players?.length),'world');
 assert.equal((await send(a,'v127:uba',{action:'join'})).ok,true);assert.equal((await send(b,'v127:uba',{action:'join'})).ok,true);
 const m=await until(()=>states[0].lobby?.match,'offer');
 for(const s of clients)assert.equal((await send(s,'v127:uba',{action:'accept',matchId:m.id})).ok,true);
 await until(()=>states.every(v=>v.arena?.fighters?.length===2),'arena',22000);
 const other=states[0].arena.fighters.find(p=>p.id===b.id);assert.equal(other.stock,undefined);
 assert.equal((await send(a,'v14:jump','invalid')).ok,false);
 assert.equal((await send(a,'v129:arenaCommand',{action:'ammo',code:'MCB-50'})).ok,true);
 assert.equal((await send(a,'v129:arenaCommand',{action:'move',x:other.x,y:other.y})).ok,true);
 assert.equal((await send(a,'v129:arenaCommand',{action:'attack',on:true})).ok,true);
 await until(()=>stock<100,'shot',16000);
 assert.equal((await send(b,'v127:uba',{action:'leave'})).ok,true);
 await until(()=>results.length===1,'settlement');
 assert.equal(results[0].winner,'fixture-1');assert.equal(results[0].loser,'fixture-2');
 await until(()=>states.every(v=>v.arena===null&&v.world?.map==='1-1'),'return');
 }finally{
 for(const s of clients)s.disconnect();await game.close();
 if(oldLobby===undefined)delete process.env.GG_UBA_LOBBY_ENABLED;else process.env.GG_UBA_LOBBY_ENABLED=oldLobby;
 if(oldCombat===undefined)delete process.env.GG_UBA_COMBAT_ENABLED;else process.env.GG_UBA_COMBAT_ENABLED=oldCombat;
 }
});
