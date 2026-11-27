'use strict';
const {WAVES}=require('./invasion-v134');
const fail=message=>Object.assign(Error(message),{status:400});
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
function normalize(result){
 if(!result||!uuid(result.id)||!Object.hasOwn(WAVES,result.difficulty)||!['finished','failed','cancelled'].includes(result.phase)||!Array.isArray(result.pilots)||result.pilots.length<1||result.pilots.length>25)throw fail('Resultado inválido');
 const seen=new Set(),pilots=result.pilots.map(p=>{if(!uuid(p.accountId)||seen.has(p.accountId)||!Number.isSafeInteger(p.points)||p.points<0||typeof p.left!=='boolean')throw fail('Participante inválido');seen.add(p.accountId);return {accountId:p.accountId,points:p.points,left:p.left};}).sort((a,b)=>a.accountId.localeCompare(b.accountId));
 return {id:result.id,difficulty:result.difficulty,phase:result.phase,pilots};
}
function createResults(pool){
 async function ready(){await pool.query(`CREATE TABLE IF NOT EXISTS gg_invasion_results(event_id uuid PRIMARY KEY,difficulty text NOT NULL,phase text NOT NULL,payload jsonb NOT NULL,finished_at timestamptz NOT NULL DEFAULT now());
 CREATE TABLE IF NOT EXISTS gg_invasion_pilots(event_id uuid NOT NULL REFERENCES gg_invasion_results(event_id) ON DELETE CASCADE,account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,points bigint NOT NULL CHECK(points>=0),abandoned boolean NOT NULL,PRIMARY KEY(event_id,account_id));
 CREATE INDEX IF NOT EXISTS gg_invasion_pilot_history ON gg_invasion_pilots(account_id,event_id);`);}
 async function settle(input){
  const d=normalize(input),payload=JSON.stringify(d),c=await pool.connect();
  try{await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(71413006)');
   const prior=(await c.query('SELECT payload=$2::jsonb AS same FROM gg_invasion_results WHERE event_id=$1',[d.id,payload])).rows[0];
   if(prior){if(!prior.same)throw fail('Resultado en conflicto');await c.query('COMMIT');return {saved:true,duplicate:true};}
   await c.query('INSERT INTO gg_invasion_results(event_id,difficulty,phase,payload) VALUES($1,$2,$3,$4)',[d.id,d.difficulty,d.phase,payload]);
   for(const p of d.pilots)await c.query('INSERT INTO gg_invasion_pilots(event_id,account_id,points,abandoned) SELECT $1,id,$3,$4 FROM accounts WHERE id=$2',[d.id,p.accountId,p.points,p.left]);
   await c.query('COMMIT');return {saved:true,duplicate:false};
  }catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}
 }
 async function status(id){
  const history=(await pool.query('SELECT r.event_id,r.difficulty,r.phase,r.finished_at,p.points,p.abandoned FROM gg_invasion_pilots p JOIN gg_invasion_results r USING(event_id) WHERE p.account_id=$1 ORDER BY r.finished_at DESC,r.event_id LIMIT 30',[id])).rows;
  const rows=(await pool.query(`SELECT a.username AS name,SUM(p.points)::bigint AS points,count(*) AS completed,p.account_id=$1 AS own FROM gg_invasion_pilots p JOIN gg_invasion_results r USING(event_id) JOIN accounts a ON a.id=p.account_id JOIN player_progress q ON q.account_id=p.account_id LEFT JOIN gg_rank_profiles k ON k.account_id=p.account_id WHERE r.phase='finished' AND NOT p.abandoned AND p.points>0 AND q.honor>=0 AND NOT COALESCE(k.admin,false) GROUP BY a.username,p.account_id ORDER BY points DESC,a.username,p.account_id LIMIT 100`,[id])).rows;
  return {history,rows,rewardPolicy:'score-only'};
 }
 return {ready,settle,status};
}
module.exports={normalize,createResults};
