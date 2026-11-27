'use strict';
const KINDS=['uridium','gate-special'],SPECIAL=new Set(['LF-4','Havoc','Hercules','Spartan','log-disk','green-key']);
const fail=message=>Object.assign(Error(message),{status:400});
function active(row,now=Date.now()){return !!row&&(row.mode==='on'||(row.mode==='scheduled'&&Number(row.start_ms)<=now&&now<Number(row.end_ms)));}
function quantity(code,n,enabled){return n*(enabled&&SPECIAL.has(code)?2:1);}
async function multiplier(c,kind){const row=(await c.query('SELECT mode,start_ms,end_ms FROM gg_bonus_events WHERE kind=$1',[kind])).rows[0];return active(row)?2:1;}
function createBonusEvents(pool){
 async function ready(){await pool.query(`CREATE TABLE IF NOT EXISTS gg_bonus_events(kind text PRIMARY KEY CHECK(kind IN ('uridium','gate-special')),mode text NOT NULL CHECK(mode IN ('off','on','scheduled')),start_ms bigint,end_ms bigint,updated_at timestamptz NOT NULL DEFAULT now());INSERT INTO gg_bonus_events(kind,mode) VALUES('uridium','off'),('gate-special','off') ON CONFLICT DO NOTHING;`);}
 async function status(){const now=Date.now(),rows=(await pool.query('SELECT kind,mode,start_ms,end_ms FROM gg_bonus_events ORDER BY kind')).rows;return Object.fromEntries(rows.map(r=>[r.kind,{mode:r.mode,startAt:r.start_ms==null?null:Number(r.start_ms),endAt:r.end_ms==null?null:Number(r.end_ms),active:active(r,now)}]));}
 async function configure(kind,d){if(!KINDS.includes(kind)||!['on','off','scheduled'].includes(d?.mode))throw fail('Evento o modo inválido');let start=null,end=null;if(d.mode==='scheduled'){start=d.startAt;end=d.endAt;if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||end<=Date.now()||end<=start||end>8640000000000000)throw fail('Horario inválido');}
 await pool.query('UPDATE gg_bonus_events SET mode=$2,start_ms=$3,end_ms=$4,updated_at=now() WHERE kind=$1',[kind,d.mode,start,end]);return status();}
 return {ready,status,configure};
}
module.exports={createBonusEvents,multiplier,quantity,active};
