'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {createReferrals,RECRUIT,REFERRER}=require('../referrals-v222');
test('PostgreSQL: background referral settlement pays both accounts once, skips blocked and level 14',{skip:process.env.GG_TEST_DB!=='1'||!process.env.DATABASE_URL},async t=>{
 const {Pool}=require('pg'),{createAccounts}=require('../accounts');
 const accounts=createAccounts(process.env.DATABASE_URL);try{await accounts.ready();}finally{await accounts.close();}
 const pool=new Pool({connectionString:process.env.DATABASE_URL});t.after(()=>pool.end());
 const ids=[];
 async function pilot(level){const name='R'+randomUUID().replaceAll('-','').slice(0,12),id=(await pool.query('INSERT INTO accounts(username,email,password_hash) VALUES($1,$2,$3) RETURNING id',[name,name+'@example.test','fixture'])).rows[0].id;ids.push(id);await pool.query("INSERT INTO player_progress(account_id,ship,level,uridium) VALUES($1,'scout',$2,0)",[id,level]);return id;}
 async function link(recruit,referrer){await pool.query('INSERT INTO gg_referrals_v222(recruit_id,referrer_id,ip_hash) VALUES($1,$2,$3)',[recruit,referrer,randomUUID()]);}
 try{
 const ref=await pilot(1),recruit=await pilot(15),low=await pilot(14),blockedRef=await pilot(1),blockedRecruit=await pilot(15);
 await link(recruit,ref);await link(low,ref);await link(blockedRecruit,blockedRef);
 await pool.query('INSERT INTO gg_referral_network_v222(account_id,blocked) VALUES($1,true)',[blockedRef]);
 const service=createReferrals(pool);
 const results=(await Promise.all([service.settleDue(),service.settleDue()])).flat().filter(r=>ids.includes(r.recruitId));
 assert.deepEqual(results,[{recruitId:recruit,referrerId:ref}]);
 assert.equal((await service.settleDue()).filter(r=>ids.includes(r.recruitId)).length,0);
 const balances=(await pool.query('SELECT account_id,uridium FROM player_progress WHERE account_id=ANY($1::uuid[])',[ids])).rows;
 assert.equal(Number(balances.find(x=>x.account_id===recruit).uridium),10000);
 assert.equal(Number(balances.find(x=>x.account_id===low).uridium),0);
 assert.equal(Number(balances.find(x=>x.account_id===blockedRecruit).uridium),0);
 for(const [id,expected] of [[recruit,RECRUIT],[ref,REFERRER]]){
 const rows=(await pool.query('SELECT code,quantity FROM gg_v13_ammo WHERE account_id=$1',[id])).rows;
 for(const [code,n] of Object.entries(expected))assert.equal(Number(rows.find(x=>x.code===code)?.quantity),n);
 }
 await pool.query('UPDATE player_progress SET level=15 WHERE account_id=$1',[low]);
 assert.ok((await service.settleDue()).some(r=>r.recruitId===low&&r.referrerId===ref));
 }finally{await pool.query('DELETE FROM accounts WHERE id=ANY($1::uuid[])',[ids]);}
});
test('invalid batch size rejects before querying',async()=>{const service=createReferrals({query:()=>{throw Error('unexpected query')}});for(const n of [0,101,2.5])await assert.rejects(service.settleDue(n),/Límite inválido/);});
