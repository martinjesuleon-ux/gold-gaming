'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {createInventory}=require('../inventory-v13'),{createMinerals}=require('../minerals-v17'),{createRespawn}=require('../respawn-v222'),{createBoosters,premiumRead}=require('../boosters-v112');
test('PostgreSQL: Premium purchase, gate spins, cargo and repairs return to normal after expiry',{skip:process.env.GG_TEST_DB!=='1'||!process.env.DATABASE_URL},async t=>{
 const {Pool}=require('pg'),{createAccounts}=require('../accounts');
 const accounts=createAccounts(process.env.DATABASE_URL);try{await accounts.ready();}finally{await accounts.close();}
 const pool=new Pool({connectionString:process.env.DATABASE_URL});t.after(()=>pool.end());
 const name='V'+randomUUID().replaceAll('-','').slice(0,12),id=(await pool.query('INSERT INTO accounts(username,email,password_hash) VALUES($1,$2,$3) RETURNING id',[name,name+'@example.test','fixture'])).rows[0].id;
 try{
 await pool.query("INSERT INTO player_progress(account_id,ship,credits,uridium) VALUES($1,'scout',100000,100000)",[id]);
 const inv=createInventory(pool),lab=createMinerals(pool),repair=createRespawn(pool),boost=createBoosters(pool,{allowPremium:x=>x===id});
 const initial=await lab.status(id);
 assert.equal(await premiumRead(pool,id),false);
 await pool.query("INSERT INTO gg_v16_entitlements(account_id,code,seconds) VALUES($1,'premium-seconds',86400)",[id]);
 await boost.action(id,{action:'activate',code:'PREMIUM',requestId:randomUUID()});
 assert.equal(await premiumRead(pool,id),true);
 const purchase=await inv.purchase(id,{category:'lasers',code:'LF-1',quantity:2,requestId:randomUUID()});
 assert.equal(purchase.total,19000);assert.equal(purchase.baseTotal,20000);assert.equal(Number(purchase.balance.credits),81000);
 const gate=await inv.gateStatus(id);assert.equal(gate.spinPrice,95);assert.equal(gate.lifePrice,23750);
 const spin=await inv.gateSpin(id,{gate:'alpha',count:1,allowUridium:true,requestId:randomUUID()});assert.equal(spin.batch.uridiumUsed,95);
 assert.equal((await lab.status(id)).capacity,initial.capacity+1500);
 assert.equal((await repair.options(id)).find(x=>x.mode==='position').uridium,0);
 await pool.query("UPDATE gg_booster_active SET until_ms=$2 WHERE account_id=$1 AND code='PREMIUM'",[id,Date.now()-1]);
 assert.equal(await premiumRead(pool,id),false);
 const ordinary=await inv.purchase(id,{category:'lasers',code:'LF-1',quantity:1,requestId:randomUUID()});assert.equal(ordinary.total,10000);
 const normalGate=await inv.gateStatus(id);assert.equal(normalGate.spinPrice,100);assert.equal(normalGate.lifePrice,25000);
 assert.equal((await lab.status(id)).capacity,initial.capacity);
 // A random gate spin can award a repair voucher. Test both quote states explicitly.
 const voucherStock=Number((await pool.query("SELECT quantity FROM gg_v13_ammo WHERE account_id=$1 AND code='repair-voucher'",[id])).rows[0]?.quantity||0);
 const afterExpiry=(await repair.options(id)).find(x=>x.mode==='position');
 assert.equal(afterExpiry.premium,false);assert.equal(afterExpiry.vouchers,voucherStock>0?1:0);assert.equal(afterExpiry.uridium,voucherStock>0?0:1000);
 await pool.query("DELETE FROM gg_v13_ammo WHERE account_id=$1 AND code='repair-voucher'",[id]);
 const noVoucher=(await repair.options(id)).find(x=>x.mode==='position');assert.equal(noVoucher.uridium,1000);assert.equal(noVoucher.vouchers,0);
 await pool.query("INSERT INTO gg_v13_ammo(account_id,code,quantity) VALUES($1,'repair-voucher',1)",[id]);
 const withVoucher=(await repair.options(id)).find(x=>x.mode==='position');assert.equal(withVoucher.premium,false);assert.equal(withVoucher.uridium,0);assert.equal(withVoucher.vouchers,1);
 }finally{await pool.query('DELETE FROM accounts WHERE id=$1',[id]);}
});
