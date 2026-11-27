'use strict';
const catalog=require('./data/catalog-v13.json');
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
// Charge is measured in milliseconds of equivalent minutes: 1000 units = one minute.
function deflector(station,now=Date.now()){
 const ready=Number(station.ready_at),cap=RULES.deflectorCap*1000;
 let at=Math.max(ready,Number(station.clock_at??ready)),charge=Math.min(cap,Math.max(0,Number(station.charge_units??0))),down=Number(station.down_until);
 if(now<ready)return {at:ready,charge:0,downUntil:down,mode:'building',protected:false};
 // Once a full day repeats, skip whole days to keep long-offline calculations bounded.
 const seen=new Map();
 while(at<now){
  const key=[at%86400000,charge,Math.max(0,down-at)].join(':');
  if(seen.has(key)){const cycle=at-seen.get(key),skip=cycle>0?Math.floor((now-at)/cycle)*cycle:0;if(skip>0){if(down>at)down+=skip;at+=skip;if(at===now)break;}}
  else seen.set(key,at);
  if(at<down){
   const day=Math.floor(at/86400000)*86400000,hour=(at-day)/3600000,peak=hour>=20&&hour<23;
   const boundary=day+(hour<20?20:hour<23?23:44)*3600000;
   const end=Math.min(now,down,boundary);
   charge=Math.min(cap,charge+(end-at)*(peak?RULES.peakCharge:RULES.normalCharge));at=end;
  }else if(charge>0){
   const end=Math.min(now,at+Math.ceil(charge/RULES.drain));
   charge=Math.max(0,charge-(end-at)*RULES.drain);at=end;
   if(charge===0)down=at+RULES.initialDown;
  }else down=at+RULES.initialDown;
 }
 if(at>=down&&charge===0)down=at+RULES.initialDown;
 return {at,charge,downUntil:down,mode:now<down?'vulnerable':'protected',protected:now>=down};
}
function lowerDeflector(station,minutes,now=Date.now()){
 if(!Number.isSafeInteger(minutes)||minutes<30||minutes>2880)throw fail('Caída de 30 minutos a 48 horas');
 const d=deflector(station,now);if(d.mode!=='protected')throw fail('El deflector no está levantado');
 return {...d,downUntil:now+minutes*60000,mode:'vulnerable',protected:false};
}
const DESTRUCTION_REWARD=Object.freeze({credits:50000000,xp:10000000,honor:500000,uridium:0});
const MODULE_REWARDS=Object.freeze({'RAM-LA':2000,'RAM-MA':1800,'LTM-LR':1600,'LTM-MR':1300,'LTM-HR':1000,'REPM-1':700,'HONM-1':500,'XPM-1':500,'DMGM-1':500});
const EMERGENCY=Object.freeze({price:500,rate:7500,duration:20000});
function moduleLimits(m){
 const d=MODULES[m.code];if(!d||!Number.isInteger(m.level)||m.level<1||m.level>16)throw fail('Módulo inválido');
 const scale=1+(m.level-1)*.02;
 return {hp:Math.round((m.slot===0?d.hp:RULES.edgeHp)*scale),shield:Math.round((m.slot===1?d.shield:RULES.edgeShield)*scale)};
}
function stationHit(station,slot,damage,now=Date.now()){
 if(!Number.isSafeInteger(damage)||damage<=0||!Number.isInteger(slot)||slot<0||slot>9)throw fail('Golpe inválido');
 if(deflector(station,now).mode!=='vulnerable')return {applied:0,modules:station.modules};
 if(slot===0&&station.modules.some(m=>m.slot!==0&&m.hp>0))return {applied:0,modules:station.modules};
 const modules=station.modules.map(m=>({...m})),target=modules.find(m=>m.slot===slot);
 if(!target||target.hp<=0)return {applied:0,modules};
 const shieldLoss=Math.min(target.shield,Math.round(damage*RULES.absorption)),hpLoss=Math.min(target.hp,damage-shieldLoss);
 target.shield-=shieldLoss;target.hp-=hpLoss;
 return {modules,applied:shieldLoss+hpLoss,destroyed:target.hp===0,lastHit:now,stationDestroyed:slot===0&&target.hp===0};
}
function repairModule(m,rate,elapsedMs){
 if(!Number.isFinite(rate)||rate<0||!Number.isFinite(elapsedMs)||elapsedMs<0)throw fail('Reparación inválida');
 if(m.hp<=0)return {...m}; // destroyed equipment must be recovered and repaired separately
 return {...m,hp:Math.min(moduleLimits(m).hp,m.hp+Math.floor(rate*elapsedMs/1000))};
}
function passiveRepairRate(modules,lastHit,now=Date.now()){
 if(now-lastHit<RULES.repairDelay)return 0;
 const repair=modules.find(m=>m.code==='REPM-1'&&m.hp>0);
 return repair?20500*(1+(repair.level-1)*.02):20500/20;
}
// Lazy repair: account for elapsed time exactly once, including server restarts.
function repairState(station,now=Date.now()){
 const start=Math.max(Number(station.ready_at),Number(station.repair_at??station.ready_at));
 const until=Math.max(start,now),lastHit=Number(station.last_hit||0);
 const passiveStart=Math.max(start,lastHit+RULES.repairDelay);
 const passiveMs=Math.max(0,until-passiveStart);
 const rate=passiveRepairRate(station.modules,lastHit,until);
 const emergencyEnd=Number(station.emergency_until||0);
 const emergencyMs=Math.max(0,Math.min(until,emergencyEnd)-Math.max(start,emergencyEnd-EMERGENCY.duration));
 const modules=station.modules.map(m=>{
  const normal=repairModule(m,rate,passiveMs);
  return m.slot===station.emergency_slot?repairModule(normal,EMERGENCY.rate,emergencyMs):normal;
 });
 return {modules,repairAt:until};
}
function destructionShares(contributions,now=Date.now()){
 // Wiki specifies participants from the prior ten minutes, not distribution weights.
 // Equal share among unique eligible attackers, deterministic remainder by account ID.
 const ids=[...new Set(contributions.filter(x=>uuid(x.accountId)&&Number.isFinite(x.at)&&x.at>=now-600000&&x.at<=now&&x.damage>0).map(x=>x.accountId))].sort();
 return ids.map((accountId,i)=>({accountId,...Object.fromEntries(Object.entries(DESTRUCTION_REWARD).map(([k,n])=>[k,Math.floor(n/ids.length)+(i<n%ids.length?1:0)]))}));
}
function createStations(pool){
 async function ready(){await pool.query(`CREATE TABLE IF NOT EXISTS gg_cbs_stations(asteroid_id text PRIMARY KEY,clan_id uuid NOT NULL REFERENCES gg_v15_clans(id) ON DELETE CASCADE,builder uuid NOT NULL REFERENCES accounts(id),ready_at bigint NOT NULL,down_until bigint NOT NULL,modules jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
 CREATE TABLE IF NOT EXISTS gg_cbs_requests(account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,request_id uuid NOT NULL,response jsonb NOT NULL,PRIMARY KEY(account_id,request_id));
 ALTER TABLE gg_cbs_stations ADD COLUMN IF NOT EXISTS clock_at bigint;
 ALTER TABLE gg_cbs_stations ADD COLUMN IF NOT EXISTS charge_units bigint;
 ALTER TABLE gg_cbs_stations ADD COLUMN IF NOT EXISTS last_hit bigint NOT NULL DEFAULT 0;
 ALTER TABLE gg_cbs_stations ADD COLUMN IF NOT EXISTS repair_at bigint;
 ALTER TABLE gg_cbs_stations ADD COLUMN IF NOT EXISTS emergency_until bigint NOT NULL DEFAULT 0;
 ALTER TABLE gg_cbs_stations ADD COLUMN IF NOT EXISTS emergency_slot integer;
 CREATE TABLE IF NOT EXISTS gg_cbs_hits(asteroid_id text NOT NULL REFERENCES gg_cbs_stations(asteroid_id) ON DELETE CASCADE,account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,at_ms bigint NOT NULL,damage bigint NOT NULL CHECK(damage>0),PRIMARY KEY(asteroid_id,account_id));`);}
 async function status(id,map){
  const member=(await pool.query('SELECT c.id,c.leader,m.permissions FROM gg_v15_clan_members m JOIN gg_v15_clans c ON c.id=m.clan_id WHERE m.account_id=$1',[id])).rows[0];
  const canManage=!!member&&(member.leader===id||member.permissions.includes('cbs'));
  const stations=(await pool.query('SELECT s.clan_id,s.asteroid_id,s.ready_at,s.down_until,s.clock_at,s.charge_units,s.modules,s.last_hit,s.repair_at,s.emergency_until,s.emergency_slot,c.tag AS clan_tag FROM gg_cbs_stations s JOIN gg_v15_clans c ON c.id=s.clan_id')).rows;
  const inventory=(await pool.query("SELECT instance_id AS \"instanceId\",code,level FROM gg_v13_inventory WHERE account_id=$1 AND category='cbs-modules' ORDER BY code,instance_id",[id])).rows;
  const broken=(await pool.query(`SELECT instance_id AS "instanceId",code,level FROM gg_v13_inventory WHERE account_id=$1 AND category='cbs-broken' ORDER BY code,instance_id`,[id])).rows;
  return {catalog:MODULES,rules:RULES,broken,canManage,constructionEnabled:process.env.GG_CBS_BUILD_ENABLED==='1',asteroids:ASTEROIDS.filter(a=>!map||a.map===map).map(a=>{const s=stations.find(x=>x.asteroid_id===a.id);return {...a,station:s?{...s,modules:repairState(s).modules.map(({slot,code,level,hp,shield})=>({slot,code,level,hp,shield})),owned:member?.id===s.clan_id,state:deflector(s).mode,deflector:deflector(s)}:null};}),inventory,repairEnabled:process.env.GG_CBS_COMBAT_ENABLED==='1',combatEnabled:process.env.GG_CBS_COMBAT_ENABLED==='1'};
 }
 async function build(id,{asteroidId,moduleIds,minutes,requestId}={},position){
  if(!uuid(requestId)||!Array.isArray(moduleIds)||moduleIds.length!==10||!moduleIds.every(uuid)||new Set(moduleIds).size!==10)throw fail('Solicitud inválida');
  const a=ASTEROIDS.find(x=>x.id===asteroidId);
  if(!a||!position||position.zone!==a.map||!Number.isFinite(position.x)||!Number.isFinite(position.y)||Math.hypot(position.x-a.x,position.y-a.y)>250)throw fail('Acércate al asteroide');
  const c=await pool.connect();try{await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(71413003)');
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
 async function lower(id,{asteroidId,minutes,requestId}={}){
  if(!uuid(requestId)||!ASTEROIDS.some(a=>a.id===asteroidId))throw fail('Solicitud inválida');
  const c=await pool.connect();try{await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(71413003)');
   await c.query('SELECT account_id FROM player_progress WHERE account_id=$1 FOR UPDATE',[id]);
   const old=(await c.query('SELECT response FROM gg_cbs_requests WHERE account_id=$1 AND request_id=$2',[id,requestId])).rows[0];if(old){await c.query('COMMIT');return old.response;}
   const m=(await c.query('SELECT c.id,c.leader,m.permissions FROM gg_v15_clan_members m JOIN gg_v15_clans c ON c.id=m.clan_id WHERE m.account_id=$1 FOR UPDATE OF m,c',[id])).rows[0];
   if(!m||!(m.leader===id||m.permissions.includes('cbs')))throw fail('Sin permiso CBS');
   const station=(await c.query('SELECT * FROM gg_cbs_stations WHERE asteroid_id=$1 AND clan_id=$2 FOR UPDATE',[asteroidId,m.id])).rows[0];if(!station)throw fail('Estación no disponible');
   const d=lowerDeflector(station,minutes);await c.query('UPDATE gg_cbs_stations SET clock_at=$2,charge_units=$3,down_until=$4 WHERE asteroid_id=$1',[asteroidId,d.at,d.charge,d.downUntil]);
   await c.query('INSERT INTO gg_cbs_requests(account_id,request_id,response) VALUES($1,$2,$3)',[id,requestId,JSON.stringify(d)]);await c.query('COMMIT');return d;
  }catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}
 }
 // Internal trusted game-server entrypoint. No HTTP/socket accepts a client damage amount.
 async function hit(id,{asteroidId,slot,damage,requestId}={},position,weapon=null){
  const a=ASTEROIDS.find(x=>x.id===asteroidId);
  if(!uuid(requestId)||!a||!position||position.zone!==a.map||!Number.isFinite(position.x)||!Number.isFinite(position.y)||Math.hypot(position.x-a.x,position.y-a.y)>600||!Number.isSafeInteger(damage)||damage<1||!Number.isInteger(slot)||slot<0||slot>9)throw fail('Ataque inválido');
  const c=await pool.connect();try{await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(71413003)');
   const old=(await c.query('SELECT response FROM gg_cbs_requests WHERE account_id=$1 AND request_id=$2',[id,requestId])).rows[0];if(old){await c.query('COMMIT');return old.response;}
   const station=(await c.query('SELECT * FROM gg_cbs_stations WHERE asteroid_id=$1 FOR UPDATE',[asteroidId])).rows[0];if(!station)throw fail('Estación inexistente');
   const member=(await c.query('SELECT clan_id FROM gg_v15_clan_members WHERE account_id=$1',[id])).rows[0];
   if(member?.clan_id===station.clan_id||station.builder===id)throw fail('No puedes atacar tu propia estación');
   if(member&&(await c.query("SELECT 1 FROM gg_v15_clan_diplomacy WHERE state='alliance' AND ((source=$1 AND target=$2) OR (source=$2 AND target=$1))",[member.clan_id,station.clan_id])).rowCount)throw fail('Estación aliada');
   const now=Date.now(),repaired=repairState(station,now),result=stationHit({...station,modules:repaired.modules},slot,damage,now);
   if(!result.applied)throw fail('Módulo protegido o destruido');
   let stock=null;
   if(weapon){const ammo=catalog.ammo.find(a=>a.id===weapon.code);if(!ammo||ammo.shieldOnly||!Number.isSafeInteger(weapon.count)||weapon.count<1||weapon.count>100)throw fail('Munición no compatible');
    const row=(await c.query('UPDATE gg_v13_ammo SET quantity=quantity-$3 WHERE account_id=$1 AND code=$2 AND quantity>=$3 RETURNING quantity',[id,weapon.code,weapon.count])).rows[0];if(!row)throw fail('Munición insuficiente');stock=Number(row.quantity);
   }
   await c.query('INSERT INTO gg_cbs_hits(asteroid_id,account_id,at_ms,damage) VALUES($1,$2,$3,$4) ON CONFLICT(asteroid_id,account_id) DO UPDATE SET at_ms=EXCLUDED.at_ms,damage=EXCLUDED.damage',[asteroidId,id,now,result.applied]);
   let shares=[],uridium=0;
   if(result.destroyed){
    const target=result.modules.find(m=>m.slot===slot);
    // Original instance and upgrade level return to its contributing owner as broken.
    await c.query("INSERT INTO gg_v13_inventory(account_id,instance_id,code,category,level) VALUES($1,$2,$3,'cbs-broken',$4)",[station.builder,target.instanceId,target.code,target.level]);
    uridium=MODULE_REWARDS[target.code]||0;
   }
   if(result.stationDestroyed){
    const rows=(await c.query('SELECT account_id AS "accountId",at_ms AS at,damage FROM gg_cbs_hits WHERE asteroid_id=$1 AND at_ms>=$2',[asteroidId,now-600000])).rows;
    shares=destructionShares(rows.map(r=>({...r,at:Number(r.at),damage:Number(r.damage)})),now);
   }
   // Update balances in deterministic account order; last hitter receives module uridium provisionally.
   const payouts=new Map(shares.map(r=>[r.accountId,{...r}]));if(uridium){const p=payouts.get(id)||{accountId:id,credits:0,xp:0,honor:0,uridium:0};p.uridium+=uridium;payouts.set(id,p);}
   for(const [accountId,p] of [...payouts].sort(([a],[b])=>a.localeCompare(b)))await c.query('UPDATE player_progress SET credits=credits+$2,experience=experience+$3,honor=honor+$4,uridium=uridium+$5,level=CASE WHEN experience+$3<10000 THEN 1 ELSE 2+FLOOR(LOG(2,((experience+$3)::numeric/10000)))::int END,updated_at=now() WHERE account_id=$1',[accountId,p.credits,p.xp,p.honor,p.uridium]);
   if(result.stationDestroyed)await c.query('DELETE FROM gg_cbs_stations WHERE asteroid_id=$1',[asteroidId]);
   else await c.query('UPDATE gg_cbs_stations SET modules=$2,last_hit=$3,repair_at=$3 WHERE asteroid_id=$1',[asteroidId,JSON.stringify(result.modules),now]);
   const response={stock,applied:result.applied,destroyed:result.destroyed,stationDestroyed:result.stationDestroyed,uridium,shares};
   await c.query('INSERT INTO gg_cbs_requests(account_id,request_id,response) VALUES($1,$2,$3)',[id,requestId,JSON.stringify(response)]);await c.query('COMMIT');return response;
  }catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}
 }
 async function emergency(id,{asteroidId,slot,requestId}={}){
  if(!uuid(requestId)||!ASTEROIDS.some(a=>a.id===asteroidId)||!Number.isInteger(slot)||slot<0||slot>9)throw fail('Solicitud inválida');
  const c=await pool.connect();try{await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(71413003)');
   const old=(await c.query('SELECT response FROM gg_cbs_requests WHERE account_id=$1 AND request_id=$2',[id,requestId])).rows[0];if(old){await c.query('COMMIT');return old.response;}
   const member=(await c.query('SELECT c.id,c.leader,m.permissions FROM gg_v15_clan_members m JOIN gg_v15_clans c ON c.id=m.clan_id WHERE m.account_id=$1',[id])).rows[0];
   if(!member||!(member.leader===id||member.permissions.includes('cbs')))throw fail('Sin permiso CBS');
   const station=(await c.query('SELECT * FROM gg_cbs_stations WHERE asteroid_id=$1 AND clan_id=$2 FOR UPDATE',[asteroidId,member.id])).rows[0];
   const now=Date.now();if(!station||now<Number(station.ready_at))throw fail('Estación no disponible');
   if(Number(station.emergency_until)>now)throw fail('Reparación de emergencia activa');
   const r=repairState(station,now),m=r.modules.find(m=>m.slot===slot);if(!m||m.hp<=0||m.hp>=moduleLimits(m).hp)throw fail('Módulo sin daño reparable');
   const paid=await c.query('UPDATE player_progress SET uridium=uridium-$2 WHERE account_id=$1 AND uridium>=$2 RETURNING uridium',[id,EMERGENCY.price]);if(!paid.rowCount)throw fail('Uridium insuficiente');
   const result={slot,until:now+EMERGENCY.duration,uridium:Number(paid.rows[0].uridium)};
   await c.query('UPDATE gg_cbs_stations SET modules=$2,repair_at=$3,emergency_slot=$4,emergency_until=$5 WHERE asteroid_id=$1',[asteroidId,JSON.stringify(r.modules),r.repairAt,slot,result.until]);
   await c.query('INSERT INTO gg_cbs_requests(account_id,request_id,response) VALUES($1,$2,$3)',[id,requestId,JSON.stringify(result)]);await c.query('COMMIT');return result;
  }catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}
 }
 return {ready,status,build,lower,hit,emergency};
}
module.exports={MODULES,ASTEROIDS,RULES,validateModules,stationState,deflector,lowerDeflector,DESTRUCTION_REWARD,MODULE_REWARDS,EMERGENCY,moduleLimits,stationHit,repairModule,passiveRepairRate,repairState,destructionShares,createStations};
