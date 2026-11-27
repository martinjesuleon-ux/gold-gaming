'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const {io}=require('socket.io-client');const {createGame,SHIPS}=require('../server');const {createAccounts}=require('../accounts');const {randomUUID}=require('node:crypto');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,ms=6500){const deadline=Date.now()+ms;while(Date.now()<deadline){const result=fn();if(result)return result;await sleep(40);}throw Error('Tiempo de espera agotado');}
const event=(s,name,data)=>s.timeout(3000).emitWithAck(name,data);
test('dos pilotos, movimiento, administración, combate y desconexión',{skip:!process.env.DATABASE_URL},async t=>{
 const accounts=createAccounts(process.env.DATABASE_URL);await accounts.ready();const g=createGame({password:'test-only-secret',npcCount:0,boxCount:0,accounts});await new Promise(r=>g.server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+g.server.address().port;
 const clients=[];t.after(async()=>{for(const c of clients)c.disconnect();await g.close();});
 const connect=async(cookie)=>{const s=io(url,{transports:['websocket'],forceNew:true,reconnection:false,extraHeaders:cookie?{Cookie:cookie}:{}});clients.push(s);await new Promise((r,j)=>{s.once('connect',r);s.once('connect_error',j);});return s;};
 const register=async(ship)=>{const name='P'+randomUUID().replaceAll('-','').slice(0,12);const res=await fetch(url+'/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:name,email:name+'@example.test',password:'test-only-password',ship})});assert.equal(res.status,200);return res.headers.get('set-cookie').split(';')[0];};
 const cookieA=await register('scout'),cookieB=await register('tank');
 const guest=await connect(),a=await connect(cookieA),b=await connect(cookieB);let snapshot,other;a.on('state',s=>snapshot=s);b.on('state',s=>other=s);
 assert.equal((await fetch(url+'/health')).status,200);assert.equal((await fetch(url+'/admin')).status,200);assert.equal((await fetch(url+'/socket.io/socket.io.js')).status,200);
 assert.equal((await event(guest,'join',{name:'<script>',ship:'scout'})).ok,false);
 assert.equal((await event(a,'join',{name:'Pilot A',ship:'scout'})).ok,true);
 const duplicate=await connect(cookieA);assert.equal((await event(duplicate,'join',{})).ok,false);
 assert.equal((await event(b,'join',{name:'Pilot B',ship:'tank'})).ok,true);
 const pilot=()=>snapshot?.players.find(p=>p.id===a.id);await until(()=>snapshot?.players.length===2&&other?.players.length===2);
 assert.equal(pilot().maxHp,SHIPS.scout.hp);assert.equal(snapshot.players.find(p=>p.id===b.id).maxHp,SHIPS.tank.hp);
 const initial=pilot().x;a.emit('move',{x:initial+150,y:pilot().y});await until(()=>pilot().x>initial+100);await sleep(350);assert.ok(Math.abs(pilot().x-initial-150)<3);
 a.emit('move',{x:'no',y:0});await sleep(150);assert.ok(Math.abs(pilot().x-initial-150)<3);
 const api=(route,body,pass='test-only-secret')=>fetch(url+'/api/admin/'+route,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+pass,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
 assert.equal((await api('players',undefined,'wrong')).status,401);assert.equal((await api('credits',{playerId:a.id,amount:-5})).status,400);assert.equal((await api('credits',{playerId:a.id,amount:1000},'wrong')).status,401);
 const initialCredits=pilot().credits;a.emit('credits',{amount:999999});await sleep(150);assert.equal(pilot().credits,initialCredits);
 assert.equal((await api('credits',{playerId:a.id,amount:1234})).status,200);await until(()=>pilot().credits===initialCredits+1234&&other?.players.find(p=>p.id===a.id)?.credits===initialCredits+1234);
 const boss=await (await api('boss',{playerId:a.id})).json();assert.equal(boss.ok,true);const getBoss=()=>snapshot?.npcs.find(n=>n.id===boss.id);await until(getBoss);a.emit('move',{x:boss.x-300,y:boss.y});await until(()=>Math.hypot(pilot().x-getBoss().x,pilot().y-getBoss().y)<600);a.emit('select',boss.id);a.emit('attack',true);await until(()=>getBoss()?.shield<4500);assert.equal(getBoss().hp,8500);a.emit('attack',false);await until(()=>pilot().attack===false);const shield=getBoss().shield;await sleep(700);assert.equal(getBoss().shield,shield);
 b.disconnect();await until(()=>snapshot.players.length===1);
});
test('administración deshabilitada sin contraseña',{skip:!process.env.DATABASE_URL},async t=>{const g=createGame({password:'',npcCount:0,boxCount:0});await new Promise(r=>g.server.listen(0,'127.0.0.1',r));t.after(()=>g.close());const response=await fetch('http://127.0.0.1:'+g.server.address().port+'/api/admin/players');assert.equal(response.status,503);});
