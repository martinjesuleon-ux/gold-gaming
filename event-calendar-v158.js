'use strict';
const {randomUUID}=require('node:crypto');
const KINDS=['hitac','ice','spaceball','invasion','hitac-lottery'];
function validate(body,now=Date.now()){
 const kind=body?.kind;
 if(!KINDS.includes(kind))throw Object.assign(Error('Evento inválido'),{status:400});
 const at=typeof body.startAt==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(body.startAt)?Date.parse(body.startAt):NaN;
 if(!Number.isFinite(at)||at<=now)throw Object.assign(Error('Inicio UTC futuro requerido'),{status:400});
 const payload=kind==='hitac-lottery'?{action:'open'}:{action:'start'};
 if(kind==='ice'){if(!['1-4','2-4','3-4','4-5'].includes(body.map))throw Object.assign(Error('Mapa inválido'),{status:400});payload.map=body.map;}
 if(kind==='invasion'){if(!['easy','medium','hard'].includes(body.difficulty))throw Object.assign(Error('Dificultad inválida'),{status:400});payload.difficulty=body.difficulty;}
 return {kind,startAt:new Date(at).toISOString(),payload};
}
function createCalendar(pool){
 async function ready(){
  await pool.query("CREATE TABLE IF NOT EXISTS gg_event_calendar_v158(id uuid PRIMARY KEY,kind text NOT NULL,start_at timestamptz NOT NULL,payload jsonb NOT NULL,status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','claimed','started','failed','cancelled','expired')),detail text,updated_at timestamptz NOT NULL DEFAULT now())");
  await pool.query("CREATE INDEX IF NOT EXISTS gg_event_calendar_due_v158 ON gg_event_calendar_v158(start_at) WHERE status='pending'");
 }
 async function add(body){const x=validate(body);return (await pool.query("INSERT INTO gg_event_calendar_v158(id,kind,start_at,payload) VALUES($1,$2,$3,$4) RETURNING *",[randomUUID(),x.kind,x.startAt,JSON.stringify(x.payload)])).rows[0];}
 async function list(){return (await pool.query("SELECT id,kind,start_at,payload,status,detail FROM gg_event_calendar_v158 ORDER BY (status='pending') DESC,start_at DESC LIMIT 100")).rows;}
 async function cancel(id){if(typeof id!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id))throw Object.assign(Error('Identificador inválido'),{status:400});const r=await pool.query("UPDATE gg_event_calendar_v158 SET status='cancelled',updated_at=now() WHERE id=$1 AND status='pending' RETURNING id",[id]);if(!r.rowCount)throw Object.assign(Error('Programación no disponible'),{status:409});return {ok:true};}
 async function claim(){
  // Never replay a side effect after a crash. An ambiguous claim becomes failed for admin review.
  await pool.query("UPDATE gg_event_calendar_v158 SET status='failed',detail='Inicio interrumpido; revisar manualmente',updated_at=now() WHERE status='claimed' AND updated_at<now()-interval '5 minutes'");
  await pool.query("UPDATE gg_event_calendar_v158 SET status='expired',detail='Servidor no disponible en el horario previsto',updated_at=now() WHERE status='pending' AND start_at<now()-interval '5 minutes'");
  return (await pool.query("WITH next AS (SELECT id FROM gg_event_calendar_v158 WHERE status='pending' AND start_at<=now() ORDER BY start_at,id LIMIT 10 FOR UPDATE SKIP LOCKED) UPDATE gg_event_calendar_v158 j SET status='claimed',updated_at=now() FROM next WHERE j.id=next.id RETURNING j.*")).rows;
 }
 async function finish(id,ok,detail){await pool.query("UPDATE gg_event_calendar_v158 SET status=$2,detail=$3,updated_at=now() WHERE id=$1 AND status='claimed'",[id,ok?'started':'failed',String(detail||'').slice(0,200)]);}
 return {ready,add,list,cancel,claim,finish};
}
async function runDue(calendar,dispatch){for(const j of await calendar.claim()){let result;try{result=await dispatch(j.kind,j.payload);}catch{result={ok:false,detail:'No se pudo iniciar el evento'};}await calendar.finish(j.id,result.ok,result.detail);}}
module.exports={KINDS,validate,createCalendar,runDue};
