'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {rewards}=require('../spaceball-v138'),{validate,createSpaceballRewards}=require('../spaceball-rewards-v140');
test('Spaceball reward bounds reject incomplete or inflated crates',()=>{
 const r=rewards(()=>0);assert.deepEqual(validate(r),r);assert.throws(()=>validate({...r,uridium:1001}));assert.throws(()=>validate({...r,credits:4999}));assert.throws(()=>validate({...r,other:1}));assert.throws(()=>validate({credits:5000}));
});
test('Spaceball crate claims pay all six rewards exactly once across competing pilots',{skip:process.env.GG_TEST_DB!=='1'||!process.env.DATABASE_URL},async t=>{
 const {Pool}=require('pg'),{createAccounts}=require('../accounts'),accounts=createAccounts(process.env.DATABASE_URL);try{await accounts.ready();}finally{await accounts.close();}
 const pool=new Pool({connectionString:process.env.DATABASE_URL});t.after(()=>pool.end());const ids=[];
 try{
 const svc=createSpaceballRewards(pool);await svc.ready();
 for(let i=0;i<2;i++){const name='S'+randomUUID().replaceAll('-','').slice(0,12),id=(await pool.query('INSERT INTO accounts(username,email,password_hash) VALUES($1,$2,$3) RETURNING id',[name,name+'@example.test','fixture'])).rows[0].id;ids.push(id);await pool.query("INSERT INTO player_progress(account_id,ship,credits,uridium,honor) VALUES($1,'scout',1000,100,200)",[id]);}
 const event=randomUUID(),box=randomUUID(),r=rewards(()=>0),res=await Promise.allSettled(ids.map(id=>svc.claim(id,event,box,r)));
 assert.equal(res.filter(x=>x.status==='fulfilled').length,1);
 const winner=ids[res.findIndex(x=>x.status==='fulfilled')],loser=ids.find(id=>id!==winner);
 assert.equal((await svc.claim(winner,event,box,r)).duplicate,true);await assert.rejects(svc.claim(loser,event,box,r),/ya recogida/);
 const p=(await pool.query('SELECT credits,uridium,honor FROM player_progress WHERE account_id=$1',[winner])).rows[0];assert.equal(Number(p.credits),6000);assert.equal(Number(p.uridium),600);assert.equal(Number(p.honor),200);
 const rows=(await pool.query('SELECT code,quantity FROM gg_v13_ammo WHERE account_id=$1',[winner])).rows;
 for(const [code,n] of [['RSB-75',100],['gate-energy',10],['jump-voucher',1],['repair-voucher',1]])assert.equal(Number(rows.find(x=>x.code===code).quantity),n);
 const q=(await pool.query('SELECT credits,uridium FROM player_progress WHERE account_id=$1',[loser])).rows[0];assert.equal(Number(q.credits),1000);assert.equal(Number(q.uridium),100);
 }finally{for(const id of ids)await pool.query('DELETE FROM accounts WHERE id=$1',[id]);}
});
