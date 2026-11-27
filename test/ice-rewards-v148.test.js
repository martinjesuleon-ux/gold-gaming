'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {normalize,createIceRewards}=require('../ice-rewards-v148'),{REWARD}=require('../ice-v146');
test('Ice rewards require unique contributors and conserve all four reward pools',()=>{
 const a=randomUUID(),b=randomUUID(),rows=[{accountId:a,damage:1},{accountId:b,damage:3}];
 const r=normalize(rows);for(const [k,n] of Object.entries(REWARD))assert.equal(r.reduce((v,p)=>v+p[k],0),n);
 assert.throws(()=>normalize([rows[0],rows[0]]));assert.throws(()=>normalize([{accountId:a,damage:0}]));
});
test('Ice settlement and box claims are atomic and replay safe',{skip:process.env.GG_TEST_DB!=='1'||!process.env.DATABASE_URL},async t=>{
 const {Pool}=require('pg'),{createAccounts}=require('../accounts'),a=createAccounts(process.env.DATABASE_URL);try{await a.ready();}finally{await a.close();}
 const pool=new Pool({connectionString:process.env.DATABASE_URL});t.after(()=>pool.end());const ids=[],event=randomUUID();
 try{for(let i=0;i<2;i++){const name='I'+randomUUID().replaceAll('-','').slice(0,12),id=(await pool.query('INSERT INTO accounts(username,email,password_hash) VALUES($1,$2,$3) RETURNING id',[name,name+'@example.test','fixture'])).rows[0].id;ids.push(id);await pool.query("INSERT INTO player_progress(account_id,ship,credits,uridium,honor,experience) VALUES($1,'scout',1000,100,200,0)",[id]);}
 const svc=createIceRewards(pool),contributors=ids.map(accountId=>({accountId,damage:10}));const r=await svc.settle(event,contributors);assert.equal(r.duplicate,false);assert.equal((await svc.settle(event,contributors)).duplicate,true);
 const box=randomUUID(),res=await Promise.allSettled(ids.map(id=>svc.claim(id,event,box)));assert.equal(res.filter(x=>x.status==='fulfilled').length,1);const winner=ids[res.findIndex(x=>x.status==='fulfilled')];assert.equal((await svc.claim(winner,event,box)).duplicate,true);
 const p=(await pool.query('SELECT credits,uridium,honor,experience FROM player_progress WHERE account_id=$1',[winner])).rows[0];assert.equal(Number(p.credits),25001000);assert.equal(Number(p.uridium),252100);assert.equal(Number(p.honor),250200);assert.equal(Number(p.experience),2500000);
 for(let i=1;i<15;i++)await svc.claim(winner,event,randomUUID());await assert.rejects(svc.claim(winner,event,randomUUID()),/agotadas/);
 }finally{await pool.query('DELETE FROM gg_ice_boxes WHERE event_id=$1',[event]);await pool.query('DELETE FROM gg_ice_results WHERE event_id=$1',[event]);for(const id of ids)await pool.query('DELETE FROM accounts WHERE id=$1',[id]);}
});
