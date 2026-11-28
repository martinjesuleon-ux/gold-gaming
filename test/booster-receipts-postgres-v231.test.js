'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {createBoosters}=require('../boosters-v112');
test('PostgreSQL: booster receipts bind operation, prevent duplicate charge and reject ambiguous legacy replay',{skip:process.env.GG_TEST_DB!=='1'||!process.env.DATABASE_URL},async t=>{
 const {Pool}=require('pg'),{createAccounts}=require('../accounts');const accounts=createAccounts(process.env.DATABASE_URL);try{await accounts.ready();}finally{await accounts.close();}
 const pool=new Pool({connectionString:process.env.DATABASE_URL});t.after(()=>pool.end());
 const name='B'+randomUUID().replaceAll('-','').slice(0,12),id=(await pool.query('INSERT INTO accounts(username,email,password_hash) VALUES($1,$2,$3) RETURNING id',[name,name+'@example.test','fixture'])).rows[0].id;
 try{
 await pool.query("INSERT INTO player_progress(account_id,ship,uridium) VALUES($1,'scout',50000)",[id]);
 const booster=createBoosters(pool),requestId=randomUUID(),body={action:'buy',code:'DMG-B01',requestId};
 const [one,two]=await Promise.all([booster.action(id,body),booster.action(id,body)]);assert.deepEqual(one,two);
 await assert.rejects(booster.action(id,{...body,code:'SHD-B01'}),{status:409});await assert.rejects(booster.action(id,{...body,action:'activate'}),{status:409});
 const legacy=randomUUID();await pool.query('INSERT INTO gg_booster_requests(account_id,request_id,response) VALUES($1,$2,$3)',[id,legacy,JSON.stringify(one)]);
 await assert.rejects(booster.action(id,{...body,requestId:legacy}),{status:409});
 const balance=(await pool.query('SELECT uridium FROM player_progress WHERE account_id=$1',[id])).rows[0];assert.equal(Number(balance.uridium),40000);
 const ent=(await pool.query("SELECT seconds FROM gg_v16_entitlements WHERE account_id=$1 AND code='DMG-B01'",[id])).rows[0];assert.equal(Number(ent.seconds),36000);
 const activated=await booster.action(id,{action:'activate',code:'DMG-B01',requestId:randomUUID()});assert.ok(activated);
 }finally{await pool.query('DELETE FROM accounts WHERE id=$1',[id]);}
});
