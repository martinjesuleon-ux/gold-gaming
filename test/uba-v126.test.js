'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {RULES,scoreResult,createMatch,accept,advance,finishRound,createLobby,createUBA}=require('../uba-v126');
test('UBA eligibility, lobby acceptance and best-of-three round timing',()=>{
 const a={id:'a',level:14},b={id:'b',level:15},l=createLobby();
 assert.throws(()=>l.enqueue({id:'c',level:13}),/Nivel 14/);
 assert.equal(l.enqueue(a,0),null);assert.equal(l.enqueue(a,0),null);
 const m=l.enqueue(b,0);assert.equal(m.until,40000);assert.equal(l.get('a'),m);
 accept(m,'a',1000);accept(m,'a',1100);assert.equal(m.phase,'offer');
 assert.throws(()=>accept(m,'c',1100));accept(m,'b',2000);assert.equal(m.until,17000);
 advance(m,17000);assert.equal(m.until,332000);assert.equal(m.phase,'fight');
 finishRound(m,'a',18000);assert.equal(m.round,2);assert.equal(m.until,48000);
 accept(m,'a',19000);accept(m,'b',19000);advance(m,34000);finishRound(m,'a',35000);
 assert.equal(m.phase,'finished');assert.equal(m.winner,'a');assert.deepEqual(m.score,[2,0]);
 l.remove('b');assert.equal(l.get('a'),null);
 const x=createMatch(a,b,0);advance(x,40000);assert.equal(x.phase,'cancelled');
});
test('UBA rating floor and weaker rival bonus',()=>{
 assert.deepEqual(scoreResult(50,50),{winner:60,loser:50});assert.deepEqual(scoreResult(250,50),{winner:255,loser:50});assert.deepEqual(scoreResult(80,100),{winner:90,loser:95});
});
test('UBA rating result is idempotent and never changes honor or currency',{skip:process.env.GG_TEST_DB!=='1'||!process.env.DATABASE_URL},async t=>{
 const {Pool}=require('pg'),{createAccounts}=require('../accounts');const a=createAccounts(process.env.DATABASE_URL);try{await a.ready();}finally{await a.close();}
 const pool=new Pool({connectionString:process.env.DATABASE_URL});t.after(()=>pool.end());const ids=[];
 try{
 for(let i=0;i<2;i++){const n='U'+randomUUID().replaceAll('-','').slice(0,12),id=(await pool.query('INSERT INTO accounts(username,email,password_hash) VALUES($1,$2,$3) RETURNING id',[n,n+'@example.test','fixture'])).rows[0].id;ids.push(id);await pool.query("INSERT INTO player_progress(account_id,ship,credits,uridium,honor) VALUES($1,'scout',1000,100,200)",[id]);}
 const svc=createUBA(pool),batch=randomUUID();await pool.query("INSERT INTO gg_v13_ammo(account_id,code,quantity) VALUES($1,'MCB-50',10)",[ids[0]]);const plans=[{accountId:ids[0],code:'MCB-50',count:3},{accountId:ids[1],code:'MCB-50',count:3}];const paid=await svc.authorizeAmmo(batch,plans);assert.equal(paid[ids[0]],7);assert.equal(paid[ids[1]],null);assert.deepEqual(await svc.authorizeAmmo(batch,plans),paid);assert.equal(Number((await pool.query("SELECT quantity FROM gg_v13_ammo WHERE account_id=$1 AND code='MCB-50'",[ids[0]])).rows[0].quantity),7);const key=randomUUID();const r=await svc.settle(key,...ids);assert.equal(r.winnerScore,60);assert.equal(r.loserScore,50);assert.deepEqual(await svc.settle(key,...ids),r);await assert.rejects(svc.settle(key,...ids.slice().reverse()),/conflicto/);
 assert.equal((await svc.status(ids[0])).own.wins,1);assert.equal((await svc.status(ids[1])).own.losses,1);
 const balances=(await pool.query('SELECT credits,uridium,honor FROM player_progress WHERE account_id=ANY($1::uuid[])',[ids])).rows;assert.ok(balances.every(x=>Number(x.credits)===1000&&Number(x.uridium)===100&&Number(x.honor)===200));
 }finally{for(const id of ids)await pool.query('DELETE FROM accounts WHERE id=$1',[id]);}
});
test('UBA preview prunes unavailable pilots and never enters combat',()=>{
 let available=new Set(['a','b','c']);const l=createLobby({eligible:p=>available.has(p.id)});
 const a={id:'a',level:14},b={id:'b',level:14},c={id:'c',level:14};
 assert.equal(l.enqueue(a,0),null);available.delete('a');assert.equal(l.enqueue(b,0),null);assert.equal(l.queued('a'),false);
 const m=l.enqueue(c,100);assert.deepEqual(m.players,['b','c']);accept(m,'b',200);accept(m,'c',300);
 assert.equal(l.previewTick(15299)[0].phase,'countdown');assert.equal(l.previewTick(15300)[0].phase,'preview-complete');assert.deepEqual(m.score,[0,0]);assert.equal(m.winner,null);
 l.remove('c');assert.equal(l.get('b'),null);assert.equal(l.get('c'),null);
 assert.throws(()=>l.enqueue(a,20000),/no disponible/);
});
test('UBA forfeit requires a started match and cannot settle twice',()=>{
 const {forfeit,expireOffer}=require('../uba-v126'),a={id:'a',level:14},b={id:'b',level:14},m=createMatch(a,b,0);
 assert.equal(forfeit(m,'a'),false);accept(m,'a',1);accept(m,'b',1);advance(m,15001);m.started=true;
 assert.equal(forfeit(m,'outsider'),false);assert.equal(forfeit(m,'b'),true);assert.equal(m.winner,'a');assert.equal(m.phase,'finished');assert.equal(m.reason,'forfeit');assert.equal(forfeit(m,'a'),false);
 const next=createMatch(a,b,0);accept(next,'a',1);accept(next,'b',1);advance(next,15001);next.started=true;finishRound(next,'b',16000);accept(next,'a',17000);
 assert.equal(expireOffer(next,45999),false);assert.equal(expireOffer(next,46000),true);assert.equal(next.winner,'a');
 const cancelled=createMatch(a,b,0);accept(cancelled,'a',1);assert.equal(expireOffer(cancelled,40000),false);
});
