'use strict';
const TITLES={kappa:'Campeón de Kappa',lambda:'Campeón de Lambda',hades:'Campeón de Hades',kronos:'Campeón de Kronos'};
const TYPES=['alien','box','distance'];
const fail=message=>Object.assign(Error(message),{status:400});
function createAchievements(pool){
 async function ready(){await pool.query(`CREATE TABLE IF NOT EXISTS gg_achievement_counters(account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,kind text NOT NULL,value bigint NOT NULL DEFAULT 0 CHECK(value>=0),PRIMARY KEY(account_id,kind));
 CREATE TABLE IF NOT EXISTS gg_achievement_titles(account_id uuid PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,title text);`);}
 async function add(id,kind,count=1){if(!TYPES.includes(kind)||!Number.isSafeInteger(count)||count<1||count>10000000)throw fail('Contador inválido');await pool.query('INSERT INTO gg_achievement_counters(account_id,kind,value) VALUES($1,$2,$3) ON CONFLICT(account_id,kind) DO UPDATE SET value=gg_achievement_counters.value+EXCLUDED.value',[id,kind,count]);}
 async function read(id){
  const gates=(await pool.query('SELECT gate,completions FROM gg_v14_gates WHERE account_id=$1 AND completions>0 ORDER BY gate',[id])).rows;
  const unlocked=gates.filter(g=>Object.hasOwn(TITLES,g.gate)).map(g=>({id:g.gate,name:TITLES[g.gate]}));
  const selected=(await pool.query('SELECT title FROM gg_achievement_titles WHERE account_id=$1',[id])).rows[0]?.title;
  const title=unlocked.find(t=>t.id===selected)||null;
  return {rings:gates.map(g=>g.gate),gates,unlocked,selected:title?.id||null,title:title?.name||null};
 }
 async function status(id){const d=await read(id),rows=(await pool.query('SELECT kind,value FROM gg_achievement_counters WHERE account_id=$1',[id])).rows;
  const counters=Object.fromEntries(TYPES.map(k=>[k,Number(rows.find(r=>r.kind===k)?.value||0)]));
  const pvp=(await pool.query('SELECT count(*) AS n FROM gg_rank_kills WHERE attacker=$1',[id])).rows[0];
  return {...d,counters:{...counters,pvp:Number(pvp.n),gates:d.gates.reduce((n,g)=>n+Number(g.completions),0)}};
 }
 async function select(id,title){if(title!==null&&!Object.hasOwn(TITLES,title))throw fail('Título inválido');const d=await read(id);if(title!==null&&!d.unlocked.some(t=>t.id===title))throw fail('Título no desbloqueado');
  await pool.query('INSERT INTO gg_achievement_titles(account_id,title) VALUES($1,$2) ON CONFLICT(account_id) DO UPDATE SET title=EXCLUDED.title',[id,title]);return status(id);}
 return {ready,add,read,status,select};
}
module.exports={TITLES,createAchievements};
