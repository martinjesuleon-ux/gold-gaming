'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {premiumAllowed,premiumEnabled}=require('../premium-pilot-v224'),{createBoosters,premiumRead,premiumPrice}=require('../boosters-v112');
const id='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002';
test('Premium defaults off',()=>{assert.equal(premiumEnabled({}),false);assert.equal(premiumAllowed(id,{}),false);});
test('Premium allowlist permits only explicitly selected account',()=>{const env={GG_PREMIUM_PILOTS:'invalid, '+id};assert.equal(premiumEnabled(env),true);assert.equal(premiumAllowed(id,env),true);assert.equal(premiumAllowed(other,env),false);});
test('global rollout must be explicit',()=>{assert.equal(premiumAllowed(other,{GG_PREMIUM_ENABLED:'1'}),true);assert.equal(premiumAllowed('invalid',{GG_PREMIUM_ENABLED:'1'}),false);});
test('disabled activation never opens transaction',async()=>{const b=createBoosters({connect:()=>{throw Error('unexpected database access');}},{allowPremium:()=>false});await assert.rejects(b.action(id,{action:'activate',code:'PREMIUM',requestId:randomUUID()}),/no habilitada/);});
test('Premium never bought with game currency',async()=>{const b=createBoosters({connect:()=>{throw Error('unexpected database access');}},{allowPremium:()=>true});await assert.rejects(b.action(id,{action:'buy',code:'PREMIUM',requestId:randomUUID()}),/no habilitada/);});
test('PostgreSQL: approved pilot activates reserved Premium once without debit',{skip:process.env.GG_TEST_DB!=='1'||!process.env.DATABASE_URL},async t=>{
 const {Pool}=require('pg'),{createAccounts}=require('../accounts');
 const a=createAccounts(process.env.DATABASE_URL);try{await a.ready();}finally{await a.close();}
 const pool=new Pool({connectionString:process.env.DATABASE_URL});t.after(()=>pool.end());
 const name='P'+randomUUID().replaceAll('-','').slice(0,12),id=(await pool.query('INSERT INTO accounts(username,email,password_hash) VALUES($1,$2,$3) RETURNING id',[name,name+'@example.test','fixture'])).rows[0].id;
 try{
 await pool.query("INSERT INTO player_progress(account_id,ship,uridium) VALUES($1,'scout',20000)",[id]);
 await pool.query("INSERT INTO gg_v16_entitlements(account_id,code,seconds) VALUES($1,'premium-seconds',259200)",[id]);
 const b=createBoosters(pool,{allowPremium:x=>x===id}),request={action:'activate',code:'PREMIUM',requestId:randomUUID()};
 assert.equal((await b.status(id)).premiumActivationEnabled,true);
 const [x,y]=await Promise.all([b.action(id,request),b.action(id,request)]);
 assert.equal(x.active.PREMIUM,y.active.PREMIUM);assert.equal(x.stock['premium-seconds'],0);assert.equal(Number(x.balance.uridium),20000);
 assert.ok(x.active.PREMIUM>Date.now()+259190000);
 assert.equal(premiumPrice(100,await premiumRead(pool,id)),95);
 await assert.rejects(b.action(id,{...request,requestId:randomUUID()}),/Sin tiempo/);
 }finally{await pool.query('DELETE FROM accounts WHERE id=$1',[id]);}
});
