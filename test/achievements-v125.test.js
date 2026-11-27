'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {createAchievements,TITLES}=require('../achievements-v125');
test('four gate titles and permanent rings are derived from confirmed completions',{skip:process.env.GG_TEST_DB!=='1'||!process.env.DATABASE_URL},async t=>{
 const {Pool}=require('pg'),{createAccounts}=require('../accounts');const a=createAccounts(process.env.DATABASE_URL);try{await a.ready();}finally{await a.close();}
 const pool=new Pool({connectionString:process.env.DATABASE_URL});t.after(()=>pool.end());
 const name='T'+randomUUID().replaceAll('-','').slice(0,12),id=(await pool.query('INSERT INTO accounts(username,email,password_hash) VALUES($1,$2,$3) RETURNING id',[name,name+'@example.test','fixture'])).rows[0].id;
 try{
  await pool.query("INSERT INTO player_progress(account_id,ship) VALUES($1,'scout')",[id]);
  const svc=createAchievements(pool);assert.deepEqual((await svc.status(id)).rings,[]);
  await assert.rejects(svc.select(id,'kappa'),/no desbloqueado/);
  await svc.add(id,'alien',2);await svc.add(id,'alien',3);await svc.add(id,'distance',1200);await svc.add(id,'box');
  await assert.rejects(svc.add(id,'alien',-1),/inválido/);
  await pool.query("INSERT INTO gg_v14_gates(account_id,gate,completions) VALUES($1,'kappa',2),($1,'alpha',1)",[id]);
  const d=await svc.select(id,'kappa');assert.equal(d.title,TITLES.kappa);assert.deepEqual(d.rings,['alpha','kappa']);assert.equal(d.counters.gates,3);assert.equal(d.counters.alien,5);assert.equal(d.counters.distance,1200);assert.equal(d.counters.box,1);
  await assert.rejects(svc.select(id,'hades'),/no desbloqueado/);
  assert.equal((await svc.select(id,null)).title,null);assert.deepEqual((await svc.read(id)).rings,['alpha','kappa']);
 }finally{await pool.query('DELETE FROM accounts WHERE id=$1',[id]);}
});
