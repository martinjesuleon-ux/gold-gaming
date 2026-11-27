'use strict';
const DAY=86400000;
const NAMES=['','Piloto espacial básico','Piloto espacial','Piloto espacial jefe','Sargento básico','Sargento','Sargento jefe','Teniente básico','Teniente','Teniente jefe','Capitán básico','Capitán','Capitán jefe','Comandante básico','Comandante','Comandante jefe','Coronel básico','Coronel','Coronel jefe','General básico','General','General jefe','Buscado','Administrador'];
function rankPoints(p){if(Number(p.honor)<0||p.admin)return 0;return Math.max(0,Math.floor(Number(p.experience||0)/100000+Number(p.honor||0)/100+Number(p.level||0)*100+Number(p.days||0)*6+Number(p.kills||0)*4+Number(p.allyKills||0)*10-Number(p.deaths||0)*4-Number(p.radiation||0)*8));}
function warPoints(age){return age<0?0:age<7*DAY?75:age<30*DAY?50:age<60*DAY?25:12;}
function ranks(rows){
 const out=rows.map(p=>({...p,points:rankPoints(p),rank:p.admin?23:Number(p.honor)<0?22:1}));
 for(const company of [1,2,3]){
  const group=out.filter(p=>p.company===company&&p.rank===1).sort((a,b)=>b.points-a.points||String(a.id).localeCompare(String(b.id)));
  const top=[21,20,19,18,18,17,17,17];
  group.forEach((p,i)=>{p.rank=top[i]||Math.max(1,16-Math.floor((i-8)*16/Math.max(1,group.length-8)));});
 }
 return out;
}
function createRankings(pool){
 async function ready(){await pool.query(`CREATE TABLE IF NOT EXISTS gg_rank_profiles(account_id uuid PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,registered_at timestamptz NOT NULL DEFAULT now(),rank integer NOT NULL DEFAULT 1,highest integer NOT NULL DEFAULT 1,points bigint NOT NULL DEFAULT 0,admin boolean NOT NULL DEFAULT false,calculated_at bigint NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS gg_rank_kills(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,attacker uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,victim uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,ally boolean NOT NULL,at timestamptz NOT NULL DEFAULT now());
 CREATE INDEX IF NOT EXISTS gg_rank_kills_attacker ON gg_rank_kills(attacker);
 CREATE INDEX IF NOT EXISTS gg_rank_kills_victim ON gg_rank_kills(victim);
 CREATE TABLE IF NOT EXISTS gg_rank_deaths(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,radiation boolean NOT NULL DEFAULT false,at timestamptz NOT NULL DEFAULT now());
 CREATE TABLE IF NOT EXISTS gg_rank_clock(singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),day bigint NOT NULL);`);}
 async function refresh(){
 const c=await pool.connect();try{await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(71413004)');
 const now=Date.now(),day=Math.floor(now/DAY);
 // Existing accounts without a registration timestamp begin tracking from migration day.
 await c.query(`INSERT INTO gg_rank_profiles(account_id,registered_at) SELECT id,COALESCE(NULLIF(to_jsonb(a)->>'created_at','')::timestamptz,now()) FROM accounts a ON CONFLICT DO NOTHING`);
 const last=(await c.query('SELECT day FROM gg_rank_clock WHERE singleton=true')).rows[0];
 if(Number(last?.day)===day){await c.query('COMMIT');return false;}
 const rows=(await c.query(`SELECT p.account_id AS id,p.experience,p.honor,p.level,COALESCE(l.company,1) AS company,r.admin,r.highest,
 GREATEST(0,FLOOR(EXTRACT(EPOCH FROM (now()-r.registered_at))/86400)) AS days,
 (SELECT count(*) FROM gg_rank_kills k WHERE k.attacker=p.account_id AND NOT k.ally) AS kills,
 (SELECT count(*) FROM gg_rank_kills k WHERE k.attacker=p.account_id AND k.ally) AS "allyKills",
 (SELECT count(*) FROM gg_rank_kills k WHERE k.victim=p.account_id)+(SELECT count(*) FROM gg_rank_deaths d WHERE d.account_id=p.account_id AND NOT d.radiation) AS deaths,
 (SELECT count(*) FROM gg_rank_deaths d WHERE d.account_id=p.account_id AND d.radiation) AS radiation
 FROM player_progress p JOIN gg_rank_profiles r USING(account_id) LEFT JOIN gg_v14_location l USING(account_id)`)).rows;
 for(const p of ranks(rows))await c.query('UPDATE gg_rank_profiles SET rank=$2,points=$3,highest=CASE WHEN $2<=21 THEN GREATEST(highest,$2) ELSE highest END,calculated_at=$4 WHERE account_id=$1',[p.id,p.rank,p.points,now]);
 await c.query('INSERT INTO gg_rank_clock(singleton,day) VALUES(true,$1) ON CONFLICT(singleton) DO UPDATE SET day=EXCLUDED.day',[day]);await c.query('COMMIT');return true;
 }catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}}
 async function status(id,board='rank'){
  if(!['rank','xp','honor','clan','war'].includes(board))throw Object.assign(Error('Clasificación inválida'),{status:400});
  await refresh();
  const base=`FROM player_progress p JOIN accounts a ON a.id=p.account_id JOIN gg_rank_profiles r ON r.account_id=p.account_id LEFT JOIN gg_v14_location l ON l.account_id=p.account_id WHERE NOT r.admin AND p.honor>=0`;
  let rows;
  if(board==='clan')rows=(await pool.query(`SELECT c.name,c.tag,SUM(r.points)::bigint AS value,count(*) AS members FROM gg_v15_clans c JOIN gg_v15_clan_members m ON m.clan_id=c.id JOIN gg_rank_profiles r ON r.account_id=m.account_id JOIN player_progress p ON p.account_id=m.account_id WHERE NOT r.admin AND p.honor>=0 GROUP BY c.id,c.name,c.tag ORDER BY value DESC,c.tag LIMIT 100`)).rows;
  else{const value={rank:'r.points',xp:'p.experience',honor:'p.honor',war:`(SELECT COALESCE(SUM(CASE WHEN k.at>now()-interval '7 days' THEN 75 WHEN k.at>now()-interval '30 days' THEN 50 WHEN k.at>now()-interval '60 days' THEN 25 ELSE 12 END),0) FROM gg_rank_kills k WHERE k.attacker=p.account_id AND NOT k.ally)`}[board];rows=(await pool.query(`SELECT a.username AS name,COALESCE(l.company,1) AS company,r.rank,${value} AS value,p.account_id=$1 AS own ${base} ORDER BY value DESC,a.username,p.account_id LIMIT 100`,[id])).rows;}
  const own=(await pool.query('SELECT CASE WHEN p.honor<0 AND NOT r.admin THEN 22 WHEN r.admin THEN 23 ELSE r.rank END AS rank,r.highest,CASE WHEN p.honor<0 OR r.admin THEN 0 ELSE r.points END AS points,r.calculated_at FROM gg_rank_profiles r JOIN player_progress p USING(account_id) WHERE r.account_id=$1',[id])).rows[0];
  return {board,rows,own,names:NAMES,provisional:true};
 }
 async function death(id,radiation=false){await pool.query('INSERT INTO gg_rank_deaths(account_id,radiation) VALUES($1,$2)',[id,!!radiation]);}
 return {ready,refresh,status,death};
}
module.exports={rankPoints,warPoints,ranks,NAMES,createRankings};
