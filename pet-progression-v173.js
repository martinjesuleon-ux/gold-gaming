'use strict';
const {levels,costs}=require('./data/pet-progression-v173.json');
const TYPES=Object.freeze(['laser','generator','gear','protocol']);
const INITIAL=Object.freeze({laser:1,generator:2,gear:1,protocol:2});
const MAX_XP=Number.MAX_SAFE_INTEGER;
const fail=(message,status=400)=>Object.assign(Error(message),{status});
function levelForExperience(xp){
 if(!Number.isSafeInteger(xp)||xp<0)throw fail('Experiencia P.E.T. inválida');
 for(let i=levels.length-1;i>=0;i--)if(xp>=levels[i].experience)return levels[i];
 return levels[0];
}
function profile(experience=0,slots=INITIAL){
 const current=levelForExperience(experience);
 const purchased={};
 for(const type of TYPES){
  const count=slots[type]??INITIAL[type];
  if(!Number.isInteger(count)||count<INITIAL[type]||count>current[type])throw fail('Ranuras P.E.T. inválidas');
  purchased[type]=count;
 }
 const next=levels[current.level+1]||null;
 return {experience,level:current.level,nextExperience:next?.experience??null,limits:Object.fromEntries(TYPES.map(k=>[k,current[k]])),slots:purchased,maxHp:current.maxHp,hpUpgrade:current.hpUpgrade,repair:current.repair,fuel:current.fuel,damageBonus:current.damageBonus,shieldBonus:current.shieldBonus,equipmentTier:current.equipmentTier};
}
function quoteSlot(state,type){
 if(!TYPES.includes(type))throw fail('Tipo de ranura P.E.T. inválido');
 const p=profile(state.experience,state.slots);
 const slot=p.slots[type]+1;
 if(slot>p.limits[type])throw fail('Ranura bloqueada por nivel',409);
 const price=costs[type][slot-1];
 if(!Number.isSafeInteger(price)||price<0)throw fail('Coste de ranura no disponible');
 return {type,slot,price};
}
function createPetProgression(pool){
 async function ready(){await pool.query(`CREATE TABLE IF NOT EXISTS gg_pet_progress_v173(account_id uuid PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,experience bigint NOT NULL DEFAULT 0 CHECK(experience BETWEEN 0 AND 9007199254740991),slots jsonb NOT NULL DEFAULT '{"laser":1,"generator":2,"gear":1,"protocol":2}');
 ALTER TABLE gg_pet_progress_v173 ADD COLUMN IF NOT EXISTS paid_hull_tier integer CHECK(paid_hull_tier BETWEEN 0 AND 20);
 CREATE TABLE IF NOT EXISTS gg_pet_vitals_v173(account_id uuid PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,hp bigint NOT NULL CHECK(hp>=0),shield bigint NOT NULL CHECK(shield>=0));
 ALTER TABLE gg_pet_vitals_v173 ADD COLUMN IF NOT EXISTS last_damage_at timestamptz NOT NULL DEFAULT now();
 ALTER TABLE gg_pet_vitals_v173 ADD COLUMN IF NOT EXISTS last_regen_at timestamptz NOT NULL DEFAULT now();
 CREATE TABLE IF NOT EXISTS gg_pet_slot_receipts_v173(account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,request_id uuid NOT NULL,kind text NOT NULL,response jsonb NOT NULL,PRIMARY KEY(account_id,request_id));`);}
 async function transaction(id,fn){
  const c=await pool.connect();
  try{
   await c.query('BEGIN');
   const balance=(await c.query('SELECT uridium FROM player_progress WHERE account_id=$1 FOR UPDATE',[id])).rows[0];
   if(!balance)throw fail('Cuenta no encontrada',404);
   if(!(await c.query("SELECT 1 FROM gg_v13_inventory WHERE account_id=$1 AND category='pet'",[id])).rowCount)throw fail('Necesitas un P.E.T.',409);
   await c.query('INSERT INTO gg_pet_progress_v173(account_id) VALUES($1) ON CONFLICT DO NOTHING',[id]);
   const row=(await c.query('SELECT experience,slots,paid_hull_tier FROM gg_pet_progress_v173 WHERE account_id=$1 FOR UPDATE',[id])).rows[0];
   const p=profile(Number(row.experience),row.slots);
   // Existing accounts without a paid tier retain their unlocked hull ceiling on opt-in.
   p.paidHullTier=row.paid_hull_tier==null?p.level:Math.min(p.level,Number(row.paid_hull_tier));
   p.hullPurchasesEnabled=process.env.GG_PET_HULL_PURCHASES_ENABLED==='1';
   const result=await fn(c,p,balance);
   await c.query('COMMIT');return result;
  }catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}
 }
 async function status(id){return transaction(id,async(_c,p,balance)=>({
  ...p,uridium:String(balance.uridium),purchasesEnabled:process.env.GG_PET_PROGRESSION_ENABLED==='1',
  nextHull:p.hullPurchasesEnabled?require('./pet-hull-upgrade-v173').hullUpgradeQuote(p.level,p.paidHullTier):null,
  nextSlots:Object.fromEntries(TYPES.map(type=>[type,p.slots[type]<p.limits[type]?quoteSlot(p,type):null]))
 }));}
 // Internal server-only grant. The caller must establish the XP sharing rule and event idempotency before enabling grants.
 async function grantInTransaction(c,id,amount){
  if(!Number.isSafeInteger(amount)||amount<0||amount>MAX_XP)throw fail('Experiencia P.E.T. inválida');
  if(!amount)return false;
  if(process.env.GG_PET_HULL_PURCHASES_ENABLED==='1'){
   const existing=(await c.query('SELECT experience FROM gg_pet_progress_v173 WHERE account_id=$1 FOR UPDATE',[id])).rows[0];
   if(existing)await c.query('UPDATE gg_pet_progress_v173 SET paid_hull_tier=$2 WHERE account_id=$1 AND paid_hull_tier IS NULL',[id,levelForExperience(Number(existing.experience)).level]);
  }
  const r=await c.query(`INSERT INTO gg_pet_progress_v173(account_id,experience,paid_hull_tier)
   SELECT $1,$2,$3 WHERE EXISTS(SELECT 1 FROM gg_v13_inventory WHERE account_id=$1 AND category='pet')
   ON CONFLICT(account_id) DO UPDATE SET experience=LEAST(9007199254740991,gg_pet_progress_v173.experience+EXCLUDED.experience)`,[id,amount,process.env.GG_PET_HULL_PURCHASES_ENABLED==='1'?0:null]);
  return r.rowCount>0;
 }
 async function buySlot(id,{type,requestId}={}){
  if(!TYPES.includes(type)||typeof requestId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId))throw fail('Solicitud de ranura inválida');
  return transaction(id,async(c,p,balance)=>{
   const previous=(await c.query('SELECT kind,response FROM gg_pet_slot_receipts_v173 WHERE account_id=$1 AND request_id=$2',[id,requestId])).rows[0];
   if(previous){if(previous.kind!==type)throw fail('Solicitud ya utilizada',409);return previous.response;}
   const q=quoteSlot(p,type);
   if(Number(balance.uridium)<q.price)throw fail('Uridium insuficiente',409);
   const slots={...p.slots,[type]:q.slot};
   const b=(await c.query('UPDATE player_progress SET uridium=uridium-$2 WHERE account_id=$1 RETURNING uridium',[id,q.price])).rows[0];
   await c.query('UPDATE gg_pet_progress_v173 SET slots=$2::jsonb WHERE account_id=$1',[id,JSON.stringify(slots)]);
   const response={...q,profile:profile(p.experience,slots),uridium:String(b.uridium)};
   await c.query('INSERT INTO gg_pet_slot_receipts_v173(account_id,request_id,kind,response) VALUES($1,$2,$3,$4::jsonb)',[id,requestId,type,JSON.stringify(response)]);
   return response;
  });
 }
 async function equipmentState(c,id,p,requested){
  const {EMPTY,validatePetEquipment,shipReservations}=require('./pet-equipment-rules-v173');
  const configs=(await c.query('SELECT configs FROM gg_v13_hangar WHERE account_id=$1',[id])).rows[0]?.configs||[[],[]];
  const rows=(await c.query("SELECT instance_id AS \"instanceId\",code,category,level FROM gg_v13_inventory WHERE account_id=$1 AND category IN ('lasers','shields','petGear')",[id])).rows;
  const saved=(await c.query('SELECT equipment FROM gg_pet_equipment_v173 WHERE account_id=$1',[id])).rows[0]?.equipment||EMPTY();
  const gearEnabled=require('./pet-test-kit-v175').gearEnabled(id);
  const candidate=requested===undefined?saved:{...requested,gear:requested?.gear??saved.gear??[]};
  if(requested!==undefined&&(!requested||typeof requested!=='object'||Array.isArray(requested)))throw fail('Equipamiento inválido');
  if(!gearEnabled&&requested!==undefined&&JSON.stringify(candidate.gear||[])!==JSON.stringify(saved.gear||[]))throw fail('Asignación de módulos en pruebas',403);
  const result=validatePetEquipment(p,candidate,new Map(rows.map(i=>[i.instanceId,i])),configs);
  if(p.hullPurchasesEnabled)result.stats.maxHp=levels[p.paidHullTier].maxHp;
  const reserved=shipReservations(configs);
  return {...result,available:rows.filter(i=>!reserved.has(i.instanceId)),enabled:require('./pet-test-kit-v175').equipmentEnabled(id),gearEnabled};
 }
 async function equipmentRead(id){return transaction(id,(c,p)=>equipmentState(c,id,p));}
 async function equipmentSave(id,body){
  if(!require('./pet-test-kit-v175').equipmentEnabled(id))throw fail('Equipamiento P.E.T. en pruebas',403);
  if(!body||!Object.hasOwn(body,'equipment'))throw fail('Equipamiento P.E.T. requerido');
  return transaction(id,async(c,p)=>{
   const result=await equipmentState(c,id,p,body.equipment);
   await c.query('INSERT INTO gg_pet_equipment_v173(account_id,equipment) VALUES($1,$2::jsonb) ON CONFLICT(account_id) DO UPDATE SET equipment=EXCLUDED.equipment',[id,JSON.stringify(result.equipment)]);
   return result;
  });
 }
 // Experimental guard uses basic ammunition from the pilot's stock, one unit per PET laser.
 async function authorizeGuardShot(id){
  if(!require('./pet-test-kit-v175').guardEnabled(id))return null;
  return transaction(id,async(c,p)=>{
   const {stats}=await equipmentState(c,id,p);
   if(!stats.lasers||!stats.damage)return {blocked:'Equipa láseres en el hangar del P.E.T.'};
   if(require('./pet-test-kit-v175').vitalsEnabled(id)){
    const row=(await c.query('SELECT hp FROM gg_pet_vitals_v173 WHERE account_id=$1',[id])).rows[0];
    if(row&&Number(row.hp)===0)return {blocked:'P.E.T. destruido'};
   }
   const row=(await c.query("UPDATE gg_v13_ammo SET quantity=quantity-$2 WHERE account_id=$1 AND code='LCB-10' AND quantity>=$2 RETURNING quantity",[id,stats.lasers])).rows[0];
   return row?{code:'LCB-10',count:stats.lasers,damage:stats.damage,stock:Number(row.quantity)}:{blocked:'Munición LCB-10 insuficiente'};
  });
 }
 async function readVitals(c,id,p){
  const {vitals}=require('./pet-vitals-v173');
  const {stats}=await equipmentState(c,id,p);
  const row=(await c.query('SELECT hp,shield FROM gg_pet_vitals_v173 WHERE account_id=$1',[id])).rows[0];
  const saved=row?{hp:Number(row.hp),shield:Number(row.shield)}:null;
  return {stats,saved,vitals:vitals(stats,saved)};
 }
 async function writeVitals(c,id,v){
  await c.query('INSERT INTO gg_pet_vitals_v173(account_id,hp,shield) VALUES($1,$2,$3) ON CONFLICT(account_id) DO UPDATE SET hp=EXCLUDED.hp,shield=EXCLUDED.shield',[id,v.hp,v.shield]);
 }
 async function vitalsRead(id){return transaction(id,async(c,p)=>{const {vitals,stats}=await readVitals(c,id,p);return {...vitals,lasers:stats.lasers,damage:stats.damage,repairPrice:p.repair,enabled:require('./pet-test-kit-v175').vitalsEnabled(id)};});}
 // Internal server-only repair tick. No client-supplied amount or duration.
 async function repairPetHullTick(id){
  const rules=require('./pet-support-gears-v178');if(!rules.repairEnabled(id))throw fail('Reparación en pruebas',403);
  return transaction(id,async(c,p)=>{
   const {equipment,available,stats}=await equipmentState(c,id,p);
   const gear=available.find(i=>i.category==='petGear'&&i.code==='G-REP1'&&equipment.gear?.includes(i.instanceId));
   const spec=rules.supportSpec('G-REP1',gear?.level);if(!spec)throw fail('Equipa el módulo G-REP1');
   const {vitals}=require('./pet-vitals-v173');
   const row=(await c.query('SELECT hp,shield FROM gg_pet_vitals_v173 WHERE account_id=$1',[id])).rows[0];
   const v=vitals(stats,row?{hp:Number(row.hp),shield:Number(row.shield)}:null);
   if(v.destroyed)throw fail('P.E.T. destruido');
   const hp=rules.repairHull(v.hp,v.maxHp,spec.repairPerSecond,1000);
   if(hp!==v.hp)await writeVitals(c,id,{...v,hp});
   return {...v,hp,lasers:stats.lasers,damage:stats.damage,repairPrice:p.repair,enabled:true,durationMs:spec.durationMs};
  });
 }
 async function applyPetDamage(id,amount){
  if(!require('./pet-test-kit-v175').vitalsEnabled(id))return null;
  return transaction(id,async(c,p)=>{
   const {stats,saved}=await readVitals(c,id,p);
   const v=require('./pet-vitals-v173').damageVitals(stats,saved,amount);
   await writeVitals(c,id,v);
   if(amount>0)await c.query('UPDATE gg_pet_vitals_v173 SET last_damage_at=now() WHERE account_id=$1',[id]);
   return v;
  });
 }
 async function regeneratePetShield(id){
  const rules=require('./pet-vitals-v173'),percent=rules.shieldRegenPercent(process.env.GG_PET_SHIELD_REGEN_PERCENT);
  if(!require('./pet-test-kit-v175').vitalsEnabled(id)||!percent)return null;
  return transaction(id,async(c,p)=>{
   const {stats,saved,vitals}=await readVitals(c,id,p);
   if(!saved||vitals.destroyed||vitals.shield>=vitals.maxShield)return vitals;
   const row=(await c.query("SELECT EXTRACT(EPOCH FROM (now()-GREATEST(last_damage_at,last_regen_at)))*1000 AS elapsed FROM gg_pet_vitals_v173 WHERE account_id=$1",[id])).rows[0];
   const v=rules.regenerateShield(stats,saved,percent,Number(row?.elapsed||0));
   if(v.shield>vitals.shield){
    await writeVitals(c,id,v);
    await c.query('UPDATE gg_pet_vitals_v173 SET last_regen_at=now() WHERE account_id=$1',[id]);
   }
   return v;
  });
 }
 async function upgradeHull(id,body){
  if(process.env.GG_PET_HULL_PURCHASES_ENABLED!=='1')throw fail('Mejora de vida P.E.T. en pruebas',403);
  const requestId=body?.requestId;
  if(typeof requestId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId))throw fail('Solicitud inválida');
  return transaction(id,async(c,p,balance)=>{
   const receipt=(await c.query('SELECT kind,response FROM gg_pet_slot_receipts_v173 WHERE account_id=$1 AND request_id=$2',[id,requestId])).rows[0];
   if(receipt){if(receipt.kind!=='hull')throw fail('Solicitud ya utilizada',409);return receipt.response;}
   const r=require('./pet-hull-upgrade-v173').purchaseHull(p.level,p.paidHullTier,Number(balance.uridium));
   if(body.tier!==r.tier)throw fail('Actualiza el precio y nivel de mejora',409);
   await c.query('UPDATE player_progress SET uridium=uridium-$2 WHERE account_id=$1',[id,r.price]);
   await c.query('UPDATE gg_pet_progress_v173 SET paid_hull_tier=$2 WHERE account_id=$1',[id,r.tier]);
   const response={...r,uridium:String(r.uridium)};
   await c.query('INSERT INTO gg_pet_slot_receipts_v173(account_id,request_id,kind,response) VALUES($1,$2,$3,$4::jsonb)',[id,requestId,'hull',JSON.stringify(response)]);
   return response;
  });
 }
 async function repairPet(id,body){
  if(!require('./pet-test-kit-v175').vitalsEnabled(id))throw fail('Reparación P.E.T. en pruebas',403);
  const requestId=body?.requestId;
  if(typeof requestId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId))throw fail('Solicitud inválida');
  return transaction(id,async(c,p,balance)=>{
   const receipt=(await c.query('SELECT kind,response FROM gg_pet_slot_receipts_v173 WHERE account_id=$1 AND request_id=$2',[id,requestId])).rows[0];
   if(receipt){if(receipt.kind!=='repair')throw fail('Solicitud ya utilizada',409);return receipt.response;}
   const {stats,saved}=await readVitals(c,id,p);
   const r=require('./pet-vitals-v173').repairVitals(stats,saved,p.repair,Number(balance.uridium));
   if(r.price)await c.query('UPDATE player_progress SET uridium=uridium-$2 WHERE account_id=$1',[id,r.price]);
   await writeVitals(c,id,r.vitals);
   await c.query('UPDATE gg_pet_vitals_v173 SET last_regen_at=now() WHERE account_id=$1',[id]);
   const response={...r,uridium:String(r.uridium)};
   await c.query('INSERT INTO gg_pet_slot_receipts_v173(account_id,request_id,kind,response) VALUES($1,$2,$3,$4::jsonb)',[id,requestId,'repair',JSON.stringify(response)]);
   return response;
  });
 }
 return {ready,status,grantInTransaction,buySlot,equipmentRead,equipmentSave,authorizeGuardShot,vitalsRead,applyPetDamage,repairPet,repairPetHullTick,regeneratePetShield,upgradeHull};
}
module.exports={levelForExperience,profile,quoteSlot,createPetProgression,TYPES,INITIAL};
