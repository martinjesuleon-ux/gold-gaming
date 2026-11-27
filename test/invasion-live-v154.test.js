'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {setTimeout:delay}=require('node:timers/promises'),{randomUUID}=require('node:crypto'),{io}=require('socket.io-client'),{createGame}=require('../server'),invasion=require('../invasion-v134');
async function until(fn,label,ms=12000){const end=Date.now()+ms;while(Date.now()<end){const v=fn();if(v)return v;await delay(100);}throw Error('Timeout: '+label);}
function send(s,event,data){return new Promise((resolve,reject)=>s.timeout(4000).emit(event,data,(err,r)=>err?reject(err):resolve(r)));}
test('Invasion: local sockets, isolated combat, paid ammo, abandonment and persisted roster',{timeout:45000},async()=>{
 const flags=['GG_INVASION_LOBBY_ENABLED','GG_INVASION_COMBAT_ENABLED'],old=Object.fromEntries(flags.map(k=>[k,process.env[k]]));for(const k of flags)delete process.env[k];
 const original=invasion.createAdmission;let fixture;invasion.createAdmission=(...args)=>{const lobby=original(...args),open=lobby.open;lobby.open=(...a)=>(fixture=open(...a));return lobby;};
 const ids=[randomUUID(),randomUUID(),randomUUID()],clients=[],states=[{},{},{}],debits=[],settlements=[];let count=0;
 const accounts={endpoints(){},close:async()=>{},authenticate:async()=>{const i=count++;return {id:ids[i],username:'Invasion pilot '+i,ship:'scout',level:i===2?4:8,credits:1000,experience:10000,honor:100};},boosterRead:async()=>({}),combatLoadout:async()=>({ship:'phoenix',hp:10000000,shield:10000000,speed:4000,damage:1500000,absorption:.8,lasers:1,active:0}),upgradeStatus:async()=>({upgrades:{}}),assemblyStatus:async()=>({active:{}}),location:async()=>({company:1,company_chosen:true,map:'1-1'}),dailyClaim:async()=>({balance:{credits:1000},already:true}),gateStatus:async()=>({gates:[],states:{}}),consumeAmmo:async(id,code,count)=>{debits.push({id,code,count});return 100-debits.length;},invasionSettle:async result=>{settlements.push(result);return {saved:true,duplicate:false};},auctionSettle:async()=>{},collectClanTaxes:async()=>[],clanTags:async()=>[]};
 const game=createGame({accounts,password:'local-fixture-only',npcCount:0,boxCount:0});
 try{await new Promise(resolve=>game.server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+game.server.address().port;
 const admin=(auth=true)=>fetch(url+'/api/admin/invasion',{method:'POST',headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer local-fixture-only'}:{})},body:JSON.stringify({difficulty:'easy'})});
 assert.equal((await admin(false)).status,401);assert.equal((await admin()).status,403);process.env.GG_INVASION_LOBBY_ENABLED='1';process.env.GG_INVASION_COMBAT_ENABLED='1';
 for(let i=0;i<3;i++){const s=io(url,{autoConnect:false,transports:['websocket'],reconnection:false});clients.push(s);s.on('state',v=>states[i].world=v);s.on('v136:invasionState',v=>states[i].arena=v);s.connect();await until(()=>s.connected,'connected');assert.equal((await send(s,'join',{})).ok,true);}
 await until(()=>states.every(v=>v.world?.players?.length),'world');assert.equal((await admin()).status,200);
 const [a,b,c]=clients;assert.equal((await send(c,'v135:invasion',{action:'join'})).ok,false);
 for(const s of [a,b])assert.equal((await send(s,'v135:invasion',{action:'join'})).ok,true);
 fixture.entryUntil=Date.now()-10;
 await until(()=>states.slice(0,2).every(v=>v.arena?.players?.length===2&&v.arena.aliens.length===20),'arena');assert.equal(states[2].arena,undefined);
 assert.equal((await send(a,'v14:jump','invalid')).ok,false);
 const target=states[0].arena.aliens[0];assert.equal((await send(a,'v136:invasionCommand',{action:'target',id:target.id})).ok,true);
 assert.equal((await send(a,'v136:invasionCommand',{action:'move',x:target.x,y:target.y})).ok,true);
 assert.equal((await send(a,'v136:invasionCommand',{action:'attack',on:true})).ok,true);
 await until(()=>debits.length>0,'paid shot');assert.ok(debits.every(q=>q.id===ids[0]&&q.count===1));
 await until(()=>states[0].arena.scores.some(q=>q.id===a.id&&q.points>0),'damage points');
 assert.equal(states[0].arena.players.find(p=>p.id===b.id).stock,undefined);
 for(const s of [a,b])assert.equal((await send(s,'v135:invasion',{action:'leave'})).ok,true);
 await until(()=>settlements.length===1,'settlement');assert.equal(settlements[0].phase,'cancelled');assert.equal(settlements[0].pilots.length,2);assert.ok(settlements[0].pilots.every(p=>p.left));
 await until(()=>states.slice(0,2).every(v=>v.arena===null&&v.world?.map==='1-1'),'return');
 }finally{for(const s of clients)s.disconnect();await game.close();invasion.createAdmission=original;for(const k of flags){if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];}}
});
