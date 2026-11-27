'use strict';
const {premiumRead}=require('./boosters-v112');
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
function createRespawn(pool){
 async function ready(){await pool.query('CREATE TABLE IF NOT EXISTS gg_respawn_receipts_v222(account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,death_id uuid NOT NULL,response jsonb NOT NULL,PRIMARY KEY(account_id,death_id))');}
 async function charge(id,deathId,mode){
  if(typeof deathId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(deathId)||!Object.hasOwn(BASE_COST,mode))throw fail('Solicitud inválida');
  const c=await pool.connect();try{await c.query('BEGIN');
   const p=(await c.query('SELECT uridium FROM player_progress WHERE account_id=$1 FOR UPDATE',[id])).rows[0];if(!p)throw fail('Piloto no disponible',404);
   const prior=(await c.query('SELECT response FROM gg_respawn_receipts_v222 WHERE account_id=$1 AND death_id=$2',[id,deathId])).rows[0];
   if(prior){if(prior.response.mode!==mode)throw fail('Reaparición ya confirmada',409);await c.query('COMMIT');return prior.response;}
   const premium=await premiumRead(c,id);
   const stock=(await c.query("SELECT quantity FROM gg_v13_ammo WHERE account_id=$1 AND code='repair-voucher'",[id])).rows[0]?.quantity||0;
   const q=repairQuote(mode,premium,stock);
   if(q.vouchers){const v=await c.query("UPDATE gg_v13_ammo SET quantity=quantity-1 WHERE account_id=$1 AND code='repair-voucher' AND quantity>=1",[id]);if(!v.rowCount)throw fail('Vale no disponible',409);}
   if(q.uridium){const v=await c.query('UPDATE player_progress SET uridium=uridium-$2 WHERE account_id=$1 AND uridium>=$2',[id,q.uridium]);if(!v.rowCount)throw fail('Uridium insuficiente',409);}
   await c.query('INSERT INTO gg_respawn_receipts_v222(account_id,death_id,response) VALUES($1,$2,$3)',[id,deathId,JSON.stringify(q)]);
   await c.query('COMMIT');return q;
  }catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}
 }
 return {ready,charge};
}
module.exports={BASE_COST,repairQuote,nearestRepairPortal,createRespawn};
