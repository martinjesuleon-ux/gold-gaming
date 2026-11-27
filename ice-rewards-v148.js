'use strict';
const {REWARD,RULES,shares}=require('./ice-v146');
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
const fail=(message,status=400)=>Object.assign(Error(message),{status});
function normalize(contributors){
 if(!Array.isArray(contributors)||contributors.length<1||contributors.length>10000)throw fail('Participantes inválidos');
 const map=new Map();for(const p of contributors){if(!uuid(p.accountId)||!Number.isSafeInteger(p.damage)||p.damage<1||map.has(p.accountId))throw fail('Participante inválido');map.set(p.accountId,p.damage);}
 return shares(map).sort((a,b)=>a.accountId.localeCompare(b.accountId));
}
function createIceRewards(pool){
 async function ready(){await pool.query(`CREATE TABLE IF NOT EXISTS gg_ice_results(event_id uuid PRIMARY KEY,rewards jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now());CREATE TABLE IF NOT EXISTS gg_ice_boxes(box_id uuid PRIMARY KEY,event_id uuid NOT NULL REFERENCES gg_ice_results(event_id),account_id uuid NOT NULL REFERENCES accounts(id),claimed_at timestamptz NOT NULL DEFAULT now());`);}
 async function tx(fn){const c=await pool.connect();try{await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(71413008)');const r=await fn(c);await c.query('COMMIT');return r;}catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}}
 async function settle(eventId,contributors){if(!uuid(eventId))throw fail('Evento inválido');const rewards=normalize(contributors);return tx(async c=>{
 const existing=(await c.query('SELECT rewards FROM gg_ice_results WHERE event_id=$1',[eventId])).rows[0];
 if(existing){if(JSON.stringify(existing.rewards.map(p=>[p.accountId,...Object.keys(REWARD).map(k=>p[k])]))!==JSON.stringify(rewards.map(p=>[p.accountId,...Object.keys(REWARD).map(k=>p[k])])))throw fail('Resultado incompatible',409);return {duplicate:true,rewards};}
 await c.query('INSERT INTO gg_ice_results(event_id,rewards) VALUES($1,$2)',[eventId,JSON.stringify(rewards)]);
 for(const r of rewards){if(!(await c.query('UPDATE player_progress SET credits=credits+$2,experience=experience+$3,uridium=uridium+$4,honor=honor+$5,level=CASE WHEN experience+$3<10000 THEN 1 ELSE 2+FLOOR(LOG(2,((experience+$3)::numeric/10000)))::int END,updated_at=now() WHERE account_id=$1',[r.accountId,r.credits,r.xp,r.uridium,r.honor])).rowCount)throw fail('Participante sin progreso');}
 return {duplicate:false,rewards};});}
 async function claim(id,eventId,boxId){if(![id,eventId,boxId].every(uuid))throw fail('Caja inválida');return tx(async c=>{
 if(!(await c.query('SELECT 1 FROM gg_ice_results WHERE event_id=$1',[eventId])).rowCount)throw fail('Evento no liquidado');
 const prior=(await c.query('SELECT account_id,event_id FROM gg_ice_boxes WHERE box_id=$1',[boxId])).rows[0];if(prior){if(prior.account_id!==id||prior.event_id!==eventId)throw fail('Caja recogida',409);return {duplicate:true,uridium:RULES.boxUridium};}
 if(Number((await c.query('SELECT count(*) FROM gg_ice_boxes WHERE event_id=$1',[eventId])).rows[0].count)>=RULES.boxCount)throw fail('Cajas agotadas',409);
 await c.query('INSERT INTO gg_ice_boxes(box_id,event_id,account_id) VALUES($1,$2,$3)',[boxId,eventId,id]);
 if(!(await c.query('UPDATE player_progress SET uridium=uridium+$2 WHERE account_id=$1',[id,RULES.boxUridium])).rowCount)throw fail('Piloto sin progreso');
 return {duplicate:false,uridium:RULES.boxUridium};});}
 return {ready,settle,claim};
}
module.exports={normalize,createIceRewards};
