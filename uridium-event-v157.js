'use strict';
// Server-owned event state. Manual actions replace any previous schedule.
const OFF=Object.freeze({mode:'off',startAt:null,endAt:null});
function activeAt(state,now=Date.now()){
 if(state.mode==='on')return true;
 return state.mode==='scheduled'&&now>=Date.parse(state.startAt)&&now<Date.parse(state.endAt);
}
function normalizeAction(body,now=Date.now()){
 const action=body?.action;
 if(action==='start'||action==='stop')return {mode:action==='start'?'on':'off',startAt:null,endAt:null};
 if(action!=='schedule')throw Object.assign(Error('Acción inválida'),{status:400});
 const parse=v=>{if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(v))return NaN;const t=Date.parse(v);return Number.isFinite(t)&&new Date(t).toISOString()===(v.includes('.')?v:v.replace(/Z$/,'.000Z'))?t:NaN;};
 const start=parse(body.startAt),end=parse(body.endAt);
 if(!Number.isFinite(start)||!Number.isFinite(end)||start<now||end<=start)throw Object.assign(Error('Horario UTC inválido: inicio futuro y fin posterior requeridos'),{status:400});
 return {mode:'scheduled',startAt:new Date(start).toISOString(),endAt:new Date(end).toISOString()};
}
function multiply(amount,active){
 if(!Number.isSafeInteger(amount)||amount<0||!Number.isSafeInteger(amount*(active?2:1)))throw Error('Cantidad de uridium inválida');
 return amount*(active?2:1);
}
function createUridiumEvent(pool,kind='uridium'){
 if(!['uridium','gate-special'].includes(kind))throw Error('Evento desconocido');
 const table=kind==='uridium'?'gg_uridium_event_v157':'gg_gate_special_event_v157';
 const query=(client,sql,args)=>client.query(sql.replaceAll('gg_uridium_event_v157',table),args);
 async function ready(){
  await query(pool,"CREATE TABLE IF NOT EXISTS gg_uridium_event_v157 (id integer PRIMARY KEY CHECK(id=1), mode text NOT NULL CHECK(mode IN ('off','on','scheduled')), start_at timestamptz, end_at timestamptz, updated_at timestamptz NOT NULL DEFAULT now(), CHECK ((mode='scheduled' AND start_at IS NOT NULL AND end_at IS NOT NULL AND end_at>start_at) OR (mode<>'scheduled' AND start_at IS NULL AND end_at IS NULL)))");
  await query(pool,"INSERT INTO gg_uridium_event_v157(id,mode) VALUES(1,'off') ON CONFLICT(id) DO NOTHING");
 }
 function view(row){
  const s=row?{mode:row.mode,startAt:row.start_at?new Date(row.start_at).toISOString():null,endAt:row.end_at?new Date(row.end_at).toISOString():null}:OFF;
  const active=activeAt(s);return {...s,active,multiplier:active?2:1};
 }
 async function status(){return view((await query(pool,'SELECT mode,start_at,end_at FROM gg_uridium_event_v157 WHERE id=1')).rows[0]);}
 async function change(body){
  const s=normalizeAction(body);
  return view((await query(pool,'UPDATE gg_uridium_event_v157 SET mode=$1,start_at=$2,end_at=$3,updated_at=now() WHERE id=1 RETURNING mode,start_at,end_at',[s.mode,s.startAt,s.endAt])).rows[0]);
 }
 async function factor(c){
  // Read once in the same transaction as the reward; database clock is authoritative.
  const r=(await query(c,"SELECT (mode='on' OR (mode='scheduled' AND statement_timestamp()>=start_at AND statement_timestamp()<end_at)) AS active FROM gg_uridium_event_v157 WHERE id=1")).rows[0];
  return r?.active===true?2:1;
 }
 return {ready,status,change,factor};
}
const specialGateQuantity=(item,factor)=>item?(['LF-4','Havoc','Hercules','Spartan'].includes(item)?factor:1):0;
module.exports={specialGateQuantity,activeAt,normalizeAction,multiply,createUridiumEvent};
