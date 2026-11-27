'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {normalize,createResults}=require('../invasion-results-v137');
test('invasion result validation rejects duplicate participants and negative points',()=>{
 const id=randomUUID(),accountId=randomUUID(),p={accountId,points:150,left:false},r={id,difficulty:'easy',phase:'finished',pilots:[p]};
 assert.deepEqual(normalize(r),r);assert.throws(()=>normalize({...r,pilots:[p,p]}));assert.throws(()=>normalize({...r,pilots:[{...p,points:-1}]}));assert.throws(()=>normalize({...r,phase:'wave'}));
});
test('invasion result persistence is idempotent and excludes failed or abandoned events from standings',{skip:process.env.GG_TEST_DB!=='1'||!process.env.DATABASE_URL},async t=>{
 const {Pool}=require('pg'),{createAccounts}=require('../accounts'),a=createAccounts(process.env.DATABASE_URL);try{await a.ready();}finally{await a.close();}
 const pool=new Pool({connectionString:process.env.DATABASE_URL});t.after(()=>pool.end());const ids=[],events=[];
 try{
 for(let i=0;i<2;i++){const name='I'+randomUUID().replaceAll('-','').slice(0,12),id=(await pool.query('INSERT INTO accounts(username,email,password_hash) VALUES($1,$2,$3) RETURNING id',[name,name+'@example.test','fixture'])).rows[0].id;ids.push(id);await pool.query("INSERT INTO player_progress(account_id,ship,credits,uridium,honor) VALUES($1,'scout',1000,100,200)",[id]);}
 const svc=createResults(pool),id=randomUUID();events.push(id);const r={id,difficulty:'easy',phase:'finished',pilots:[{accountId:ids[0],points:150,left:false},{accountId:ids[1],points:300,left:true}]};
 assert.equal((await svc.settle(r)).duplicate,false);assert.equal((await svc.settle({...r,pilots:[...r.pilots].reverse()})).duplicate,true);await assert.rejects(svc.settle({...r,phase:'failed'}),/conflicto/);
 const failed={...r,id:randomUUID(),phase:'failed'};events.push(failed.id);await svc.settle(failed);
 const status=await svc.status(ids[0]);assert.equal(status.history.length,2);assert.equal(Number(status.rows.find(p=>p.own).points),150);assert.equal(Number(status.rows.find(p=>p.own).completed),1);assert.equal((await svc.status(ids[1])).rows.some(p=>p.own),false);
 const balances=(await pool.query('SELECT credits,uridium,honor FROM player_progress WHERE account_id=ANY($1::uuid[])',[ids])).rows;assert.ok(balances.every(p=>Number(p.credits)===1000&&Number(p.uridium)===100&&Number(p.honor)===200));
 }finally{for(const id of events)await pool.query('DELETE FROM gg_invasion_results WHERE event_id=$1',[id]);for(const id of ids)await pool.query('DELETE FROM accounts WHERE id=$1',[id]);}
});
