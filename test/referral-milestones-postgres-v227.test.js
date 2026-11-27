'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {createReferrals}=require('../referrals-v222'),{validatePetEquipment}=require('../pet-equipment-rules-v173');
test('PostgreSQL: milestone claims concurrently grant valid exclusive gear once',{skip:process.env.GG_TEST_DB!=='1'||!process.env.DATABASE_URL},async t=>{
 const {Pool}=require('pg'),{createAccounts}=require('../accounts');
 const accounts=createAccounts(process.env.DATABASE_URL);try{await accounts.ready();}finally{await accounts.close();}
 const pool=new Pool({connectionString:process.env.DATABASE_URL});t.after(()=>pool.end());
 const ids=[];
 async function pilot(){const name='M'+randomUUID().replaceAll('-','').slice(0,12),id=(await pool.query('INSERT INTO accounts(username,email,password_hash) VALUES($1,$2,$3) RETURNING id',[name,name+'@example.test','fixture'])).rows[0].id;ids.push(id);await pool.query("INSERT INTO player_progress(account_id,ship) VALUES($1,'scout')",[id]);return id;}
 try{
 const ref=await pilot();
 for(let i=0;i<100;i++){const recruit=await pilot();await pool.query('INSERT INTO gg_referrals_v222(recruit_id,referrer_id,ip_hash,qualified_at) VALUES($1,$2,$3,now())',[recruit,ref,randomUUID()]);}
 const service=createReferrals(pool),results=await Promise.all([service.claim(ref),service.claim(ref)]);
 assert.equal(results.flatMap(r=>r.awarded).length,5);
 assert.equal((await service.claim(ref)).awarded.length,0);
 const rows=(await pool.query('SELECT instance_id AS "instanceId",category,code,level FROM gg_v13_inventory WHERE account_id=$1 AND level=20',[ref])).rows;
 assert.equal(rows.length,3);assert.equal(rows.filter(x=>x.code==='LF-4').length,2);assert.equal(rows.filter(x=>x.code==='SG3N-B03').length,1);
 const eq={laser:[rows.find(x=>x.code==='LF-4').instanceId],generator:[rows.find(x=>x.code==='SG3N-B03').instanceId]};
 assert.ok(validatePetEquipment({experience:0,slots:{laser:1,generator:2,gear:1,protocol:2}},eq,new Map(rows.map(x=>[x.instanceId,x]))).stats.damage>0);
 const history=(await pool.query('SELECT milestone FROM gg_referral_milestones_v222 WHERE account_id=$1 ORDER BY milestone',[ref])).rows;assert.deepEqual(history.map(x=>x.milestone),[5,15,25,50,100]);
 const expected=[{milestone:15,kind:'sharedCombatHours',quantity:5,state:'reserved'},{milestone:25,kind:'sharedCombatHours',quantity:10,state:'reserved'},{milestone:50,kind:'specialPetDesign',quantity:1,state:'reserved'},{milestone:100,kind:'specialShipDesign',quantity:1,state:'reserved'}];
 const status=await createReferrals(pool).status(ref);assert.deepEqual(status.pendingRewards,expected);assert.deepEqual(status.available,[]);
 const outsider=ids[1];assert.deepEqual((await service.status(outsider)).pendingRewards,[]);
 await pool.query('INSERT INTO gg_referral_network_v222(account_id,blocked) VALUES($1,true)',[ref]);
 const blocked=await service.status(ref);assert.equal(blocked.blocked,true);assert.deepEqual(blocked.pendingRewards,expected);assert.deepEqual(blocked.available,[]);
 
 }finally{await pool.query('DELETE FROM accounts WHERE id=ANY($1::uuid[])',[ids]);}
});
