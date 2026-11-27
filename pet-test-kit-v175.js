'use strict';
const crypto=require('node:crypto');
const {levels}=require('./data/pet-progression-v173.json');
const catalog=require('./data/catalog-v13.json');
// Same pilot already authorized by the server's test controller. No request-supplied target.
const TEST_ACCOUNT='14733365-e185-4d81-90a8-b3c95baf0af7';
const testKitEnabled=id=>id===TEST_ACCOUNT&&process.env.GG_PET_TEST_KIT_ENABLED!=='0';
const equipmentEnabled=id=>testKitEnabled(id)||process.env.GG_PET_EQUIPMENT_ENABLED==='1';
const gearEnabled=id=>equipmentEnabled(id)&&(testKitEnabled(id)||process.env.GG_PET_GEAR_EQUIP_ENABLED==='1');
const KIT=Object.freeze([
 ['LF-4','lasers',100,catalog.rules.maxUpgrade],
 ['LF-P01','lasers',12,catalog.rules.maxUpgrade],
 ['SG3N-B03','shields',100,catalog.rules.maxUpgrade],
 ['Havoc','drone-designs',10,1],['Hercules','drone-designs',10,1],['Spartan','drone-designs',10,1],
 ['pet-10','pet',1,1],['G-AL1','petGear',1,1],['G-KK1','petGear',1,1]
]);
async function ready(pool){await pool.query('CREATE TABLE IF NOT EXISTS gg_pet_test_kit_v175(account_id uuid PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,granted_at timestamptz NOT NULL DEFAULT now())');}
async function grant(pool){
 if(!testKitEnabled(TEST_ACCOUNT))return false;
 const c=await pool.connect();
 try{
  await c.query('BEGIN');
  const p=(await c.query('SELECT account_id FROM player_progress WHERE account_id=$1 FOR UPDATE',[TEST_ACCOUNT])).rows[0];
  if(!p){await c.query('COMMIT');return false;}
  const receipt=await c.query('INSERT INTO gg_pet_test_kit_v175(account_id) VALUES($1) ON CONFLICT DO NOTHING RETURNING account_id',[TEST_ACCOUNT]);
  if(!receipt.rowCount){await c.query('COMMIT');return false;}
  for(const [code,category,count,level] of KIT){
   if(level>1)await c.query('UPDATE gg_v13_inventory SET level=GREATEST(level,$4) WHERE account_id=$1 AND code=$2 AND category=$3',[TEST_ACCOUNT,code,category,level]);
   const existing=Number((await c.query('SELECT count(*) AS n FROM gg_v13_inventory WHERE account_id=$1 AND code=$2 AND category=$3',[TEST_ACCOUNT,code,category])).rows[0].n);
   for(let n=existing;n<count;n++)await c.query('INSERT INTO gg_v13_inventory(account_id,instance_id,code,category,level) VALUES($1,$2,$3,$4,$5)',[TEST_ACCOUNT,crypto.randomUUID(),code,category,level]);
  }
  const top=levels.at(-1),slots=Object.fromEntries(['laser','generator','gear','protocol'].map(k=>[k,top[k]]));
  await c.query('INSERT INTO gg_pet_progress_v173(account_id,experience,slots,paid_hull_tier) VALUES($1,$2,$3::jsonb,$4) ON CONFLICT(account_id) DO UPDATE SET experience=GREATEST(gg_pet_progress_v173.experience,EXCLUDED.experience),slots=EXCLUDED.slots,paid_hull_tier=EXCLUDED.paid_hull_tier',[TEST_ACCOUNT,top.experience,JSON.stringify(slots),top.level]);
  await c.query("INSERT INTO gg_v13_ammo(account_id,code,quantity) VALUES($1,'pet-fuel',50000) ON CONFLICT(account_id,code) DO UPDATE SET quantity=GREATEST(gg_v13_ammo.quantity,EXCLUDED.quantity)",[TEST_ACCOUNT]);
  await c.query('COMMIT');return true;
 }catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}
}
module.exports={TEST_ACCOUNT,testKitEnabled,equipmentEnabled,gearEnabled,KIT,ready,grant};
