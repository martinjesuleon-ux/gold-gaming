'use strict';
const FORMATIONS=[
 ['turtle','Tortuga',1000000,'credits',{shield:1.1,laser:.925},'Escudo +10 %, láser -7,5 %'],
 ['arrow','Flecha',1000000,'credits',{rocket:1.2,laser:.97},'Cohetes +20 %, láser -3 %'],
 ['lance','Lanza',100000,'uridium',{mine:1.5},'Minas +50 %'],
 ['star','Estrella',75000,'uridium',{rocket:1.25,evasion:.1,launcherCooldown:1.33},'Cohetes +25 %, evasión +10 %, recarga lanzador +33 %'],
 ['pincer','Pinza',100000,'uridium',{pvp:1.03,honor:1.05,penetration:-.1},'PvP +3 %, honor +5 %, penetración -10 %'],
 ['double-arrow','Flecha doble',75000,'uridium',{penetration:.1,shield:.8},'Penetración +10 %, escudo -20 %'],
 ['diamond','Diamante',100000,'uridium',{hp:.7,regen:.01,regenCap:5000},'Regenera 1 % de escudo/s (máx. 5.000), PV -30 %'],
 ['chevron','Galón',75000,'uridium',{rocket:1.65,hp:.8},'Cohetes +65 %, PV -20 %'],
 ['moth','Polilla',100000,'uridium',{penetration:.2,hp:1.2,drain:.05},'Penetración +20 %, PV +20 %, fuga de escudo 5 %/s'],
 ['crab','Cangrejo',100000,'uridium',{absorption:.2,speed:.85},'Absorción +20 %, velocidad -15 %'],
 ['heart','Corazón',100000,'uridium',{hp:1.2,shield:1.2,laser:.95},'PV y escudo +20 %, láser -5 %'],
 ['barrage','Andanada',100000,'uridium',{npc:1.05,npcXp:1.05,absorption:-.15},'Daño y EXP de aliens +5 %, absorción -15 %'],
 ['bat','Murciélago',125000,'uridium',{npc:1.08,npcXp:1.08,speed:.85},'Daño y EXP de aliens +8 %, velocidad -15 %'],
 ['ring','Anillo',150000,'uridium',{shield:1.85,laser:.75,speed:.95,rocketCooldown:1.25,launcherCooldown:1.25},'Escudo +85 %, láser -25 %, velocidad -5 %, recargas +25 %'],
 ['drill','Taladro',150000,'uridium',{laser:1.2,speed:.95},'Láser +20 %, velocidad -5 %'],
 ['veteran','Veterano',150000,'uridium',{honor:1.2,hp:.8,shield:.8,laser:.8},'Honor +20 %, PV, escudo y láser -20 %'],
 ['dome','Cúpula',150000,'uridium',{shield:1.3,regen:.005,rocketCooldown:.75,launcherCooldown:.75,laser:.5,speed:.5},'Escudo +30 %, regeneración 0,5 %/s, recargas -25 %, láser y velocidad -50 %'],
 ['wheel','Rueda',150000,'uridium',{speed:1.05,laser:.8,drain:.05},'Velocidad +5 %, láser -20 %, fuga de escudo 5 %/s'],
 ['wave','Ola',4950000,'credits',{},'Solo estética']
].map(([id,name,price,currency,bonus,description])=>({id,name,price,currency,bonus,description}));
const get=id=>FORMATIONS.find(f=>f.id===id);
const bonuses=id=>get(id)?.bonus||{};
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
function stats(base,id){const b=bonuses(id);return {hp:Math.round(base.hp*(b.hp||1)),shield:Math.round(base.shield*(b.shield||1)),damage:Math.round(base.damage*(b.laser||1)),speed:base.speed*(b.speed||1),absorption:clamp(base.absorption+(b.absorption||0),0,1)};}
function absorption(attacker,target){return clamp((target.absorption??.5)-(bonuses(attacker.formation).penetration||0),0,1);}
function combatFactor(p,pvp){const b=bonuses(p.formation);return (pvp?b.pvp:b.npc)||1;}
function shieldDelta(p,dt){const b=bonuses(p.formation);return (Math.min(p.maxShield*(b.regen||0),b.regenCap??Infinity)-p.maxShield*(b.drain||0))*dt;}
function rank(points){const levels=[0,100,300,700,1500,3100];return levels.filter(n=>points>=n).length||1;}
const fail=message=>Object.assign(Error(message),{status:400});
function createFormations(pool){
 async function ready(){await pool.query(`CREATE TABLE IF NOT EXISTS gg_v19_formations(account_id uuid PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,active text NOT NULL DEFAULT 'normal',ready_at bigint NOT NULL DEFAULT 0);`);}
 async function tx(id,fn){const c=await pool.connect();try{await c.query('BEGIN');const balance=(await c.query('SELECT credits,uridium FROM player_progress WHERE account_id=$1 FOR UPDATE',[id])).rows[0];if(!balance)throw fail('Piloto no disponible');const result=await fn(c,balance);await c.query('COMMIT');return result;}catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}}
 async function read(c,id){const row=(await c.query('SELECT active,ready_at FROM gg_v19_formations WHERE account_id=$1',[id])).rows[0];const h=(await c.query('SELECT configs,active FROM gg_v13_hangar WHERE account_id=$1',[id])).rows[0];const owned=(await c.query("SELECT instance_id,code,category FROM gg_v13_inventory WHERE account_id=$1 AND category IN ('drones','formations')",[id])).rows;const ids=new Set((h?.configs?.[h.active]?.drones||[]).map(d=>d.id));const count=owned.filter(i=>i.category==='drones'&&ids.has(i.instance_id)).length;const formations=owned.filter(i=>i.category==='formations').map(i=>i.code);const selected=row?.active||'normal';return {active:count>=6&&formations.includes(selected)&&get(selected)?selected:'normal',readyAt:Number(row?.ready_at||0),count,owned:formations};}
 async function status(id){return tx(id,async(c,balance)=>({...await read(c,id),catalog:FORMATIONS,balance}));}
 async function buy(id,code){const f=get(code);if(!f)throw fail('Formación inválida');return tx(id,async c=>{const current=await read(c,id);if(current.owned.includes(code))throw fail('Ya tienes esta formación');const balance=(await c.query('UPDATE player_progress SET '+f.currency+'='+f.currency+'-$2 WHERE account_id=$1 AND '+f.currency+'>=$2 RETURNING credits,uridium',[id,f.price])).rows[0];if(!balance)throw fail('Saldo insuficiente');await c.query("INSERT INTO gg_v13_inventory(account_id,instance_id,code,category) VALUES($1,gen_random_uuid(),$2,'formations')",[id,code]);return {code,balance};});}
 async function select(id,code){return tx(id,async c=>{const current=await read(c,id),now=Date.now();if(code!=='normal'&&(!get(code)||!current.owned.includes(code)||current.count<6))throw fail('Necesitas seis VANT montados y la formación adquirida');if(current.readyAt>now)throw fail('Formación en recarga');const readyAt=now+2000;await c.query('INSERT INTO gg_v19_formations(account_id,active,ready_at) VALUES($1,$2,$3) ON CONFLICT(account_id) DO UPDATE SET active=EXCLUDED.active,ready_at=EXCLUDED.ready_at',[id,code,readyAt]);return {...current,active:code,readyAt};});}
 return {ready,status,buy,select,read};
}
module.exports={FORMATIONS,get,bonuses,stats,absorption,combatFactor,shieldDelta,rank,createFormations};
