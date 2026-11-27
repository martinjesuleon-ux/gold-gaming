'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {io:connect}=require('socket.io-client');
const {createGame}=require('../server');
const {setTimeout:delay}=require('node:timers/promises');
function accountsForTest(){
 const saves=new Map();
 return {saves,endpoints(){},async authenticate(headers){const id=headers['x-test-pilot'];if(!/^pilot-\d+$/.test(id||''))return null;return {id,username:id,ship:'scout',credits:1000,experience:0,level:1,honor:0};},async boosterRead(){return {};},async upgradeStatus(){return {upgrades:{}};},async assemblyStatus(){return {active:{}};},async location(id){return {company:1,company_chosen:true,map:Number(id.split('-')[1])%2?'1-1':'2-1'};},async dailyClaim(){return {already:true,balance:{credits:1000}};},async gateStatus(){return {gates:[],states:{}};},async achievementAdd(id,kind,n){saves.set(id,(saves.get(id)||0)+n);},async health(){},async close(){this.closed=true;}};
}
function waitFor(fn,ms=10000){return (async()=>{const deadline=Date.now()+ms;while(Date.now()<deadline){if(fn())return;await delay(25);}assert.fail('Timed out waiting for expected state');})();}
test('isolated local game supports 40 pilots, map isolation, movement and reconnect', {timeout:35000},async()=>{
 const accounts=accountsForTest(),game=createGame({accounts,npcCount:0,boxCount:0}),clients=[];
 try{
  await new Promise((resolve,reject)=>{game.server.once('error',reject);game.server.listen(0,'127.0.0.1',resolve);});const url='http://127.0.0.1:'+game.server.address().port;
  async function open(i){const c=connect(url,{forceNew:true,transports:['websocket'],reconnection:false,extraHeaders:{'x-test-pilot':'pilot-'+i}});const entry={c,states:0,last:null};clients.push(entry);c.on('state',s=>{entry.states++;entry.last=s;});await new Promise((resolve,reject)=>{c.once('connect',resolve);c.once('connect_error',reject);});entry.join=await c.timeout(10000).emitWithAck('join',{});return entry;}
  const pilots=await Promise.all(Array.from({length:40},(_,i)=>open(i)));assert.ok(pilots.every(p=>p.join.ok),JSON.stringify(pilots.filter(p=>!p.join.ok).map(p=>p.join)));
  await waitFor(()=>pilots.every(p=>p.last?.players?.length===20));
  for(const p of pilots){assert.equal(p.last.map,p.join.map);assert.ok(p.last.players.every(q=>Number(q.name.split('-')[1])%2===(p.join.map==='1-1'?1:0)));}
  const overflow=await open(40);assert.equal(overflow.join.ok,false);overflow.c.disconnect();
  const start=pilots.map(p=>({x:p.last.players.find(q=>q.id===p.join.id).x,count:p.states}));
  for(const p of pilots)p.c.emit('move',{x:7000,y:4000});
  await waitFor(()=>pilots.every((p,i)=>p.states>start[i].count+2&&p.last.players.find(q=>q.id===p.join.id)?.x>start[i].x+20));
  const old=pilots[0];old.c.disconnect();await waitFor(()=>accounts.saves.has('pilot-0')&&pilots[2].last?.players.length===19);
  const rejoined=await open(0);assert.equal(rejoined.join.ok,true);await waitFor(()=>rejoined.last?.players.length===20);assert.ok(rejoined.last.players.some(q=>q.id===rejoined.join.id));
  const h=await fetch(url+'/health');assert.equal(h.status,200);assert.equal((await h.json()).players,40);
  const before=accounts.saves.get('pilot-2')||0;await game.close();assert.ok(accounts.closed);assert.ok((accounts.saves.get('pilot-2')||0)>before,'shutdown must drain distance checkpoints');console.log('Isolated load: 40 simultaneous clients; two maps; overflow rejected; movement, reconnect and shutdown persistence confirmed.');
 }finally{for(const p of clients)p.c.disconnect();await game.close();}
});
