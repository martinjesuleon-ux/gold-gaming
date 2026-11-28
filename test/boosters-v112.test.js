'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {CATALOG,factors,createBoosters}=require('../boosters-v112');
test('wiki boosters price, duration, active and shared effects',()=>{
 assert.equal(Object.keys(CATALOG).length,18);
 assert.equal(Object.values(CATALOG).filter(x=>x.price===10000).length,14);
 for(const code of ['PREMIUM','NBX-B01','QR-01']){assert.equal(CATALOG[code].price,undefined);assert.deepEqual(CATALOG[code].effects,{});assert.deepEqual(CATALOG[code].shared,{});}
 for(const d of Object.values(CATALOG).filter(x=>x.price)){assert.equal(d.price,10000);assert.equal(d.seconds,36000);}
 const now=1000,active={'DMG-B01':2000,'SHD-B02':2000,'MUL-B03':2000,'HP-B01':900};
 const result=factors(active,[{'DMG-B02':2000,'SHD-B02':2000},{'DMG-B02':2000}],now);
 assert.ok(Math.abs(result.damage-1.2)<1e-9);assert.ok(Math.abs(result.shield-1.4)<1e-9);assert.equal(result.hp,1);assert.equal(result.xp,1.05);
});
test('purchase activates immediately, extends existing time once, and preserves reward stock',{skip:process.env.GG_TEST_DB!=='1'||!process.env.DATABASE_URL},async t=>{
 const {Pool}=require('pg');const {createAccounts}=require('../accounts');
 const a=createAccounts(process.env.DATABASE_URL);try{await a.ready();}finally{await a.close();}
 const pool=new Pool({connectionString:process.env.DATABASE_URL});t.after(()=>pool.end());
 const name='B'+randomUUID().replaceAll('-','').slice(0,12),id=(await pool.query('INSERT INTO accounts(username,email,password_hash) VALUES($1,$2,$3) RETURNING id',[name,name+'@example.test','fixture'])).rows[0].id;
 try{
  await pool.query("INSERT INTO player_progress(account_id,ship,uridium) VALUES($1,'scout',20000)",[id]);
  const b=createBoosters(pool),buy={action:'buy',code:'SHD-B02',requestId:randomUUID()};
  const initial=await b.action(id,buy),duplicate=await b.action(id,buy);assert.equal(initial.active['SHD-B02'],duplicate.active['SHD-B02']);
  const s=await b.status(id);assert.equal(Number(s.balance.uridium),10000);assert.equal(s.stock['SHD-B02']||0,0);assert.ok(s.active['SHD-B02']>Date.now()+35990000);assert.equal(factors(s.active).shield,1.25);
  const extended=await b.action(id,{...buy,requestId:randomUUID()});assert.equal(extended.active['SHD-B02'],initial.active['SHD-B02']+36000000);assert.equal(Number(extended.balance.uridium),0);
  await assert.rejects(b.action(id,{...buy,requestId:randomUUID()}),/Uridium insuficiente/);
  await pool.query('INSERT INTO gg_v16_entitlements(account_id,code,seconds) VALUES($1,$2,$3)',[id,'SHD-B02',36000]);
  const activate={action:'activate',code:'SHD-B02',requestId:randomUUID()},first=await b.action(id,activate),second=await b.action(id,activate);
  assert.equal(first.active['SHD-B02'],second.active['SHD-B02']);assert.equal(second.stock['SHD-B02'],0);assert.equal(first.active['SHD-B02'],extended.active['SHD-B02']+36000000);
  await assert.rejects(b.action(id,{...activate,requestId:randomUUID()}),/Sin tiempo/);
 }finally{await pool.query('DELETE FROM accounts WHERE id=$1',[id]);}
});