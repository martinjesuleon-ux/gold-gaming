'use strict';
const NPCS=require('./data/npcs-v14.json');
const fail=(message,status=400)=>Object.assign(Error(message),{status});
function unitReward(unitId){
 if(typeof unitId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:[0-6]$/i.test(unitId))throw fail('Unidad Hitac inválida');
 const name=unitId.endsWith(':0')?'Hitac Mothership':'Hitac Minion',n=NPCS[name];
 return {name,credits:n.credits,uridium:n.uridium,xp:n.xp,honor:n.honor};
}
function createHitacRewards(pool){
 async function ready(){await pool.query(`CREATE TABLE IF NOT EXISTS gg_hitac_rewards(unit_id text PRIMARY KEY,account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,reward jsonb NOT NULL,claimed_at timestamptz NOT NULL DEFAULT now());`);}
 async function claim(id,unitId){
 const reward=unitReward(unitId),c=await pool.connect();
 try{await c.query('BEGIN');
 const p=(await c.query('SELECT credits,experience,uridium,honor,level FROM player_progress WHERE account_id=$1 FOR UPDATE',[id])).rows[0];if(!p)throw fail('Piloto no disponible',404);
 const inserted=(await c.query('INSERT INTO gg_hitac_rewards(unit_id,account_id,reward) VALUES($1,$2,$3) ON CONFLICT(unit_id) DO NOTHING RETURNING unit_id',[unitId,id,JSON.stringify(reward)])).rowCount;
 if(!inserted){if(!(await c.query('SELECT 1 FROM gg_hitac_rewards WHERE unit_id=$1 AND account_id=$2',[unitId,id])).rowCount)throw fail('Recompensa ya acreditada',409);await c.query('COMMIT');return {duplicate:true,reward,balance:p};}
 const balance=(await c.query('UPDATE player_progress SET credits=credits+$2,experience=experience+$3,uridium=uridium+$4,honor=honor+$5,level=CASE WHEN experience+$3<10000 THEN 1 ELSE 2+FLOOR(LOG(2,((experience+$3)::numeric/10000)))::int END,updated_at=now() WHERE account_id=$1 RETURNING credits,experience,uridium,honor,level',[id,reward.credits,reward.xp,reward.uridium,reward.honor])).rows[0];await c.query('COMMIT');return {duplicate:false,reward,balance};
 }catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}
 }
 return {ready,claim};
}
module.exports={unitReward,createHitacRewards};
