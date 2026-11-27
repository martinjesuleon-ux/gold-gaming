'use strict';
// CBS rules transcribed from wiki.txt. Coordinates and the extra asteroid's map are provisional.
const MODULES={
 'HULM-1':{slot:0,hp:5850000},'DEFM-1':{slot:1,shield:5850000},
 'REPM-1':{repair:20500},'HONM-1':{honor:.10},'XPM-1':{xp:.10},'DMGM-1':{damageBonus:.10},
 'LTM-LR':{damage:59850,range:590,cooldown:1000,accuracy:.90},'LTM-MR':{damage:48450,range:650,cooldown:1000,accuracy:.70},'LTM-HR':{damage:28500,range:720,cooldown:1000,accuracy:.60},
 'RAM-LA':{damage:85500,range:900,cooldown:2000,accuracy:.50},'RAM-MA':{damage:71250,range:780,cooldown:2000,accuracy:.70}
};
const ASTEROIDS=Object.freeze([...Array.from({length:3},(_,i)=>Array.from({length:5},(_,j)=>({id:(i+1)+'-'+(j+3)+':1',map:(i+1)+'-'+(j+3),x:4200,y:2700}))).flat(),...Array.from({length:4},(_,i)=>({id:'4-'+(i+1)+':1',map:'4-'+(i+1),x:4200,y:2700})),{id:'4-4:2',map:'4-4',x:7800,y:5300}]);
const RULES=Object.freeze({minBuild:300000,maxBuild:3600000,initialDown:1800000,deflectorCap:2880,normalCharge:2,peakCharge:10,drain:1,peakStartUTC:20,peakEndUTC:23,edgeHp:1560000,edgeShield:780000,absorption:.8,repairDelay:10000});
const fail=message=>Object.assign(Error(message),{status:400});
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
function validateModules(items,buildMs){
 if(!Number.isSafeInteger(buildMs)||buildMs<RULES.minBuild||buildMs>RULES.maxBuild||buildMs%60000)throw fail('Construcción de 5 a 60 minutos');
 if(!Array.isArray(items)||items.length!==10||new Set(items.map(x=>x.instanceId)).size!==10)throw fail('Se requieren diez módulos distintos');
 const seen=new Set();
 return items.map((item,slot)=>{
  const d=MODULES[item.code],level=Number(item.level);
  if(!d||!uuid(item.instanceId)||!Number.isInteger(level)||level<1||level>16||item.broken)throw fail('Módulo inválido o roto');
  if((slot<2&&d.slot!==slot)||(slot>=2&&d.slot!==undefined))throw fail('Ranura inválida');
  if(!d.range&&seen.has(item.code))throw fail('Módulo único duplicado');
  seen.add(item.code);
  const scale=1+(level-1)*.02; // provisional linear progression to +30% at 16
  return {slot,instanceId:item.instanceId,code:item.code,level,hp:Math.round((slot===0?d.hp:RULES.edgeHp)*scale),shield:Math.round((slot===1?d.shield:RULES.edgeShield)*scale)};
 });
}
function stationState(station,now=Date.now()){
 if(now<Number(station.ready_at))return 'building';
 if(now<Number(station.down_until))return 'vulnerable';
 return 'ready'; // Combat and deflector clock are not enabled until the next stage.
}
function createStations(pool){
 async function ready(){await pool.query(`CREATE TABLE IF NOT EXISTS gg_cbs_stations(asteroid_id text PRIMARY KEY,clan_id uuid NOT NULL REFERENCES gg_v15_clans(id) ON DELETE CASCADE,builder uuid NOT NULL REFERENCES accounts(id),ready_at bigint NOT NULL,down_until bigint NOT NULL,modules jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
 CREATE TABLE IF NOT EXISTS gg_cbs_requests(account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,request_id uuid NOT NULL,response jsonb NOT NULL,PRIMARY KEY(account_id,request_id));`);}
 async function status(id,map){
  const stations=(await pool.query('SELECT s.asteroid_id,s.ready_at,s.down_until,c.tag AS clan_tag FROM gg_cbs_stations s JOIN gg_v15_clans c ON c.id=s.clan_id')).rows;
  const inventory=(await pool.query("SELECT instance_id AS \"instanceId\",code,level FROM gg_v13_inventory WHERE account_id=$1 AND category='cbs-modules' ORDER BY code,instance_id",[id])).rows;
  return {catalog:MODULES,rules:RULES,asteroids:ASTEROIDS.filter(a=>!map||a.map===map).map(a=>{const s=stations.find(x=>x.asteroid_id===a.id);return {...a,station:s?{...s,state:stationState(s)}:null};}),inventory,combatEnabled:false};
 }
 async function build(id,{asteroidId,moduleIds,minutes,requestId}={},position){
  if(!uuid(requestId)||!Array.isArray(moduleIds)||moduleIds.length!==10||!moduleIds.every(uuid)||new Set(moduleIds).size!==10)throw fail('Solicitud inválida');
  const a=ASTEROIDS.find(x=>x.id===asteroidId);
  if(!a||!position||position.zone!==a.map||Math.hypot(position.x-a.x,position.y-a.y)>250)throw fail('Acércate al asteroide');
  const c=await pool.connect();try{await c.query('BEGIN');
   await c.query('SELECT account_id FROM player_progress WHERE account_id=$1 FOR UPDATE',[id]);
   const prior=(await c.query('SELECT response FROM gg_cbs_requests WHERE account_id=$1 AND request_id=$2',[id,requestId])).rows[0];if(prior){await c.query('COMMIT');return prior.response;}
   const m=(await c.query('SELECT c.id,c.leader,m.permissions FROM gg_v15_clan_members m JOIN gg_v15_clans c ON c.id=m.clan_id WHERE m.account_id=$1 FOR UPDATE OF m,c',[id])).rows[0];
   if(!m||!(m.leader===id||m.permissions.includes('cbs')))throw fail('Se requiere permiso CBS del clan');
   const rows=(await c.query("SELECT instance_id AS \"instanceId\",code,level FROM gg_v13_inventory WHERE account_id=$1 AND category='cbs-modules' AND instance_id=ANY($2::uuid[]) FOR UPDATE",[id,moduleIds])).rows;
   if(rows.length!==10)throw fail('Faltan módulos en tu inventario');
   const modules=validateModules(moduleIds.map(mid=>rows.find(r=>r.instanceId===mid)),minutes*60000);
   const readyAt=Date.now()+minutes*60000,downUntil=readyAt+RULES.initialDown;
   const result={asteroidId,clanId:m.id,readyAt,downUntil,modules};
   await c.query('INSERT INTO gg_cbs_stations(asteroid_id,clan_id,builder,ready_at,down_until,modules) VALUES($1,$2,$3,$4,$5,$6)',[asteroidId,m.id,id,readyAt,downUntil,JSON.stringify(modules)]);
   await c.query("DELETE FROM gg_v13_inventory WHERE account_id=$1 AND category='cbs-modules' AND instance_id=ANY($2::uuid[])",[id,moduleIds]);
   await c.query('INSERT INTO gg_cbs_requests(account_id,request_id,response) VALUES($1,$2,$3)',[id,requestId,JSON.stringify(result)]);
   await c.query('COMMIT');return result;
  }catch(e){await c.query('ROLLBACK').catch(()=>{});if(e.code==='23505')throw fail('Asteroide ocupado');throw e;}finally{c.release();}
 }
 return {ready,status,build};
}
module.exports={MODULES,ASTEROIDS,RULES,validateModules,stationState,createStations};
