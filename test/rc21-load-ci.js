'use strict';
// Dedicated disposable CI database; never run against a deployed service.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {once}=require('node:events');
const {Pool}=require('pg');
const {io}=require('socket.io-client');
const {createAccounts}=require('../accounts');
const {createGame}=require('../server');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const until=async(fn,ms,label)=>{const deadline=Date.now()+ms;while(Date.now()<deadline){if(await fn())return;await wait(100);}throw Error('Timeout: '+label);};
const db=new URL(process.env.DATABASE_URL||'postgresql://invalid');
assert.equal(process.env.GG_TEST_DB,'1');
assert.ok(['localhost','127.0.0.1'].includes(db.hostname)&&db.pathname==='/gg_test'&&db.username==='gg_test','Disposable CI database required');
async function main(){
 const pool=new Pool({connectionString:db.href,max:2});
 const ids=[],tokens=[],sockets=[],states=new Map();
 let accounts,game,base;
 const tag=crypto.randomBytes(4).toString('hex');
 async function connect(i){
  const s=io(base,{transports:['websocket'],forceNew:true,reconnection:false,autoConnect:false,extraHeaders:{Cookie:'gg_session='+tokens[i]}});
  sockets.push(s);
  s.on('state',state=>states.set(s.id,state));
  const connection=once(s,'connect');s.connect();
  await Promise.race([connection,wait(10000).then(()=>{if(!s.connected)throw Error('connect timeout');})]);
  const ack=await s.timeout(60000).emitWithAck('join',{});
  return {s,ack};
 }
 async function health(){const response=await fetch(base+'/health',{signal:AbortSignal.timeout(10000)});assert.equal(response.status,200);return response.json();}
 try{
  accounts=createAccounts(db.href);await accounts.ready();
  for(let i=0;i<41;i++){
   const id=crypto.randomUUID(),token=crypto.randomBytes(32).toString('hex');ids.push(id);tokens.push(token);
   await pool.query('INSERT INTO accounts(id,username,email,password_hash) VALUES($1,$2,$3,$4)',[id,'Load'+tag+i,'load'+tag+i+'@example.invalid','ci-only']);
   await pool.query("INSERT INTO player_progress(account_id,ship) VALUES($1,'scout')",[id]);
   await pool.query("INSERT INTO player_sessions(token_hash,account_id,expires_at) VALUES($1,$2,now()+interval '1 hour')",[crypto.createHash('sha256').update(token).digest('hex'),id]);
  }
  game=createGame({accounts,npcCount:0,boxCount:0});
  game.server.listen(0,'127.0.0.1');await once(game.server,'listening');base='http://127.0.0.1:'+game.server.address().port;
  const pilots=await Promise.all(Array.from({length:40},(_,i)=>connect(i)));
  assert.equal(pilots.filter(x=>x.ack.ok).length,40,JSON.stringify(pilots.filter(x=>!x.ack.ok).map(x=>x.ack)));
  assert.equal((await health()).players,40);
  const overflow=await connect(40);assert.equal(overflow.ack.ok,false);assert.equal(overflow.ack.code,'SERVER_FULL');
  await until(()=>pilots.every(({s})=>states.get(s.id)?.players?.some(p=>p.id===s.id)),15000,'all pilots receive own state');
  // Five seconds of concurrent movement, with health and snapshots checked.
  for(let tick=0;tick<20;tick++){
   for(const [i,{s}] of pilots.entries())s.emit('move',{x:6000+((i+tick)%20)*12,y:4000+((i+tick)%10)*12});
   await wait(250);
  }
  assert.equal((await health()).players,40);
  assert.ok(pilots.every(({s})=>s.connected&&states.get(s.id)?.players?.some(p=>p.id===s.id)));
  const first=pilots[0].s;first.disconnect();
  await until(async()=>(await health()).players===39,10000,'slot release');
  const replacement=await overflow.s.timeout(60000).emitWithAck('join',{});
  assert.equal(replacement.ok,true,JSON.stringify(replacement));assert.equal((await health()).players,40);
  console.log('PASS: 40 simultaneous authenticated sockets, 41st rejected, movement snapshots, health, slot reuse.');
 }finally{
  for(const s of sockets)s.disconnect();
  try{if(game)await game.close();else if(accounts)await accounts.close();}
  finally{try{if(ids.length)await pool.query('DELETE FROM accounts WHERE id=ANY($1::uuid[])',[ids]);}finally{await pool.end();}}
 }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
