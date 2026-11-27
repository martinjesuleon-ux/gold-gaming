'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {createRespawn}=require('../respawn-v222');
test('PostgreSQL: unresolved death, concurrent repair and lost acknowledgement survive service restart',{skip:process.env.GG_TEST_DB!=='1'||!process.env.DATABASE_URL},async t=>{
 const {Pool}=require('pg'),{createAccounts}=require('../accounts');
 const accounts=createAccounts(process.env.DATABASE_URL);try{await accounts.ready();}finally{await accounts.close();}
 const pool=new Pool({connectionString:process.env.DATABASE_URL});t.after(()=>pool.end());
 const name='R'+randomUUID().replaceAll('-','').slice(0,12),id=(await pool.query('INSERT INTO accounts(username,email,password_hash) VALUES($1,$2,$3) RETURNING id',[name,name+'@example.test','fixture'])).rows[0].id;
 try{
  await pool.query("INSERT INTO player_progress(account_id,ship,uridium) VALUES($1,'scout',2500)",[id]);
  const death=randomUUID(),dest={zone:'1-3',x:77,y:88},r=createRespawn(pool);
  await r.markDeath(id,death,dest,Date.now()-100);
  const resumed=createRespawn(pool);assert.deepEqual((await resumed.deathState(id)).destination,dest);
  const results=await Promise.all([r.charge(id,death,'position',dest,true),resumed.charge(id,death,'position',dest,true)]);
  assert.deepEqual(results[0],results[1]);assert.equal(await resumed.deathState(id),null);
  assert.equal(Number((await pool.query('SELECT uridium FROM player_progress WHERE account_id=$1',[id])).rows[0].uridium),1500);
  const receipt=await createRespawn(pool).pending(id);assert.equal(receipt.deathId,death);assert.deepEqual(receipt.destination,dest);
  assert.equal(await resumed.acknowledge(id,randomUUID()),false);assert.equal(await resumed.acknowledge(id,death),true);assert.equal(await resumed.pending(id),null);
  const next=randomUUID();await r.markDeath(id,next,dest,Date.now()-100);await r.charge(id,next,'base',{zone:'1-1',x:6000,y:4000},true);
  assert.equal(await r.deathState(id),null);assert.equal(Number((await pool.query('SELECT uridium FROM player_progress WHERE account_id=$1',[id])).rows[0].uridium),1500);
 }finally{await pool.query('DELETE FROM accounts WHERE id=$1',[id]);}
});
