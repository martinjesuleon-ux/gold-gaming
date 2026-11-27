'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {setTimeout:delay}=require('node:timers/promises'),{randomUUID}=require('node:crypto'),{io}=require('socket.io-client'),{createGame}=require('../server'),spaceball=require('../spaceball-v138');
async function until(fn,label,ms=12000){const end=Date.now()+ms;while(Date.now()<end){const v=fn();if(v)return v;await delay(100);}throw Error('Timeout: '+label);}
function send(s,event,data){return new Promise((resolve,reject)=>s.timeout(4000).emit(event,data,(err,r)=>err?reject(err):resolve(r)));}
test('Spaceball: real local sockets, rival goal, map isolation and unique box collection',{timeout:45000},async()=>{
 const flags=['GG_SPACEBALL_ENABLED','GG_SPACEBALL_CLAIMS_ENABLED'],old=Object.fromEntries(flags.map(k=>[k,process.env[k]]));for(const k of flags)delete process.env[k];
 const original=spaceball.createGame;let fixture;spaceball.createGame=(...args)=>(fixture=original(...args));
 const ids=[randomUUID(),randomUUID(),randomUUID()],clients=[],states=[{},{},{}],debits=[],claims=[];let count=0;
 const accounts={endpoints(){},close:async()=>{},authenticate:async()=>{const i=count++;return {id:ids[i],username:'Ball pilot '+i,ship:'scout',level:14,credits:1000,experience:10000,honor:100};},boosterRead:async()=>({}),combatLoadout:async()=>({ship:'phoenix',hp:10000000,shield:10000000,speed:4000,damage:150,absorption:.8,lasers:1,active:0}),upgradeStatus:async()=>({upgrades:{}}),assemblyStatus:async()=>({active:{}}),location:async id=>({company:1,company_chosen:true,map:id===ids[2]?'3-3':'4-4'}),dailyClaim:async()=>({balance:{credits:1000},already:true}),gateStatus:async()=>({gates:[],states:{}}),ubaAuthorizeAmmo:async(key,plans)=>{debits.push(...plans);return Object.fromEntries(plans.map(p=>[p.accountId,100-debits.length]));},spaceballClaim:async(id,eventId,boxId,rewards)=>{assert.ok(!claims.some(q=>q.boxId===boxId));claims.push({id,eventId,boxId,rewards});return {balance:{credits:1000+rewards.credits},rewards};},auctionSettle:async()=>{},collectClanTaxes:async()=>[],clanTags:async()=>[]};
 const game=createGame({accounts,password:'local-fixture-only',npcCount:0,boxCount:0});
 try{await new Promise(resolve=>game.server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+game.server.address().port;
 const admin=(action,auth=true)=>fetch(url+'/api/admin/spaceball',{method:'POST',headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer local-fixture-only'}:{})},body:JSON.stringify({action})});
 assert.equal((await admin('start',false)).status,401);assert.equal((await admin('start')).status,403);process.env.GG_SPACEBALL_ENABLED='1';process.env.GG_SPACEBALL_CLAIMS_ENABLED='1';
 for(let i=0;i<3;i++){const s=io(url,{autoConnect:false,transports:['websocket'],reconnection:false});clients.push(s);s.on('state',v=>states[i].world=v);s.connect();await until(()=>s.connected,'connected');assert.equal((await send(s,'join',{})).ok,true);}
 await until(()=>states.every(v=>v.world?.players?.length),'world');assert.equal((await admin('start')).status,200);assert.equal((await admin('start')).status,409);
 await until(()=>states.slice(0,2).every(v=>v.world?.spaceball?.ball),'ball');assert.equal(states[2].world.spaceball,null);
 const [a,b,c]=clients,target='event:spaceball';
 c.emit('select',target);c.emit('attack',true);await delay(250);assert.equal(states[2].world.players[0].target,null);
 // Place the private fixture ball 165px from a rival goal, along its inward normal.
 const goal=fixture.goals.find(g=>g.company!==1),dx=fixture.w/2-goal.x,dy=fixture.h/2-goal.y,len=Math.hypot(dx,dy),ux=dx/len,uy=dy/len;
 fixture.ball={x:goal.x+ux*165,y:goal.y+uy*165};const pos={x:goal.x+ux*400,y:goal.y+uy*400};
 a.emit('move',pos);await until(()=>{const p=states[0].world.players.find(x=>x.id===a.id);return p&&Math.hypot(p.x-pos.x,p.y-pos.y)<12;},'pilot at rival goal');
 a.emit('select',target);await until(()=>states[0].world.players.find(p=>p.id===a.id)?.target===target,'target accepted');a.emit('attack',true);
 await until(()=>states[0].world.spaceball?.scores[1]===1,'goal scored');a.emit('attack',false);
 assert.ok(debits.length>=1);assert.ok(debits.every(p=>p.accountId===ids[0]&&p.count===1));assert.equal(fixture.boxes.size+claims.length,15);
 assert.equal(states[0].world.spaceball.ball,null);assert.equal(states[1].world.spaceball.scores[1],1);
 const box=[...fixture.boxes.values()].find(x=>!x.pending);assert.ok(box);assert.ok(states[0].world.spaceball.boxes.every(q=>!Object.hasOwn(q,'rewards')));
 a.emit('move',{x:box.x,y:box.y});b.emit('move',{x:box.x,y:box.y});await until(()=>claims.some(q=>q.boxId===box.id),'crate pickup');
 assert.equal(claims.filter(q=>q.boxId===box.id).length,1);for(const [k,[min,max]] of Object.entries(spaceball.REWARDS)){const n=claims.find(q=>q.boxId===box.id).rewards[k];assert.ok(n>=min&&n<=max);}
 await until(()=>states[0].world.spaceball?.ball,'reset',15000);
 assert.equal((await admin('stop')).status,200);await until(()=>states[0].world.spaceball===null,'stopped');
 }finally{for(const s of clients)s.disconnect();await game.close();spaceball.createGame=original;for(const k of flags){if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];}}
});
