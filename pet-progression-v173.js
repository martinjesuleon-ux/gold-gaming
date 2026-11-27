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
 CREATE TABLE IF NOT EXISTS gg_pet_slot_receipts_v173(account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,request_id uuid NOT NULL,kind text NOT NULL,response jsonb NOT NULL,PRIMARY KEY(account_id,request_id));`);}
 async function transaction(id,fn){
  const c=await pool.connect();
  try{
   await c.query('BEGIN');
   const balance=(await c.query('SELECT uridium FROM player_progress WHERE account_id=$1 FOR UPDATE',[id])).rows[0];
   if(!balance)throw fail('Cuenta no encontrada',404);
   if(!(await c.query("SELECT 1 FROM gg_v13_inventory WHERE account_id=$1 AND category='pet'",[id])).rowCount)throw fail('Necesitas un P.E.T.',409);
   await c.query('INSERT INTO gg_pet_progress_v173(account_id) VALUES($1) ON CONFLICT DO NOTHING',[id]);
   const row=(await c.query('SELECT experience,slots FROM gg_pet_progress_v173 WHERE account_id=$1 FOR UPDATE',[id])).rows[0];
   const result=await fn(c,profile(Number(row.experience),row.slots),balance);
   await c.query('COMMIT');return result;
  }catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}
 }
 async function status(id){return transaction(id,async(_c,p,balance)=>({
  ...p,uridium:String(balance.uridium),purchasesEnabled:process.env.GG_PET_PROGRESSION_ENABLED==='1',
  nextSlots:Object.fromEntries(TYPES.map(type=>[type,p.slots[type]<p.limits[type]?quoteSlot(p,type):null]))
 }));}
 // Internal server-only grant. The caller must establish the XP sharing rule and event idempotency before enabling grants.
 async function grantInTransaction(c,id,amount){
  if(!Number.isSafeInteger(amount)||amount<0||amount>MAX_XP)throw fail('Experiencia P.E.T. inválida');
  if(!amount)return false;
  const r=await c.query(`INSERT INTO gg_pet_progress_v173(account_id,experience)
   SELECT $1,$2 WHERE EXISTS(SELECT 1 FROM gg_v13_inventory WHERE account_id=$1 AND category='pet')
   ON CONFLICT(account_id) DO UPDATE SET experience=LEAST(9007199254740991,gg_pet_progress_v173.experience+EXCLUDED.experience)`,[id,amount]);
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
  const rows=(await c.query("SELECT instance_id AS \"instanceId\",code,category,level FROM gg_v13_inventory WHERE account_id=$1 AND category IN ('lasers','shields')",[id])).rows;
  const saved=(await c.query('SELECT equipment FROM gg_pet_equipment_v173 WHERE account_id=$1',[id])).rows[0]?.equipment||EMPTY();
  const result=validatePetEquipment(p,requested===undefined?saved:requested,new Map(rows.map(i=>[i.instanceId,i])),configs);
  const reserved=shipReservations(configs);
  return {...result,available:rows.filter(i=>!reserved.has(i.instanceId)),enabled:process.env.GG_PET_EQUIPMENT_ENABLED==='1'};
 }
 async function equipmentRead(id){return transaction(id,(c,p)=>equipmentState(c,id,p));}
 async function equipmentSave(id,body){
  if(process.env.GG_PET_EQUIPMENT_ENABLED!=='1')throw fail('Equipamiento P.E.T. en pruebas',403);
  if(!body||!Object.hasOwn(body,'equipment'))throw fail('Equipamiento P.E.T. requerido');
  return transaction(id,async(c,p)=>{
   const result=await equipmentState(c,id,p,body.equipment);
   await c.query('INSERT INTO gg_pet_equipment_v173(account_id,equipment) VALUES($1,$2::jsonb) ON CONFLICT(account_id) DO UPDATE SET equipment=EXCLUDED.equipment',[id,JSON.stringify(result.equipment)]);
   return result;
  });
 }
 // Experimental guard uses basic ammunition from the pilot's stock, one unit per PET laser.
 async function authorizeGuardShot(id){
  if(process.env.GG_PET_GUARD_ENABLED!=='1'||process.env.GG_PET_EQUIPMENT_ENABLED!=='1')return null;
  return transaction(id,async(c,p)=>{
   const {stats}=await equipmentState(c,id,p);
   if(!stats.lasers||!stats.damage)return null;
   const row=(await c.query("UPDATE gg_v13_ammo SET quantity=quantity-$2 WHERE account_id=$1 AND code='LCB-10' AND quantity>=$2 RETURNING quantity",[id,stats.lasers])).rows[0];
   return row?{code:'LCB-10',count:stats.lasers,damage:stats.damage,stock:Number(row.quantity)}:null;
  });
 }
 return {ready,status,grantInTransaction,buySlot,equipmentRead,equipmentSave,authorizeGuardShot};
}
module.exports={levelForExperience,profile,quoteSlot,createPetProgression,TYPES,INITIAL};
