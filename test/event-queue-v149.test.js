'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {createEventQueue}=require('../event-queue-v149');
test('Event queue survives worker recreation, retries failure and rejects conflicting jobs',{skip:process.env.GG_TEST_DB!=='1'||!process.env.DATABASE_URL},async t=>{
 const {Pool}=require('pg'),pool=new Pool({connectionString:process.env.DATABASE_URL});t.after(()=>pool.end());const id=randomUUID(),payload={eventId:id,contributors:[]};
 try{
 const first=createEventQueue(pool,{ice:async()=>{throw Error('Temporary failure');}});await first.ready();await assert.rejects(first.deliver('ice',id,payload),/Temporary failure/);
 const row=(await pool.query('SELECT attempts,done_at FROM gg_event_reward_queue WHERE kind=$1 AND job_id=$2',['ice',id])).rows[0];assert.equal(row.attempts,1);assert.equal(row.done_at,null);
 await assert.rejects(first.enqueue('ice',id,{...payload,contributors:['changed']}),/incompatible/);
 await pool.query('UPDATE gg_event_reward_queue SET next_attempt=now() WHERE kind=$1 AND job_id=$2',['ice',id]);
 let calls=0;const second=createEventQueue(pool,{ice:async p=>{assert.deepEqual(p,payload);calls++;return {saved:true};}});await second.drain();assert.equal(calls,1);
 assert.equal((await second.enqueue('ice',id,payload)).done,true);await second.drain();assert.equal(calls,1);
 }finally{await pool.query('DELETE FROM gg_event_reward_queue WHERE kind=$1 AND job_id=$2',['ice',id]);}
});
