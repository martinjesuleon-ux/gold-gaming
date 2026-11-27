'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {unitReward,createHitacRewards}=require('../hitac-rewards-v145');
test('Hitac catalog rewards use trusted unit identifiers',()=>{
 const id=randomUUID();
 assert.deepEqual(unitReward(id+':0'),{name:'Hitac Mothership',credits:3000000,uridium:10000,xp:600000,honor:7500});
 assert.deepEqual(unitReward(id+':6'),{name:'Hitac Minion',credits:2000000,uridium:4500,xp:1000000,honor:18500});
 assert.throws(()=>unitReward(id+':7'));assert.throws(()=>unitReward('fake:0'));
});
test('Hitac unit reward is paid once even with concurrent claims',{skip:process.env.GG_TEST_DB!=='1'||!process.env.DATABASE_URL},async t=>{
 const {Pool}=require('pg'),{createAccounts}=require('../accounts'),a=createAccounts(process.env.DATABASE_URL);try{await a.ready();}finally{await a.close();}
 const pool=new Pool({connectionString:process.env.DATABASE_URL});t.after(()=>pool.end());const ids=[];
 try{for(let i=0;i<2;i++){const name='H'+randomUUID().replaceAll('-','').slice(0,12),id=(await pool.query('INSERT INTO accounts(username,email,password_hash) VALUES($1,$2,$3) RETURNING id',[name,name+'@example.test','fixture'])).rows[0].id;ids.push(id);await pool.query("INSERT INTO player_progress(account_id,ship,credits,uridium,honor,experience) VALUES($1,'scout',1000,100,200,0)",[id]);}
 const svc=createHitacRewards(pool),unit=randomUUID()+':0',res=await Promise.allSettled(ids.map(id=>svc.claim(id,unit)));
 assert.equal(res.filter(r=>r.status==='fulfilled').length,1);const winner=ids[res.findIndex(r=>r.status==='fulfilled')];assert.equal((await svc.claim(winner,unit)).duplicate,true);
 const p=(await pool.query('SELECT credits,uridium,honor,experience FROM player_progress WHERE account_id=$1',[winner])).rows[0];assert.equal(Number(p.credits),3001000);assert.equal(Number(p.uridium),10100);assert.equal(Number(p.honor),7700);assert.equal(Number(p.experience),600000);
 }finally{for(const id of ids)await pool.query('DELETE FROM accounts WHERE id=$1',[id]);}
});
