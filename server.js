'use strict';
const {eligibleForNpcXp,guardTarget,selectGuardTarget,npcRetaliatesAgainstPet,recordPilotAggression,pilotGuardTarget,selectPilotGuardTarget}=require('./pet-combat-rules-v173');
const {factors:boosterFactors,rocketCooldown}=require('./boosters-v112');const {logoutDelay,logoutBlocked,logoutState}=require('./logout-v222');const {clanStationEffects}=require('./stations-v113');const express=require('express');const http=require('node:http');const path=require('node:path');const crypto=require('node:crypto');const {Server}=require('socket.io');const {createAccounts}=require('./accounts');
const catalogV13=require('./data/catalog-v13.json');const {DEFS,WAVES,SHARED}=require('./gates-v14');const {MAPS,homeBase,galaxyPortals,portals,requiredLevel,population}=require('./maps-v14');const {eligible,damageFactor}=require('./pvp-v15');const {createGroups}=require('./groups-v15');const {npcCargo}=require('./minerals-v17');const {factor}=require('./upgrades-v18');const {MINES,RULES:MR,mineImpact}=require('./mines-v18');const {repairRate}=require('./cpus-v18');const {cpuEnabled,setCpu,cpuState,autoWeapons,extraView}=require('./cpu-controls-v235');const {TECH,isActive:techActive,leechAmount}=require('./assembly-v19');const {points:dronePoints}=require('./drones-v19');const {get:formationDef,bonuses:formationBonus,stats:formationStats,absorption:formationAbsorption,combatFactor,shieldDelta}=require('./formations-v19');const {ABILITIES,definitions:abilityDefinitions,active:abilityActive,activate:activateAbility,heal,speedFactor,incoming,breakCloak}=require('./abilities-v18');const alienStats=require('./data/npcs-v14.json');const {createHadesLobbies}=require('./hades-lobby-v14');const {salvo,hit}=require('./equipment-v13');
const WORLD={w:12000,h:8000};const SHIPS={scout:{hp:900,shield:450,speed:420,damage:110},tank:{hp:1800,shield:950,speed:255,damage:155}};
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n)),distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),random=(a,b)=>a+Math.random()*(b-a),point=()=>({x:random(150,WORLD.w-150),y:random(150,WORLD.h-150)}),validPoint=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
const {createJoinReservations}=require('./join-reservations-v203');const {buildZoneSnapshots,snapshotFor}=require('./zone-snapshot-v163');const {groupByZone,nearestEligible}=require('./npc-targeting-v163');const {BoxIndex,petEligible,petResourceEligible}=require('./box-index-v163');const {runDue}=require('./event-calendar-v158');const {runMaintenance,onceAsync,trackPending,drainPending}=require('./stability-v160');const {upcomingEvents,createSnapshotCache}=require('./event-feed-v159');
function createGame({password=process.env.ADMIN_PASSWORD||'',npcCount=42,boxCount=75,accounts=createAccounts(process.env.DATABASE_URL)}={}){
 const app=express(),server=http.createServer(app),io=new Server(server,{maxHttpBufferSize:8192});const hadesLobbies=createHadesLobbies(),groups=createGroups();const players=new Map(),npcs=new Map(),boxes=new BoxIndex(),mines=new Map(),active=new Map(),joinReservations=createJoinReservations({capacity:40}),pending=new Set(),unpersistedDeaths=new Map();let seq=0,tick=0,closing=false;const timers=new Set(),attempts=new Map();
 const {createLobby:makeUBALobby,accept:acceptUBA,advance:advanceUBA,forfeit:forfeitUBA,expireOffer}=require('./uba-v126');const {createArena,command:arenaCommand,tickArenaPaid,viewArena}=require('./uba-arena-v128');
 const ubaEligible=p=>!!p&&players.get(p.id)===p&&p.level>=14&&!p.invasionReturn&&!ubaSettling.has(p.accountId)&&!p.deadUntil&&!p.gate&&!p.gatePending&&!p.hadesPending&&!p.godMode&&!p.shotPending&&!p.reloadPending&&!p.upgradePending&&!p.cbsBusy&&!p.petPending;
 const ubaLobby=makeUBALobby({eligible:ubaEligible}),arenas=new Map(),ubaSettling=new Set();
 const ice=require('./ice-v146'),iceEnabled=()=>process.env.GG_ICE_ENABLED==='1';let iceRun=null;
 const iceTarget=id=>typeof id==='string'&&id.startsWith('ice:');
 function iceUnit(id){const e=iceRun;if(!e||!iceTarget(id))return null;const key=id.slice(4);return key===e.boss.id?e.boss:e.icy.get(key);}
 function icePilot(p,e=iceRun){return !!p&&!!e&&iceEnabled()&&e.phase==='active'&&p.zone===e.map&&p.hp>0&&!p.deadUntil&&!p.gate&&!p.gatePending&&!p.ubaReturn&&!p.invasionReturn&&!p.godMode&&!safeZone(p);}
 function iceView(zone){return iceEnabled()&&iceRun?.map===zone?ice.view(iceRun):null;}
 function syncProgress(p){if(!p||!accounts.progressRead||closing||p.progressSyncPending)return Promise.resolve();p.progressSyncPending=true;
 const job=p.writes.catch(()=>{}).then(async()=>{const r=await accounts.progressRead(p.accountId);if(!r||players.get(p.id)!==p)return;const values={credits:Number(r.credits),experience:Number(r.experience),level:Number(r.level),honor:Number(r.honor),uridium:Number(r.uridium)};if(!Object.values(values).every(Number.isSafeInteger))throw Error('Progreso fuera de rango');Object.assign(p,values);}).finally(()=>{p.progressSyncPending=false;pending.delete(job);});p.writes=job;pending.add(job);return job;}
 function settleIce(e){if(e.settling||e.settled||!accounts.iceSettle||process.env.GG_ICE_REWARDS_ENABLED!=='1')return;e.settling=true;const rows=[...e.contributors].map(([accountId,damage])=>({accountId,damage}));const pay=()=>accounts.iceSettle(e.id,rows);e.nextSettlement=Date.now()+30000;const job=Promise.resolve().then(pay).catch(pay).then(r=>{e.settled=true;for(const x of r.rewards){const p=[...players.values()].find(p=>p.accountId===x.accountId);if(!p)continue;syncProgress(p).catch(()=>{});emitReward(p,'Meteorito',x);}}).catch(()=>{io.to(e.map).emit('notice','No se pudo guardar el reparto del meteorito');}).finally(()=>{e.settling=false;pending.delete(job);});pending.add(job);}
 function collectIce(p,now){const e=iceRun;if(!e||!iceEnabled()||process.env.GG_ICE_REWARDS_ENABLED!=='1'||!accounts.iceBoxClaim||p.iceBoxPending)return;
 for(const b of e.boxes.values()){if(!ice.reserveBox(e,p,b.id,now))continue;p.iceBoxPending=true;const pay=()=>accounts.iceBoxClaim(p.accountId,e.id,b.id);const job=p.writes.catch(()=>{}).then(()=>Promise.resolve().then(pay).catch(pay)).then(r=>{ice.releaseBox(e,b,true);io.to(p.id).emit('notice','Caja de hielo: +'+r.uridium+' uridium');}).catch(err=>{ice.releaseBox(e,b,err.status===409);}).finally(()=>{p.iceBoxPending=false;pending.delete(job);});p.writes=job;pending.add(job);break;}
 }
 function tickIce(now,dt){const e=iceRun;if(!e||!iceEnabled())return;const prev=e.phase,signals=ice.advance(e,now);
 if(prev!==e.phase)io.to(e.map).emit('notice',e.phase==='active'?'Meteorito de Hielo activo':e.phase==='expired'?'Meteorito de Hielo finalizado':'Evento de Hielo actualizado');
 if(e.phase==='defeated'&&!e.settled&&!e.settling&&now>=(e.nextSettlement||0)&&process.env.GG_ICE_REWARDS_ENABLED==='1')settleIce(e);if(e.phase==='expired'||(e.phase==='defeated'&&!e.boxes.size&&!e.settling&&(e.settled||process.env.GG_ICE_REWARDS_ENABLED!=='1'))){iceRun=null;return;}if(e.phase!=='active')return;
 if(signals.notice)io.to(e.map).emit('notice','Meteorito de Hielo: X '+Math.round(e.boss.x)+' / Y '+Math.round(e.boss.y));
 if(signals.ping)io.to(e.map).emit('v147:icePing',signals.ping);
 const ps=[...players.values()].filter(p=>icePilot(p,e)&&!safeZone(p)&&!p.cloaked&&!abilityActive(p,'ultimate-cloak',now)&&!(p.protectedUntil>now));
 for(const u of [e.boss,...e.icy.values()]){let target=null,best=1000;for(const p of ps){const d=distance(u,p);if(d<best&&p.hp>0&&!p.deadUntil){target=p;best=d;}}if(!target)continue;
 if(best>450)move(u,target,dt);if(distance(u,target)>450||now-(u.lastShot||0)<1100)continue;u.lastShot=now;laser({...u,zone:e.map,type:u===e.boss?'boss':'drone'},target);damage(target,u.damage);
 if(target.hp<=0&&!target.deadUntil){recordRankDeath(target);target.deadUntil=now+4000;target.attack=false;target.target=null;target.dest=null;setPetMode(target,'off');io.to(target.id).emit('notice','Nave destruida por Meteorito de Hielo');}}
 }
 function shootIce(p,now){const e=iceRun,u=iceUnit(p.target),code=p.ammo,count=p.lasers,a=catalogV13.ammo.find(a=>a.id===code);if(!icePilot(p,e)||!u||!p.attack||!a||a.shieldOnly||p.shotPending||p.reloadPending||p.reloadRequested||p.upgradePending||!Number.isInteger(count)||count<1||count>100||now-p.lastShot<a.intervalMs)return;
 try{ice.validateShot(e,p,u.id,now);}catch{return;}p.lastShot=now;p.shotPending=true;breakCloak(p);const key=crypto.randomUUID(),pay=()=>accounts.ubaAuthorizeAmmo(key,[{accountId:p.accountId,code,count}]);const job=Promise.resolve().then(pay).catch(pay).then(r=>{const stock=r[p.accountId];if(stock==null){p.attack=false;return io.to(p.id).emit('notice','Munición insuficiente');}io.to(p.id).emit('v13:ammoStock',{code,quantity:stock});if(closing||iceRun!==e||players.get(p.id)!==p||!icePilot(p,e)||p.target!=='ice:'+u.id||!p.attack)return;
 try{ice.validateShot(e,p,u.id);p.angle=Math.atan2(u.y-p.y,u.x-p.x);laser(p,u,a.id);if(Math.random()<a.miss)return;const amount=Math.max(1,Math.round(p.damage*a.multiplier*(p.boost?.damage||1))),result=ice.hit(e,p,u.id,amount);if(result.dealt>0)laserDamage(p,u,amount,u===e.boss?100:54);if(result.killed){p.attack=false;p.target=null;if(result.boss){e.settlement=result.shares;settleIce(e);io.to(e.map).emit('notice','Meteorito destruido');}else io.to(p.id).emit('notice','Icy eliminado · el jefe recupera vida');}}catch{}}).catch(()=>{p.attack=false;io.to(p.id).emit('notice','Disparo de Hielo no disponible');}).finally(()=>{p.shotPending=false;pending.delete(job);});pending.add(job);}
 const hitac=require('./hitac-v141'),hitacEnabled=()=>process.env.GG_HITAC_ENABLED==='1';let hitacRun=null;
 const hitacTarget=id=>typeof id==='string'&&id.startsWith('hitac:');
 function hitacUnit(id){return hitacTarget(id)?hitacRun?.units.get(id.slice(6)):null;}
 function hitacView(zone){return hitacEnabled()&&hitacRun?.phase==='active'&&hitacRun.map===zone?hitac.view(hitacRun):null;}
 function hitacPilot(p,c=hitacRun){return !!p&&!!c&&hitacEnabled()&&c.phase==='active'&&p.zone===c.map&&p.hp>0&&!p.deadUntil&&!p.gate&&!p.gatePending&&!p.ubaReturn&&!p.invasionReturn&&!p.godMode&&!safeZone(p);}
 function hitacDeath(p,now){if(p.hp>0||p.deadUntil)return;recordRankDeath(p);p.deadUntil=now+4000;p.attack=false;p.target=null;p.dest=null;setPetMode(p,'off');io.to(p.id).emit('notice','Nave destruida por Hitac');}
 function tickHitac(now){const c=hitacRun;if(!c||!hitacEnabled())return;const ps=[...players.values()].filter(p=>hitacPilot(p,c)&&!safeZone(p)&&!p.cloaked&&!abilityActive(p,'ultimate-cloak',now)&&!(p.protectedUntil>now)),old=c.map,e=hitac.effects(c,ps,now);
 if(c.phase!=='active'){io.emit('notice','Hitac: '+(c.phase==='defeated'?'nodriza destruida':'convoy retirado'));hitacRun=null;return;}if(old!==c.map)io.emit('notice','Hitac ha llegado a '+c.map);
 for(const q of e.slows){const p=players.get(q.pilotId);if(p&&hitacPilot(p,c)&&!immune(p))p.slowUntil=Math.max(p.slowUntil||0,q.until);}
 for(const q of e.targets){const u=c.units.get(q.unitId),p=players.get(q.pilotId);if(!u||!hitacPilot(p,c)||now-(u.lastShot||0)<1100||distance(u,p)>hitac.RULES.attackRange)continue;u.lastShot=now;laser({...u,zone:c.map,type:u.boss?'boss':'drone'},p);damage(p,q.damage);hitacDeath(p,now);}
 if(e.ping)io.emit('v142:hitacPing',e.ping);
 }
 function shootHitac(p,now){const c=hitacRun,u=hitacUnit(p.target),code=p.ammo,count=p.lasers,a=catalogV13.ammo.find(a=>a.id===code);if(!hitacPilot(p,c)||!u||!p.attack||!a||a.shieldOnly||p.shotPending||p.reloadPending||p.reloadRequested||p.upgradePending||!Number.isInteger(count)||count<1||count>100||now-p.lastShot<a.intervalMs)return;
 try{hitac.validateShot(c,p,u.id,now);}catch{return;}p.lastShot=now;p.shotPending=true;breakCloak(p);const key=crypto.randomUUID(),pay=()=>accounts.ubaAuthorizeAmmo(key,[{accountId:p.accountId,code,count}]);const job=Promise.resolve().then(pay).catch(pay).then(r=>{const stock=r[p.accountId];if(stock==null){p.attack=false;return io.to(p.id).emit('notice','Munición insuficiente');}io.to(p.id).emit('v13:ammoStock',{code,quantity:stock});if(closing||hitacRun!==c||players.get(p.id)!==p||!hitacPilot(p,c)||p.target!=='hitac:'+u.id||!p.attack)return;
 try{hitac.validateShot(c,p,u.id);p.angle=Math.atan2(u.y-p.y,u.x-p.x);laser(p,u,a.id);if(Math.random()<a.miss)return;const amount=Math.max(1,Math.round(p.damage*a.multiplier*(p.boost?.damage||1))),result=hitac.hit(c,p,u.id,amount);if(!result.blocked&&result.damage>0)laserDamage(p,u,amount,u.boss?100:64);if(result.blocked){io.to(p.id).emit('notice','Hitac protegido');return;}if(result.killed){p.attack=false;p.target=null;io.to(p.id).emit('notice',u.name+' eliminado');if(process.env.GG_HITAC_REWARDS_ENABLED==='1'&&accounts.hitacReward){const pay=()=>accounts.hitacReward(p.accountId,u.id);const job=p.writes.catch(()=>{}).then(()=>Promise.resolve().then(pay).catch(pay)).then(r=>{Object.assign(p,{credits:Number(r.balance.credits),experience:Number(r.balance.experience),level:Number(r.balance.level),honor:Number(r.balance.honor)});emitReward(p,'Hitac eliminado',r.reward);});p.writes=job;pending.add(job);job.then(()=>pending.delete(job),()=>{pending.delete(job);io.to(p.id).emit('notice','No se pudo guardar recompensa Hitac');});}if(process.env.GG_HITAC_LOTTERY_ENABLED==='1'&&accounts.hitacCapsuleGrant){const grant=()=>accounts.hitacCapsuleGrant(p.accountId,u.id);const reward=p.writes.catch(()=>{}).then(()=>Promise.resolve().then(grant).catch(grant));p.writes=reward;pending.add(reward);reward.then(r=>{if(r.granted)io.to(p.id).emit('notice','Hitac: cápsula obtenida');},()=>io.to(p.id).emit('notice','No se pudo guardar cápsula Hitac')).finally(()=>pending.delete(reward));}for(const q of hitac.explosionTargets(c,result.explosion,[...players.values()])){const v=players.get(q.pilotId);if(!v||safeZone(v)||v.protectedUntil>Date.now())continue;damage(v,q.damage);hitacDeath(v,Date.now());}}}catch{}}).catch(()=>{p.attack=false;io.to(p.id).emit('notice','Disparo Hitac no disponible');}).finally(()=>{p.shotPending=false;pending.delete(job);});pending.add(job);}
 const spaceball=require('./spaceball-v138'),spaceballEnabled=()=>process.env.GG_SPACEBALL_ENABLED==='1';let spaceballGame=null;
 const ballTarget='event:spaceball';
 function spaceballView(now=Date.now()){return spaceballEnabled()&&spaceballGame?spaceball.view(spaceballGame,now):null;}
 function canShootBall(p,g=spaceballGame){return !!g&&spaceballEnabled()&&g.active&&p.zone==='4-4'&&!p.deadUntil&&!p.gatePending&&!p.gate&&!p.ubaReturn&&!p.invasionReturn&&!p.godMode&&!p.reloadPending&&!p.reloadRequested&&!p.upgradePending&&!p.shotPending;}
 function shootBall(p,now){const g=spaceballGame,ammo=p.ammo,count=p.lasers,a=catalogV13.ammo.find(a=>a.id===ammo);if(!canShootBall(p,g)||!p.attack||!a||!Number.isInteger(count)||count<1||count>100||now-p.lastShot<a.intervalMs||g.busy)return;try{spaceball.validateShot(g,p,ammo,now);}catch{return;}p.lastShot=now;p.shotPending=true;g.busy=true;breakCloak(p);const key=crypto.randomUUID(),batch=[{accountId:p.accountId,code:ammo,count}];const pay=()=>accounts.ubaAuthorizeAmmo(key,batch);const job=Promise.resolve().then(pay).catch(pay).then(r=>{const stock=r[p.accountId];if(stock==null){p.attack=false;io.to(p.id).emit('notice','Munición insuficiente');return;}io.to(p.id).emit('v13:ammoStock',{code:ammo,quantity:stock});if(closing||spaceballGame!==g||players.get(p.id)!==p||p.deadUntil||p.zone!=='4-4'||p.target!==ballTarget||!p.attack||p.godMode)return;try{spaceball.validateShot(g,p,ammo);laser(p,g.ball);const result=spaceball.shot(g,p,ammo);if(result.goal){io.to('4-4').emit('notice',result.scorer?'Spaceball: gol de '+['','MMO','EIC','VRU'][result.scorer]:'Spaceball: autogol');}}catch{}}).catch(()=>{p.attack=false;io.to(p.id).emit('notice','No se pudo procesar disparo Spaceball');}).finally(()=>{p.shotPending=false;g.busy=false;pending.delete(job);});pending.add(job);}
 function collectSpaceball(p,now){const g=spaceballGame;if(!g||!spaceballEnabled()||process.env.GG_SPACEBALL_CLAIMS_ENABLED!=='1'||!accounts.spaceballClaim||p.spaceballPending||p.zone!=='4-4'||p.deadUntil||p.godMode)return;
 for(const b of g.boxes.values()){if(!spaceball.reserveBox(g,p,b.id,now))continue;p.spaceballPending=true;const claim=()=>accounts.spaceballClaim(p.accountId,g.id,b.id,b.rewards);const job=p.writes.catch(()=>{}).then(()=>Promise.resolve().then(claim).catch(claim)).then(r=>{spaceball.releaseBox(g,b,true);p.credits=Number(r.balance.credits);io.to(p.id).emit('notice','Spaceball: +'+r.rewards.credits+' créditos · +'+r.rewards.uridium+' uridium · +'+r.rewards['RSB-75']+' RSB-75 · +'+r.rewards.gateEnergy+' energía · +'+r.rewards.jumpVouchers+' saltos · +'+r.rewards.repairVouchers+' reparaciones');io.to(p.id).emit('v13:inventoryChanged');}).catch(e=>{spaceball.releaseBox(g,b,e.status===409);io.to(p.id).emit('notice','No se pudo recoger caja Spaceball');}).finally(()=>{p.spaceballPending=false;pending.delete(job);});p.writes=job;pending.add(job);break;}
 }
 const invasion=require('./invasion-v134'),invasionEnabled=()=>process.env.GG_INVASION_LOBBY_ENABLED==='1';
 const invasionCombat=require('./invasion-combat-v136'),invasionRuns=new Map(),liveInvasion=()=>invasionEnabled()&&process.env.GG_INVASION_COMBAT_ENABLED==='1';
 const invasionEligible=p=>!!p&&players.get(p.id)===p&&!p.deadUntil&&!p.gate&&!p.gatePending&&!p.hadesPending&&!p.ubaReturn&&!p.invasionReturn&&!p.shotPending&&!p.reloadPending&&!p.upgradePending&&!p.petPending&&!p.attack&&!p.godMode&&p.zone===p.company+'-1'&&safeZone(p);
 const invasionLobby=invasion.createAdmission({eligible:invasionEligible});
 function invasionView(p){return invasionEnabled()?invasionLobby.view(p):{enabled:false,joined:false,event:null};}
 function notifyInvasion(){for(const p of players.values())io.to(p.id).emit('v135:invasion',invasionView(p));}
 function restoreInvasion(p){if(!p?.invasionReturn)return;const pos=p.invasionReturn;delete p.invasionReturn;changeMap(p,pos.zone,pos);p.protectedUntil=Date.now()+3000;io.to(p.id).emit('v136:invasionState',null);}
 function leaveInvasion(p){if(!p?.invasionReturn)return;const c=invasionRuns.get(p.invasionReturn.eventId);if(c)invasionCombat.leave(c,p.id);restoreInvasion(p);}
 function startInvasion(event,ids,now){const ps=ids.map(id=>players.get(id)).filter(invasionEligible);if(!ps.length)return;event.players=new Set(ps.map(p=>p.id));event.scores=new Map(ps.map(p=>[p.id,0]));event.phase='entry';const c=invasionCombat.createCombat(event,ps,now);invasionRuns.set(event.id,c);
 for(const p of ps){p.invasionReturn={zone:p.zone,x:p.x,y:p.y,eventId:event.id};p.attack=false;p.target=null;p.dest=null;setPetMode(p,'off');io.sockets.sockets.get(p.id)?.leave(p.zone);p.zone='invasion:'+event.id;io.sockets.sockets.get(p.id)?.join(p.zone);io.to(p.id).emit('v136:invasionState',invasionCombat.view(c,p.id));}}
 function tickInvasion(now){if(!invasionEnabled())return;let changed=false;for(const p of players.values())if(invasionLobby.view(p).joined&&!invasionEligible(p)){invasionLobby.leave(p.id);changed=true;}for(const {event,ids} of invasionLobby.tick(now)){if(liveInvasion()){try{startInvasion(event,ids,now);}catch{for(const id of ids)restoreInvasion(players.get(id));invasionRuns.delete(event.id);}}else for(const id of ids)io.to(id).emit('notice','Invasión '+event.map+': prueba de inscripción completada.');changed=true;}if(changed)notifyInvasion();
 for(const [eventId,c] of invasionRuns){if(c.busy)continue;const job=invasionCombat.tick(c,async plans=>{const result={};await Promise.all(plans.map(async q=>{const p=players.get(q.id);if(!p||p.invasionReturn?.eventId!==eventId)return;try{result[q.id]=await accounts.consumeAmmo(p.accountId,q.code,q.count);}catch{result[q.id]=null;}}));return result;},now).then(board=>{if(invasionRuns.get(eventId)!==c)return;if(board)for(const id of c.fighters.keys())io.to(id).emit('notice','Invasión: '+board.slice(0,3).map(x=>(players.get(x.id)?.name||'Piloto')+' '+x.points).join(' · '));if(!c.lastBroadcast||now-c.lastBroadcast>=200||c.closed){c.lastBroadcast=now;for(const id of c.fighters.keys())io.to(id).emit('v136:invasionState',invasionCombat.view(c,id));}if(c.closed){const result=invasionCombat.result(c);for(const id of c.fighters.keys())restoreInvasion(players.get(id));invasionRuns.delete(eventId);if(accounts.invasionSettle){const save=()=>accounts.invasionSettle(result);const persist=Promise.resolve().then(save).catch(save);pending.add(persist);persist.then(()=>{for(const id of c.fighters.keys())io.to(id).emit('notice','Resultado de Invasión guardado');},()=>{for(const id of c.fighters.keys())io.to(id).emit('notice','No se pudo guardar el resultado de Invasión');}).finally(()=>pending.delete(persist));}}}).catch(()=>{for(const id of c.fighters.keys())restoreInvasion(players.get(id));invasionRuns.delete(eventId);}).finally(()=>pending.delete(job));pending.add(job);}
 }
 const liveUBA=()=>process.env.GG_UBA_COMBAT_ENABLED==='1'&&process.env.GG_UBA_LOBBY_ENABLED==='1';
 function enterUBA(m){const ps=m.players.map(id=>players.get(id));if(ps.some(p=>!ubaEligible(p)||!p.ubaReturn&&(!MAPS[p.zone]||!safeZone(p)||p.attack)))throw Error('Entra desde una base segura');const arena=createArena(m,ps,Date.now());arenas.set(m.id,arena);m.started=true;for(const p of ps){if(!p.ubaReturn){p.ubaReturn={zone:p.zone,x:p.x,y:p.y};p.attack=false;p.target=null;p.dest=null;setPetMode(p,'off');io.sockets.sockets.get(p.id)?.leave(p.zone);p.zone='uba:'+m.id;io.sockets.sockets.get(p.id)?.join(p.zone);}io.to(p.id).emit('v129:arena',viewArena(arena,p.id));}}
 function restoreUBA(m){arenas.delete(m.id);for(const id of m.players){const p=players.get(id);if(!p?.ubaReturn)continue;const pos=p.ubaReturn;delete p.ubaReturn;changeMap(p,pos.zone,pos);p.protectedUntil=Date.now()+3000;io.to(id).emit('v129:arena',null);}}
 function endUBA(m){const winner=players.get(m.winner),loser=players.get(m.players.find(id=>id!==m.winner));restoreUBA(m);notifyUBA(m);ubaLobby.remove(m.players[0]);if(m.winner&&winner&&loser&&accounts.ubaSettle){const ids=[winner.accountId,loser.accountId];for(const id of ids)ubaSettling.add(id);const settle=()=>accounts.ubaSettle(m.id,...ids);const job=Promise.resolve().then(settle).catch(()=>settle());pending.add(job);job.then(r=>{for(const id of m.players)io.to(id).emit('notice','UBA: resultado acreditado · '+r.winnerScore+' / '+r.loserScore);},()=>{for(const id of m.players)io.to(id).emit('notice','No se pudo acreditar resultado UBA');}).finally(()=>{for(const id of ids)ubaSettling.delete(id);pending.delete(job);});}}
 function ubaView(id,m=ubaLobby.get(id)){
  return {queued:ubaLobby.queued(id),match:m?{id:m.id,round:m.round,phase:m.phase,until:m.until,score:m.score,reason:m.reason||null,winner:m.winner?m.winner===id?'you':'opponent':null,accepted:m.accepted.includes(id),opponentAccepted:m.accepted.some(x=>x!==id),opponent:players.get(m.players.find(x=>x!==id))?.name||'Piloto'}:null};
 }
 function notifyUBA(m){if(m)for(const id of m.players)io.to(id).emit('v127:ubaState',ubaView(id,m));}
 function leaveUBA(id,voluntary=false){const current=ubaLobby.get(id);if(!closing&&liveUBA()&&voluntary&&current&&forfeitUBA(current,id)){endUBA(current);return;}const m=ubaLobby.remove(id);if(m){m.phase='cancelled';m.until=0;restoreUBA(m);notifyUBA(m);}io.to(id).emit('v127:ubaState',ubaView(id));}
 function tickUBA(now){if(process.env.GG_UBA_LOBBY_ENABLED!=='1')return;if(liveUBA()){for(const m of ubaLobby.all()){if(m.players.some(id=>!ubaEligible(players.get(id)))){leaveUBA(m.players[0]);continue;}try{const old=m.phase;if(expireOffer(m,now)){endUBA(m);continue;}if(m.phase==='fight'){const arena=arenas.get(m.id);if(!arena)throw Error('Arena no disponible');if(arena.busy)continue;const job=tickArenaPaid(arena,m,async plans=>{const key=crypto.randomUUID(),batch=plans.map(q=>({accountId:players.get(q.id).accountId,code:q.code,count:q.count}));const pay=()=>accounts.ubaAuthorizeAmmo(key,batch);const result=await Promise.resolve().then(pay).catch(pay);return Object.fromEntries(plans.map((q,i)=>[q.id,result[batch[i].accountId]]));},now).then(()=>{if(arenas.get(m.id)!==arena)return;if(!arena.lastBroadcast||now-arena.lastBroadcast>=100||arena.closed){arena.lastBroadcast=now;for(const id of m.players)io.to(id).emit('v129:arena',viewArena(arena,id));}if(m.phase!=='fight')notifyUBA(m);if(m.phase==='finished')endUBA(m);}).catch(()=>{if(arenas.get(m.id)===arena)leaveUBA(m.players[0]);}).finally(()=>pending.delete(job));pending.add(job);continue;}else{advanceUBA(m,now);if(m.phase==='fight')enterUBA(m);}if(m.phase!==old)notifyUBA(m);if(m.phase==='finished')endUBA(m);else if(m.phase==='cancelled')leaveUBA(m.players[0]);}catch{leaveUBA(m.players[0]);}}return;}for(const m of ubaLobby.previewTick(now)){
  if(m.players.some(id=>!ubaEligible(players.get(id)))){leaveUBA(m.players[0]);continue;}
  if(['cancelled','preview-complete'].includes(m.phase)){notifyUBA(m);ubaLobby.remove(m.players[0]);}
 }}
 const zoneOf=o=>o?.zone||'1-1';const sameZone=(a,b)=>zoneOf(a)===zoneOf(b);
 const later=(fn,ms)=>{if(closing)return;const t=setTimeout(()=>{timers.delete(t);fn();},ms);timers.add(t);};const id=()=>String(++seq);
 function spawnNPC(boss=false,pos=point()){const n={id:id(),type:boss?'boss':'drone',name:boss?'BOSS · TITAN':'Stellar Drone',x:pos.x,y:pos.y,angle:0,hp:boss?8500:650,maxHp:boss?8500:650,shield:boss?4500:220,maxShield:boss?4500:220,speed:boss?105:155,damage:boss?220:55,reward:boss?3500:180,target:null,dest:point(),lastShot:0};npcs.set(n.id,n);return n;}
 function spawnBox(pos=point(),zone='1-1'){const b={id:id(),zone,x:pos.x,y:pos.y,value:Math.floor(random(35,101))};boxes.set(b.id,b);return b;}
 function updateBoosters(p,now=Date.now()){
  if(!p.rawBoosters)p.rawBoosters={};
  const nearby=[...players.values()].filter(q=>q!==p&&!q.deadUntil&&q.company===p.company&&sameZone(p,q)&&distance(p,q)<=1000).map(q=>q.rawBoosters);
  const next=boosterFactors(p.rawBoosters,nearby,now),old=p.boost||{},cbs=stationEffects(p,now);
  next.damage*=cbs.damage;next.xp*=cbs.xp;next.honor*=cbs.honor;
  if(old.hp!==next.hp||old.shield!==next.shield){
   p.boost=next;
   if(p.unformedStats)applyFormation(p,p.formation);
   else{const base=SHIPS[p.ship];if(base){p.maxHp=Math.round(base.hp*next.hp);p.hp=Math.min(p.hp??p.maxHp,p.maxHp);p.baseShield=base.shield*next.shield;applyMineralStats(p,p.mineralUpgrades);}}
  }else p.boost=next;
 }
 function applyFormation(p,formation){p.formation=p.droneCount>=6&&formationDef(formation)?formation:'normal';const b=p.unformedStats;if(!b)return;const q=formationStats(b,p.formation);p.maxHp=Math.round(q.hp*(p.boost?.hp||1));p.baseShield=q.shield*(p.boost?.shield||1);p.baseSpeed=q.speed;p.damage=q.damage;p.absorption=q.absorption;p.hp=Math.min(p.maxHp,Math.max(0,p.hp));applyMineralStats(p,p.mineralUpgrades);}
 function applyLoadout(p,l){if(!l)return;if(p.ship!==l.ship||p.design!==l.design)for(const a of Object.values(p.abilities||{}))a.until=0;const ratio=Number.isFinite(p.hp)&&p.maxHp>0?p.hp/p.maxHp:1;p.nextUpgradeAt=l.nextUpgradeAt||0;p.ship=l.ship;p.design=l.design||null;p.designBonus=l.designBonus||{};p.pilotBonus=l.pilotBonus||{};p.droneCount=l.droneCount||0;p.droneRank=l.droneRank||1;p.droneVisuals=l.droneVisuals||[];p.formationReadyAt=l.formationReadyAt||0;p.unformedStats={hp:(l.hp+(p.pilotBonus.hp||0))*(p.designBonus.hp||1),shield:l.shield*(p.designBonus.shield||1)*(p.pilotBonus.shield||1),speed:l.speed,damage:l.damage*(p.designBonus.damage||1),absorption:l.absorption+(p.pilotBonus.absorption||0)};p.lasers=l.lasers;p.allLF3=l.allLF3===true;p.launcher=l.launcher||null;p.cpus=l.cpus||[];p.robot=l.robot||null;applyFormation(p,l.formation);p.hp=Math.min(p.maxHp,Math.max(0,Math.round(p.maxHp*ratio)));p.activeConfig=l.active;p.v13=true;p.ammo=p.ammo||'LCB-10';}
 function rememberDeath(p){if(!accounts.respawnMarkDeath||p.gate||p.gatePending||p.ubaReturn||p.invasionReturn||!Object.hasOwn(MAPS,p.zone)||p.deathPersistence)return;const deathId=p.deathRequestId||crypto.randomUUID();p.deathRequestId=deathId;const death={deathId,destination:{zone:p.zone,x:p.x,y:p.y},readyAt:p.deadUntil||Date.now()+4000};p.deathPersistence=death;unpersistedDeaths.set(p.accountId,death);const job=p.writes.catch(()=>{}).then(()=>flushDeath(p.accountId));p.writes=job;pending.add(job);job.then(()=>pending.delete(job),()=>{pending.delete(job);io.to(p.id).emit('notice','No se pudo guardar destrucción; se reintentará');});}
 async function flushDeath(accountId){const d=unpersistedDeaths.get(accountId);if(!d)return;await accounts.respawnMarkDeath(accountId,d.deathId,d.destination,d.readyAt);if(unpersistedDeaths.get(accountId)===d)unpersistedDeaths.delete(accountId);}
 function respawnDestination(p,mode){if(mode==='base')return {zone:p.company+'-1',x:WORLD.w/2,y:WORLD.h/2};const pos=mode==='position'?{x:p.x,y:p.y}:require('./respawn-v222').nearestRepairPortal(portals(p.zone,WORLD.w,WORLD.h),p.x,p.y);return pos?{zone:p.zone,x:pos.x,y:pos.y}:null;}
 function requestRepair(p,mode,ack=()=>{}){const deathId=p.deathRequestId,death=p.deathPersistence,destination=mode==='base'&&!death?null:respawnDestination(p,mode);if(!destination&&mode!=='base')return ack({ok:false,error:'Destino no disponible'});p.respawnPending=true;p.respawnAttempt=mode;const job=p.writes.catch(()=>{}).then(async()=>{if(death){await flushDeath(p.accountId);await accounts.respawnMarkDeath(p.accountId,deathId,death.destination,death.readyAt);}return accounts.respawnCharge(p.accountId,deathId,mode,destination,!!death);});p.writes=job;pending.add(job);job.then(result=>{if(players.get(p.id)===p&&p.deadUntil&&p.deathRequestId===deathId){finishRespawn(p,mode,destination?{deathId,destination}:null);ack({ok:true,result});}}).catch(e=>{if(e.status>=400&&e.status<500){p.respawnAttempt=null;p.respawnChoiceUntil=Date.now()+30000;}ack({ok:false,retrySame:!!p.respawnAttempt,error:e.status?e.message:'No se pudo confirmar; reintenta la misma opción'});}).finally(()=>{p.respawnPending=false;pending.delete(job);});}
 function finishRespawn(p,mode,receipt=null){const home=p.company+'-1',zone=receipt?.destination?.zone||(mode==='base'?home:p.zone);const pos=receipt?.destination||(mode==='position'?{x:p.x,y:p.y}:mode==='portal'?require('./respawn-v222').nearestRepairPortal(portals(p.zone,WORLD.w,WORLD.h),p.x,p.y):null);changeMap(p,zone,pos);spawnPlayer(p);if(pos){p.x=pos.x;p.y=pos.y;}p.protectedUntil=Date.now()+3000;if(receipt)p.recoveredRespawnId=receipt.deathId;io.to(p.id).emit('v222:respawnDone',{mode,deathId:receipt?.deathId});io.to(p.id).emit('v13:inventoryChanged');const job=p.writes.catch(()=>{}).then(()=>accounts.saveLocation(p.accountId,p.company,zone));p.writes=job;pending.add(job);job.then(()=>pending.delete(job),()=>pending.delete(job));}
 function offerRespawn(p,now){if(p.respawnChoiceUntil)return;p.respawnChoiceUntil=now+30000;const deathId=p.deathRequestId;const available=['base','position',...(portals(p.zone,WORLD.w,WORLD.h).length?['portal']:[])];Promise.resolve().then(()=>accounts.respawnOptions(p.accountId)).then(options=>{if(players.get(p.id)===p&&p.deadUntil&&p.deathRequestId===deathId)io.to(p.id).emit('v222:respawnOffer',{deathId,until:p.respawnChoiceUntil,options:options.filter(x=>available.includes(x.mode))});}).catch(()=>{if(players.get(p.id)===p&&p.deadUntil&&p.deathRequestId===deathId)io.to(p.id).emit('v222:respawnOffer',{deathId,until:p.respawnChoiceUntil,options:[{mode:'base',uridium:0,vouchers:0}]});});}
 function spawnPlayer(p){p.deathPersistence=null;p.respawnChoiceUntil=0;p.respawnPending=false;p.respawnAttempt=null;p.petAggressors=new Map();p.deathRecorded=false;p.deathRequestId=crypto.randomUUID();p.cloaked=false;p.ishUntil=0;p.repairOn=false;for(const a of Object.values(p.abilities||{}))a.until=0;p.petMode='off';p.petUntil=0;p.petGeneration=(p.petGeneration||0)+1;Object.assign(p,{x:WORLD.w/2+random(-180,180),y:WORLD.h/2+random(-180,180),hp:p.maxHp,shield:p.maxShield,angle:0,dest:null,target:null,attack:false,deadUntil:0,lastHit:Date.now()});}
 function applyMineralStats(p,upgrades){p.mineralUpgrades=upgrades||{};const max=Math.round((p.baseShield??p.maxShield)*factor(upgrades,'shield'));p.maxShield=max;p.shield=Math.min(max,p.shield);p.speed=(p.baseSpeed??p.speed)*factor(upgrades,'speed');}
 function generatorTick(p,now){
  if(p.upgradePending||p.shotPending||now<(p.nextGeneratorRound||0))return;
  const u=p.mineralUpgrades||{},slots=[];
  if(u.speed?.rounds>0&&p.dest)slots.push('speed');
  if(u.shield?.rounds>0&&now-p.lastHit<10000&&!p.godMode)slots.push('shield');
  if(!slots.length)return;
  p.nextGeneratorRound=now+10000;p.upgradePending=true;
  const job=p.writes.catch(()=>{}).then(()=>accounts.generatorRound(p.accountId,slots)).then(r=>{if(players.get(p.id)===p)applyMineralStats(p,r.upgrades);});
  p.writes=job;pending.add(job);job.catch(()=>{}).finally(()=>{p.upgradePending=false;pending.delete(job);});
 }
 function immune(v){return v.godMode===true||v.ishUntil>Date.now();}
 function damage(v,amount){if(immune(v))return;amount=protectDamage(v,amount*incoming(v,Date.now()));const absorbed=Math.min(v.shield,amount*(v.absorption??1));v.shield-=absorbed*(abilityActive(v,'fortress',Date.now())?.7:1);v.hp=Math.max(0,v.hp-(amount-absorbed));v.lastHit=Date.now();return amount;}
 function awaitAchievementHades(p){if(!accounts.achievementAdd)return;const job=p.writes.catch(()=>{}).then(()=>accounts.achievementAdd(p.accountId,'alien',1));p.writes=job;pending.add(job);job.then(()=>pending.delete(job),()=>pending.delete(job));}
 function flushFlight(p){if(!accounts.achievementAdd)return;const n=Math.floor(p.flightDistance||0);if(n<1)return;p.flightDistance-=n;const job=p.writes.catch(()=>{}).then(()=>accounts.achievementAdd(p.accountId,'distance',n));p.writes=job;pending.add(job);job.then(()=>pending.delete(job),()=>{pending.delete(job);p.flightDistance+=n;});}
 function move(v,d,dt){if(!d)return;const dx=d.x-v.x,dy=d.y-v.y,len=Math.hypot(dx,dy);if(len<1)return;v.angle=Math.atan2(dy,dx);const step=Math.min(len,v.speed*speedFactor(v,Date.now())*(v.freezeUntil>Date.now()?0:v.mineSlowUntil>Date.now()?.5:v.slowUntil>Date.now()?.7:1)*dt);const x=v.x,y=v.y;v.x=clamp(v.x+dx/len*step,25,WORLD.w-25);v.y=clamp(v.y+dy/len*step,25,WORLD.h-25);if(v.accountId)v.flightDistance=(v.flightDistance||0)+Math.hypot(v.x-x,v.y-y);}
 function adminTestDamage(p,n,pvp){if(pvp||!p.godAllowed||!p.oneShot||n.gateShielded||immune(n)||n.hp<=0)return 0;const amount=Math.max(0,n.hp)+Math.max(0,n.shield);n.hp=0;n.shield=0;return amount;}
 function laserDamage(p,n,amount,offset=64){if(!Number.isFinite(amount)||amount<=0)return;io.to(p.id).emit('gg:laserDamage',{targetId:n.id,x:n.x,y:n.y,amount:Math.max(1,Math.round(amount)),offset,map:MAPS[zoneOf(p)]?zoneOf(p):null});}
 function actualLaserDamage(before,n){return Math.max(0,before.hp-n.hp)+Math.max(0,before.shield-n.shield);}
 function laser(a,b,ammo){io.to(zoneOf(a)).emit('laser',{x:a.x,y:a.y,tx:b.x,ty:b.y,kind:a.type||'player',...(ammo?{ammo}: {}),...(!a.type?{allLF3:a.allLF3===true,enhanced:(b?.accountId?a.pilotBonus?.pvp:a.pilotBonus?.npc)>=1.119999}: {})});}
 const initializedMaps=new Set();
 function spawnMapNPC(name,zone){
  const a=alienStats[name];if(!a)return;
  const n=spawnNPC(false,point());Object.assign(n,{zone,name,type:name.startsWith('Boss')?'boss':'drone',hp:a.hp,maxHp:a.hp,shield:a.shield,maxShield:a.shield,speed:a.speed,damage:a.damage,reward:a.credits,xpReward:a.xp,uridiumReward:a.uridium,honorReward:a.honor,mapNPC:true});
 }
 function spawnPirate(zone){const b=spawnBox(point(),zone);b.kind='pirate';return b;}
 function spawnPalladium(){const q={x:random(WORLD.w*.15,WORLD.w*.85),y:random(WORLD.h*.2,WORLD.h*.8)};const b=spawnBox(q,'5-3');b.kind='paladio';b.contents={paladio:1};return b;}
 function dropCargo(p,n){const b=spawnBox(n,n.zone);b.kind='cargo';b.owner=p.accountId;b.contents=npcCargo(n.name,n.reward);b.expires=Date.now()+90000;later(()=>boxes.delete(b.id),90000);}
 function spawnMine(zone,position,code,owner=null){const now=Date.now(),m={id:id(),zone,x:position.x,y:position.y,code,owner,armedAt:now+(owner?MR.armMs:0),expires:owner?now+MR.lifetimeMs:Infinity};mines.set(m.id,m);return m;}
 function updateMines(now){
  const pilotsByZone=groupByZone(players.values(),p=>p.zone);let npcsByZone=null;
  for(const m of mines.values()){
   const owner=m.owner?players.get(m.owner):null;
   if(now>=m.expires||(m.owner&&(!owner||owner.zone!==m.zone))){mines.delete(m.id);continue;}
   if(now<m.armedAt)continue;
   const candidates=(pilotsByZone.get(m.zone)||[]).filter(v=>v.zone===m.zone&&!v.deadUntil&&!v.gatePending&&v.hp>0&&!safeZone(v)&&!(v.protectedUntil>now)&&(!owner||v!==owner&&(canPvp(owner,v)||(m.code==='EMPM-01'&&v.cloaked&&eligible(owner,{...v,safe:safeZone(v)})&&!safeZone(owner)&&!abilityActive(v,'ultimate-cloak',now)))));
   if(owner){npcsByZone??=groupByZone(npcs.values(),n=>n.zone);for(const n of npcsByZone.get(m.zone)||[])if(npcs.get(n.id)===n&&n.zone===m.zone&&!n.gateShielded&&n.hp>0)candidates.push(n);}
   if(!candidates.some(v=>distance(m,v)<=MR.triggerRadius))continue;
   mines.delete(m.id);const spec=MINES.find(x=>x.id===m.code);
   for(const v of candidates)if(distance(m,v)<=(m.radius||MR.blastRadius)&&!immune(v)){
    const before=v.hp+v.shield;Object.assign(v,mineImpact(v,{...spec,fraction:(spec.fraction||0)*(m.multiplier||1)},now));if(v.hp+v.shield<before)v.lastHit=now;
    if(owner&&npcs.get(v.id)===v)v.target=owner.id;
    if(players.get(v.id)===v&&v.hp<=0&&!v.deadUntil){if(owner)finishCombat(owner,v,true);else{recordRankDeath(v);v.deadUntil=now+4000;v.attack=false;v.target=null;v.dest=null;setPetMode(v,'off');}}
   }
   io.to(m.zone).emit('v18:mineBlast',{x:m.x,y:m.y,radius:m.radius||MR.blastRadius,code:m.code});
   if(!owner)later(()=>spawnMine(m.zone,m,m.code),60000);
  }
 }
 function initMap(zone){if(initializedMaps.has(zone)||!MAPS[zone])return;initializedMaps.add(zone);
  for(let i=0;i<({'5-1':85,'5-3':66}[zone]||0);i++)spawnMine(zone,point(),'ACM-01');
  if(npcCount>0)for(const [name,count] of population(zone))for(let i=0;i<count;i++)spawnMapNPC(name,zone);
  if(boxCount>0)for(let i=0;i<15;i++)spawnPirate(zone);
   if(boxCount>0&&zone==='5-3')for(let i=0;i<50;i++)spawnPalladium();
  if(boxCount>0&&!['4-4','4-5'].includes(zone))for(let i=0;i<(/^4-[123]$/.test(zone)?100:boxCount);i++)spawnBox(point(),zone);
 }
 function changeMap(p,zone,pos){const sock=io.sockets.sockets.get(p.id);sock?.leave(zoneOf(p));p.zone=zone;p.petAggressors=new Map();initMap(zone);sock?.join(zone);p.x=pos?.x??WORLD.w/2;p.y=pos?.y??WORLD.h/2;p.dest=null;p.target=null;p.attack=false;setPetMode(p,'off');sock?.emit('v14:map',{map:zone});sock?.emit('v16:basePortals',{map:zone,portals:personalPortals(p)});const group=groups.status(p.id);if(group)notifyGroup(group.members);}
 function groupEligible(p){return !!p&&!p.gate&&!p.gatePending&&!p.gateWaiting&&!p.deadUntil&&!p.ubaReturn&&!p.invasionReturn&&p.hp>0;}
 function groupView(id){const g=groups.status(id);return {group:g?{...g,members:g.members.map(id=>({id,name:players.get(id)?.name||'Piloto',map:players.get(id)?.zone}))}:null,invite:(()=>{const i=groups.pending(id);return i?{...i,name:players.get(i.from)?.name||'Piloto'}:null;})(),pilots:[...players.values()].filter(p=>p.id!==id&&groupEligible(p)&&!groups.status(p.id)).map(p=>({id:p.id,name:p.name}))};}
 function notifyGroup(ids){for(const id of ids){const p=players.get(id);if(p){p.group=groups.status(id)?.id||null;io.to(id).emit('v15:group',groupView(id));}}}
 function canPvp(a,b){return !!b&&!abilityActive(b,'ultimate-cloak',Date.now())&&!b.cloaked&&eligible(a,{...b,safe:safeZone(b)})&&!safeZone(a)&&!(a.hadesPending||b.hadesPending);}
 function groupMates(p,radius){return (groups.status(p.id)?.members||[]).map(id=>players.get(id)).filter(q=>q&&q!==p&&!q.deadUntil&&!q.gatePending&&q.hp>0&&sameZone(q,p)&&distance(p,q)<=radius);}
 function protectDamage(v,amount){if(!v.group||!amount)return amount;const protector=groupMates(v,700).find(q=>abilityActive(q,'protect',Date.now()));if(!protector)return amount;const redirected=Math.min(protector.shield,amount*.25);if(!protector.godMode){protector.shield-=redirected;protector.lastHit=Date.now();}return amount-redirected;}
 function technologyLeech(p,n,before){if(techActive(p.technologies,'energy-leech',Date.now()))heal(p,'hp',leechAmount(before,n));}
 function markFactor(p,n,now){return n.markUntil>now&&n.markGroup&&n.markGroup===p.group?1.05:1;}
 function abilityTick(p,now,dt){
  const a=p.abilities||{};
  if(techActive(p.technologies,'battle-repair',now))heal(p,'hp',10000*dt);
  if(p.robot&&(p.repairOn||cpuEnabled(p,'NC-RRB'))&&!p.attack&&now-p.lastHit>=5000&&p.hp<p.maxHp)heal(p,'hp',repairRate(p.robot,p.maxHp)*(p.pilotBonus?.repair||1)*(p.boost?.repair||1)*dt);
  if(abilityActive(p,'singularity',now)){const effect=a.singularity,n=npcs.get(effect.target)||players.get(effect.target);const pvp=!!n&&players.get(n.id)===n;if(!n||n.hp<=0||immune(n)||n.gateShielded||!sameZone(p,n)||(pvp&&!canPvp(p,n))){effect.until=0;}else if(now>=(effect.next||0)){effect.next=now+1000;effect.ticks=(effect.ticks||0)+1;n.hp=Math.max(0,n.hp-500*effect.ticks);n.lastHit=now;finishCombat(p,n,pvp);if(n.hp<=0)effect.until=0;}}
  for(const [key,kind,selfRate,otherRate] of [['repair-hp','hp',20000,40000],['repair-shield','shield',15000,25000]]){
   if(!abilityActive(p,key,now))continue;const q=players.get(a[key].target);
   if(q&&groupMates(p,700).includes(q))heal(q,kind,otherRate*dt);else heal(p,kind,selfRate*dt);
  }
  if(abilityActive(p,'repair-pod',now)&&a['repair-pod'].zone===p.zone){const pod=a['repair-pod'];for(const q of players.values())if(!q.deadUntil&&!q.gatePending&&q.hp>0&&sameZone(p,q)&&distance(pod,q)<=350&&(q===p||q.company===p.company||p.group&&p.group===q.group))heal(q,'hp',18000*dt);}
  if(abilityActive(p,'draw-fire',now)&&!safeZone(p)){for(const n of npcs.values())if(sameZone(p,n)&&distance(p,n)<=500&&!(n.empUntil>now)){n.target=p.id;}}
 }
 function safeZone(p){if(stationEffects(p).safe)return true;const b=homeBase(p.zone,WORLD.w,WORLD.h);return b?distance(p,b)<b.radius:!!MAPS[p.zone]?.base&&distance(p,{x:WORLD.w/2,y:WORLD.h/2})<450;}
 function personalPortals(p){return galaxyPortals(p.zone,p.company,p.ggBuilt||[],WORLD.w,WORLD.h);}
 function atGalaxyPortal(p,gate){const q=galaxyPortals(p.zone,p.company,[gate],WORLD.w,WORLD.h)[0];return !!q&&distance(p,q)<=125;}
 function syncSoloGateLives(p,g,snapshot){if(!g||p.gate!==g||g.gate==='hades'||g.closed||g.completed||p.gatePending||!snapshot?.built||snapshot.wave!==g.wave||!Number.isInteger(snapshot.lives)||snapshot.lives<1||snapshot.lives>10||snapshot.lives<=g.lives)return false;g.lives=snapshot.lives;return true;}
 async function refreshGalaxy(p){const gate=p.gate;const data=await accounts.gateStatus(p.accountId);if(accounts.achievementRead){const a=await accounts.achievementRead(p.accountId);p.pilotTitle=a.title;p.gateRings=a.rings;}if(players.get(p.id)!==p)return;if(syncSoloGateLives(p,gate,data.states[gate?.gate]))io.to(p.id).emit('v214:gateLives',{gate:gate.gate,wave:gate.wave+1,lives:gate.lives});p.ggBuilt=data.gates.filter(g=>data.states[g].built);io.to(p.id).emit('v16:basePortals',{map:p.zone,portals:personalPortals(p)});}

 const KAMIKAZE={damage:1000000,radius:1500,cooldown:10000};
 const TEST_KAMIKAZE=Object.freeze({damage:100000000,radius:5000,cooldown:0});
 function recordRankDeath(p,radiation=false){rememberDeath(p);if(p.deathRecorded||!accounts.recordDeath)return;p.deathRecorded=true;const requestId=p.deathRequestId||crypto.randomUUID();const job=p.writes.catch(()=>{}).then(()=>accounts.recordDeath(p.accountId,radiation,requestId));p.writes=job;pending.add(job);job.then(()=>pending.delete(job),()=>{pending.delete(job);io.to(p.id).emit('notice','No se pudo registrar la baja');});}
 function finishCombat(p,n,pvp,independentPet=false){if(pvp){n.lastHit=Date.now();if(!independentPet&&!immune(n)&&canPvp(p,n))recordPilotAggression(n,p,n.lastHit);if(n.hp<=0&&!n.deadUntil){n.deadUntil=Date.now()+4000;rememberDeath(n);n.attack=false;n.target=null;n.dest=null;setPetMode(n,'off');if(!independentPet||p.target===n.id){p.attack=false;p.target=null;}const job=p.writes.catch(()=>{}).then(()=>accounts.pvpReward(p.accountId,n.accountId,n.ship,(formationBonus(p.formation).honor||1)*(p.pilotBonus?.honor||1),dronePoints(p.ship,n.ship,true))).then(async r=>{if(r.rankChanged)p.reloadRequested=true;Object.assign(p,{credits:Number(r.balance.credits),experience:Number(r.balance.experience),level:Number(r.balance.level),honor:Number(r.balance.honor)});emitReward(p,'Piloto eliminado',r.reward);if(r.reward.honor>=0)await accounts.missionEvent(p.accountId,'pilot',n.ship);});p.writes=job;pending.add(job);job.then(()=>pending.delete(job),()=>{pending.delete(job);io.to(p.id).emit('notice','No se pudo guardar recompensa PvP');});io.to(n.id).emit('notice','Nave destruida por '+p.name);}return;}finishNPC(p,n);}
 function finishNPC(p,n,deferGate=false,independentPet=false){n.target=p.id;if(n.hp<=0&&npcs.get(n.id)===n){npcs.delete(n.id);if(p.gate&&n.gateNPC&&n.gateKillKey){(p.gate.observedKills??=new Set()).add(n.gateKillKey);}if(!p.gate)dropCargo(p,n);if(!independentPet||p.target===n.id){p.target=null;p.attack=false;}if(p.gate?.gate==='hades'){const g=p.gate,wave=g.wave;queueHades(g,()=>accounts.hadesKill(g.accounts,wave,n.gateKillKey,{credits:n.reward,xp:n.xpReward,uridium:n.uridiumReward,honor:n.honorReward},p.accountId,dronePoints(p.ship,n.name))).then(r=>{if(r.rankChanged)p.reloadRequested=true;if(!r.duplicate)awaitAchievementHades(p);if(r.balances)for(const member of groupPilots(g)){const b=r.balances[member.accountId];if(b){Object.assign(member,{credits:Number(b.credits),experience:Number(b.experience),level:Number(b.level)});if(r.payouts?.[member.accountId])emitReward(member,n.name+' eliminado',r.payouts[member.accountId]);}}}).catch(()=>{});if(!deferGate&&!([...npcs.values()].some(x=>sameZone(p,x)&&!x.gateShielded)))nextGateGroup(p);return;}if(p.gate){const g=p.gate;const job=p.writes.catch(()=>{}).then(()=>accounts.gateKill(p.accountId,g.gate,g.wave,n.gateKillKey,{credits:Math.round(n.reward*(p.pilotBonus?.credits||1)),xp:Math.round(n.xpReward*(formationBonus(p.formation).npcXp||1)*(p.pilotBonus?.xp||1)*(p.boost?.xp||1)),uridium:n.uridiumReward,honor:Math.round(n.honorReward*(formationBonus(p.formation).honor||1)*(p.pilotBonus?.honor||1)*(p.boost?.honor||1))},dronePoints(p.ship,n.name))).then(async r=>{if(r.rankChanged)p.reloadRequested=true;if(!r.duplicate)await accounts.missionEvent(p.accountId,'alien',n.name).catch(()=>{});if(r.balance){Object.assign(p,{credits:Number(r.balance.credits),experience:Number(r.balance.experience),level:Number(r.balance.level)});if(!r.duplicate&&r.payout)emitReward(p,n.name+' eliminado',r.payout);}});p.writes=job;pending.add(job);job.then(()=>pending.delete(job),()=>{pending.delete(job);if(players.get(p.id)===p&&p.gate===g&&!p.gatePending){returnFromGate(p);io.to(p.id).emit('v14:gateState',{inside:false});io.to(p.id).emit('notice','No se pudo guardar el enemigo. Vuelve a entrar.');}});if(!deferGate&&!([...npcs.values()].some(x=>sameZone(p,x)&&!x.gateShielded)))nextGateGroup(p);return;}awardGroup(p,n.reward,n.xpReward??(n.type==='boss'?500:50),n.name+' eliminado',n.uridiumReward||0,n.honorReward||0,dronePoints(p.ship,n.name)).catch(()=>{});missionEvent(p,'alien',n.name);if(n.mapNPC)later(()=>spawnMapNPC(n.name,n.zone),5000);}}
 const petNavigation=require('./pet-navigation-v187');const {createTickCandidates}=require('./pet-target-index-v188');
 function petFollowGoal(p){return petNavigation.followGoal(p,WORLD);}
 function tickPetRepair(p,now){
  if(p.petMode!=='repair'||p.petUntil<=now||!p.petRepairStarted||p.petRepairTickPending)return;
  if(p.deadUntil||p.attack||p.lastHit>=p.petRepairStarted||p.petRepairUntil&&now>=p.petRepairUntil||p.petVitals?.destroyed||p.petVitals?.hp>=p.petVitals?.maxHp){setPetMode(p,'passive');return;}
  if(now<p.petRepairNext||!accounts.petRepairHullTick)return;
  const generation=p.petGeneration,started=p.petRepairStarted;
  const valid=()=>!closing&&players.get(p.id)===p&&p.petGeneration===generation&&p.petMode==='repair'&&p.petUntil>Date.now()&&!p.deadUntil&&!p.attack&&(p.lastHit||0)<started;
  p.petRepairTickPending=true;p.petRepairNext=now+1000;
  const job=p.writes.catch(()=>{}).then(()=>valid()?accounts.petRepairHullTick(p.accountId):null).then(v=>{
   if(!v||!valid())return;
   p.petVitals=v;if(!p.petRepairUntil)p.petRepairUntil=started+v.durationMs;
   io.to(p.id).emit('v14:petState',{mode:p.petMode,fuel:p.petFuel,pending:false,vitals:v});
   if(v.hp>=v.maxHp)setPetMode(p,'passive');
  }).catch(e=>{if(valid()){setPetMode(p,'passive');io.to(p.id).emit('notice',e.status?e.message:'Reparación del P.E.T. interrumpida');}}).finally(()=>{p.petRepairTickPending=false;pending.delete(job);});
  p.writes=job;pending.add(job);
 }
 function shootPetGuard(p,now,candidates){
  if(!require('./pet-test-kit-v175').guardEnabled(p.accountId)||!accounts.petGuardShot||p.petShotPending||now<(p.petNextShot||0))return;
  const pilotEnabled=require('./pet-test-kit-v175').testKitEnabled(p.accountId)||process.env.GG_PET_GUARD_PVP_ENABLED==='1';
  const npc=selectGuardTarget(p,candidates.npcFor(p).filter(n=>!immune(n)),now,600),pilot=pilotEnabled?selectPilotGuardTarget(p,candidates.pilotsFor(p,now),now,600,(a,b)=>canPvp(a,b)&&!immune(b)):null;
  const n=pilot&&(!npc||distance({x:p.petX,y:p.petY},pilot)<distance({x:p.petX,y:p.petY},npc))?pilot:npc,pvp=!!n&&n===pilot,generation=p.petGeneration;
  const valid=()=>!!n&&!closing&&players.get(p.id)===p&&p.petGeneration===generation&&!p.petTradePending&&(pvp?players.get(n.id)===n&&pilotGuardTarget(p,n,Date.now(),600,canPvp):npcs.get(n.id)===n&&guardTarget(p,n,Date.now(),600))&&!safeZone(p)&&!immune(n)&&!abilityActive(p,'ultimate-cloak',Date.now());
  if(!valid()){if(p.petGuardStatus){p.petGuardStatus=null;io.to(p.id).emit('v14:petGuard',{target:null});}return;}
  p.petShotPending=true;p.petNextShot=now+1000;
  const job=p.writes.catch(()=>{}).then(()=>valid()?accounts.petGuardShot(p.accountId):null).then(shot=>{
   if(!shot||shot.blocked){p.petNextShot=Date.now()+5000;if(valid()){p.petGuardStatus=shot?.blocked||'Guardia no disponible';io.to(p.id).emit('v14:petGuard',{target:n.name,blocked:p.petGuardStatus});}return;}
   if(players.get(p.id)!==p)return;
   io.to(p.id).emit('v13:ammoStock',{code:shot.code,quantity:shot.stock});
   if(!valid())return;
   p.petAngle=Math.atan2(n.y-p.petY,n.x-p.petX);
   laser({x:p.petX,y:p.petY,zone:p.zone,type:'player'},n,shot.code);
   const result=salvo({damage:shot.damage*(pvp?damageFactor(p.honor)*incoming(n,Date.now())*(abilityActive(n,'prism',Date.now())?.1:1):1),lasers:shot.count,accuracyFactor:pvp?(1-(formationBonus(n.formation).evasion||0))*(1-(n.pilotBonus?.evasion||0)):1},n,shot.code,shot.stock+shot.count,Math.random());
   p.petGuardStatus=n.name;const report=damage=>io.to(p.id).emit('v14:petGuard',{target:n.name,damage,lasers:shot.count});
   if(result.damage<=0){report(0);return;}
   const before={hp:n.hp,shield:n.shield};
   if(pvp){const amount=protectDamage(n,result.damage),resolved=hit(n,amount,formationAbsorption(p,n)),shieldLoss=n.shield-resolved.shield;resolved.shield=Math.max(0,n.shield-shieldLoss*(n.weakenUntil>Date.now()?1.5:1)*(abilityActive(n,'fortress',Date.now())?.7:1));Object.assign(n,resolved);const actual=actualLaserDamage(before,n);report(actual);laserDamage(p,n,actual);finishCombat(p,n,true,true);return;}
   Object.assign(n,result.target);n.lastHit=Date.now();p.petLastHitNpc=n.id;p.petLastAttackAt=n.lastHit;
   const actual=actualLaserDamage(before,n);report(actual);laserDamage(p,n,actual,n.type==='boss'?100:64);
   finishNPC(p,n,false,true);
  }).catch(()=>{p.petNextShot=Date.now()+5000;if(valid())io.to(p.id).emit('v14:petGuard',{target:n.name,blocked:'No se pudo confirmar el disparo'});}).finally(()=>{p.petShotPending=false;pending.delete(job);});
  p.writes=job;pending.add(job);
 }
 function hitGuardPet(n,p,now){
  if(!require('./pet-test-kit-v175').vitalsEnabled(p.accountId)||!accounts.petDamage||!npcRetaliatesAgainstPet(p,n,now)||immune(p))return false;
  let amount=Math.max(0,Math.round(n.damage));
  const combo=p.petComboRepair?.until>now?p.petComboRepair:null;
  if(combo)amount=require('./pet-combos-v180').deflectedDamage(amount,'CSR-02',combo.level);
  else if(p.petMode==='combo-guard'&&p.petComboGuardLevel)amount=require('./pet-combos-v180').deflectedDamage(amount,'CGM-02',p.petComboGuardLevel);
  if(!Number.isSafeInteger(amount)||!amount)return false;
  p.petDamagePending=true;
  laser(n,{x:p.petX,y:p.petY});
  // The shot is accepted now. Persist even if the pilot subsequently switches the PET off.
  const job=p.writes.catch(()=>{}).then(()=>accounts.petDamage(p.accountId,amount)).then(v=>{
   if(!v||players.get(p.id)!==p)return;
   p.petVitals={...p.petVitals,...v};
   if(v.destroyed){setPetMode(p,'off');io.to(p.id).emit('notice','P.E.T. destruido. Repáralo antes de volver a activarlo.');}
   io.to(p.id).emit('v14:petState',{mode:p.petMode,fuel:p.petFuel??null,pending:!!p.petPending,vitals:p.petVitals});
  }).catch(()=>{if(players.get(p.id)===p){setPetMode(p,'off');io.to(p.id).emit('notice','No se pudo confirmar el daño del P.E.T.');}}).finally(()=>{p.petDamagePending=false;pending.delete(job);});
  p.writes=job;pending.add(job);return true;
 }
 function setPetMode(p,mode){
  const preserve=mode!=='off'&&p.petMode&&p.petMode!=='off';p.petMode=mode;p.petUntil=0;p.petFollowing=false;p.petSpeed=0;if(!preserve){p.petX=null;p.petY=null;p.petAngle=null;}p.petGeneration=(p.petGeneration||0)+1;p.petLastHitNpc=null;p.petLastAttackAt=0;p.petGuardStatus=null;p.petNextShot=0;p.petRepairStarted=0;p.petRepairNext=0;p.petRepairUntil=0;p.petLocateNext=0;p.petComboRepair=null;p.petComboGuardLevel=null;io.to(p.id).emit('v14:petCombo',null);io.to(p.id).emit('v14:petLocator',null);io.to(p.id).emit('v14:petGuard',{target:null});
  io.to(p.id).emit('v14:petState',{mode,fuel:p.petFuel??null,pending:mode!=='off',vitals:p.petVitals||null});
 }
 // Section groups spawn in order. Protegit combat statistics remain provisional.
 function clearGateNPCs(p){for(const [id,n] of npcs)if(n.zone===p.zone&&p.zone!=='world')npcs.delete(id);for(const [id,m] of mines)if(m.zone===p.zone&&p.zone!=='world')mines.delete(id);}
 const gateWaveRules=require('./gate-wave-v194'),{waveProgress}=require('./gate-progress-v195'),{npcPilotEligible}=require('./gate-npc-v196');
 function spawnGateGroup(p,group,groupIndex){
  const [name,count,scale=1,shielded=false]=group;
  const key=p.gate.gate==='kappa'&&['Boss Kucurbium','Century-Falcon'].includes(name)?name+' (Kappa)':name;
  let base=alienStats[key]||{hp:650,shield:220,damage:55,speed:155,credits:0,uridium:0,xp:0,honor:0};
  if(name==='Mirror')base={hp:p.maxHp,shield:p.maxShield,damage:p.damage,speed:p.speed,credits:0,uridium:0,xp:0,honor:0};
  else if(name.startsWith('Saturn ')){
   const variant=name.slice(7).toLowerCase(),hull=catalogV13.ships.find(x=>x.id===variant)||catalogV13.ships.find(x=>x.id==='goliath');
   // Temporary combat parameters, no unverified alien payout.
   base={hp:hull.hp,shield:hull.generators*10000,damage:hull.lasers*200,speed:hull.speed,credits:0,uridium:0,xp:0,honor:0};
  }
  let spawned=0;
  const existing=[...npcs.values()].filter(n=>sameZone(p,n)&&n.gateNPC).map(n=>n.gateKillKey);
  for(const {i,key:killKey} of gateWaveRules.missingKillKeys(groupIndex,count,p.gate.kills,existing)){
   const a=i*Math.PI*2/count,n=spawnNPC(false,{x:WORLD.w/2+Math.cos(a)*850,y:WORLD.h/2+Math.sin(a)*850});
   n.zone=p.zone;n.name=name;n.target=p.id;n.gateNPC=true;n.hp=n.maxHp=base.hp*scale;n.shield=n.maxShield=base.shield*scale;n.damage=base.damage*scale;n.speed=base.speed;
   n.reward=base.credits*scale;n.xpReward=base.xp*scale;n.uridiumReward=base.uridium*scale;n.honorReward=base.honor*scale;n.gateShielded=shielded;n.gateKillKey=killKey;spawned++;
  }
  return spawned;
 }
 function nextGateGroup(p){
  if(!p.gate||p.gatePending||p.gateWaiting||p.gate.closed||p.gate.countdownPending||p.gate.completed||p.gate.transition)return;
  const g=p.gate,queue=g.groups||[];
  const step=gateWaveRules.waveStep([...npcs.values()].filter(n=>sameZone(p,n)&&n.gateNPC),queue,(group,index)=>spawnGateGroup(p,group,index));
  if(step==='clear')saveGate(p,'clear');
 }
 function gateWave(p,withCountdown=true){
  if(!p.gate)return;
  const g=p.gate,def=DEFS[g.gate];if(g.countdownPending||g.completed||g.closed||g.launchedWave===g.wave)return;g.countdownPending=true;
  if(g.gate==='hades')for(const member of groupPilots(g))member.gateWaiting=false;
  else p.gateWaiting=false;
  const launch=()=>{
   if(players.get(p.id)!==p||p.gate!==g||p.gateWaiting)return;
   g.countdownPending=false;g.launchedWave=g.wave;g.observedKills=new Set();
   const groups=WAVES[g.gate][g.wave];
   if(!Array.isArray(groups)||!groups.length){returnFromGate(p);io.to(p.id).emit('notice','Esta sección aún no está disponible');return;}
   g.groups=groups.map((group,i)=>[group,i]).filter(([group])=>!group[3]);
   for(const [group,index] of groups.map((group,i)=>[group,i]).filter(([group])=>group[3]))spawnGateGroup(p,group,index);
   nextGateGroup(p);
   if(p.gatePending||g.transition||p.gate!==g)return;
   if(g.gate==='hades')groupState(g,'combat');else io.to(p.id).emit('v14:gateState',{inside:true,gate:g.gate,wave:g.wave+1,total:def.waves,lives:g.lives,phase:'combat'});
  };
  if(withCountdown){if(g.gate==='hades')groupState(g,'countdown',{seconds:def.countdown});else io.to(p.id).emit('v14:gateState',{inside:true,gate:g.gate,wave:g.wave+1,total:def.waves,lives:g.lives,phase:'countdown',seconds:def.countdown});later(launch,def.countdown*1000);}
  else launch();
 }
 // Intermission starts only after the database confirms the completed wave.
 function gateIntermission(p,completed=false){
  const g=p.gate;if(!g||g.closed)return;
  const leader=g.gate==='hades'?players.get(g.leader):p;if(!leader||leader.gate!==g)return;
  const members=g.gate==='hades'?groupPilots(g):[p];
  const until=Date.now()+10000;
  g.exitPortal={id:'gg:exit',kind:'exit',to:'BASE',x:clamp(leader.x+(leader.x>WORLD.w/2?-90:90),25,WORLD.w-25),y:leader.y};
  g.intermissionUntil=until;g.completed=completed;
  for(const member of members){
   member.gateWaiting=true;member.attack=false;member.target=null;
   io.to(member.id).emit('v14:gateState',{inside:true,gate:g.gate,wave:completed?DEFS[g.gate].waves:g.wave+1,total:DEFS[g.gate].waves,lives:g.lives,phase:'between',seconds:10,until,completed,exitPortal:g.exitPortal,leader:member.id===leader.id});
  }
  later(()=>{
   if(players.get(leader.id)!==leader||leader.gate!==g||g.closed||!leader.gateWaiting||g.intermissionUntil!==until)return;
   if(completed){if(g.gate==='hades')endHades(g,'Hades completada');else{returnFromGate(leader);refreshGalaxy(leader).catch(()=>{});io.to(leader.id).emit('v14:gateState',{inside:false});}return;}
   g.intermissionUntil=0;g.exitPortal=null;gateWave(leader,false);
  },10000);
 }
 function returnFromGate(p,repair=false){
  const old={hp:p.hp,shield:p.shield,lastHit:p.lastHit};const home=p.gateReturn;
  clearGateNPCs(p);const sock=io.sockets.sockets.get(p.id);
  sock?.leave(p.zone);p.zone=repair?(p.company+'-1'):(home?.zone||p.company+'-1');initMap(p.zone);sock?.join(p.zone);sock?.emit('v14:map',{map:p.zone});sock?.emit('v16:basePortals',{map:p.zone,portals:personalPortals(p)});p.gate=null;p.gateWaiting=false;p.gateReturn=null;p.attack=false;p.target=null;spawnPlayer(p);if(!repair){p.hp=Math.max(1,old.hp);p.shield=old.shield;p.lastHit=old.lastHit;if(home){p.x=home.x;p.y=home.y;}}setPetMode(p,'off');if(repair){const job=p.writes.catch(()=>{}).then(()=>accounts.saveLocation(p.accountId,p.company,p.zone));p.writes=job;pending.add(job);job.then(()=>pending.delete(job),()=>pending.delete(job));}
 }
 function groupPilots(g){return g.members.map(id=>players.get(id)).filter(p=>p&&p.gate===g);}
 function groupState(g,phase,extra={}){for(const p of groupPilots(g))io.to(p.id).emit('v14:gateState',{inside:true,gate:'hades',wave:g.wave+1,total:3,lives:g.lives,phase,leader:p.id===g.leader,...extra});}
 function endHades(g,message){if(g.closed)return;g.closed=true;for(const p of groupPilots(g)){returnFromGate(p,p.hp<=0);refreshGalaxy(p).catch(()=>{});p.gatePending=false;io.to(p.id).emit('v14:gateState',{inside:false});io.to(p.id).emit('notice',message);}}
 function queueHades(g,fn){
  const members=groupPilots(g),prior=[g.writes,...members.map(p=>p.writes)];
  const job=Promise.all(prior).then(fn);g.writes=job;
  for(const p of members)p.writes=job;
  pending.add(job);job.then(()=>pending.delete(job),()=>{pending.delete(job);endHades(g,'No se pudo guardar Hades. El progreso confirmado se conserva.');});return job;
 }
 function saveHades(p,outcome){
  const g=p.gate;if(!g||g.closed||g.transition)return;
  g.transition=true;
  const wave=g.wave,deadId=p.id;
  for(const member of groupPilots(g)){member.gatePending=true;member.attack=false;member.target=null;member.dest=null;}
  queueHades(g,()=>accounts.hadesAdvance(g.accounts,wave,outcome)).then(result=>{
   if(g.closed)return;
   g.lives=result.lives;g.wave=result.wave;g.kills=result.kills;
   if(result.complete){for(const member of groupPilots(g)){const pay=result.payouts[member.accountId];if(pay){Object.assign(member,{credits:Number(pay.balance.credits),experience:Number(pay.balance.experience),level:Number(pay.balance.level),honor:Number(pay.balance.honor)});io.to(member.id).emit('v17:gateReward',{gate:'hades',payout:pay});}}for(const member of groupPilots(g)){member.gatePending=false;io.to(member.id).emit('notice','Hades completada · +20.000 uridium por piloto');}g.transition=false;gateIntermission(p,true);return;}
   if(result.failed){endHades(g,'Hades cerrada: el grupo agotó sus vidas');return;}
   if(outcome==='death'){const dead=players.get(deadId);if(dead?.gate===g){dead.hp=dead.maxHp;dead.shield=dead.maxShield;dead.deathRecorded=false;dead.deathRequestId=crypto.randomUUID();dead.lastHit=Date.now();dead.dest=null;dead.target=null;dead.attack=false;dead.protectedUntil=Date.now()+3000;setPetMode(dead,'off');}groupState(g,'combat');}
   else gateIntermission(p);
   g.transition=false;for(const member of groupPilots(g))member.gatePending=false;
  }).catch(()=>{});
 }
 function saveGate(p,outcome){
  if(p.gate?.gate==='hades'){saveHades(p,outcome);return;}
  if(!p.gate||p.gatePending)return;
  p.gatePending=true;p.attack=false;p.target=null;p.dest=null;
  const wave=p.gate.wave,gate=p.gate.gate;
  const job=p.writes.catch(()=>{}).then(()=>accounts.gateAdvance(p.accountId,wave,outcome,gate)).then(async r=>{if(r.complete)await accounts.missionEvent(p.accountId,'gate',gate).catch(()=>{});
   if(players.get(p.id)!==p)return;
   if(r.complete){if(r.payout?.item==='MUL-B03'){try{p.rawBoosters=await accounts.boosterRead(p.accountId);updateBoosters(p);}catch{}}if(r.payout?.balance)Object.assign(p,{credits:Number(r.payout.balance.credits),experience:Number(r.payout.balance.experience),level:Number(r.payout.balance.level),honor:Number(r.payout.balance.honor)});io.to(p.id).emit('v17:gateReward',{gate:r.gate,completion:r.completions,payout:r.payout});gateIntermission(p,true);}
   else if(outcome==='death'||r.failed){if(r.payout?.balance)Object.assign(p,{credits:Number(r.payout.balance.credits),experience:Number(r.payout.balance.experience),level:Number(r.payout.balance.level)});returnFromGate(p,outcome==='death');refreshGalaxy(p).catch(()=>{});io.to(p.id).emit('v14:gateState',{inside:false,...r});io.to(p.id).emit('notice',r.complete?DEFS[r.gate].name+' completada · +'+r.payout.uridium+' uridium':r.failed?'Puerta perdida':'Vida perdida · vuelve a entrar desde Portales');}
   else{p.gate={gate:r.gate,wave:r.wave,lives:r.lives,kills:[]};gateIntermission(p);}
  }).catch(()=>{if(players.get(p.id)===p){returnFromGate(p,outcome==='death');io.to(p.id).emit('v14:gateState',{inside:false});io.to(p.id).emit('notice','No se pudo guardar la puerta. Vuelve a entrar.');}}).finally(()=>{p.gatePending=false;pending.delete(job);});
  p.writes=job;pending.add(job);
 }
 async function refreshPilotSummaries(pilots){if(!accounts.pilotSummary||!pilots.length)return;const rows=await accounts.pilotSummary(pilots.map(p=>p.accountId));const byId=new Map(rows.map(r=>[r.account_id,r]));for(const p of pilots){const r=byId.get(p.accountId);if(!r||players.get(p.id)!==p)continue;p.rank=Number(r.rank);io.to(p.id).emit('gg:pilotSummary',{id:p.accountId,points:r.points,uridium:r.uridium,kills:r.kills,deaths:r.deaths,aliens:r.aliens,keys:r.keys,premiumSeconds:r.premium_seconds,cargo:r.cargo});}}
 const publicPlayer=p=>({id:p.id,name:p.name,rank:p.rank||1,title:p.pilotTitle||null,gateRings:p.gateRings||[],godAllowed:!!p.godAllowed,godMode:!!p.godMode,oneShot:!!p.oneShot,cpus:p.cpus||[],robot:p.robot,repairOn:!!p.repairOn,cloaked:!!p.cloaked,ishUntil:p.ishUntil||0,mineUntil:p.mineUntil||0,abilities:p.abilities||{},technologies:p.technologies||{},jamUntil:p.jamUntil||0,mineralUpgrades:p.mineralUpgrades||{},clanTag:p.clanTag||'',ship:p.ship,design:p.design||null,formation:p.formation||'normal',droneCount:p.droneCount||0,droneRank:p.droneRank||1,droneVisuals:p.droneVisuals||[],formationReadyAt:p.formationReadyAt||0,company:p.company,companyChosen:p.companyChosen,honor:p.honor,x:p.x,y:p.y,angle:p.angle,hp:p.hp,maxHp:p.maxHp,shield:p.shield,maxShield:p.maxShield,credits:p.credits,experience:p.experience,level:p.level,target:p.target,attack:p.attack,deadUntil:p.deadUntil,premiumUntil:Number(p.rawBoosters?.PREMIUM||0),pet:p.petUntil>Date.now()&&p.petMode!=='off'&&!p.deadUntil?{mode:p.petMode,x:p.petX,y:p.petY,angle:Number.isFinite(p.petAngle)?p.petAngle:p.angle,vitals:p.petVitals||null}:null});
 function missionEvent(p,type,target,count=1){
  const job=p.writes.catch(()=>{}).then(()=>accounts.missionEvent(p.accountId,type,target,count));p.writes=job;pending.add(job);job.then(()=>pending.delete(job),()=>{pending.delete(job);io.to(p.id).emit('notice','No se pudo guardar el progreso de misión');});return job;
 }
 function collectCargo(p,b,byPet){
  if(closing||b.pending||boxes.get(b.id)!==b||p.cargoBusy||p.cargoRetry>Date.now())return;
  b.pending=true;p.cargoBusy=true;
  const job=p.writes.catch(()=>{}).then(async()=>{
   if(byPet&&(players.get(p.id)!==p||p.deadUntil||!sameZone(p,b)||!['loot','resource'].includes(p.petMode)||p.petUntil<=Date.now()||Math.hypot(p.petX-b.x,p.petY-b.y)>=35))return;
   const r=await accounts.collectMinerals(p.accountId,b.contents,b.owner);p.honor=Number(r.balance.honor);
   if(!Object.keys(r.taken).length){p.cargoRetry=Date.now()+5000;io.to(p.id).emit('notice','Bodega llena');return;}
   for(const [k,n] of Object.entries(r.taken)){b.contents[k]-=n;if(b.contents[k]<=0)delete b.contents[k];}
   if(!Object.keys(b.contents).length){boxes.delete(b.id);if(b.kind==='paladio')later(spawnPalladium,6500);}
   else p.cargoRetry=Date.now()+3000;
   io.to(p.id).emit('notice',(byPet?'P.E.T.':'Carga')+': '+Object.entries(r.taken).map(([k,n])=>n+' '+k).join(' · ')+(r.penalty?' · Honor -'+r.penalty:''));
  });p.writes=job;pending.add(job);job.catch(()=>{p.cargoRetry=Date.now()+3000;io.to(p.id).emit('notice','No se pudo recoger la carga');}).finally(()=>{b.pending=false;p.cargoBusy=false;pending.delete(job);});
 }
 function collectPirate(p,b){
   if(closing||b.pending||boxes.get(b.id)!==b||p.pirateBusy||p.pirateRetry>Date.now())return;
   b.pending=true;p.pirateBusy=true;
   const retire=()=>{if(boxes.delete(b.id))later(()=>spawnPirate(b.zone),30000);};
   const job=p.writes.catch(()=>{}).then(async()=>{
    if(closing||players.get(p.id)!==p||p.deadUntil||p.gatePending||!sameZone(p,b)||distance(p,b)>=52)return;
    const r=await accounts.awardBox(p.accountId,b.zone,p.level,'pirate');
    retire();p.credits=Number(r.balance.credits);
    io.to(p.id).emit('v13:ammoStock',{code:'green-key',quantity:r.keys});
    io.to(p.id).emit('notice','Cofre pirata: +'+r.loot.quantity+' '+r.loot.code+' · Llaves restantes: '+r.keys);
    io.to(p.id).emit('v14:loot',r);
    await accounts.missionEvent(p.accountId,'box','pirate').catch(()=>{});
   });
   p.writes=job;pending.add(job);
   job.catch(e=>{
    p.pirateRetry=Date.now()+5000;
    if(e.code==='NO_GREEN_KEY')io.to(p.id).emit('notice','Cofre pirata: necesitas una llave verde');
    else{retire();io.to(p.id).emit('notice','No se pudo confirmar el cofre. Revisa tu inventario.');}
   }).finally(()=>{b.pending=false;p.pirateBusy=false;pending.delete(job);});
 }
 function collectBox(p,b,byPet=false){
   if(b.kind==='pirate'){if(!byPet)collectPirate(p,b);return;}
  if(b.kind==='cargo'||b.kind==='paladio'){collectCargo(p,b,byPet);return;}
  if(!boxes.delete(b.id))return;
  if(closing)return;
  const job=p.writes.catch(()=>{}).then(async()=>{
   const r=await accounts.awardBox(p.accountId,b.zone,p.level,'bonus',p.boost?.box||1);p.credits=Number(r.balance.credits);await accounts.missionEvent(p.accountId,'box','bonus').catch(()=>{});
   const label=({'credits':'créditos','uridium':'uridium','gate-energy':'energía de puerta'})[r.loot.code]||r.loot.code;
   io.to(p.id).emit('notice',(byPet?'P.E.T.':'Caja')+': +'+r.loot.quantity+' '+label);
   io.to(p.id).emit('v14:loot',r);
  });
  p.writes=job;pending.add(job);
  job.then(()=>{pending.delete(job);later(()=>spawnBox(point(),b.zone),6500);},()=>{pending.delete(job);later(()=>spawnBox(point(),b.zone),6500);io.to(p.id).emit('notice','No se pudo confirmar la recompensa');});
 }
 function emitReward(p,title,payout){
  const amounts={};for(const key of ['xp','honor','credits','uridium']){const n=Number(payout?.[key]);if(payout?.[key]!=null&&Number.isFinite(n)&&n!==0)amounts[key]=n;}
  if(Object.keys(amounts).length)io.to(p.id).emit('v171:reward',{title,amounts});
  else io.to(p.id).emit('notice',title);
 }
 function awardGroup(p,credits,xp,message,uridium=0,honor=0,points=0){
  const ids=(groups.status(p.id)?.members||[p.id]).filter(id=>{const m=players.get(id);return m&&sameZone(p,m)&&m.hp>0&&!m.deadUntil&&!m.gate&&!m.gatePending&&!m.ubaReturn&&!m.invasionReturn;});if(!ids.includes(p.id))ids.push(p.id);
  const petEligibility=new Map(ids.map(id=>[id,eligibleForNpcXp(players.get(id),Date.now())]));
  const shares=[credits,xp,uridium,honor].map(n=>groups.split(n,ids,p.id));return Promise.allSettled(ids.map(id=>award(players.get(id),Math.round(shares[0][id]*(players.get(id).pilotBonus?.credits||1)),Math.round(shares[1][id]*(formationBonus(players.get(id).formation).npcXp||1)*(players.get(id).pilotBonus?.xp||1)*(players.get(id).boost?.xp||1)),message,shares[2][id],Math.round(shares[3][id]*(formationBonus(players.get(id).formation).honor||1)*(players.get(id).pilotBonus?.honor||1)*(players.get(id).boost?.honor||1)),id===p.id?points:0,petEligibility.get(id)===true)));
 }
 function award(p,credits,xp,message,uridium=0,honor=0,points=0,petEligible=false){if(closing)return Promise.reject(Error('Servidor cerrando'));const job=p.writes.catch(()=>{}).then(async()=>{const r=await accounts.reward(p.accountId,credits,xp,uridium,honor,points,petEligible);if(r.rankChanged)p.reloadRequested=true;Object.assign(p,{credits:Number(r.credits),experience:Number(r.experience),level:Number(r.level),honor:Number(r.honor??p.honor)});emitReward(p,message,r.payout||{credits,xp,honor});if(r.petXp>0&&players.get(p.id)===p)io.to(p.id).emit('v185:petXp',{gained:r.petXp});return p.credits;});p.writes=job;pending.add(job);job.then(()=>pending.delete(job),()=>{pending.delete(job);io.to(p.id).emit('notice','No se pudo confirmar una recompensa en la base de datos.');});return job;}
 if(process.env.GG_REFERRAL_TRUST_PROXY==='1')app.set('trust proxy',1);
 app.disable('x-powered-by');app.use((req,res,next)=>{res.set({'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self' ws: wss:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"});next();});app.use(express.json({limit:'8kb'}));accounts.endpoints(app);
 app.get('/health',async(req,res)=>{res.set('Cache-Control','no-store');if(closing)return res.status(503).json({ok:false,database:false});try{await (accounts.health?accounts.health():accounts.ready());res.json({ok:true,database:true,players:players.size,version:require('./package.json').version});}catch{res.status(503).json({ok:false,database:false});}});
 app.get('/admin',(req,res)=>{res.set('Cache-Control','no-store').sendFile(path.join(__dirname,'public','admin.html'));});
 const admin=(req,res,next)=>{res.set('Cache-Control','no-store');if(!password)return res.status(503).json({error:'ADMIN_PASSWORD no configurada'});const now=Date.now();for(const[k,v]of attempts)if(v.until<now)attempts.delete(k);const key='global',a=attempts.get(key)||{count:0,until:now+60000};if(a.count>=20)return res.status(429).json({error:'Demasiados intentos. Reintenta en un minuto.'});const supplied=req.get('Authorization')||'',hash=s=>crypto.createHash('sha256').update(s).digest();if(!crypto.timingSafeEqual(hash(supplied),hash('Bearer '+password))){a.count++;attempts.set(key,a);return res.status(401).json({error:'Contraseña incorrecta'});}next();};
 const proxyProbe=require('./referral-proxy-probe-v226').createProxyProbe();
 app.post('/api/admin/referral-proxy-probe',admin,(req,res)=>{try{res.json(proxyProbe(req,req.body?.nonce));}catch(e){res.status(e.status||503).json({error:e.status?e.message:'Diagnóstico no disponible'});}});
 app.get('/api/admin/premium',admin,async(req,res)=>{try{if(!accounts.premiumAdmin)return res.status(503).json({error:'Premium no disponible'});res.json(await accounts.premiumAdmin.status(req.query.username));}catch{res.status(503).json({error:'No se pudo consultar Premium'});}});
 app.post('/api/admin/premium',admin,async(req,res)=>{try{if(!accounts.premiumAdmin)return res.status(503).json({error:'Premium no disponible'});const result=await accounts.premiumAdmin.grant(req.body);const p=[...players.values()].find(p=>p.name.toLowerCase()===result.username.toLowerCase());if(p){p.rawBoosters={...p.rawBoosters,PREMIUM:Math.max(Number(p.rawBoosters?.PREMIUM||0),result.until)};updateBoosters(p);io.to(p.id).emit('v13:inventoryChanged');}res.json(result);}catch(e){res.status(e.status||503).json({error:e.status?e.message:'No se pudo asignar Premium'});}});
 app.get('/api/admin/bank',admin,async(req,res)=>{try{if(!accounts.bankAdmin)return res.status(503).json({error:'Banco no disponible'});return res.json(await accounts.bankAdmin.list());}catch{return res.status(503).json({error:'No se pudo consultar el banco'});}});
 app.post('/api/admin/bank',admin,async(req,res)=>{try{if(!accounts.bankAdmin)return res.status(503).json({error:'Banco no disponible'});const action=req.body?.action;if(action==='create')return res.json(await accounts.bankAdmin.create(req.body));if(action==='enable')return res.json(await accounts.bankAdmin.setEnabled(req.body));return res.status(400).json({error:'Acción inválida'});}catch(e){return res.status(e.status||503).json({error:e.status?e.message:'No se pudo guardar el código'});}});
 app.get('/api/admin/uridium-x2',admin,async(req,res)=>{try{if(!accounts.uridiumEventStatus)return res.status(503).json({error:'Evento no disponible'});return res.json(await accounts.uridiumEventStatus());}catch{return res.status(503).json({error:'No se pudo consultar el evento'});}});
 app.post('/api/admin/uridium-x2',admin,async(req,res)=>{try{if(!accounts.uridiumEventChange)return res.status(503).json({error:'Evento no disponible'});const state=await accounts.uridiumEventChange(req.body);readEventFeed.invalidate();io.emit('notice',state.active?'Evento Uridium x2 activo (NPC)':'Configuración de Uridium x2 actualizada');return res.json(state);}catch(e){return res.status(e.status||503).json({error:e.status?e.message:'No se pudo guardar el evento'});}});
 app.get('/api/admin/gate-special-x2',admin,async(req,res)=>{try{if(!accounts.gateSpecialEventStatus)return res.status(503).json({error:'Evento no disponible'});return res.json(await accounts.gateSpecialEventStatus());}catch{return res.status(503).json({error:'No se pudo consultar el evento'});}});
 app.post('/api/admin/gate-special-x2',admin,async(req,res)=>{try{if(!accounts.gateSpecialEventChange)return res.status(503).json({error:'Evento no disponible'});const state=await accounts.gateSpecialEventChange(req.body);readEventFeed.invalidate();io.emit('notice',state.active?'Evento recompensas especiales de Galaxy Gates x2 activo':'Configuración de Galaxy Gates x2 actualizada');return res.json(state);}catch(e){return res.status(e.status||503).json({error:e.status?e.message:'No se pudo guardar el evento'});}});
 app.get('/api/admin/events',admin,async(req,res)=>{let lotteryState=null,lotteryError=false;try{lotteryState=await accounts.hitacLotteryStatus?.()||null;}catch{lotteryError=true;}return res.json({
 maps:Object.keys(MAPS),
 hitac:{enabled:hitacEnabled(),rewards:process.env.GG_HITAC_REWARDS_ENABLED==='1',active:hitacRun?{id:hitacRun.id,map:hitacRun.map,phase:hitacRun.phase,units:hitacRun.units.size}:null},
 lottery:{enabled:hitacEnabled()&&process.env.GG_HITAC_LOTTERY_ENABLED==='1',state:lotteryState,unavailable:lotteryError},
 ice:{enabled:iceEnabled(),rewards:process.env.GG_ICE_REWARDS_ENABLED==='1',active:iceRun?{id:iceRun.id,map:iceRun.map,phase:iceRun.phase,startAt:iceRun.startAt,endAt:iceRun.endAt,icy:iceRun.icy.size,boxes:iceRun.boxes.size}:null},
 spaceball:{enabled:spaceballEnabled(),rewards:process.env.GG_SPACEBALL_CLAIMS_ENABLED==='1',active:spaceballGame?{id:spaceballGame.id,map:'4-4',scores:spaceballGame.scores,boxes:spaceballGame.boxes.size}:null},
 invasion:{enabled:invasionEnabled(),combat:liveInvasion(),lobbies:invasionLobby.list(),runs:[...invasionRuns.values()].map(c=>({id:c.event.id,difficulty:c.event.difficulty,phase:c.event.phase,wave:c.event.wave+1,participants:c.fighters.size}))},
 uba:{enabled:liveUBA(),matches:arenas.size}
 });}); 
 const iceAction=(req,res)=>{if(!iceEnabled())return res.status(403).json({error:'Evento deshabilitado'});if(req.body?.action==='stop'){iceRun=null;io.emit('notice','Meteorito de Hielo cerrado');return res.json({ok:true});}if(req.body?.action!=='start')return res.status(400).json({error:'Acción inválida'});if(iceRun)return res.status(409).json({error:'Evento activo'});try{iceRun=ice.createEvent(req.body?.map,Date.now(),WORLD.w,WORLD.h);io.emit('notice','Meteorito de Hielo en '+iceRun.map+' · inicia en 60 segundos');res.json({ok:true,id:iceRun.id,startAt:iceRun.startAt});}catch(e){res.status(400).json({error:e.message});}};
 app.post('/api/admin/ice',admin,iceAction);
 const lotteryAction=async(req,res)=>{if(!hitacEnabled()||process.env.GG_HITAC_LOTTERY_ENABLED!=='1')return res.status(403).json({error:'Lotería deshabilitada'});try{if(req.body?.action==='open')return res.json(await accounts.hitacLotteryOpen());if(req.body?.action==='close')return res.json(await accounts.hitacLotteryClose());res.status(400).json({error:'Acción inválida'});}catch(e){res.status(e.status||503).json({error:e.status?e.message:'No se pudo actualizar la bolsa'});}};
 app.post('/api/admin/hitac-lottery',admin,lotteryAction);
 const hitacAction=(req,res)=>{if(!hitacEnabled())return res.status(403).json({error:'Hitac deshabilitado'});if(req.body?.action==='stop'){hitacRun=null;io.emit('notice','Hitac finalizado');return res.json({ok:true});}if(req.body?.action!=='start')return res.status(400).json({error:'Acción inválida'});if(hitacRun)return res.status(409).json({error:'Hitac activo'});hitacRun=hitac.createConvoy(Date.now(),WORLD.w,WORLD.h);io.emit('notice','Convoy Hitac abierto en '+hitacRun.map);return res.json({ok:true,id:hitacRun.id});};
 app.post('/api/admin/hitac',admin,hitacAction);
 const spaceballAction=(req,res)=>{if(!spaceballEnabled())return res.status(403).json({error:'Spaceball deshabilitado'});if(req.body?.action==='stop'){if(spaceballGame)spaceballGame.active=false;spaceballGame=null;io.emit('notice','Spaceball finalizado');return res.json({ok:true});}if(req.body?.action!=='start')return res.status(400).json({error:'Acción inválida'});if(spaceballGame)return res.status(409).json({error:'Spaceball ya activo'});spaceballGame=spaceball.createGame(Date.now(),WORLD.w,WORLD.h);io.emit('notice','Spaceball abierto en 4-4');return res.json({ok:true,id:spaceballGame.id});};
 app.post('/api/admin/spaceball',admin,spaceballAction);
 const invasionAction=(req,res)=>{if(!invasionEnabled())return res.status(403).json({error:'Inscripción Invasión deshabilitada'});try{const difficulty=req.body?.difficulty,action=req.body?.action||'start';if(!Object.hasOwn(invasion.WAVES,difficulty))return res.status(400).json({error:'Dificultad inválida'});if(action==='stop'){const run=[...invasionRuns.values()].find(c=>c.event.difficulty===difficulty);if(run?.closed)return res.status(409).json({error:'La invasión ya está finalizando'});const cancelled=invasionLobby.cancel(difficulty);if(run){run.event.phase='cancelled';run.closed=true;}if(!cancelled&&!run)return res.status(409).json({error:'No hay invasión activa'});notifyInvasion();io.emit('notice','Invasión '+difficulty+' cancelada');return res.json({ok:true});}if(action!=='start')return res.status(400).json({error:'Acción inválida'});if([...invasionRuns.values()].some(c=>c.event.difficulty===difficulty))throw Error('Ya hay una invasión activa');const e=invasionLobby.open(difficulty);notifyInvasion();res.json({ok:true,id:e.id,entryUntil:e.entryUntil});}catch(e){res.status(400).json({error:e.message});}};
 app.post('/api/admin/invasion',admin,invasionAction);
 const calendarActions={ice:iceAction,hitac:hitacAction,spaceball:spaceballAction,invasion:invasionAction,'hitac-lottery':lotteryAction};
 async function dispatchScheduled(kind,body){const handler=calendarActions[kind];if(!handler)return {ok:false,detail:'Evento inválido'};let code=200,data;const response={status(n){code=n;return this;},json(v){data=v;return this;}};await handler({body},response);return {ok:code>=200&&code<300,detail:code>=200&&code<300?'Evento iniciado':data?.error||'Inicio rechazado'};}
 const readEventFeed=createSnapshotCache(async()=>{const [u,g,rows,lottery]=await Promise.all([accounts.uridiumEventStatus?.(),accounts.gateSpecialEventStatus?.(),accounts.eventCalendar?.upcoming?.(),hitacEnabled()&&process.env.GG_HITAC_LOTTERY_ENABLED==='1'?accounts.hitacLotteryStatus?.():null]);const bonus=x=>x?.active?{active:true,endAt:x.endAt||null}:null;const events={uridium:bonus(u),gateSpecial:bonus(g),hitac:hitacEnabled()&&hitacRun?{active:true,map:hitacRun.map}:null,ice:iceEnabled()&&iceRun&&['countdown','active'].includes(iceRun.phase)?{active:true,map:iceRun.map,endAt:new Date(iceRun.endAt).toISOString()}:null,spaceball:spaceballEnabled()&&spaceballGame?{active:true,map:'4-4'}:null,invasion:invasionEnabled()&&(invasionLobby.list().length||invasionRuns.size)?{active:true}:null,'hitac-lottery':lottery?.bag?{active:true}:null};const now=Date.now();return {events,upcoming:upcomingEvents(rows,{uridium:u,gateSpecial:g},now),serverTime:now};});
 app.get('/api/events/live',async(req,res)=>{res.set('Cache-Control','no-store');try{res.json({...await readEventFeed(),serverTime:Date.now()});}catch{return res.status(503).json({error:'Estado no disponible'});}});
 app.get('/api/admin/calendar',admin,async(req,res)=>{try{if(!accounts.eventCalendar)return res.status(503).json({error:'Calendario no disponible'});res.json({entries:await accounts.eventCalendar.list()});}catch{return res.status(503).json({error:'No se pudo consultar el calendario'});}});
 app.post('/api/admin/calendar',admin,async(req,res)=>{try{if(!accounts.eventCalendar)return res.status(503).json({error:'Calendario no disponible'});if(req.body?.action==='cancel'){const result=await accounts.eventCalendar.cancel(req.body.id);readEventFeed.invalidate();return res.json(result);}if(req.body?.action!=='schedule')return res.status(400).json({error:'Acción inválida'});const result=await accounts.eventCalendar.add(req.body);readEventFeed.invalidate();res.json(result);}catch(e){res.status(e.status||503).json({error:e.status?e.message:'No se pudo guardar la programación'});}});
 app.get('/api/admin/players',admin,(req,res)=>res.json({players:[...players.values()].map(publicPlayer),npcs:npcs.size,boxes:boxes.size}));
 app.post('/api/admin/credits',admin,async(req,res)=>{const{playerId,amount}=req.body||{},p=players.get(playerId);if(!p||!Number.isSafeInteger(amount)||amount<1||amount>1000000||!Number.isSafeInteger(p.credits+amount))return res.status(400).json({error:'Jugador o monto inválido'});try{const credits=await award(p,amount,0,`Administración: +${amount} créditos`);res.json({ok:true,credits});}catch{res.status(503).json({error:'No se pudo confirmar el guardado'});}});
 app.post('/api/admin/boss',admin,(req,res)=>{if(npcs.size>=100||[...npcs.values()].filter(n=>n.type==='boss').length>=5)return res.status(409).json({error:'Límite de enemigos o jefes alcanzado'});const p=players.get(req.body?.playerId),pos=p?{x:clamp(p.x+650,80,WORLD.w-80),y:p.y}:{x:WORLD.w/2+700,y:WORLD.h/2};const n=spawnNPC(true,pos);n.zone=p&&!p.gate?p.zone:'1-1';initMap(n.zone);io.to(n.zone).emit('notice','¡Un TITAN ha aparecido en el sector!');res.json({ok:true,id:n.id,x:n.x,y:n.y});});app.use(express.static(path.join(__dirname,'public')));
 function shootOrdnance(p,code,ack){
  const special=catalogV13.specialRockets.find(r=>r.id===code),shell=catalogV13.launcherAmmo.find(r=>r.id===code);
  if(!p||(!special&&!shell)||p.deadUntil||p.gatePending||p.gateWaiting||p.shotPending||p.upgradePending||p.reloadPending)return ack({ok:false,error:'Arma no disponible ahora'});
  if(p.target===ballTarget)return ack({ok:false,error:'Spaceball solo admite láseres'});
 const n=npcs.get(p.target)||players.get(p.target),pvp=!!n&&players.get(n.id)===n;
  if(!n||n.gateShielded||!sameZone(p,n)||distance(p,n)>600||(pvp&&!canPvp(p,n)))return ack({ok:false,error:'Selecciona un objetivo válido a menos de 600 unidades'});
  const launcher=catalogV13.launchers.find(l=>l.id===p.launcher);
  if(shell&&!launcher)return ack({ok:false,error:'Equipa un Hellstorm en el hangar'});
  const key=special?code:'hellstorm',cooldown=special?special.cooldown:Math.round(5000*(formationBonus(p.formation).launcherCooldown||1)),count=special?1:launcher.capacity,zone=p.zone;
  p.ordnanceUntil??={};
  if(Date.now()<(p.ordnanceUntil[key]||0))return ack({ok:false,error:'Arma en recarga'});
  p.upgradePending=true;
  const job=p.writes.catch(()=>{}).then(()=>accounts.consumeOrdnance(p.accountId,code,count));p.writes=job;pending.add(job);
  job.then(stock=>{
   if(stock===null)return ack({ok:false,error:'Necesitas '+count+' '+code});
   p.ordnanceUntil[key]=Date.now()+cooldown;breakCloak(p);
   io.to(p.id).emit('v13:ammoStock',{code,quantity:stock});
   if(players.get(p.id)!==p||p.deadUntil||p.gatePending||p.zone!==zone||!sameZone(p,n)||distance(p,n)>600||n.gateShielded||(pvp?players.get(n.id)!==n||!canPvp(p,n):npcs.get(n.id)!==n))return ack({ok:true,damage:0,stock,cooldown,count,key});
   io.to(zone).emit('laser',{x:p.x,y:p.y,tx:n.x,ty:n.y,kind:'rocket',ammo:code,count});
   let amount=0;
   if(!immune(n)){
    if(special){const field={accuracy:'accuracyUntil',slow:'slowUntil',freeze:'freezeUntil'}[special.effect];n[field]=Math.max(n[field]||0,Date.now()+special.duration);if(!pvp)n.target=p.id;}
    else{const before={hp:n.hp,shield:n.shield};const scale=(p.boost?.damage||1)*(pvp?damageFactor(p.honor):1)*markFactor(p,n,Date.now())*combatFactor(p,pvp);const drain=Math.min(n.shield,Math.round((shell.drain||0)*count*scale));n.shield-=drain;p.shield=Math.min(p.maxShield,p.shield+drain);amount=Math.round((shell.damage||0)*count*scale);if(amount)damage(n,amount);technologyLeech(p,n,before);if(drain||amount)finishCombat(p,n,pvp);}
   }
   ack({ok:true,damage:amount,stock,cooldown,count,key,effect:immune(n)?null:special?.effect||null});
  }).catch(()=>ack({ok:false,error:'No se pudo confirmar el disparo'})).finally(()=>{p.upgradePending=false;pending.delete(job);});
 }
 function shootRocket(p,code,ack){
  const rocket=catalogV13.rockets.find(r=>r.id===code);
  if(!p||!rocket||p.deadUntil||p.gatePending||p.gateWaiting||p.shotPending||p.upgradePending)return ack({ok:false,error:'Cohete no disponible ahora'});
  const n=npcs.get(p.target)||players.get(p.target),pvp=!!n&&players.get(n.id)===n;
  if(!n||n.gateShielded||!sameZone(p,n)||distance(p,n)>600||(pvp&&!canPvp(p,n)))return ack({ok:false,error:'Selecciona un objetivo válido a menos de 600 unidades'});
  if(Date.now()<(p.rocketUntil||0))return ack({ok:false,error:'Cohete en recarga'});
  const zone=p.zone;p.upgradePending=true;
  const job=p.writes.catch(()=>{}).then(()=>accounts.upgradedShot(p.accountId,code,1,'rocket',{autoMineral:cpuEnabled(p,'NC-AWB')}));
  p.writes=job;pending.add(job);
  job.then(shot=>{
   if(!shot)return ack({ok:false,error:'No tienes '+code});
   const cd=rocketCooldown(cpuEnabled(p,'R0K-T01'),formationBonus(p.formation).rocketCooldown||1,shot.premium===true);p.rocketUntil=Date.now()+cd;breakCloak(p);applyMineralStats(p,shot.upgrades);for(const [code,quantity] of Object.entries(shot.resources||{}))io.to(p.id).emit('v13:ammoStock',{code,quantity});
   io.to(p.id).emit('v13:ammoStock',{code,quantity:shot.stock});
   if(players.get(p.id)!==p||p.deadUntil||p.gatePending||p.zone!==zone||!sameZone(p,n)||distance(p,n)>600||n.gateShielded||(pvp?!canPvp(p,n):npcs.get(n.id)!==n))return ack({ok:true,damage:0,stock:shot.stock,cooldown:cd});
   const amount=Math.random()<1-(1-rocket.miss)*(p.accuracyUntil>Date.now()?.6:1)*(1-(formationBonus(n.formation).evasion||0))*(1-(n.pilotBonus?.evasion||0))*(1+(p.pilotBonus?.rocketAccuracy||0))?0:Math.round(rocket.damage*(p.boost?.damage||1)*shot.factor*(p.pilotBonus?.rocket||1)*(formationBonus(p.formation).rocket||1)*combatFactor(p,pvp)*markFactor(p,n,Date.now())*(pvp?damageFactor(p.honor):1));
   io.to(zone).emit('laser',{x:p.x,y:p.y,tx:n.x,ty:n.y,kind:'rocket',ammo:code,count:1});
   if(amount&&!immune(n)){const before={hp:n.hp,shield:n.shield};damage(n,amount);technologyLeech(p,n,before);finishCombat(p,n,pvp);}
   ack({ok:true,damage:immune(n)?0:amount,stock:shot.stock,cooldown:cd});
  }).catch(()=>ack({ok:false,error:'No se pudo confirmar el disparo'})).finally(()=>{p.upgradePending=false;pending.delete(job);});
 }

 io.on('connection',socket=>{socket.use((packet,next)=>{const p=players.get(socket.id);if(p?.recoveredRespawnId&&!['v223:respawnAck','gg:latency','join'].includes(packet[0])){const ack=packet.at(-1);if(typeof ack==='function')ack({ok:false,error:'Confirmando reaparición; reintenta'});return;}next();});socket.use((packet,next)=>{if(players.get(socket.id)?.invasionReturn&&!['v136:invasionCommand','v135:invasion','gg:latency'].includes(packet[0])){const ack=packet.at(-1);if(typeof ack==='function')ack({ok:false,error:'Acción no disponible durante Invasión'});return;}if(players.get(socket.id)?.ubaReturn&&!['v127:uba','v129:arenaCommand','gg:latency'].includes(packet[0])){const ack=packet.at(-1);if(typeof ack==='function')ack({ok:false,error:'Acción no disponible durante UBA'});return;}next();});let budget=50,windowStart=Date.now(),joining=false;const allowed=()=>{const now=Date.now();if(now-windowStart>=1000){budget=50;windowStart=now;}return --budget>=0;};let lastLatencyProbe=0;socket.on('gg:latency',ack=>{const now=Date.now();if(typeof ack!=='function'||!players.has(socket.id)||now-lastLatencyProbe<2500||!allowed())return;lastLatencyProbe=now;ack({ok:true});});
 socket.on('join',(data,ack)=>{trackPending(pending,async()=>{if(typeof ack!=='function'||!allowed()||!socket.connected)return;if(closing)return ack({ok:false,code:'SERVER_UNAVAILABLE',error:'Servidor no disponible'});if(joining)return ack({ok:false,code:'ACCOUNT_BUSY',error:'Cuenta cargando. Reintenta.'});if(players.has(socket.id))return ack({ok:true,id:socket.id,world:WORLD,map:players.get(socket.id).zone});if(players.size>=40)return ack({ok:false,code:'SERVER_FULL',error:'Servidor lleno (40 pilotos)'});joining=true;let lease;try{const a=await accounts.authenticate(socket.handshake.headers);if(!socket.connected)return;if(!a)return ack({ok:false,code:'AUTH_REQUIRED',error:'Inicia sesión o regístrate primero'});if(closing)return ack({ok:false,code:'SERVER_UNAVAILABLE',error:'Servidor no disponible'});const reservation=joinReservations.acquire(a.id,socket.id,active,players.size);if(!reservation.ok)return ack(reservation.code==='ACCOUNT_BUSY'?{ok:false,code:'ACCOUNT_BUSY',error:'Cuenta conectada, cargando o guardando. Reintenta.'}:{ok:false,code:'SERVER_FULL',error:'Servidor lleno (40 pilotos)'});lease=reservation.lease;await flushDeath(a.id);const ship=Object.hasOwn(SHIPS,a.ship)?a.ship:'scout',s=SHIPS[ship];const p={id:socket.id,accountId:a.id,name:a.username,godAllowed:a.id==='14733365-e185-4d81-90a8-b3c95baf0af7',godMode:false,oneShot:false,ship,maxHp:s.hp,maxShield:s.shield,speed:s.speed,damage:s.damage,credits:Number(a.credits),experience:Number(a.experience),level:Number(a.level),honor:Number(a.honor),lastShot:0,writes:Promise.resolve()};p.rawBoosters=await accounts.boosterRead(a.id);p.boost=boosterFactors(p.rawBoosters);const loadout=await accounts.combatLoadout?.(a.id);p.mineralUpgrades=(await accounts.upgradeStatus(a.id)).upgrades;p.technologies=(await accounts.assemblyStatus(a.id)).active;p.baseSpeed=s.speed;p.baseShield=s.shield;const loc=await accounts.location(a.id);if(!socket.connected||closing)return;const daily=await accounts.dailyClaim(a.id);p.credits=Number(daily.balance.credits);p.company=loc.company;p.companyChosen=loc.company_chosen;p.zone=loc.map;initMap(p.zone);if(!socket.connected||closing||active.has(a.id)||players.size>=40)return ack({ok:false,code:'SERVER_UNAVAILABLE',error:'Cuenta o servidor no disponible'});applyLoadout(p,loadout);if(!loadout){p.maxHp=Math.round(s.hp*p.boost.hp);p.baseShield=s.shield*p.boost.shield;applyMineralStats(p,p.mineralUpgrades);}spawnPlayer(p);const recovered=accounts.respawnRecovery?await accounts.respawnRecovery(a.id):null;if(recovered&&Object.hasOwn(MAPS,recovered.destination.zone)){p.zone=recovered.destination.zone;p.x=recovered.destination.x;p.y=recovered.destination.y;initMap(p.zone);p.recoveredRespawnId=recovered.deathId;}else if(accounts.respawnDeathState){const death=await accounts.respawnDeathState(a.id);if(death&&Object.hasOwn(MAPS,death.destination.zone)){p.deathPersistence=death;p.deathRequestId=death.deathId;p.deathRecorded=true;p.zone=death.destination.zone;p.x=death.destination.x;p.y=death.destination.y;p.hp=0;p.shield=0;p.deadUntil=Math.max(1,death.readyAt);initMap(p.zone);}}p.petTradeUntil=accounts.petTradeStatus?(await accounts.petTradeStatus(a.id)).until:0;const cooldowns=accounts.petCooldowns?await accounts.petCooldowns(a.id):{};p.kamiUntil=cooldowns.kamiReadyAt||0;if(!socket.connected||closing||active.has(a.id)||players.size>=40)return ack({ok:false,code:'SERVER_UNAVAILABLE',error:'Cuenta o servidor no disponible'});p.protectedUntil=Date.now()+3000;active.set(a.id,p);joinReservations.release(lease);lease=null;players.set(socket.id,p);socket.join(p.zone);ack({ok:true,id:socket.id,world:WORLD,map:p.zone});if(p.recoveredRespawnId){const job=p.writes.catch(()=>{}).then(()=>accounts.saveLocation(p.accountId,p.company,p.zone));p.writes=job;pending.add(job);job.then(()=>pending.delete(job),()=>pending.delete(job));io.to(p.id).emit('v222:respawnDone',{mode:recovered.response.mode,deathId:p.recoveredRespawnId,recovered:true});}io.to(p.id).emit('v181:petTradeState',{until:p.petTradeUntil||0});io.to(p.id).emit('v184:petKami',{pending:false,readyAt:p.kamiUntil||0});io.to(p.id).emit('v189:petCooldowns',{comboReadyAt:cooldowns.comboReadyAt||0});refreshGalaxy(p).catch(()=>{});refreshPilotSummaries([p]).catch(()=>{});if(!daily.already)io.to(p.id).emit('notice','Recompensa diaria '+daily.day+'/28 acreditada');}catch{ack({ok:false,code:'DB_UNAVAILABLE',error:'Base de datos no disponible'});}finally{joinReservations.release(lease);joining=false;}});});
 socket.on('move',data=>{const p=players.get(socket.id);if(!allowed()||!p||p.deadUntil||!validPoint(data))return;p.dest={x:clamp(data.x,25,WORLD.w-25),y:clamp(data.y,25,WORLD.h-25)};});socket.on('select',(target,ack)=>{const p=players.get(socket.id);try{if(!allowed()||!p||p.deadUntil)return;if(iceTarget(target)){const u=iceUnit(target);p.target=icePilot(p)&&u&&distance(p,u)<1800?target:null;p.attack=false;return;}if(hitacTarget(target)){const u=hitacUnit(target);p.target=hitacPilot(p)&&u&&distance(p,u)<1800?target:null;p.attack=false;return;}if(target===ballTarget){p.target=canShootBall(p)&&!spaceballGame.resetAt&&distance(p,spaceballGame.ball)<1800?ballTarget:null;p.attack=false;return;}const n=npcs.get(target)||players.get(target);p.target=n&&sameZone(p,n)&&distance(p,n)<1800&&(npcs.has(target)||canPvp(p,n)||groupMates(p,1800).includes(n))?n.id:null;p.attack=false;}finally{if(typeof ack==='function')ack({target:p?.target??null,attack:!!p?.attack});}});socket.on('attack',(on,ack)=>{const p=players.get(socket.id);try{if(!allowed()||!p||p.deadUntil||typeof on!=='boolean')return;if(iceTarget(p.target)){p.attack=on&&icePilot(p)&&!!iceUnit(p.target);if(p.attack)p.protectedUntil=0;return;}if(hitacTarget(p.target)){p.attack=on&&hitacPilot(p)&&!!hitacUnit(p.target);if(p.attack)p.protectedUntil=0;return;}if(p.target===ballTarget){p.attack=on&&canShootBall(p)&&!spaceballGame.resetAt;if(p.attack)p.protectedUntil=0;return;}const n=npcs.get(p.target)||players.get(p.target);p.attack=on&&!!n&&sameZone(p,n)&&!p.gatePending&&(npcs.has(p.target)||canPvp(p,n));if(p.attack)p.protectedUntil=0;}finally{if(typeof ack==='function')ack({target:p?.target??null,attack:!!p?.attack});}});
 socket.on('v13:ammo',code=>{const p=players.get(socket.id);if(allowed()&&p&&catalogV13.ammo.some(a=>a.id===code))p.ammo=code;});
 socket.on('v19:formation',(code,ack)=>{
  if(typeof ack!=='function'||!allowed())return;const p=players.get(socket.id);
  if(!p||p.deadUntil||p.gatePending||p.gateWaiting||p.upgradePending||p.shotPending||p.reloadPending||p.reloadRequested)return ack({ok:false,error:'Formación no disponible ahora'});
  p.upgradePending=true;const job=p.writes.catch(()=>{}).then(()=>accounts.selectFormation(p.accountId,code));p.writes=job;pending.add(job);
  job.then(r=>{if(players.get(p.id)!==p)return;p.formationReadyAt=r.readyAt;applyFormation(p,r.active);ack({ok:true,...r});io.to(p.id).emit('notice','Formación: '+(formationDef(p.formation)?.name||'Normal'));}).catch(e=>ack({ok:false,error:e.status?e.message:'No se pudo cambiar formación'})).finally(()=>{p.upgradePending=false;pending.delete(job);});
 });
 socket.on('v19:technology',(code,ack)=>{
  if(typeof ack!=='function'||!allowed())return;
  const p=players.get(socket.id);if(!p||!Object.hasOwn(TECH,code)||p.deadUntil||p.gatePending||p.gateWaiting||p.upgradePending||p.shotPending)return ack({ok:false,error:'Tecnología no disponible ahora'});
  p.upgradePending=true;const job=p.writes.catch(()=>{}).then(()=>accounts.activateTechnology(p.accountId,code));p.writes=job;pending.add(job);
  job.then(r=>{if(players.get(p.id)!==p)return;p.technologies=r.active;
   if(code==='backup-shields'&&!p.deadUntil)heal(p,'shield',75000);
   io.to(p.id).emit('v13:ammoStock',{code,quantity:r.stock});ack({ok:true,...r});io.to(p.id).emit('notice',TECH[code].name+' activada');
  }).catch(e=>ack({ok:false,error:e.status?e.message:'No se pudo activar tecnología'})).finally(()=>{p.upgradePending=false;pending.delete(job);});
 });
 socket.on('v18:advancedJump',(destination,ack)=>{
  if(typeof ack!=='function'||!allowed())return;
  const p=players.get(socket.id),now=Date.now();
  if(!p||!p.cpus?.includes('AJP-01')||p.gate||p.gatePending||p.deadUntil||p.upgradePending||p.shotPending||p.reloadPending||p.attack||now-p.lastHit<5000)return ack({ok:false,error:'Equipa AJP-01 y espera a estar fuera de combate'});
  if(typeof destination!=='string'||!Object.hasOwn(MAPS,destination)||destination===p.zone||/^5-|^B-L/.test(destination)||/^5-|^B-L/.test(p.zone))return ack({ok:false,error:'Mapa no permitido para AJP'});
  const incomingRoutes=Object.keys(MAPS).flatMap(map=>portals(map,WORLD.w,WORLD.h)).filter(r=>r.to===destination);
  const level=incomingRoutes.length?Math.min(...incomingRoutes.map(r=>requiredLevel(r,p.company))):1;
  if(p.level<level)return ack({ok:false,error:'Necesitas nivel '+level});
  p.gatePending=true;p.dest=null;p.attack=false;
  const job=p.writes.catch(()=>{}).then(()=>accounts.useCpu(p.accountId,'AJP-01',destination));p.writes=job;pending.add(job);
  job.then(remaining=>{if(players.get(p.id)!==p)return;changeMap(p,destination);p.protectedUntil=Date.now()+3000;missionEvent(p,'map',destination);io.to(p.id).emit('v13:ammoStock',{code:'jump-voucher',quantity:remaining['jump-voucher']});ack({ok:true,map:destination});}).catch(e=>ack({ok:false,error:e.status?e.message:'No se pudo guardar el salto'})).finally(()=>{p.gatePending=false;pending.delete(job);});
 });
 socket.on('v235:cpuToggle',(data,ack)=>{
  if(typeof ack!=='function'||!allowed())return;const p=players.get(socket.id);
  if(!p||p.deadUntil||p.gatePending||p.gateWaiting)return ack({ok:false,error:'CPU no disponible ahora'});
  if(!setCpu(p,data?.code,data?.enabled))return ack({ok:false,error:'CPU no equipado o no conmutable'});
  ack({ok:true,cpuStates:cpuState(p)});
 });
 socket.on('v18:cpu',(code,ack)=>{
  if(typeof ack!=='function'||!allowed())return;const p=players.get(socket.id),now=Date.now();
  if(!p||p.deadUntil||p.gatePending||p.gateWaiting||p.upgradePending||p.shotPending||p.reloadPending)return ack({ok:false,error:'CPU no disponible ahora'});
  if(code==='repair'){if(!p.robot)return ack({ok:false,error:'Equipa un robot primero'});p.repairOn=!p.repairOn;return ack({ok:true,repairOn:p.repairOn});}
  if(!p.cpus?.includes(code)||!['ISH-01','SMB-01','CLO4K-CPU','CLO4K-XL-CPU'].includes(code))return ack({ok:false,error:'Equipa el CPU en el hangar'});
  const mineBased=['ISH-01','SMB-01'].includes(code),zone=p.zone;
  if(mineBased&&now<(p.mineUntil||0))return ack({ok:false,error:'Minas en recarga'});
  if(code==='SMB-01'&&safeZone(p))return ack({ok:false,error:'No disponible en zona segura'});
  if(!mineBased&&p.cloaked){p.cloaked=false;return ack({ok:true,cloaked:false});}
  if(!mineBased&&(p.cloaked||abilityActive(p,'ultimate-cloak',now)))return ack({ok:false,error:'Ya estás camuflado'});
  p.upgradePending=true;const job=p.writes.catch(()=>{}).then(()=>accounts.useCpu(p.accountId,code));p.writes=job;pending.add(job);
  job.then(remaining=>{
   if(mineBased)p.mineUntil=Date.now()+(cpuEnabled(p,'MIN-T02')?30000:60000);
   if(players.get(p.id)!==p||p.deadUntil||p.zone!==zone)return ack({ok:true,remaining});
   if(code==='ISH-01')p.ishUntil=Date.now()+3000;
   else if(code==='SMB-01'){breakCloak(p);const spec=MINES.find(x=>x.id==='ACM-01');for(const n of [...npcs.values(),...players.values()])if(n!==p&&sameZone(p,n)&&distance(p,n)<=250&&n.hp>0&&!n.deadUntil&&!immune(n)&&!n.gateShielded&&(npcs.has(n.id)||canPvp(p,n))){Object.assign(n,mineImpact(n,spec,Date.now()));n.lastHit=Date.now();}io.to(zone).emit('v18:mineBlast',{x:p.x,y:p.y,radius:250,code});}
   else{p.cloaked=true;p.attack=false;p.target=null;for(const n of npcs.values())if(n.target===p.id)n.target=null;}
   for(const [code,quantity] of Object.entries(remaining))io.to(p.id).emit('v13:ammoStock',{code,quantity});
   ack({ok:true,remaining});io.to(p.id).emit('notice',code+' activado');
  }).catch(e=>ack({ok:false,error:e.status?e.message:'No se pudo activar CPU'})).finally(()=>{p.upgradePending=false;pending.delete(job);});
 });
 socket.on('v18:ability',(code,ack)=>{
  if(typeof ack!=='function'||!allowed())return;
  const p=players.get(socket.id),now=Date.now();
  if(!p||p.deadUntil||p.gatePending||p.gateWaiting||p.hp<=0)return ack({ok:false,error:'Habilidad no disponible ahora'});
  const target=npcs.get(p.target)||players.get(p.target);
  try{
   if(['draw-fire','jam','mark','weaken','singularity'].includes(code)&&safeZone(p))throw Error('No disponible en zona segura');
   if(code==='protect'&&!groupMates(p,700).length)throw Error('Necesitas un compañero de grupo a 700 unidades');
   if(code==='mark'&&(!p.group||!target||!sameZone(p,target)||target.gateShielded||distance(p,target)>1500||(players.has(target.id)&&!canPvp(p,target))))throw Error('Selecciona un enemigo y pertenece a un grupo');
   if(['weaken','singularity'].includes(code)&&(!target||!sameZone(p,target)||target.gateShielded||target.godMode||distance(p,target)>600||(players.has(target.id)&&!canPvp(p,target))))throw Error('Selecciona un enemigo válido a menos de 600 unidades');
   const extra=code==='singularity'?{target:target?.id,next:now+1000,ticks:0}:code==='repair-pod'?{x:p.x,y:p.y,zone:p.zone}:['repair-hp','repair-shield'].includes(code)?{target:target?.id}:{};const a=activateAbility(p,code,now,extra);
   if(code==='jam'){for(const q of players.values())if(q!==p&&sameZone(p,q)&&distance(p,q)<=1000&&canPvp(p,q)&&!q.godMode)q.jamUntil=Math.max(q.jamUntil||0,now+8000);}
   if(code==='mark'){target.markUntil=now+15000;target.markGroup=p.group;}
   if(code==='weaken')target.weakenUntil=now+15000;
   if(code==='nano-repair'){heal(p,'hp',p.maxHp*.35);for(const q of groupMates(p,Infinity))heal(q,'hp',q.maxHp*.15);}
   if(code==='fortify')p.dest=null;
   if(code==='ultimate-cloak'){p.attack=false;p.target=null;for(const q of players.values())if(q.target===p.id){q.target=null;q.attack=false;}for(const n of npcs.values())if(n.target===p.id)n.target=null;}
   ack({ok:true,ability:a});io.to(p.id).emit('notice',abilityDefinitions(p).find(x=>x.id===code).name+' activada');
  }catch(e){ack({ok:false,error:e.message});}
 });
 socket.on('v18:mine',(code,ack)=>{
  if(typeof ack!=='function'||!allowed())return;
  const p=players.get(socket.id),spec=MINES.find(m=>m.id===code);
  if(!p||!spec||p.deadUntil||p.gatePending||p.gateWaiting||p.upgradePending||p.shotPending||safeZone(p))return ack({ok:false,error:'No puedes poner una mina aquí'});
  
  if(Date.now()<(p.mineUntil||0))return ack({ok:false,error:'Minas en recarga'});
  const zone=p.zone,pos={x:clamp(p.x-Math.cos(p.angle)*65,25,WORLD.w-25),y:clamp(p.y-Math.sin(p.angle)*65,25,WORLD.h-25)};
  p.upgradePending=true;const job=p.writes.catch(()=>{}).then(()=>accounts.consumeOrdnance(p.accountId,code,1));p.writes=job;pending.add(job);
  job.then(stock=>{
   if(stock===null)return ack({ok:false,error:'No tienes '+code});
   const cd=cpuEnabled(p,'MIN-T02')?MR.cooldownMs/2:MR.cooldownMs;p.mineUntil=Date.now()+cd;breakCloak(p);io.to(p.id).emit('v13:ammoStock',{code,quantity:stock});
   if(players.get(p.id)===p&&!p.deadUntil&&!p.gatePending&&p.zone===zone){const m=spawnMine(zone,pos,code,p.id);m.multiplier=(formationBonus(p.formation).mine||1)*(p.pilotBonus?.mine||1);m.radius=MR.blastRadius*(p.pilotBonus?.mineRadius||1);}
   ack({ok:true,stock,cooldown:cd});
  }).catch(()=>ack({ok:false,error:'No se pudo colocar la mina'})).finally(()=>{p.upgradePending=false;pending.delete(job);});
 });
 socket.on('v120:cbsSell',(data,ack)=>{
  if(typeof ack!=='function'||!allowed())return;const p=players.get(socket.id);
  if(process.env.GG_CBS_COMBAT_ENABLED!=='1'||!p||p.deadUntil||p.gate||p.gatePending||p.cbsBusy)return ack({ok:false,error:'Comercio CBS no disponible'});
  p.cbsBusy=true;const zone=p.zone,request={action:'cbs-sell',code:data?.code,quantity:data?.quantity,asteroidId:data?.asteroidId,requestId:data?.requestId};
  const job=p.writes.catch(()=>{}).then(()=>{
   if(players.get(p.id)!==p||p.deadUntil||p.zone!==zone||p.gatePending||p.gate)throw Object.assign(Error('Comercio no disponible'),{status:400});
   return accounts.stationMineralSale(p.accountId,request,{zone:p.zone,x:p.x,y:p.y});
  });p.writes=job;pending.add(job);
  job.then(r=>{p.credits=Number(r.balance.credits);ack({ok:true,...r});}).catch(e=>ack({ok:false,error:e.status?e.message:'No se pudo vender el mineral'})).finally(()=>{p.cbsBusy=false;pending.delete(job);});
 });
 socket.on('v129:arenaCommand',(data,ack)=>{if(typeof ack!=='function'||!allowed())return;try{const m=ubaLobby.get(socket.id),arena=m&&arenas.get(m.id);if(!liveUBA()||!arena)throw Error('Arena no disponible');arenaCommand(arena,m,socket.id,data);ack({ok:true});}catch(e){ack({ok:false,error:e.message});}});
 socket.on('v136:invasionCommand',(data,ack)=>{if(typeof ack!=='function'||!allowed())return;try{const p=players.get(socket.id),c=invasionRuns.get(p?.invasionReturn?.eventId);if(!c)throw Error('Invasión no disponible');invasionCombat.command(c,p.id,data);ack({ok:true});}catch(e){ack({ok:false,error:e.message});}});
 socket.on('v135:invasion',(data,ack)=>{if(typeof ack!=='function'||!allowed())return;const p=players.get(socket.id);if(!p||!invasionEnabled())return ack({ok:false,error:'Invasión no disponible'});try{if(data?.action==='join'){invasionLobby.join(p);notifyInvasion();}else if(data?.action==='leave'){leaveInvasion(p);invasionLobby.leave(p.id);notifyInvasion();}else if(data?.action!=='status')throw Error('Acción inválida');ack({ok:true,...invasionView(p)});}catch(e){ack({ok:false,error:e.message});}});
 socket.on('v127:uba',(data,ack)=>{
  if(typeof ack!=='function'||!allowed())return;const p=players.get(socket.id);
  if(!p)return ack({ok:false,error:'Conéctate primero'});
  if(process.env.GG_UBA_LOBBY_ENABLED!=='1')return ack({ok:false,error:'Sala UBA en pruebas'});
  try{if(data?.action==='leave'){leaveUBA(p.id,true);return ack({ok:true,...ubaView(p.id)});}
   if(data?.action==='status')return ack({ok:true,...ubaView(p.id)});
   if(!ubaEligible(p))throw Error('Nivel 14 y nave disponible requeridos');
   if(data?.action==='join'){if(liveUBA()&&!p.ubaReturn&&(!safeZone(p)||p.attack))throw Error('Entra desde una base segura');const m=ubaLobby.enqueue(p);notifyUBA(m);return ack({ok:true,...ubaView(p.id)});}
   if(data?.action==='accept'){const m=ubaLobby.get(p.id);if(!m||m.id!==data.matchId||m.players.some(id=>!ubaEligible(players.get(id))))throw Error('Oferta no disponible');acceptUBA(m,p.id);notifyUBA(m);return ack({ok:true,...ubaView(p.id)});}
   throw Error('Acción inválida');
  }catch(e){ack({ok:false,error:e.message});}
 });
 socket.on('v116:cbsShot',(data,ack)=>{
  if(typeof ack!=='function'||!allowed())return;const p=players.get(socket.id),now=Date.now();
  if(process.env.GG_CBS_COMBAT_ENABLED!=='1')return ack({ok:false,error:'Combate CBS en pruebas'});
  if(!p||p.deadUntil||p.gate||p.gatePending||p.shotPending||p.upgradePending||p.reloadPending||p.reloadRequested||p.cbsBusy||p.godMode||safeZone(p)||!p.v13||!p.lasers)return ack({ok:false,error:'Arma no disponible'});
  const ammo=catalogV13.ammo.find(a=>a.id===p.ammo);
  if(!ammo||ammo.shieldOnly||now-p.lastShot<(ammo.intervalMs||1000))return ack({ok:false,error:'Espera la recarga o cambia munición'});
  const asteroidId=data?.asteroidId,slot=data?.slot;
  if(typeof asteroidId!=='string'||!Number.isInteger(slot)||slot<0||slot>9)return ack({ok:false,error:'Objetivo inválido'});
  const a=require('./stations-v113').ASTEROIDS.find(x=>x.id===asteroidId);
  if(!a||p.zone!==a.map||distance(p,a)>600)return ack({ok:false,error:'Acércate a la estación'});
  const count=p.lasers,code=ammo.id,damage=Math.max(1,Math.round(p.damage*(p.boost?.damage||1)*combatFactor(p,true)*ammo.multiplier));
  const requestId=crypto.randomUUID();
  p.lastShot=now;p.shotPending=true;p.cbsBusy=true;p.attack=false;p.target=null;p.protectedUntil=0;breakCloak(p);
  const job=p.writes.catch(()=>{}).then(()=>{
   if(players.get(p.id)!==p||p.deadUntil||p.zone!==a.map||distance(p,a)>600)throw Object.assign(Error('Fuera de alcance'),{status:400});
   return accounts.stationHit(p.accountId,{asteroidId,slot,damage,requestId},{x:p.x,y:p.y,zone:p.zone},{code,count});
  });p.writes=job;pending.add(job);
  job.then(r=>{io.to(p.id).emit('v13:ammoStock',{code,quantity:r.stock});if(players.get(p.id)===p){p.angle=Math.atan2(a.y-p.y,a.x-p.x);laser(p,a);}ack({ok:true,...r});}).catch(e=>ack({ok:false,error:e.status?e.message:'No se pudo guardar el disparo'})).finally(()=>{p.shotPending=false;p.cbsBusy=false;pending.delete(job);});
 });
 socket.on('v115:cbs',(data,ack)=>{
  if(typeof ack!=='function'||!allowed())return;const p=players.get(socket.id);
  if(!p||p.deadUntil||p.gatePending||p.gate||p.cbsBusy)return ack({ok:false,error:'Estación no disponible'});
  if(!['build','lower','emergency'].includes(data?.action))return ack({ok:false,error:'Acción inválida'});
  if(data.action==='emergency'?process.env.GG_CBS_COMBAT_ENABLED!=='1':process.env.GG_CBS_BUILD_ENABLED!=='1')return ack({ok:false,error:'Función CBS en pruebas'});
  p.cbsBusy=true;const position={x:p.x,y:p.y,zone:p.zone};
  const job=p.writes.catch(()=>{}).then(()=>accounts[data.action==='build'?'stationBuild':data.action==='emergency'?'stationEmergency':'stationLower'](p.accountId,data,position));p.writes=job;pending.add(job);
  job.then(r=>ack({ok:true,...r})).catch(e=>ack({ok:false,error:e.status?e.message:'No se pudo guardar la estación'})).finally(()=>{p.cbsBusy=false;pending.delete(job);});
 });
 socket.on('v114:bid',(data,ack)=>{
  if(typeof ack!=='function'||!allowed())return;const p=players.get(socket.id);if(!p||p.auctionBusy||p.deadUntil)return ack({ok:false,error:'Subasta no disponible'});
  p.auctionBusy=true;const job=p.writes.catch(()=>{}).then(()=>accounts.auctionBid(p.accountId,data));p.writes=job;pending.add(job);
  job.then(r=>{p.credits=r.credits;ack({ok:true,...r});}).catch(e=>ack({ok:false,error:e.status?e.message:'No se pudo confirmar puja'})).finally(()=>{p.auctionBusy=false;pending.delete(job);});
 });
 socket.on('v112:booster',(data,ack)=>{
  if(typeof ack!=='function'||!allowed())return;const p=players.get(socket.id);
  if(!p||p.deadUntil||p.gatePending||p.boosterBusy)return ack({ok:false,retryable:true,error:'Booster no disponible; reintenta la misma solicitud'});
  if(data?.expectedAccountId!==p.accountId)return ack({ok:false,status:409,error:'La solicitud corresponde a otra cuenta o versión anterior. Actualiza el juego.'});
  p.boosterBusy=true;const job=p.writes.catch(()=>{}).then(()=>accounts.boosterAction(p.accountId,data)).then(()=>accounts.boosterStatus(p.accountId));p.writes=job;pending.add(job);
  job.then(r=>{if(players.get(p.id)===p){p.rawBoosters=r.active;updateBoosters(p);}ack({ok:true,...r});}).catch(e=>ack({ok:false,status:e.status||503,retryable:!e.status||e.status>=500,error:e.status?e.message:'No se pudo confirmar booster; reintenta la misma solicitud'})).finally(()=>{p.boosterBusy=false;pending.delete(job);});
 });
 socket.on('v110:emp',ack=>{
  if(typeof ack!=='function'||!allowed())return;
  const p=players.get(socket.id),now=Date.now();
  if(!p||p.deadUntil||p.gatePending||p.gateWaiting||p.upgradePending||p.shotPending||p.reloadPending)return ack({ok:false,error:'EMP no disponible'});
  if(now<(p.empUntil||0))return ack({ok:false,error:'EMP en recarga'});
  p.upgradePending=true;const zone=p.zone;
  const job=p.writes.catch(()=>{}).then(()=>accounts.consumeAmmo(p.accountId,'EMP',1));p.writes=job;pending.add(job);
  job.then(stock=>{
   if(stock===null)return ack({ok:false,error:'Necesitas un EMP-01'});
   p.empUntil=Date.now()+35000;
   if(players.get(p.id)===p&&!p.deadUntil&&!p.gatePending&&p.zone===zone){
    p.slowUntil=p.freezeUntil=p.accuracyUntil=p.mineSlowUntil=0;
    for(const n of npcs.values())if(sameZone(p,n)&&distance(p,n)<=500){n.target=null;n.empUntil=Date.now()+3000;}
    io.to(zone).emit('v18:mineBlast',{x:p.x,y:p.y,radius:500,code:'EMP-01'});
    io.to(p.id).emit('v13:ammoStock',{code:'EMP',quantity:stock});
    io.to(p.id).emit('notice','EMP-01 activado · 35 s de recarga');
   }
   ack({ok:true,stock,cooldown:35000});
  }).catch(()=>ack({ok:false,error:'No se pudo confirmar EMP'})).finally(()=>{p.upgradePending=false;pending.delete(job);});
 });
 socket.on('v222:logout',(action,ack)=>{if(typeof ack!=='function'||!allowed())return;const p=players.get(socket.id),now=Date.now();if(!p)return ack({ok:false,error:'Piloto no disponible'});if(action==='cancel'){p.logoutRequest=null;return ack({ok:true,cancelled:true});}if(action!=='start'||logoutBlocked(p,now))return ack({ok:false,error:'Detén el movimiento y combate; no puedes salir desde este sector'});if(!p.logoutRequest)p.logoutRequest={until:now+logoutDelay(Number(p.rawBoosters?.PREMIUM||0)>now),zone:p.zone,x:p.x,y:p.y,lastHit:p.lastHit};ack({ok:true,until:p.logoutRequest.until});});
 socket.on('v223:respawnAck',deathId=>{const p=players.get(socket.id);if(!allowed()||!p||!accounts.respawnAcknowledge||p.recoveredRespawnId!==deathId||p.respawnAckPending)return;p.respawnAckPending=true;const job=p.writes.catch(()=>{}).then(()=>accounts.respawnAcknowledge(p.accountId,deathId));p.writes=job;pending.add(job);job.then(()=>{if(p.recoveredRespawnId===deathId){p.recoveredRespawnId=null;io.to(p.id).emit('v223:respawnAcknowledged',{deathId});}},()=>{}).finally(()=>{p.respawnAckPending=false;pending.delete(job);});});
 socket.on('v222:respawn',(data,ack)=>{if(typeof ack!=='function'||!allowed())return;const p=players.get(socket.id),mode=data?.mode;if(!p||!p.deadUntil||p.gate||p.gatePending||p.ubaReturn||p.invasionReturn||!p.respawnChoiceUntil||Date.now()<p.deadUntil||data?.deathId!==p.deathRequestId||!['base','portal','position'].includes(mode))return ack({ok:false,error:'Reaparición no disponible'});if(p.respawnPending)return ack({ok:false,retrySame:true,error:'Reaparición en proceso'});if(mode==='portal'&&!portals(p.zone,WORLD.w,WORLD.h).length)return ack({ok:false,error:'No hay portales disponibles'});if(p.respawnAttempt&&p.respawnAttempt!==mode)return ack({ok:false,error:'Confirma primero la opción anterior'});if(mode==='base'&&!p.respawnAttempt&&!p.deathPersistence){finishRespawn(p,mode);return ack({ok:true});}requestRepair(p,mode,ack);});
 socket.on('v18:ordnance',(code,ack)=>{if(typeof ack!=='function'||!allowed())return;const p=players.get(socket.id);if(p&&catalogV13.launcherAmmo.some(x=>x.id===code))p.autoShell=code;shootOrdnance(p,code,ack);});
 socket.on('v18:rocket',(code,ack)=>{if(typeof ack!=='function'||!allowed())return;const p=players.get(socket.id);if(p&&catalogV13.rockets.some(x=>x.id===code))p.autoRocket=code;shootRocket(p,code,ack);});
 socket.on('v13:reload',()=>{const p=players.get(socket.id);if(!allowed()||!p)return;p.reloadRequested=true;p.attack=false;io.to(p.id).emit('notice','Equipamiento guardado. Activando configuración…');});

 socket.on('v18:upgrade',async(data,ack)=>{
  if(typeof ack!=='function'||!allowed())return;const p=players.get(socket.id);if(!p||p.deadUntil||p.gatePending||p.upgradePending||p.shotPending)return ack({ok:false,error:'Espera a que termine la acción actual'});
  p.upgradePending=true;const job=p.writes.catch(()=>{}).then(()=>accounts.chargeMineral(p.accountId,data));p.writes=job;pending.add(job);
  try{const r=await job;if(players.get(p.id)!==p)return;applyMineralStats(p,r.upgrades);p.nextGeneratorRound=Date.now()+10000;ack({ok:true,...r});}
  catch(e){ack({ok:false,error:e.status?e.message:'No se pudo cargar el mineral'});}finally{p.upgradePending=false;pending.delete(job);}
 });
 socket.on('admin:mapList',ack=>{
  if(typeof ack!=='function'||!allowed())return;
  const p=players.get(socket.id);if(!p?.godAllowed)return ack({ok:false,error:'Acceso reservado'});
  ack({ok:true,maps:require('./admin-map-jump').mapList(),current:p.zone});
 });
 socket.on('admin:mapJump',(destination,ack)=>{
  if(typeof ack!=='function'||!allowed())return;
  const p=players.get(socket.id),error=require('./admin-map-jump').validateAdminJump(p,destination);
  if(error||closing)return ack({ok:false,error:error||'Servidor cerrando'});
  p.gatePending=true;p.attack=false;p.dest=null;p.target=null;
  const job=p.writes.catch(()=>{}).then(()=>accounts.saveLocation(p.accountId,p.company,destination));p.writes=job;pending.add(job);
  job.then(()=>{if(players.get(p.id)!==p)return;changeMap(p,destination);p.protectedUntil=Date.now()+3000;ack({ok:true,map:p.zone});}).catch(()=>ack({ok:false,error:'No se pudo guardar el salto'})).finally(()=>{p.gatePending=false;pending.delete(job);});
 });
 socket.on('admin:oneShot',(enabled,ack)=>{
  if(typeof ack!=='function'||!allowed())return;
  const p=players.get(socket.id);
  if(!p?.godAllowed||typeof enabled!=='boolean')return ack({ok:false,error:'Acceso reservado a la cuenta de pruebas'});
  if(p.deadUntil)return ack({ok:false,error:'Espera a reaparecer'});
  p.oneShot=enabled;ack({ok:true,enabled:p.oneShot});
 });
 socket.on('v17:god',(enabled,ack)=>{
  if(typeof ack!=='function'||!allowed())return;
  const p=players.get(socket.id);
  if(!p||!p.godAllowed||typeof enabled!=='boolean')return ack({ok:false,error:'Habilidad reservada a la cuenta de pruebas'});
  if(p.deadUntil)return ack({ok:false,error:'Espera a reaparecer'});
  p.godMode=enabled;
  ack({ok:true,enabled:p.godMode});io.to(p.id).emit('notice',enabled?'DIOS ACTIVADO · Inmune a todo daño':'DIOS DESACTIVADO');
 });
 socket.on('v16:kamikaze',()=>{
  const p=players.get(socket.id);if(!allowed()||!p||p.deadUntil||p.gatePending||p.gateWaiting||p.petPending||p.kamiPending||p.petTradePending)return;
  const testKami=p.godAllowed===true&&require('./pet-test-kit-v175').testKitEnabled(p.accountId);const now=Date.now();if(!testKami&&(p.kamiUntil||0)>now){io.to(p.id).emit('v184:petKami',{pending:false,readyAt:p.kamiUntil});io.to(p.id).emit('notice','Kamikaze: espera '+Math.ceil((p.kamiUntil-now)/1000)+' s');return;}
  if(p.petMode==='off'||p.petUntil<=now||!Number.isFinite(p.petX)||!Number.isFinite(p.petY)){io.to(p.id).emit('notice','Activa tu P.E.T. primero');return;}
  const zone=p.zone,generation=p.petGeneration;p.kamiPending=true;io.to(p.id).emit('v184:petKami',{pending:true,readyAt:p.kamiUntil||0});
  const valid=()=>!closing&&players.get(p.id)===p&&p.zone===zone&&p.hp>0&&!p.deadUntil&&!p.gatePending&&!p.gateWaiting&&p.petGeneration===generation&&p.petMode!=='off'&&p.petUntil>Date.now()&&!p.petVitals?.destroyed&&!p.petTradePending;
  const job=p.writes.catch(()=>{}).then(()=>valid()?accounts.petKamikaze(p.accountId):null).then(r=>{
   if(!r)return;p.kamiUntil=r.readyAt??0;p.petFuel=r.fuel;
   if(!valid())return;
   const center={x:p.petX,y:p.petY};if(!Number.isFinite(center.x)||!Number.isFinite(center.y))return;
   const kami=testKami?TEST_KAMIKAZE:(r.kamikaze||KAMIKAZE);p.petFuel=r.fuel;p.kamiUntil=testKami?0:(r.readyAt??Date.now()+kami.cooldown);if(!testKami)setPetMode(p,'off');
   const targets=[...npcs.values()].filter(n=>sameZone(p,n)&&!n.gateShielded&&distance(center,n)<=kami.radius);
   let kills=0;for(const n of targets){const before={hp:n.hp,shield:n.shield};damage(n,kami.damage);laserDamage(p,n,actualLaserDamage(before,n),n.type==='boss'?100:64);if(n.hp<=0)kills++;finishNPC(p,n,true,true);}
   io.to(zone).emit('v16:kamikazeEffect',{...center,radius:kami.radius});
   io.to(p.id).emit('notice','Kamikaze · '+targets.length+' NPC afectados · '+kills+' eliminados · recarga '+(kami.cooldown/1000)+' s');
   if(targets.length&&p.gate&&!([...npcs.values()].some(n=>sameZone(p,n)&&!n.gateShielded)))nextGateGroup(p);
  }).catch(e=>io.to(p.id).emit('notice',e.status?e.message:'Kamikaze no disponible')).finally(()=>{p.kamiPending=false;if(players.get(p.id)===p){io.to(p.id).emit('v184:petKami',{pending:false,readyAt:p.kamiUntil||0});io.to(p.id).emit('v14:petState',{mode:p.petMode,fuel:p.petFuel??null,pending:!!p.petPending,vitals:p.petVitals||null});}pending.delete(job);});
  p.writes=job;pending.add(job);
 });
 socket.on('v180:comboRepair',()=>{
  const p=players.get(socket.id),now=Date.now();
  if(!allowed()||!p||p.deadUntil||p.gatePending||p.gateWaiting||p.petMode==='off'||p.petMode==='repair'||p.petUntil<=now||p.petPending||p.petComboPending||p.petTradePending||p.petVitals?.destroyed||p.ubaReturn||p.invasionReturn||!accounts.petComboRepair)return;
  const generation=p.petGeneration;
  const valid=()=>!closing&&players.get(p.id)===p&&!p.deadUntil&&!p.gatePending&&p.petGeneration===generation&&p.petMode!=='off'&&!p.petVitals?.destroyed;
  p.petComboPending=true;
  const job=p.writes.catch(()=>{}).then(()=>valid()?accounts.petComboRepair(p.accountId):null).then(r=>{
   if(!r)return;
   p.petFuel=r.stock;if(players.get(p.id)===p)io.to(p.id).emit('v189:petCooldowns',{comboReadyAt:r.readyAt});if(!valid())return;p.petComboRepair=r;
   io.to(p.id).emit('v14:petCombo',{until:r.until,readyAt:r.readyAt,repairPerSecond:r.repairPerSecond});
   io.to(p.id).emit('v14:petState',{mode:p.petMode,fuel:p.petFuel,pending:false,vitals:p.petVitals||null});
  }).catch(e=>{if(valid())io.to(p.id).emit('notice',e.status?e.message:'Combo reparación no disponible');}).finally(()=>{p.petComboPending=false;pending.delete(job);});
  p.writes=job;pending.add(job);
 });
 socket.on('v181:petTrade',(requestId,ack)=>{
  if(typeof ack!=='function'||!allowed())return;
  const p=players.get(socket.id),now=Date.now();
  if(!p||p.deadUntil||p.gate||p.gatePending||p.gateWaiting||p.ubaReturn||p.invasionReturn||p.petMode==='off'||p.petUntil<=now||p.petPending||p.kamiPending||p.petComboPending||p.petTradePending||p.petDamagePending||p.petShotPending||p.petVitals?.destroyed||!accounts.petTrade)return ack({ok:false,error:'Activa el P.E.T. en un mapa normal primero'});
  if(p.petTradeUntil>now)return ack({ok:false,error:'El P.E.T. sigue comerciando'});
  p.petTradePending=true;const generation=p.petGeneration;
  const job=p.writes.catch(()=>{}).then(()=>{
   if(closing||players.get(p.id)!==p||p.deadUntil||p.gate||p.gatePending||p.petGeneration!==generation||p.petMode==='off')throw Object.assign(Error('P.E.T. no disponible'),{status:400});
   return accounts.petTrade(p.accountId,requestId);
  }).then(r=>{
   if(players.get(p.id)!==p)return;
   p.credits=Number(r.balance.credits);p.petTradeUntil=r.until>Date.now()?r.until:0;if(p.petTradeUntil)setPetMode(p,'off');
   io.to(p.id).emit('v181:petTradeState',{until:r.until});
   ack({ok:true,until:p.petTradeUntil,credits:r.credits,bonus:r.bonus,sold:r.sold,duplicate:!!r.duplicate});
  }).catch(e=>ack({ok:false,error:e.status?e.message:'No se pudo confirmar la venta'})).finally(()=>{p.petTradePending=false;pending.delete(job);});
  p.writes=job;pending.add(job);
 });
 socket.on('v14:pet',mode=>{const p=players.get(socket.id);if(!allowed()||!p||!['off','passive','guard','loot','repair','resource','locate-resource','locate-enemy','combo-guard'].includes(mode))return;if(p.petTradePending||p.kamiPending||p.petComboPending)return;if(mode==='off'){setPetMode(p,mode);return;}if(p.deadUntil||p.petPending||p.petMode===mode)return;if(p.petTradeUntil>Date.now()){io.to(p.id).emit('notice','El P.E.T. sigue comerciando');return;}setPetMode(p,mode);});
 function broadcastHades(room){if(room)for(const member of room.players)io.to(member.id).emit('v14:hadesLobby',room);}
 socket.on('v14:hadesLobby',async(data,ack)=>{
  if(typeof ack!=='function'||!allowed())return;
  const p=players.get(socket.id);if(!p||p.gate||p.deadUntil||p.hadesPending||p.gatePending)return ack({ok:false,error:'Piloto no disponible'});
  p.hadesPending=true;
  try{
   const action=data?.action;let room;
   if(action==='status')room=hadesLobbies.status(p.id);
   else if(action==='leave'){room=hadesLobbies.leave(p.id);socket.emit('v14:hadesLobby',null);broadcastHades(room);return ack({ok:true,room:null});}
   else if(action==='ready')room=hadesLobbies.ready(p.id,data.ready);
   else if(action==='start'){
    const locked=hadesLobbies.lock(p.id),team=locked.players.map(m=>players.get(m.id));let frozen=false;
    try{
     if(team.some(m=>!m||m.gate||m.deadUntil||m.attack||m.shotPending||m.reloadPending||m.gatePending||!atGalaxyPortal(m,'hades')))throw Error('Todos los pilotos deben estar junto a su portal Hades y fuera de combate');
     for(const m of team)m.gatePending=true;frozen=true;
     await Promise.all(team.map(m=>m.writes));
     const accountIds=team.map(m=>m.accountId),state=await accounts.hadesStart(accountIds);
     const current=hadesLobbies.status(p.id);
     if(!current||current.players.length!==team.length||team.some(m=>players.get(m.id)!==m))throw Error('Un piloto se desconectó');
     const g={gate:'hades',wave:state.wave,lives:state.lives,kills:state.kills,members:team.map(m=>m.id),accounts:accountIds,leader:p.id,writes:Promise.resolve(),closed:false};
     hadesLobbies.consume(p.id);
     for(const m of team){const sock=io.sockets.sockets.get(m.id),old={hp:m.hp,shield:m.shield,lastHit:m.lastHit};m.gateReturn={x:m.x,y:m.y,zone:m.zone};sock?.leave(m.zone);m.zone='hades:'+locked.code;sock?.join(m.zone);m.gate=g;spawnPlayer(m);Object.assign(m,old);setPetMode(m,'off');m.gatePending=false;sock?.emit('v14:hadesLobby',null);}
     gateWave(p,true);return ack({ok:true,room:null,started:true});
    }catch(e){broadcastHades(hadesLobbies.unlock(p.id));throw e;}finally{if(frozen)for(const m of team)if(m)m.gatePending=false;}
   }
   else if(action==='create'||action==='join'){
    const eligible=await accounts.hadesEligibility(p.accountId);
    if(players.get(p.id)!==p||p.gate||p.deadUntil||p.gatePending)return ack({ok:false,error:'Piloto no disponible'});
    const member={id:p.id,name:p.name,wave:eligible.wave,checkpoint:eligible.checkpoint};
    room=action==='create'?hadesLobbies.create(member):hadesLobbies.join(data.code,member);
   }else throw Error('Acción inválida');
   broadcastHades(room);ack({ok:true,room});
  }catch(e){ack({ok:false,error:e.status?e.message:String(e.message||'No disponible')});}
  finally{p.hadesPending=false;}
 });
 socket.on('v16:refreshGalaxy',()=>{const p=players.get(socket.id);if(!allowed()||!p||p.ggRefreshing)return;p.ggRefreshing=true;refreshGalaxy(p).catch(()=>{}).finally(()=>{p.ggRefreshing=false;});});
 socket.on('v14:gateEnter',async(gate,ack)=>{
  const p=players.get(socket.id);if(typeof ack!=='function'||!allowed()||!p||p.gatePending||p.gate||p.deadUntil||p.attack||p.shotPending||p.reloadPending)return;
  if(!atGalaxyPortal(p,gate))return ack({ok:false,error:'Acércate al portal galáctico de tu base'});
  p.gatePending=true;
  try{const checkpoint=await accounts.gateCheckpoint(p.accountId,gate);if(players.get(p.id)!==p||p.deadUntil||p.attack||p.shotPending)return ack({ok:false,error:'No se puede entrar ahora'});
   const old={hp:p.hp,shield:p.shield,lastHit:p.lastHit};p.gateReturn={x:p.x,y:p.y,zone:p.zone};socket.leave(p.zone);p.zone='gate:'+p.id;socket.join(p.zone);p.gate=checkpoint;spawnPlayer(p);Object.assign(p,old);setPetMode(p,'off');gateWave(p,true);ack({ok:true});
  }catch(e){ack({ok:false,error:e.status?e.message:'No se pudo abrir la puerta'});}finally{p.gatePending=false;}
 });
 socket.on('v15:group', (data,ack)=>{
  if(typeof ack!=='function'||!allowed())return;const p=players.get(socket.id);if(!p)return ack({ok:false,error:'Conéctate primero'});
  try{
   const action=data?.action,old=groups.status(p.id)?.members||[p.id];let affected=[...old,...groups.invitees(p.id)];
   if(action==='create')groups.create(p.id);
   else if(action==='invite'){const target=players.get(data.target);if(!groupEligible(p)||!groupEligible(target))throw Error('Piloto no disponible');groups.invite(p.id,target.id);affected.push(target.id);io.to(target.id).emit('notice',p.name+' te invitó a un grupo');}
   else if(action==='accept'){if(!groupEligible(p)||!groupEligible(players.get(data.from)))throw Error('Piloto no disponible; sal de la puerta o del combate especial');const g=groups.accept(p.id,data.from);affected.push(...g.members);}
   else if(action==='decline')groups.decline(p.id,data.from);
   else if(action==='transfer')groups.transfer(p.id,data.target);
   else if(action==='leave')groups.leave(p.id);
   else if(action==='kick'){groups.kick(p.id,data.target);affected.push(data.target);}
   else if(action!=='status')throw Error('Acción inválida');
   if(action!=='status')notifyGroup(new Set(affected));ack({ok:true,...groupView(p.id)});
  }catch(e){ack({ok:false,error:e.message});}
 });
 socket.on('v15:company',async(company,ack)=>{
  if(typeof ack!=='function'||!allowed())return;const p=players.get(socket.id);
  if(!p||p.gate||p.gatePending||p.attack||p.shotPending||p.deadUntil||p.hadesPending||!safeZone(p))return ack({ok:false,error:'Cambia de compañía desde una base segura y fuera de combate'});
  p.gatePending=true;
  const job=p.writes.catch(()=>{}).then(()=>accounts.chooseCompany(p.accountId,company));p.writes=job;pending.add(job);
  try{const r=await job;if(players.get(p.id)!==p)return;p.company=r.company;p.companyChosen=true;p.honor=Number(r.balance.honor);p.credits=Number(r.balance.credits);changeMap(p,r.map);p.protectedUntil=Date.now()+3000;ack({ok:true,...r});}
  catch(e){ack({ok:false,error:e.status?e.message:'No se pudo cambiar de compañía'});}finally{p.gatePending=false;pending.delete(job);}
 });
 // Read-only stellar chart: use the same routes and restrictions as actual portal travel.
 socket.on('v171:starMap',ack=>{
  if(typeof ack!=='function'||!allowed())return;
  const p=players.get(socket.id);if(!p)return ack({ok:false,error:'Inicia sesión'});
  const maps=Object.values(MAPS).map(({id,company,pvp,base})=>({id,company,pvp,base}));
  const links=maps.flatMap(m=>portals(m.id,WORLD.w,WORLD.h).map(r=>({from:r.from,to:r.to,level:requiredLevel(r,p.company)})));
  ack({ok:true,current:MAPS[p.zone]?p.zone:null,company:p.company,level:p.level,insideGate:!!p.gate,maps,links});
 });
 socket.on('v14:jump',(portalId,ack)=>{
  if(typeof ack!=='function'||!allowed())return;const p=players.get(socket.id);
  if(closing||!p||p.gate||p.gatePending||p.deadUntil||p.shotPending||p.reloadPending)return ack({ok:false,error:'Salto no disponible'});
  const portal=portals(p.zone,WORLD.w,WORLD.h).find(x=>x.id===portalId);
  if(!portal||distance(p,portal)>180)return ack({ok:false,error:'Acércate al portal'});
  const level=requiredLevel(portal,p.company);if(p.level<level)return ack({ok:false,error:'Necesitas nivel '+level});
  p.gatePending=true;p.attack=false;p.dest=null;
  const company=p.company;
  const job=p.writes.catch(()=>{}).then(async()=>{
   await accounts.saveLocation(p.accountId,company,portal.to);
   if(closing||players.get(p.id)!==p)return;
   const arrival=portals(portal.to,WORLD.w,WORLD.h).find(x=>x.to===portal.from);changeMap(p,portal.to,arrival);missionEvent(p,'map',portal.to);p.protectedUntil=Date.now()+3000;ack({ok:true,map:p.zone});
  }).catch(()=>{if(players.get(p.id)===p&&!closing)ack({ok:false,error:'No se pudo guardar el salto'});}).finally(()=>{p.gatePending=false;pending.delete(job);});
  p.writes=job;pending.add(job);
 });
 socket.on('v14:gateNext',()=>{const p=players.get(socket.id);if(allowed()&&p?.gateWaiting)io.to(p.id).emit('notice','La siguiente ronda comienza automáticamente');});
 socket.on('v14:gateLeave',()=>{const p=players.get(socket.id);if(allowed()&&p?.gate&&p.gateWaiting&&!p.gatePending&&!p.shotPending&&!p.deadUntil&&p.gate.exitPortal&&Date.now()<p.gate.intermissionUntil){if(distance(p,p.gate.exitPortal)>125){io.to(p.id).emit('notice','Acércate al portal de salida');return;}if(p.gate.gate==='hades'){if(p.gate.leader===p.id)endHades(p.gate,'El grupo regresó a la base');}else{returnFromGate(p);refreshGalaxy(p).catch(()=>{});socket.emit('v14:gateState',{inside:false});}}});
 socket.on('disconnect',()=>{leaveInvasion(players.get(socket.id));if(invasionLobby.leave(socket.id))notifyInvasion();leaveUBA(socket.id,true);const p=players.get(socket.id);if(p?.gate?.gate==='hades')endHades(p.gate,'Hades en pausa: un piloto se desconectó');else if(p?.gate)clearGateNPCs(p);broadcastHades(hadesLobbies.leave(socket.id));const oldGroup=[...(groups.status(socket.id)?.members||[]),...groups.invitees(socket.id)];groups.leave(socket.id);if(p)flushFlight(p);players.delete(socket.id);notifyGroup(oldGroup);if(p)p.writes.catch(()=>{}).finally(()=>{if(active.get(p.accountId)===p)active.delete(p.accountId);});});});
 // Run independently of simulation; never overlap or block a simulation tick.
 let calendarBusy=false;const calendarTimer=setInterval(()=>{if(closing||calendarBusy||!accounts.eventCalendar)return;calendarBusy=true;const job=runDue(accounts.eventCalendar,dispatchScheduled).catch(e=>console.error('Calendar:',e.code||e.message)).finally(()=>{calendarBusy=false;pending.delete(job);});pending.add(job);},5000);
 let rankingBusy=false;
 const rankingTimer=setInterval(()=>{
  if(closing||rankingBusy||!players.size||!accounts.rankingRefresh)return;
  rankingBusy=true;
  const job=Promise.resolve().then(()=>accounts.rankingRefresh()).then(()=>refreshPilotSummaries([...players.values()])).catch(e=>console.error('Ranking:',e.code||e.message)).finally(()=>{rankingBusy=false;pending.delete(job);});
  pending.add(job);
 },3000);
 let maintenanceBusy=false;
 const maintenance=setInterval(()=>{
  if(closing||maintenanceBusy)return;maintenanceBusy=true;
  const log=(name,e)=>console.error('Maintenance '+name+':',e.code||e.message);
  const job=runMaintenance([
   ['pending destruction saves',async()=>{for(const id of [...unpersistedDeaths.keys()].slice(0,40)){try{await flushDeath(id);}catch(e){log('destruction save',e);}}}],
   ['event settlements',()=>accounts.eventDrain?.()],
   ['auctions',()=>accounts.auctionSettle()],
   ['flight and achievements',async()=>{const pilots=[...players.values()];for(const p of pilots)flushFlight(p);
    if(accounts.achievementReadMany&&pilots.length){try{const rows=await accounts.achievementReadMany(pilots.map(p=>p.accountId));for(const p of pilots){const a=rows.get(p.accountId);if(a&&players.get(p.id)===p){p.pilotTitle=a.title;p.gateRings=a.rings;}}return;}catch(e){log('batch pilot achievements',e);}}
    if(accounts.achievementRead)for(const p of pilots){if(players.get(p.id)!==p)continue;try{const a=await accounts.achievementRead(p.accountId);if(players.get(p.id)===p){p.pilotTitle=a.title;p.gateRings=a.rings;}}catch(e){log('pilot achievements',e);}}
   }],
   ['clan taxes',async()=>{const charges=await accounts.collectClanTaxes();for(const charge of charges){const p=active.get(charge.id);if(p)io.to(p.id).emit('notice','Impuesto del clan: '+charge.credits+' créditos / '+charge.uridium+' uridium');}}],
   ['referral settlements',async()=>{if(!accounts.referralSettleDue)return;const deliveries=await accounts.referralSettleDue();for(const {recruitId,referrerId} of deliveries){for(const [id,message] of [[recruitId,'Referidos: nivel 15 alcanzado · recompensa acreditada'],[referrerId,'Referidos: un piloto alcanzó nivel 15 · recompensa acreditada']]){const p=active.get(id);if(!p||players.get(p.id)!==p)continue;io.to(p.id).emit('notice',message);io.to(p.id).emit('v13:inventoryChanged');}}}],
   ['Skylab deliveries',async()=>{if(!accounts.skylabDeliverDue||!active.size)return;const deliveries=await accounts.skylabDeliverDue([...active.keys()]);for(const {accountId,delivery} of deliveries){const p=active.get(accountId);if(!p||players.get(p.id)!==p)continue;io.to(p.id).emit('notice','Skylab: entrega completada · '+delivery.quantity+' '+delivery.code+(delivery.fee?' · refinado '+delivery.fee+' créditos':''));io.to(p.id).emit('v13:inventoryChanged');}}],
   ['progress sync',()=>Promise.allSettled([...players.values()].map(syncProgress))],
   ['clan tags',async()=>{const tags=await accounts.clanTags([...active.keys()]);const byId=new Map(tags.map(t=>[t.account_id,t.tag]));for(const p of players.values())p.clanTag=byId.get(p.accountId)||'';}]
  ],log);pending.add(job);job.catch(e=>console.error('Maintenance:',e.code||e.message)).finally(()=>{maintenanceBusy=false;pending.delete(job);});
 },30000);
 const cbsDefense=require('./stations-v113').defenseShots;
 let defenseSnapshot=null,defenseMembers=new Map(),defenseBusy=false,defenseNext=0;const defenseCooldowns=new Map();
 function stationEffects(p,now=Date.now()){if(process.env.GG_CBS_COMBAT_ENABLED!=='1'||!defenseSnapshot||now-defenseSnapshot.at>1500||p.gate)return {safe:false,xp:1,honor:1,damage:1};return clanStationEffects(defenseSnapshot.stations,defenseMembers.get(p.accountId),p.zone,p,now);}
 function updateDefense(now){
  if(process.env.GG_CBS_COMBAT_ENABLED!=='1'||!players.size)return;
  if(!defenseBusy&&now>=defenseNext){
   defenseNext=now+1000;defenseBusy=true;
   const job=accounts.stationDefense([...active.keys()]).then(r=>{defenseSnapshot=r;defenseMembers=new Map(r.members.map(m=>[m.account_id,m.clan_id]));const keys=new Set(r.stations.flatMap(s=>s.modules.map(m=>s.asteroid_id+':'+m.instanceId)));for(const key of defenseCooldowns.keys())if(!keys.has(key))defenseCooldowns.delete(key);}).catch(()=>{defenseSnapshot=null;defenseMembers.clear();}).finally(()=>{defenseBusy=false;pending.delete(job);});pending.add(job);
  }
  if(!defenseSnapshot||now-defenseSnapshot.at>1500)return;
  const candidates=[...players.values()].map(p=>({...p,safe:safeZone(p),protected:p.protectedUntil>now||abilityActive(p,'ultimate-cloak',now)}));
  for(const station of defenseSnapshot.stations)for(const shot of cbsDefense(station,candidates,defenseCooldowns,now)){
   const p=players.get(shot.targetId);if(!p||p.deadUntil||p.zone!==shot.zone||safeZone(p)||p.cloaked||p.godMode||p.protectedUntil>now)continue;
   io.to(shot.zone).emit('laser',{x:shot.x,y:shot.y,tx:p.x,ty:p.y,kind:shot.kind});
   if(shot.damage)damage(p,shot.damage);
   if(p.hp<=0){recordRankDeath(p);p.deadUntil=now+4000;p.attack=false;p.target=null;p.dest=null;setPetMode(p,'off');io.to(p.id).emit('notice','Nave destruida por estación CBS. Reaparición en 4 segundos.');}
  }
 }
 let last=Date.now();const loop=setInterval(()=>{if(closing)return;const now=Date.now(),dt=Math.min((now-last)/1000,.1);last=now;const petCandidates=createTickCandidates(npcs,players);
 for(const p of players.values()){if(p.logoutRequest){const result=logoutState(p,now);if(result==='cancel'){p.logoutRequest=null;io.to(p.id).emit('v222:logoutCancelled');}else if(result==='done'){p.logoutRequest=null;const sock=io.sockets.sockets.get(p.id);sock?.emit('v222:logoutDone');sock?.disconnect(true);continue;}}if(p.ubaReturn||p.invasionReturn)continue;if(now>=(p.nextBoosterCheck||0)){p.nextBoosterCheck=now+1000;updateBoosters(p,now);io.to(p.id).volatile.emit('gg:shipStats',{damage:p.damage*(p.boost?.damage||1),speed:p.speed,config:(p.activeConfig||0)+1});}if(p.gatePending)continue;if(p.deadUntil){if(now>=p.deadUntil&&!p.gatePending){if(p.gate||!accounts.respawnOptions||!accounts.respawnCharge)finishRespawn(p,'base');else if(!p.respawnChoiceUntil)offerRespawn(p,now);else if(now>=p.respawnChoiceUntil&&!p.respawnPending&&!p.respawnAttempt){if(p.deathPersistence)requestRepair(p,'base');else finishRespawn(p,'base');}}if(p.deadUntil)continue;}if((p.reloadRequested||p.nextUpgradeAt&&now>=p.nextUpgradeAt)&&!p.reloadPending&&!p.shotPending&&!p.upgradePending){p.nextUpgradeAt=0;p.reloadRequested=false;p.reloadPending=true;p.attack=false;const job=Promise.resolve().then(()=>accounts.combatLoadout(p.accountId)).then(l=>{if(players.get(p.id)!==p)return;if(p.deadUntil){p.reloadRequested=true;return;}if(!l)throw Error('Sin configuración guardada');applyLoadout(p,l);io.to(p.id).emit('notice','Configuración '+(l.active+1)+' activa · '+l.lasers+' láseres');io.to(p.id).emit('v13:loadoutApplied',{active:l.active,lasers:l.lasers,damage:l.damage});}).catch(()=>{if(players.get(p.id)===p)io.to(p.id).emit('notice','No se pudo activar el equipo. Guarda de nuevo en el hangar.');}).finally(()=>{p.reloadPending=false;pending.delete(job);});pending.add(job);}generatorTick(p,now);abilityTick(p,now,dt);move(p,p.dest,dt);if(p.dest&&distance(p,p.dest)<2)p.dest=null;p.shield=clamp(p.shield+shieldDelta(p,dt)+(now-p.lastHit>6500?35*dt:0),0,p.maxShield);
 if(p.petTradeUntil&&now>=p.petTradeUntil){p.petTradeUntil=0;io.to(p.id).emit('v181:petTradeState',{until:0});io.to(p.id).emit('notice','El P.E.T. ha vuelto del comercio');if(!p.deadUntil&&!p.gate&&!p.gateWaiting&&!p.gatePending&&!p.petVitals?.destroyed&&p.petMode==='off')setPetMode(p,'passive');}
 if(p.petMode&&p.petMode!=='off'&&now>=p.petUntil&&!p.petPending&&!p.petTradePending){
  const mode=p.petMode,generation=p.petGeneration;p.petPending=true;
  const job=p.writes.catch(()=>{}).then(()=>accounts.petInterval(p.accountId,mode)).then(async result=>{
   if(require('./pet-test-kit-v175').vitalsEnabled(p.accountId)&&accounts.petVitals){
    const v=await accounts.petVitals(p.accountId);
    if(v.destroyed)throw Object.assign(Error('El P.E.T. está destruido. Repáralo primero'),{status:400});
    if(players.get(p.id)!==p||p.petGeneration!==generation||p.deadUntil)return;
    const recovered=accounts.petRegenerate&&p.petVitals&&!p.attack&&!p.petDamagePending?await accounts.petRegenerate(p.accountId):null;
    if(players.get(p.id)===p&&p.petGeneration===generation)p.petVitals={...v,...(recovered||{})};
   }
   if(closing||players.get(p.id)!==p||p.deadUntil||p.petGeneration!==generation)return;
   p.petFuel=result.fuel;p.petLootRange=result.lootRange||700;p.petComboGuardLevel=result.guardLevel||null;p.petUntil=Date.now()+10000;if(mode==='repair'&&!p.petRepairStarted){p.petRepairStarted=Date.now();p.petRepairNext=p.petRepairStarted+1000;}
   if(!Number.isFinite(p.petX)||!Number.isFinite(p.petY)){const home=petFollowGoal(p);p.petX=home.x;p.petY=home.y;p.petAngle=p.angle;}
   io.to(p.id).emit('v14:petState',{mode,fuel:p.petFuel,pending:false,vitals:p.petVitals||null});
  }).catch(e=>{if(players.get(p.id)!==p||p.petGeneration!==generation)return;setPetMode(p,'off');io.to(p.id).emit('notice',e.status===400?e.message:'P.E.T. no disponible');}).finally(()=>{p.petPending=false;pending.delete(job);});p.writes=job;pending.add(job);
 }
 if(p.petUntil>now&&p.petMode!=='off'&&!p.petTradePending){
  let targetBox=null;
  if(p.petMode==='loot'&&!p.gate)targetBox=nearestEligible(p,boxes.inZone(zoneOf(p)),p.petLootRange||700,b=>petEligible(p,b));
  if(p.petMode==='resource'&&!p.gate)targetBox=nearestEligible(p,boxes.inZone(zoneOf(p)),p.petLootRange||700,b=>petResourceEligible(p,b,now));
  if(!Number.isFinite(p.petX)||!Number.isFinite(p.petY)){const home=petFollowGoal(p);p.petX=home.x;p.petY=home.y;p.petAngle=p.angle;}
  let pursuit=null;
  if(['guard','combo-guard'].includes(p.petMode)&&require('./pet-test-kit-v175').guardEnabled(p.accountId)&&!safeZone(p)&&!abilityActive(p,'ultimate-cloak',now)){
   // Pursuit uses the same owner range and aggression rules as firing, but evaluates from the owner's position.
   const nearOwner={...p,petX:p.x,petY:p.y};
   const npc=selectGuardTarget(nearOwner,petCandidates.npcFor(p).filter(n=>!immune(n)),now,600);
   const pilotEnabled=require('./pet-test-kit-v175').testKitEnabled(p.accountId)||process.env.GG_PET_GUARD_PVP_ENABLED==='1';
   const pilot=pilotEnabled?selectPilotGuardTarget(nearOwner,petCandidates.pilotsFor(p,now),now,600,(a,b)=>canPvp(a,b)&&!immune(b)):null;
   const target=pilot&&(!npc||distance(p,pilot)<distance(p,npc))?pilot:npc;
   if(target)pursuit={x:target.x,y:target.y,kind:'combat'};
  }
  const goal=petNavigation.travelGoal(p,targetBox||pursuit,now,WORLD);
  petNavigation.advance(p,goal,dt);
  if(targetBox&&goal.kind==='pickup'&&Math.hypot(p.petX-targetBox.x,p.petY-targetBox.y)<35)collectBox(p,targetBox,true);
  if(['guard','combo-guard'].includes(p.petMode))shootPetGuard(p,now,petCandidates);
  if(p.petComboRepair){if(p.petComboRepair.until>now&&!p.deadUntil&&!p.petVitals?.destroyed){heal(p,'hp',p.petComboRepair.repairPerSecond*dt);}else{p.petComboRepair=null;io.to(p.id).emit('v14:petCombo',null);}}if(p.petMode==='repair')tickPetRepair(p,now);
  if(['locate-resource','locate-enemy'].includes(p.petMode)&&now>=(p.petLocateNext||0)){p.petLocateNext=now+1000;const mode=p.petMode;const marker=!p.gate?require('./pet-support-gears-v178').locatorMarker(p,mode==='locate-resource'?boxes.inZone(zoneOf(p)):npcs.values(),p.petLootRange,mode,now):null;io.to(p.id).emit('v14:petLocator',marker); }
 }
 if(!p.gate)for(const b of boxes.inZone(zoneOf(p)))if(distance(p,b)<52)collectBox(p,b);
 collectSpaceball(p,now);collectIce(p,now);
 if(iceTarget(p.target)){if(!icePilot(p)||!iceUnit(p.target)){p.target=null;p.attack=false;}else shootIce(p,now);continue;}
 if(hitacTarget(p.target)){if(!hitacPilot(p)||!hitacUnit(p.target)){p.target=null;p.attack=false;}else shootHitac(p,now);continue;}
 if(p.target===ballTarget){if(!spaceballGame||p.zone!=='4-4'){p.target=null;p.attack=false;}else shootBall(p,now);continue;}
 const n=npcs.get(p.target)||players.get(p.target),pvp=!!n&&players.get(n.id)===n;if(!n||!sameZone(p,n)||(pvp&&!canPvp(p,n)&&!groupMates(p,1800).includes(n))){p.target=null;p.attack=false;}else if(p.attack&&(!pvp||canPvp(p,n))&&!p.reloadPending&&!p.reloadRequested&&distance(p,n)<=(p.v13?600:650)&&now-p.lastShot>=(p.v13?(catalogV13.ammo.find(a=>a.id===p.ammo)?.intervalMs||1000):450)&&!p.shotPending&&!p.upgradePending){
 p.lastShot=now;breakCloak(p);
 const finish=()=>finishCombat(p,n,pvp);
 if(n.gateShielded){p.attack=false;io.to(p.id).emit('notice','El jefe está protegido: elimina los demás alienígenas');}
 else if(!p.v13){p.angle=Math.atan2(n.y-p.y,n.x-p.x);laser(p,n);const amount=adminTestDamage(p,n,pvp)||damage(n,p.damage*(p.boost?.damage||1)*(pvp?damageFactor(p.honor):1));if(!pvp)laserDamage(p,n,amount,n.type==='boss'?100:64);finish();}
 else if(!p.lasers){p.attack=false;io.to(p.id).emit('notice','Equipa un láser en el hangar');}
 else{p.shotPending=true;const ammo=p.ammo,count=p.lasers;const job=accounts.upgradedShot(p.accountId,ammo,count,'laser',{autoMineral:cpuEnabled(p,'NC-AWB'),aim:cpuEnabled(p,'AIM-02')}).then(shot=>{const stock=shot?.stock??null;if(shot){applyMineralStats(p,shot.upgrades);for(const [code,quantity] of Object.entries(shot.resources||{}))io.to(p.id).emit('v13:ammoStock',{code,quantity});}
 if(stock===null){p.attack=false;io.to(p.id).emit('notice','Munición insuficiente');return;}
 io.to(p.id).emit('v13:ammoStock',{code:ammo,quantity:stock});
 if(closing||players.get(p.id)!==p||p.deadUntil||p.gatePending||!p.attack||p.target!==n.id||distance(p,n)>600||(pvp?players.get(n.id)!==n||!canPvp(p,n):npcs.get(n.id)!==n))return;
 const result=salvo({...p,aimBoost:shot.aimBoost||techActive(p.technologies,'precision-targeter',Date.now()),accuracyFactor:(p.accuracyUntil>Date.now()?.6:1)*(1-(formationBonus(n.formation).evasion||0))*(1-(n.pilotBonus?.evasion||0))*(1+(p.pilotBonus?.accuracy||0)),damage:p.damage*(p.boost?.damage||1)*shot.factor*combatFactor(p,pvp)*(pvp?p.pilotBonus?.pvp||1:p.pilotBonus?.npc||1)*markFactor(p,n,Date.now())*incoming(n,Date.now())*(abilityActive(p,'prism',Date.now())?.75:1)*(abilityActive(n,'prism',Date.now())?.1:1)*(pvp?damageFactor(p.honor):1)},n,ammo,stock+count,Math.random());p.angle=Math.atan2(n.y-p.y,n.x-p.x);laser(p,n,ammo);if(!immune(n)){const before={hp:n.hp,shield:n.shield};let displayDamage=ammo==='SAB-50'?0:adminTestDamage(p,n,pvp);if(displayDamage>0){}else if(result.damage>0){displayDamage=protectDamage(n,result.damage);const resolved=hit(n,displayDamage,formationAbsorption(p,n));const shieldLoss=n.shield-resolved.shield;resolved.shield=Math.max(0,n.shield-shieldLoss*(n.weakenUntil>Date.now()?1.5:1)*(abilityActive(n,'fortress',Date.now())?.7:1));Object.assign(n,resolved);}else if(result.drained>0){const drained=protectDamage(n,result.drained);n.shield=Math.max(0,n.shield-drained);p.shield=Math.min(p.maxShield,p.shield+drained);displayDamage=actualLaserDamage(before,n);}if(!pvp)laserDamage(p,n,displayDamage,n.type==='boss'?100:64);technologyLeech(p,n,before);finish();}
 }).catch(()=>{p.attack=false;io.to(p.id).emit('notice','No se pudo confirmar el consumo de munición');}).finally(()=>{p.shotPending=false;pending.delete(job);if(players.get(p.id)===p&&p.attack&&!p.deadUntil&&!p.gatePending&&!p.upgradePending&&!p.reloadPending&&Date.now()>=(p.autoRetry||0)){const now=Date.now();const choices=autoWeapons(p,now);if(choices.length){const choice=choices[p.autoTurn%choices.length||0];p.autoTurn=(p.autoTurn||0)+1;const ack=r=>{if(!r.ok)p.autoRetry=Date.now()+2000;};if(choice==='rocket')shootRocket(p,p.autoRocket||'R-310',ack);else shootOrdnance(p,p.autoShell||'ECO-10',ack);}}});pending.add(job);}
 }}
 const npcPilotsByZone=groupByZone(players.values(),zoneOf),npcContext={now,sameZone,safeZone,cloaked:(p,t)=>abilityActive(p,'ultimate-cloak',t)};
 for(const n of npcs.values()){if(n.hp<=0||n.empUntil>now){n.target=null;continue;}if(n.mapNPC&&!npcPilotsByZone.has(zoneOf(n))){n.target=null;continue;}let target=players.get(n.target);if(!npcPilotEligible(n,target,npcContext)||(!n.gateNPC&&distance(n,target)>1000)){target=nearestEligible(n,npcPilotsByZone.get(zoneOf(n))||[],n.gateNPC?Infinity:n.type==='boss'?850:310,p=>npcPilotEligible(n,p,npcContext));n.target=target?.id||null;}if(target){const d=distance(n,target);if(d>270)move(n,target,dt);else n.angle=Math.atan2(target.y-n.y,target.x-n.x);if(d<460&&now-n.lastShot>1100&&!safeZone(target)&&!(target.protectedUntil>now)){n.lastShot=now;if(target.petMode==='repair')setPetMode(target,'passive');if(hitGuardPet(n,target,now))continue;laser(n,target);if(Math.random()<(n.accuracyUntil>now?.6:1)*(1-(formationBonus(target.formation).evasion||0))*(1-(target.pilotBonus?.evasion||0)))damage(target,n.damage*(abilityActive(target,'prism',now)?.1:1));if(target.hp<=0&&!target.deadUntil){recordRankDeath(target);if(target.gate){saveGate(target,'death');continue;}target.deadUntil=now+4000;setPetMode(target,'off');target.attack=false;target.target=null;target.dest=null;io.to(target.id).emit('notice','Nave destruida. Reaparición en 4 segundos.');}}}else if(!n.gateNPC){if(distance(n,n.dest)<8)n.dest=point();move(n,n.dest,dt);}}
 updateMines(now);updateDefense(now);tickUBA(now);tickInvasion(now);tickHitac(now);tickIce(now,dt);if(spaceballGame)spaceball.advance(spaceballGame,now);
 if(tick%10===0&&players.size){const progressByGate=new Map();for(const p of players.values()){const g=p.gate;if(!g||g.closed||g.completed||p.gateWaiting||p.gatePending)continue;if(!progressByGate.has(g))progressByGate.set(g,waveProgress(WAVES[g.gate]?.[g.wave],g.kills||[],g.observedKills||[]));const progress=progressByGate.get(g);if(progress)io.to(p.id).volatile.emit('v195:gateProgress',{gate:g.gate,wave:g.wave+1,lives:g.lives,...progress});}}
 if(++tick%2===0&&players.size){const zones=buildZoneSnapshots({players:players.values(),npcs:npcs.values(),mines:mines.values(),boxesForZone:zone=>MAPS[zone]?boxes.inZone(zone):[],zoneOf,publicPlayer,isHidden:p=>abilityActive(p,'ultimate-cloak',now),common:zone=>({time:now,map:MAPS[zone]?zone:null,spaceball:zone==='4-4'?spaceballView(now):null,hitac:hitacView(zone),ice:iceView(zone),base:homeBase(zone,WORLD.w,WORLD.h),portals:MAPS[zone]?portals(zone,WORLD.w,WORLD.h):[]})});for(const z of zones.values())for(const viewer of z.viewers)io.to(viewer.id).volatile.emit('state',{...snapshotFor(z,viewer),extras:extraView(viewer)});}},50);
 const close=onceAsync(async()=>{closing=true;clearInterval(loop);clearInterval(maintenance);clearInterval(calendarTimer);clearInterval(rankingTimer);for(const t of timers)clearTimeout(t);await new Promise(resolve=>io.close(resolve));await drainPending(pending);await accounts.close();});return{app,server,io,close};}
 if(require.main===module){const accounts=createAccounts(process.env.DATABASE_URL);accounts.ready().then(()=>{const game=createGame({accounts}),PORT=process.env.PORT||3000;game.server.listen(PORT,'0.0.0.0',()=>console.log(`GOLD GAMING escuchando en ${PORT}`));for(const sig of ['SIGTERM','SIGINT'])process.once(sig,()=>game.close().then(()=>process.exit(0)));}).catch(async e=>{console.error('No se pudo conectar a PostgreSQL:',e.code||e.message);await accounts.close();process.exitCode=1;});}module.exports={createGame,WORLD,SHIPS};
