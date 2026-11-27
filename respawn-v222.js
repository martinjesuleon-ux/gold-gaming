'use strict';
const {premiumRead}=require('./boosters-v112');const {MAPS}=require('./maps-v14');
const BASE_COST=Object.freeze({base:0,portal:500,position:1000});
const fail=(message,status=400)=>Object.assign(Error(message),{status});
function repairQuote(mode,premium=false,vouchers=0){
 if(!Object.hasOwn(BASE_COST,mode))throw fail('Opción de reparación inválida');
 const baseCost=BASE_COST[mode];
 const voucher=baseCost>0&&!premium&&BigInt(vouchers)>0n?1:0;
 return {mode,baseCost,uridium:premium||voucher?0:baseCost,vouchers:voucher,premium:!!premium};
}
function nearestRepairPortal(portals,x,y){
 if(!Number.isFinite(x)||!Number.isFinite(y))return null;
 return portals.filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&!p.gate&&!p.gateId).reduce((best,p)=>!best||Math.hypot(p.x-x,p.y-y)<Math.hypot(best.x-x,best.y-y)?p:best,null);
}
function validDestination(d){return !!d&&typeof d.zone==='string'&&Object.hasOwn(MAPS,d.zone)&&Number.isFinite(d.x)&&Number.isFinite(d.y)&&d.x>=0&&d.y>=0&&d.x<=12000&&d.y<=8000;}
function createRespawn(pool){
 async function ready(){await pool.query('CREATE TABLE IF NOT EXISTS gg_respawn_receipts_v222(account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,death_id uuid NOT NULL,response jsonb NOT NULL,PRIMARY KEY(account_id,death_id)); ALTER TABLE gg_respawn_receipts_v222 ADD COLUMN IF NOT EXISTS delivered_at timestamptz; ALTER TABLE gg_respawn_receipts_v222 ADD COLUMN IF NOT EXISTS destination jsonb; CREATE TABLE IF NOT EXISTS gg_respawn_deaths_v223(account_id uuid PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,death_id uuid NOT NULL,destination jsonb NOT NULL,ready_at bigint NOT NULL);');}
 async function options(id){const premium=await premiumRead(pool,id);const stock=(await pool.query("SELECT quantity FROM gg_v13_ammo WHERE account_id=$1 AND code='repair-voucher'",[id])).rows[0]?.quantity||0;return Object.keys(BASE_COST).map(mode=>repairQuote(mode,premium,stock));}
 async function markDeath(id,deathId,destination,readyAt){
  if(!validDestination(destination)||!Number.isSafeInteger(readyAt))throw fail('Estado de destrucción inválido');
  const c=await pool.connect();try{await c.query('BEGIN');
   await c.query('SELECT account_id FROM player_progress WHERE account_id=$1 FOR UPDATE',[id]);
   const prior=(await c.query('SELECT 1 FROM gg_respawn_receipts_v222 WHERE account_id=$1 AND death_id=$2',[id,deathId])).rows[0];
   if(!prior){await c.query('UPDATE gg_respawn_receipts_v222 SET delivered_at=now() WHERE account_id=$1 AND delivered_at IS NULL AND destination IS NOT NULL',[id]);await c.query('INSERT INTO gg_respawn_deaths_v223(account_id,death_id,destination,ready_at) VALUES($1,$2,$3,$4) ON CONFLICT(account_id) DO UPDATE SET death_id=EXCLUDED.death_id,destination=EXCLUDED.destination,ready_at=EXCLUDED.ready_at WHERE gg_respawn_deaths_v223.death_id<>EXCLUDED.death_id',[id,deathId,JSON.stringify(destination),readyAt]);}
   await c.query('COMMIT');
  }catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}
 }
 async function deathState(id){const r=(await pool.query('SELECT death_id AS "deathId",destination,ready_at AS "readyAt" FROM gg_respawn_deaths_v223 WHERE account_id=$1',[id])).rows[0];return r&&validDestination(r.destination)?{...r,readyAt:Number(r.readyAt)}:null;}
 async function charge(id,deathId,mode,destination=null,requireDeath=false){
  if(destination!==null&&!validDestination(destination))throw fail('Destino inválido');
  if(typeof deathId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(deathId)||!Object.hasOwn(BASE_COST,mode))throw fail('Solicitud inválida');
  const c=await pool.connect();try{await c.query('BEGIN');
   const p=(await c.query('SELECT uridium FROM player_progress WHERE account_id=$1 FOR UPDATE',[id])).rows[0];if(!p)throw fail('Piloto no disponible',404);
   const prior=(await c.query('SELECT response FROM gg_respawn_receipts_v222 WHERE account_id=$1 AND death_id=$2',[id,deathId])).rows[0];
   if(prior){if(prior.response.mode!==mode)throw fail('Reaparición ya confirmada',409);await c.query('COMMIT');return prior.response;}
   if(requireDeath){const row=(await c.query('SELECT death_id,ready_at FROM gg_respawn_deaths_v223 WHERE account_id=$1',[id])).rows[0];if(!row||row.death_id!==deathId||Number(row.ready_at)>Date.now()||!destination)throw fail('Destrucción pendiente no disponible',409);}
   const premium=await premiumRead(c,id);
   const stock=(await c.query("SELECT quantity FROM gg_v13_ammo WHERE account_id=$1 AND code='repair-voucher'",[id])).rows[0]?.quantity||0;
   const q=repairQuote(mode,premium,stock);
   if(q.vouchers){const v=await c.query("UPDATE gg_v13_ammo SET quantity=quantity-1 WHERE account_id=$1 AND code='repair-voucher' AND quantity>=1",[id]);if(!v.rowCount)throw fail('Vale no disponible',409);}
   if(q.uridium){const v=await c.query('UPDATE player_progress SET uridium=uridium-$2 WHERE account_id=$1 AND uridium>=$2',[id,q.uridium]);if(!v.rowCount)throw fail('Uridium insuficiente',409);}
   if(destination){
    await c.query('UPDATE gg_respawn_receipts_v222 SET delivered_at=now() WHERE account_id=$1 AND destination IS NOT NULL AND delivered_at IS NULL',[id]);
    await c.query('INSERT INTO gg_respawn_receipts_v222(account_id,death_id,response,destination) VALUES($1,$2,$3,$4)',[id,deathId,JSON.stringify(q),JSON.stringify(destination)]);
   }else{
   await c.query('INSERT INTO gg_respawn_receipts_v222(account_id,death_id,response) VALUES($1,$2,$3)',[id,deathId,JSON.stringify(q)]);
   }
   if(requireDeath)await c.query('DELETE FROM gg_respawn_deaths_v223 WHERE account_id=$1 AND death_id=$2',[id,deathId]);
   await c.query('COMMIT');return q;
  }catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}
 }
 async function pending(id){const row=(await pool.query('SELECT death_id AS "deathId",response,destination FROM gg_respawn_receipts_v222 WHERE account_id=$1 AND destination IS NOT NULL AND delivered_at IS NULL LIMIT 1',[id])).rows[0];return row&&validDestination(row.destination)?row:null;}
 async function acknowledge(id,deathId){const r=await pool.query('UPDATE gg_respawn_receipts_v222 SET delivered_at=now() WHERE account_id=$1 AND death_id=$2 AND destination IS NOT NULL AND delivered_at IS NULL',[id,deathId]);return !!r.rowCount;}
 return {ready,charge,options,pending,acknowledge,markDeath,deathState};
}
module.exports={BASE_COST,repairQuote,nearestRepairPortal,validDestination,createRespawn};
