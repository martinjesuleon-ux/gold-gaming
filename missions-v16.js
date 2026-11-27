'use strict';
const {rewardFactorRead,scaleReward}=require('./boosters-v112');
// The wiki lists 435 normal/23 daily missions but not their individual definitions.
// These development-only starter missions are not represented as the original catalog.
const MISSIONS=[
 {id:'intro-streuner',name:'Primer combate',level:1,conditions:[{type:'alien',target:'Streuner',count:10}],reward:{credits:20000,experience:1300,uridium:200,honor:400}},
 {id:'intro-boxes',name:'Recuperación espacial',level:1,conditions:[{type:'box',target:'*',count:20}],reward:{credits:25000,uridium:250,'LCB-10':1000}},
 {id:'intro-explore',name:'Explorar el sector',level:2,conditions:[{type:'map',target:'*-3',count:1}],reward:{credits:30000,experience:3000,uridium:300}},
 {id:'intro-alpha',name:'Desafío Alpha',level:3,conditions:[{type:'gate',target:'alpha',count:1}],reward:{uridium:1500,experience:20000,'gate-energy':20}},
 {id:'intro-pvp',name:'Combate espacial',level:5,conditions:[{type:'pilot',target:'*',count:3}],reward:{credits:50000,uridium:500,honor:500}}
];
function match(c,type,target){return c.type===type&&(c.target==='*'||c.target===target||(c.target==='*-3'&&/^[123]-3$/.test(target)));}
function advance(def,progress,type,target,count){return def.conditions.map((c,i)=>Math.min(c.count,(progress[i]||0)+(match(c,type,target)?count:0)));}
function createMissions(pool){
 const fail=message=>Object.assign(Error(message),{status:400});
 async function ready(){await pool.query(`CREATE TABLE IF NOT EXISTS gg_v16_missions(account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,mission text NOT NULL,progress jsonb NOT NULL DEFAULT '[]',claimed boolean NOT NULL DEFAULT false,PRIMARY KEY(account_id,mission));`);}
 async function tx(id,fn){const c=await pool.connect();try{await c.query('BEGIN');const p=(await c.query('SELECT credits,uridium,experience,honor,level FROM player_progress WHERE account_id=$1 FOR UPDATE',[id])).rows[0];if(!p)throw fail('Piloto no disponible');const out=await fn(c,p);await c.query('COMMIT');return out;}catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}}
 async function view(id){const p=(await pool.query('SELECT level FROM player_progress WHERE account_id=$1',[id])).rows[0];const rows=(await pool.query('SELECT mission,progress,claimed FROM gg_v16_missions WHERE account_id=$1',[id])).rows;return {provisional:true,missions:MISSIONS.map(m=>{const r=rows.find(x=>x.mission===m.id);return {...m,accepted:!!r,claimed:!!r?.claimed,progress:r?.progress||m.conditions.map(()=>0),available:Number(p?.level)>=m.level};})};}
 async function action(id,{action,mission}={}){const m=MISSIONS.find(x=>x.id===mission);if(!m)throw fail('Misión inválida');
 await tx(id,async(c,p)=>{const row=(await c.query('SELECT progress,claimed FROM gg_v16_missions WHERE account_id=$1 AND mission=$2',[id,m.id])).rows[0];
 if(action==='accept'){if(p.level<m.level)throw fail('Nivel insuficiente');if(row)throw fail('Misión ya aceptada');await c.query('INSERT INTO gg_v16_missions(account_id,mission,progress) VALUES($1,$2,$3)',[id,m.id,JSON.stringify(m.conditions.map(()=>0))]);}
 else if(action==='claim'){if(!row||row.claimed||!m.conditions.every((x,i)=>row.progress[i]>=x.count))throw fail('Misión no disponible para reclamar');
 const r=scaleReward(m.reward,await rewardFactorRead(c,id,'mission'));await c.query('UPDATE player_progress SET credits=credits+$2,uridium=uridium+$3,experience=experience+$4,honor=honor+$5,level=CASE WHEN experience+$4<10000 THEN 1 ELSE 2+FLOOR(LOG(2,((experience+$4)::numeric/10000)))::int END,updated_at=now() WHERE account_id=$1',[id,r.credits||0,r.uridium||0,r.experience||0,r.honor||0]);
 for(const [code,n] of Object.entries(r))if(!['credits','uridium','experience','honor'].includes(code))await c.query('INSERT INTO gg_v13_ammo(account_id,code,quantity) VALUES($1,$2,$3) ON CONFLICT(account_id,code) DO UPDATE SET quantity=gg_v13_ammo.quantity+EXCLUDED.quantity',[id,code,n]);
 await c.query('UPDATE gg_v16_missions SET claimed=true WHERE account_id=$1 AND mission=$2',[id,m.id]);}
 else throw fail('Acción inválida');});return view(id);}
 async function event(id,type,target,count=1){if(!Number.isSafeInteger(count)||count<1)return;await tx(id,async c=>{const rows=(await c.query('SELECT mission,progress FROM gg_v16_missions WHERE account_id=$1 AND NOT claimed',[id])).rows;
 for(const row of rows){const m=MISSIONS.find(x=>x.id===row.mission);if(!m||!m.conditions.some(x=>match(x,type,target)))continue;const progress=advance(m,row.progress,type,target,count);await c.query('UPDATE gg_v16_missions SET progress=$3 WHERE account_id=$1 AND mission=$2',[id,row.mission,JSON.stringify(progress)]);}});}
 return {ready,view,action,event};
}
module.exports={MISSIONS,advance,createMissions};
