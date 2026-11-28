'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {setTimeout:delay}=require('node:timers/promises'),{randomUUID}=require('node:crypto'),{io}=require('socket.io-client'),{createGame}=require('../server'),ice=require('../ice-v146');
async function until(fn,label,ms=12000){const end=Date.now()+ms;while(Date.now()<end){const v=fn();if(v)return v;await delay(100);}throw Error('Timeout: '+label);}
function send(s,event,data){return new Promise((resolve,reject)=>s.timeout(4000).emit(event,data,(err,r)=>err?reject(err):resolve(r)));}
test('Ice event: local sockets, countdown, isolation, paid shots, shared settlement and box pickup',{timeout:45000},async()=>{
 const flags=['GG_ICE_ENABLED','GG_ICE_REWARDS_ENABLED'],old=Object.fromEntries(flags.map(k=>[k,process.env[k]]));for(const k of flags)delete process.env[k];
 const original=ice.createEvent;let fixtureEvent;ice.createEvent=(...args)=>(fixtureEvent=original(...args));
 const ids=[randomUUID(),randomUUID(),randomUUID()],clients=[],states=[{},{},{}],debits=[],settlements=[],claims=[];let count=0;
 const accounts={endpoints(){},close:async()=>{},authenticate:async()=>{const i=count++;return {id:ids[i],username:'Ice pilot '+i,ship:'scout',level:14,credits:1000,experience:10000,honor:100};},boosterRead:async()=>({}),combatLoadout:async()=>({ship:'phoenix',hp:10000000,shield:10000000,speed:4000,damage:1500000,absorption:.8,lasers:1,active:0}),upgradeStatus:async()=>({upgrades:{}}),assemblyStatus:async()=>({active:{}}),location:async id=>({company:3,company_chosen:true,map:id===ids[2]?'3-3':'4-5'}),dailyClaim:async()=>({balance:{credits:1000},already:true}),gateStatus:async()=>({gates:[],states:{}}),upgradedShot:async(accountId,code,count,slot)=>{assert.equal(slot,'laser');debits.push({accountId,code,count});return {stock:100-debits.length,factor:1,upgrades:{},resources:{}};},iceSettle:async(id,contributors)=>{settlements.push({id,contributors});return {duplicate:false,rewards:ice.shares(new Map(contributors.map(p=>[p.accountId,p.damage])))};},iceBoxClaim:async(id,eventId,boxId)=>{claims.push({id,eventId,boxId});return {duplicate:false,uridium:2000};},auctionSettle:async()=>{},collectClanTaxes:async()=>[],clanTags:async()=>[]};
 const game=createGame({accounts,password:'local-fixture-only',npcCount:0,boxCount:0});
 try{await new Promise(resolve=>game.server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+game.server.address().port;
 const admin=(action,auth=true)=>fetch(url+'/api/admin/ice',{method:'POST',headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer local-fixture-only'}:{})},body:JSON.stringify({action,map:'4-5'})});
 assert.equal((await admin('start',false)).status,401);assert.equal((await admin('start')).status,403);process.env.GG_ICE_ENABLED='1';process.env.GG_ICE_REWARDS_ENABLED='1';
 for(let i=0;i<3;i++){const s=io(url,{autoConnect:false,transports:['websocket'],reconnection:false});clients.push(s);s.on('state',v=>states[i].world=v);s.connect();await until(()=>s.connected,'connected');assert.equal((await send(s,'join',{})).ok,true);}
 await until(()=>states.every(v=>v.world?.players?.length),'world');assert.equal((await admin('start')).status,200);assert.equal((await admin('start')).status,409);
 await until(()=>states.slice(0,2).every(v=>v.world?.ice?.phase==='countdown'),'countdown');
 assert.equal(states[2].world.ice,null);const [a,b,c]=clients,target='ice:'+fixtureEvent.boss.id;
 a.emit('select',target);a.emit('attack',true);await delay(300);assert.equal(debits.length,0);
 // Accelerate only the private test fixture, without exposing a production clock override.
 fixtureEvent.startAt=Date.now()-10;fixtureEvent.nextSpawn=Date.now()+100;fixtureEvent.nextPing=Date.now()+100;
 await until(()=>states[0].world?.ice?.phase==='active'&&states[0].world.ice.icy.length>0,'active and Icy');
 c.emit('select',target);c.emit('attack',true);await delay(250);assert.equal(states[2].world.players[0].target,null);
 a.emit('select',target);await until(()=>states[0].world.players.find(p=>p.id===a.id)?.target===target,'first target');a.emit('attack',true);
 await until(()=>fixtureEvent.contributors.has(ids[0]),'first damage');a.emit('attack',false);
 await until(()=>states[0].world.players.find(p=>p.id===a.id)?.attack===false,'first stopped');
 b.emit('select',target);await until(()=>states[1].world.players.find(p=>p.id===b.id)?.target===target,'second target');b.emit('attack',true);
 await until(()=>settlements.length===1&&fixtureEvent.settled,'shared settlement',20000);
 assert.deepEqual(new Set(settlements[0].contributors.map(p=>p.accountId)),new Set(ids.slice(0,2)));assert.ok(debits.every(p=>p.accountId!==ids[2]&&p.count===1));
 assert.equal(fixtureEvent.boxes.size+claims.length,15);const box=[...fixtureEvent.boxes.values()].find(x=>!x.pending);assert.ok(box);a.emit('move',{x:box.x,y:box.y});await until(()=>claims.some(q=>q.boxId===box.id),'crate pickup');
 assert.equal(claims.filter(q=>q.boxId===box.id).length,1);assert.equal((await admin('stop')).status,200);await until(()=>states[0].world.ice===null,'stopped');
 }finally{for(const s of clients)s.disconnect();await game.close();ice.createEvent=original;for(const k of flags){if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];}}
});
