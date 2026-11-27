'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
test('Authoritative progress snapshot reflects externally committed rewards without replaying them',{skip:process.env.GG_TEST_DB!=='1'||!process.env.DATABASE_URL},async t=>{
 const {Pool}=require('pg'),{createAccounts}=require('../accounts'),a=createAccounts(process.env.DATABASE_URL),pool=new Pool({connectionString:process.env.DATABASE_URL});t.after(async()=>{await a.close();await pool.end();});await a.ready();let id;
 try{const name='P'+randomUUID().replaceAll('-','').slice(0,12);id=(await pool.query('INSERT INTO accounts(username,email,password_hash) VALUES($1,$2,$3) RETURNING id',[name,name+'@example.test','fixture'])).rows[0].id;await pool.query("INSERT INTO player_progress(account_id,ship,credits,uridium,honor,experience) VALUES($1,'scout',1000,100,200,0)",[id]);
 assert.equal(Number((await a.progressRead(id)).credits),1000);
 await a.reward(id,5000,10000,2000,100);
 const r=await a.progressRead(id);assert.equal(Number(r.credits),6000);assert.equal(Number(r.uridium),2100);assert.equal(Number(r.experience),10000);assert.equal(Number(r.honor),300);assert.equal(Number(r.level),2);assert.deepEqual(await a.progressRead(id),r);
 }finally{if(id)await pool.query('DELETE FROM accounts WHERE id=$1',[id]);}
});
