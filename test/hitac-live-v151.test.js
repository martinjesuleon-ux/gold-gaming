'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {setTimeout:delay}=require('node:timers/promises'),{io}=require('socket.io-client'),{createGame}=require('../server');
async function until(fn,label,ms=12000){const end=Date.now()+ms;while(Date.now()<end){const v=fn();if(v)return v;await delay(100);}throw Error('Timeout: '+label);}
function send(s,event,data){return new Promise((resolve,reject)=>s.timeout(4000).emit(event,data,(err,r)=>err?reject(err):resolve(r)));}
test('Two local sockets: Hitac is map-scoped, admin protected and consumes only eligible pilot ammo',{timeout:30000},async()=>{
 const flags=['GG_HITAC_ENABLED','GG_HITAC_REWARDS_ENABLED','GG_HITAC_LOTTERY_ENABLED'],old=Object.fromEntries(flags.map(k=>[k,process.env[k]]));for(const k of flags)delete process.env[k];
 let count=0;const clients=[],states=[{},{}],debits=[];
 const accounts={endpoints(){},close:async()=>{},authenticate:async()=>({id:'fixture-'+(++count),username:'Pilot '+count,ship:'scout',level:14,credits:1000,experience:10000,honor:100}),boosterRead:async()=>({}),combatLoadout:async()=>({ship:'phoenix',hp:10000000,shield:10000000,speed:4000,damage:150,absorption:.8,lasers:1,active:0}),upgradeStatus:async()=>({upgrades:{}}),assemblyStatus:async()=>({active:{}}),location:async id=>({company:3,company_chosen:true,map:id==='fixture-1'?'3-4':'3-3'}),dailyClaim:async()=>({balance:{credits:1000},already:true}),gateStatus:async()=>({gates:[],states:{}}),upgradedShot:async(accountId,code,count,slot)=>{assert.equal(slot,'laser');debits.push({accountId,code,count});return {stock:100-debits.length,factor:1,upgrades:{},resources:{}};},auctionSettle:async()=>{},collectClanTaxes:async()=>[],clanTags:async()=>[]};
 const game=createGame({accounts,password:'local-fixture-only',npcCount:0,boxCount:0});
 try{await new Promise(resolve=>game.server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+game.server.address().port;
 const admin=(action,auth=true)=>fetch(url+'/api/admin/hitac',{method:'POST',headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer local-fixture-only'}:{})},body:JSON.stringify({action})});
 assert.equal((await admin('start',false)).status,401);assert.equal((await admin('start')).status,403);process.env.GG_HITAC_ENABLED='1';
 for(let i=0;i<2;i++){const s=io(url,{autoConnect:false,transports:['websocket'],reconnection:false});clients.push(s);s.on('state',v=>states[i].world=v);s.connect();await until(()=>s.connected,'connected');assert.equal((await send(s,'join',{})).ok,true);}
 await until(()=>states.every(v=>v.world?.players?.length),'world');assert.equal((await admin('start')).status,200);assert.equal((await admin('start')).status,409);
 const e=await until(()=>states[0].world?.hitac,'convoy');assert.equal(e.units.length,7);assert.equal(states[1].world.hitac,null);
 const boss=e.units.find(u=>u.name==='Hitac Mothership'),[a,b]=clients,target='hitac:'+boss.id;
 b.emit('select',target);b.emit('attack',true);await delay(300);assert.equal(states[1].world.players[0].target,null);
 const latest=()=>states[0].world?.hitac?.units.find(u=>u.id===boss.id);
 a.emit('move',{x:boss.x+200,y:boss.y});await until(()=>{const p=states[0].world?.players.find(p=>p.id===a.id),u=latest();return p&&u&&Math.hypot(p.x-u.x,p.y-u.y)<500;},'pilot near convoy');
 a.emit('select',target);await until(()=>states[0].world.players.find(p=>p.id===a.id)?.target===target,'target accepted');a.emit('attack',true);await until(()=>debits.length>0,'paid shot');assert.ok(debits.every(p=>p.accountId==='fixture-1'&&p.count===1));
 assert.equal((await admin('stop')).status,200);await until(()=>states[0].world.hitac===null,'event stopped');
 }finally{for(const s of clients)s.disconnect();await game.close();for(const k of flags){if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];}}
});
