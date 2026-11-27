'use strict';
const {REWARDS}=require('./spaceball-v138');
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
const fail=(message,status=400)=>Object.assign(Error(message),{status});
const STACKS={'RSB-75':'RSB-75',gateEnergy:'gate-energy',jumpVouchers:'jump-voucher',repairVouchers:'repair-voucher'};
function validate(reward){
 if(!reward||typeof reward!=='object'||Object.keys(reward).length!==Object.keys(REWARDS).length)throw fail('Premio inválido');
 return Object.fromEntries(Object.entries(REWARDS).map(([k,[min,max]])=>{const n=reward[k];if(!Number.isSafeInteger(n)||n<min||n>max)throw fail('Premio inválido');return [k,n];}));
}
function createSpaceballRewards(pool){
 async function ready(){await pool.query(`CREATE TABLE IF NOT EXISTS gg_spaceball_claims(box_id uuid PRIMARY KEY,account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,event_id uuid NOT NULL,rewards jsonb NOT NULL,claimed_at timestamptz NOT NULL DEFAULT now());`);}
 // Internal game service only. The caller must validate position, event and expiry.
 async function claim(id,eventId,boxId,reward){
  if(![id,eventId,boxId].every(uuid))throw fail('Caja inválida');
  const r=validate(reward),c=await pool.connect();
  try{
   await c.query('BEGIN');
   const account=(await c.query('SELECT credits,uridium FROM player_progress WHERE account_id=$1 FOR UPDATE',[id])).rows[0];
   if(!account)throw fail('Piloto no disponible',404);
   const inserted=(await c.query('INSERT INTO gg_spaceball_claims(box_id,account_id,event_id,rewards) VALUES($1,$2,$3,$4) ON CONFLICT(box_id) DO NOTHING RETURNING box_id',[boxId,id,eventId,JSON.stringify(r)])).rowCount;
   if(!inserted){
    const own=(await c.query('SELECT 1 FROM gg_spaceball_claims WHERE box_id=$1 AND account_id=$2 AND event_id=$3 AND rewards=$4::jsonb',[boxId,id,eventId,JSON.stringify(r)])).rowCount;
    if(!own)throw fail('Caja ya recogida',409);
    await c.query('COMMIT');return {duplicate:true,rewards:r,balance:account};
   }
   for(const [k,code] of Object.entries(STACKS))await c.query('INSERT INTO gg_v13_ammo(account_id,code,quantity) VALUES($1,$2,$3) ON CONFLICT(account_id,code) DO UPDATE SET quantity=gg_v13_ammo.quantity+EXCLUDED.quantity',[id,code,r[k]]);
   const balance=(await c.query('UPDATE player_progress SET credits=credits+$2,uridium=uridium+$3 WHERE account_id=$1 RETURNING credits,uridium',[id,r.credits,r.uridium])).rows[0];
   await c.query('COMMIT');return {duplicate:false,rewards:r,balance};
  }catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}
 }
 return {ready,claim};
}
module.exports={validate,createSpaceballRewards};
