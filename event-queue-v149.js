'use strict';
const fail=(message,status=400)=>Object.assign(Error(message),{status});
const KINDS=new Set(['ice','hitac','invasion']);
function createEventQueue(pool,handlers){
 async function ready(){await pool.query(`CREATE TABLE IF NOT EXISTS gg_event_reward_queue(kind text NOT NULL,job_id text NOT NULL,payload jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),done_at timestamptz,attempts integer NOT NULL DEFAULT 0,next_attempt timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(kind,job_id));CREATE INDEX IF NOT EXISTS gg_event_reward_pending ON gg_event_reward_queue(next_attempt) WHERE done_at IS NULL;`);}
 async function enqueue(kind,id,payload){
 if(!KINDS.has(kind)||typeof id!=='string'||!id.length||id.length>128||!payload||typeof payload!=='object')throw fail('Evento inválido');
 const data=JSON.stringify(payload);if(data.length>2000000)throw fail('Evento demasiado grande');
 const r=await pool.query('INSERT INTO gg_event_reward_queue(kind,job_id,payload) VALUES($1,$2,$3) ON CONFLICT(kind,job_id) DO UPDATE SET payload=gg_event_reward_queue.payload WHERE gg_event_reward_queue.payload=EXCLUDED.payload RETURNING done_at',[kind,id,data]);if(!r.rowCount)throw fail('Evento incompatible',409);return {done:!!r.rows[0].done_at};
 }
 async function process(kind,id){
 if(!KINDS.has(kind)||!handlers[kind])throw fail('Tipo de evento inválido');
 const row=(await pool.query('SELECT payload,done_at FROM gg_event_reward_queue WHERE kind=$1 AND job_id=$2',[kind,id])).rows[0];if(!row)throw fail('Evento no registrado');if(row.done_at)return handlers[kind](row.payload);
 // Handlers must be idempotent. Concurrent workers and restarts may repeat execution.
 try{const result=await handlers[kind](row.payload);await pool.query('UPDATE gg_event_reward_queue SET done_at=now() WHERE kind=$1 AND job_id=$2 AND done_at IS NULL',[kind,id]);return result;}
 catch(e){await pool.query("UPDATE gg_event_reward_queue SET attempts=attempts+1,next_attempt=now()+interval '30 seconds' WHERE kind=$1 AND job_id=$2 AND done_at IS NULL",[kind,id]).catch(()=>{});throw e;}
 }
 async function deliver(kind,id,payload){await enqueue(kind,id,payload);return process(kind,id);}
 async function drain(limit=20){const rows=(await pool.query('SELECT kind,job_id FROM gg_event_reward_queue WHERE done_at IS NULL AND next_attempt<=now() ORDER BY created_at LIMIT $1',[limit])).rows;return Promise.allSettled(rows.map(r=>process(r.kind,r.job_id)));}
 return {ready,enqueue,process,deliver,drain};
}
module.exports={createEventQueue};
