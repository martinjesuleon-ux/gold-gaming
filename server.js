'use strict';
const express=require('express');const http=require('node:http');const path=require('node:path');const crypto=require('node:crypto');const {Server}=require('socket.io');const {createAccounts}=require('./accounts');
const catalogV13=require('./data/catalog-v13.json');const {DEFS,WAVES,SHARED}=require('./gates-v14');const {MAPS,homeBase,galaxyPortals,portals,requiredLevel,population}=require('./maps-v14');const {eligible,damageFactor}=require('./pvp-v15');const {createGroups}=require('./groups-v15');const {npcCargo}=require('./minerals-v17');const {factor}=require('./upgrades-v18');const {MINES,RULES:MR,mineImpact}=require('./mines-v18');const {repairRate}=require('./cpus-v18');const {ABILITIES,definitions:abilityDefinitions,active:abilityActive,activate:activateAbility,heal,speedFactor,incoming,breakCloak}=require('./abilities-v18');const alienStats=require('./data/npcs-v14.json');const {createHadesLobbies}=require('./hades-lobby-v14');const {salvo,hit}=require('./equipment-v13');
const WORLD={w:12000,h:8000};const SHIPS={scout:{hp:900,shield:450,speed:420,damage:110},tank:{hp:1800,shield:950,speed:255,damage:155}};
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n)),distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),random=(a,b)=>a+Math.random()*(b-a),point=()=>({x:random(150,WORLD.w-150),y:random(150,WORLD.h-150)}),validPoint=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
function createGame({password=process.env.ADMIN_PASSWORD||'',npcCount=42,boxCount=75,accounts=createAccounts(process.env.DATABASE_URL)}={}){
 const app=express(),server=http.createServer(app),io=new Server(server,{maxHttpBufferSize:8192});const hadesLobbies=createHadesLobbies(),groups=createGroups();const players=new Map(),npcs=new Map(),boxes=new Map(),mines=new Map(),active=new Map(),pending=new Set();let seq=0,tick=0,closing=false;const timers=new Set(),attempts=new Map();
 const zoneOf=o=>o?.zone||'1-1';const sameZone=(a,b)=>zoneOf(a)===zoneOf(b);
 const later=(fn,ms)=>{if(closing)return;const t=setTimeout(()=>{timers.delete(t);fn();},ms);timers.add(t);};const id=()=>String(++seq);
 function spawnNPC(boss=false,pos=point()){const n={id:id(),type:boss?'boss':'drone',name:boss?'BOSS · TITAN':'Stellar Drone',x:pos.x,y:pos.y,angle:0,hp:boss?8500:650,maxHp:boss?8500:650,shield:boss?4500:220,maxShield:boss?4500:220,speed:boss?105:155,damage:boss?220:55,reward:boss?3500:180,target:null,dest:point(),lastShot:0};npcs.set(n.id,n);return n;}
 function spawnBox(pos=point(),zone='1-1'){const b={id:id(),zone,x:pos.x,y:pos.y,value:Math.floor(random(35,101))};boxes.set(b.id,b);return b;}
 function applyLoadout(p,l){if(!l)return;if(p.ship!==l.ship||p.design!==l.design)for(const a of Object.values(p.abilities||{}))a.until=0;const ratio=Number.isFinite(p.hp)?p.hp/p.maxHp:1;p.ship=l.ship;p.design=l.design||null;p.designBonus=l.designBonus||{};p.maxHp=Math.round(l.hp*(p.designBonus.hp||1));p.baseShield=Math.round(l.shield*(p.designBonus.shield||1));p.baseSpeed=l.speed;p.maxShield=Math.round(p.baseShield*factor(p.mineralUpgrades,'shield'));p.speed=l.speed*factor(p.mineralUpgrades,'speed');p.damage=Math.round(l.damage*(p.designBonus.damage||1));p.lasers=l.lasers;p.launcher=l.launcher||null;p.cpus=l.cpus||[];p.robot=l.robot||null;p.absorption=l.absorption;p.hp=Math.min(p.maxHp,Math.max(0,Math.round(p.maxHp*ratio)));p.shield=Math.min(Number.isFinite(p.shield)?p.shield:p.maxShield,p.maxShield);p.v13=true;p.ammo=p.ammo||'LCB-10';}
 function spawnPlayer(p){p.cloaked=false;p.ishUntil=0;p.repairOn=false;for(const a of Object.values(p.abilities||{}))a.until=0;p.petMode='off';p.petUntil=0;p.petGeneration=(p.petGeneration||0)+1;Object.assign(p,{x:WORLD.w/2+random(-180,180),y:WORLD.h/2+random(-180,180),hp:p.maxHp,shield:p.maxShield,angle:0,dest:null,target:null,attack:false,deadUntil:0,lastHit:Date.now()});}
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
 function damage(v,amount){if(immune(v))return;amount=protectDamage(v,amount*incoming(v,Date.now()));const absorbed=Math.min(v.shield,amount*(v.absorption??1));v.shield-=absorbed*(abilityActive(v,'fortress',Date.now())?.7:1);v.hp=Math.max(0,v.hp-(amount-absorbed));v.lastHit=Date.now();}
 function move(v,d,dt){if(!d)return;const dx=d.x-v.x,dy=d.y-v.y,len=Math.hypot(dx,dy);if(len<1)return;v.angle=Math.atan2(dy,dx);const step=Math.min(len,v.speed*speedFactor(v,Date.now())*(v.freezeUntil>Date.now()?0:v.mineSlowUntil>Date.now()?.5:v.slowUntil>Date.now()?.7:1)*dt);v.x=clamp(v.x+dx/len*step,25,WORLD.w-25);v.y=clamp(v.y+dy/len*step,25,WORLD.h-25);}
 function laser(a,b){io.to(zoneOf(a)).emit('laser',{x:a.x,y:a.y,tx:b.x,ty:b.y,kind:a.type||'player'});}
 const initializedMaps=new Set();
 function spawnMapNPC(name,zone){
  const a=alienStats[name];if(!a)return;
  const n=spawnNPC(false,point());Object.assign(n,{zone,name,type:name.startsWith('Boss')?'boss':'drone',hp:a.hp,maxHp:a.hp,shield:a.shield,maxShield:a.shield,speed:a.speed,damage:a.damage,reward:a.credits,xpReward:a.xp,uridiumReward:a.uridium,honorReward:a.honor,mapNPC:true});
 }
 function spawnPalladium(){const q={x:random(WORLD.w*.15,WORLD.w*.85),y:random(WORLD.h*.2,WORLD.h*.8)};const b=spawnBox(q,'5-3');b.kind='paladio';b.contents={paladio:1};return b;}
 function dropCargo(p,n){const b=spawnBox(n,n.zone);b.kind='cargo';b.owner=p.accountId;b.contents=npcCargo(n.name,n.reward);b.expires=Date.now()+90000;later(()=>boxes.delete(b.id),90000);}
 function spawnMine(zone,position,code,owner=null){const now=Date.now(),m={id:id(),zone,x:position.x,y:position.y,code,owner,armedAt:now+(owner?MR.armMs:0),expires:owner?now+MR.lifetimeMs:Infinity};mines.set(m.id,m);return m;}
 function updateMines(now){
  for(const m of mines.values()){
   const owner=m.owner?players.get(m.owner):null;
   if(now>=m.expires||(m.owner&&(!owner||owner.zone!==m.zone))){mines.delete(m.id);continue;}
   if(now<m.armedAt)continue;
   const candidates=[...players.values()].filter(v=>v.zone===m.zone&&!v.deadUntil&&!v.gatePending&&v.hp>0&&!safeZone(v)&&!(v.protectedUntil>now)&&(!owner||v!==owner&&canPvp(owner,v)));
   if(owner)for(const n of npcs.values())if(n.zone===m.zone&&!n.gateShielded&&n.hp>0)candidates.push(n);
   if(!candidates.some(v=>distance(m,v)<=MR.triggerRadius))continue;
   mines.delete(m.id);const spec=MINES.find(x=>x.id===m.code);
   for(const v of candidates)if(distance(m,v)<=MR.blastRadius&&!immune(v)){
    const before=v.hp+v.shield;Object.assign(v,mineImpact(v,spec,now));if(v.hp+v.shield<before)v.lastHit=now;
    if(owner&&npcs.get(v.id)===v)v.target=owner.id;
   }
   io.to(m.zone).emit('v18:mineBlast',{x:m.x,y:m.y,radius:MR.blastRadius,code:m.code});
   if(!owner)later(()=>spawnMine(m.zone,m,m.code),60000);
  }
 }
 function initMap(zone){if(initializedMaps.has(zone)||!MAPS[zone])return;initializedMaps.add(zone);
  for(let i=0;i<({'5-1':85,'5-3':66}[zone]||0);i++)spawnMine(zone,point(),'ACM-01');
  if(npcCount>0)for(const [name,count] of population(zone))for(let i=0;i<count;i++)spawnMapNPC(name,zone);
  if(boxCount>0&&zone==='5-3')for(let i=0;i<50;i++)spawnPalladium();
  if(boxCount>0&&!['4-4','4-5'].includes(zone))for(let i=0;i<(/^4-[123]$/.test(zone)?100:boxCount);i++)spawnBox(point(),zone);
 }
 function changeMap(p,zone,pos){const sock=io.sockets.sockets.get(p.id);sock?.leave(zoneOf(p));p.zone=zone;initMap(zone);sock?.join(zone);p.x=pos?.x??WORLD.w/2;p.y=pos?.y??WORLD.h/2;p.dest=null;p.target=null;p.attack=false;setPetMode(p,'off');sock?.emit('v14:map',{map:zone});sock?.emit('v16:basePortals',{map:zone,portals:personalPortals(p)});}
 function groupView(id){const g=groups.status(id);return {group:g?{...g,members:g.members.map(id=>({id,name:players.get(id)?.name||'Piloto',map:players.get(id)?.zone}))}:null,invite:groups.pending(id),pilots:[...players.values()].filter(p=>p.id!==id&&!p.gate).map(p=>({id:p.id,name:p.name}))};}
 function notifyGroup(ids){for(const id of ids){const p=players.get(id);if(p){p.group=groups.status(id)?.id||null;io.to(id).emit('v15:group',groupView(id));}}}
 function canPvp(a,b){return !!b&&!abilityActive(b,'ultimate-cloak',Date.now())&&!b.cloaked&&eligible(a,{...b,safe:safeZone(b)})&&!safeZone(a)&&!(a.hadesPending||b.hadesPending);}
 function groupMates(p,radius){return [...players.values()].filter(q=>q!==p&&!q.deadUntil&&!q.gatePending&&q.hp>0&&p.group&&q.group===p.group&&sameZone(q,p)&&distance(p,q)<=radius);}
 function protectDamage(v,amount){if(!v.group||!amount)return amount;const protector=groupMates(v,700).find(q=>abilityActive(q,'protect',Date.now()));if(!protector)return amount;const redirected=Math.min(protector.shield,amount*.25);if(!protector.godMode){protector.shield-=redirected;protector.lastHit=Date.now();}return amount-redirected;}
 function markFactor(p,n,now){return n.markUntil>now&&n.markGroup&&n.markGroup===p.group?1.05:1;}
 function abilityTick(p,now,dt){
  const a=p.abilities||{};
  if(p.robot&&(p.repairOn||p.cpus?.includes('NC-RRB'))&&!p.attack&&now-p.lastHit>=5000&&p.hp<p.maxHp)heal(p,'hp',repairRate(p.robot,p.maxHp)*dt);
  if(abilityActive(p,'singularity',now)){const effect=a.singularity,n=npcs.get(effect.target)||players.get(effect.target);const pvp=!!n&&players.get(n.id)===n;if(!n||n.hp<=0||immune(n)||n.gateShielded||!sameZone(p,n)||(pvp&&!canPvp(p,n))){effect.until=0;}else if(now>=(effect.next||0)){effect.next=now+1000;effect.ticks=(effect.ticks||0)+1;n.hp=Math.max(0,n.hp-500*effect.ticks);n.lastHit=now;finishCombat(p,n,pvp);if(n.hp<=0)effect.until=0;}}
  for(const [key,kind,selfRate,otherRate] of [['repair-hp','hp',20000,40000],['repair-shield','shield',15000,25000]]){
   if(!abilityActive(p,key,now))continue;const q=players.get(a[key].target);
   if(q&&groupMates(p,700).includes(q))heal(q,kind,otherRate*dt);else heal(p,kind,selfRate*dt);
  }
  if(abilityActive(p,'repair-pod',now)&&a['repair-pod'].zone===p.zone){const pod=a['repair-pod'];for(const q of players.values())if(!q.deadUntil&&!q.gatePending&&q.hp>0&&sameZone(p,q)&&distance(pod,q)<=350&&(q===p||q.company===p.company||p.group&&p.group===q.group))heal(q,'hp',18000*dt);}
  if(abilityActive(p,'draw-fire',now)&&!safeZone(p)){for(const n of npcs.values())if(sameZone(p,n)&&distance(p,n)<=500){n.target=p.id;}}
 }
 function safeZone(p){const b=homeBase(p.zone,WORLD.w,WORLD.h);return b?distance(p,b)<b.radius:!!MAPS[p.zone]?.base&&distance(p,{x:WORLD.w/2,y:WORLD.h/2})<450;}
 function personalPortals(p){return galaxyPortals(p.zone,p.company,p.ggBuilt||[],WORLD.w,WORLD.h);}
 function atGalaxyPortal(p,gate){const q=galaxyPortals(p.zone,p.company,[gate],WORLD.w,WORLD.h)[0];return !!q&&distance(p,q)<=125;}
 async function refreshGalaxy(p){const data=await accounts.gateStatus(p.accountId);if(players.get(p.id)!==p)return;p.ggBuilt=data.gates.filter(g=>data.states[g].built);io.to(p.id).emit('v16:basePortals',{map:p.zone,portals:personalPortals(p)});}

 const KAMIKAZE={damage:1000000,radius:1500,cooldown:10000};
 function finishCombat(p,n,pvp){if(pvp){n.lastHit=Date.now();if(n.hp<=0&&!n.deadUntil){n.deadUntil=Date.now()+4000;n.attack=false;n.target=null;n.dest=null;setPetMode(n,'off');p.attack=false;p.target=null;const job=p.writes.catch(()=>{}).then(()=>accounts.pvpReward(p.accountId,n.accountId,n.ship)).then(async r=>{Object.assign(p,{credits:Number(r.balance.credits),experience:Number(r.balance.experience),level:Number(r.balance.level),honor:Number(r.balance.honor)});io.to(p.id).emit('notice','Piloto eliminado · Honor '+r.reward.honor+' · EXP '+r.reward.xp);if(r.reward.honor>=0)await accounts.missionEvent(p.accountId,'pilot',n.ship);});p.writes=job;pending.add(job);job.then(()=>pending.delete(job),()=>{pending.delete(job);io.to(p.id).emit('notice','No se pudo guardar recompensa PvP');});io.to(n.id).emit('notice','Nave destruida por '+p.name);}return;}finishNPC(p,n);}
 function finishNPC(p,n,deferGate=false){n.target=p.id;if(n.hp<=0&&npcs.get(n.id)===n){npcs.delete(n.id);if(!p.gate)dropCargo(p,n);p.target=null;p.attack=false;if(p.gate?.gate==='hades'){const g=p.gate,wave=g.wave;queueHades(g,()=>accounts.hadesKill(g.accounts,wave,n.gateKillKey,{credits:n.reward,xp:n.xpReward,uridium:n.uridiumReward,honor:n.honorReward},p.accountId)).then(r=>{if(r.balances)for(const member of groupPilots(g)){const b=r.balances[member.accountId];if(b)Object.assign(member,{credits:Number(b.credits),experience:Number(b.experience),level:Number(b.level)});}}).catch(()=>{});if(!deferGate&&!([...npcs.values()].some(x=>sameZone(p,x)&&!x.gateShielded)))nextGateGroup(p);return;}if(p.gate){const g=p.gate;const job=p.writes.catch(()=>{}).then(()=>accounts.gateKill(p.accountId,g.gate,g.wave,n.gateKillKey,{credits:n.reward,xp:n.xpReward,uridium:n.uridiumReward,honor:n.honorReward})).then(async r=>{if(!r.duplicate)await accounts.missionEvent(p.accountId,'alien',n.name).catch(()=>{});if(r.balance){Object.assign(p,{credits:Number(r.balance.credits),experience:Number(r.balance.experience),level:Number(r.balance.level)});io.to(p.id).emit('notice',n.name+' eliminado · +'+n.uridiumReward+' uridium');}});p.writes=job;pending.add(job);job.then(()=>pending.delete(job),()=>{pending.delete(job);if(players.get(p.id)===p&&p.gate===g&&!p.gatePending){returnFromGate(p);io.to(p.id).emit('v14:gateState',{inside:false});io.to(p.id).emit('notice','No se pudo guardar el enemigo. Vuelve a entrar.');}});if(!deferGate&&!([...npcs.values()].some(x=>sameZone(p,x)&&!x.gateShielded)))nextGateGroup(p);return;}awardGroup(p,n.reward,n.xpReward??(n.type==='boss'?500:50),n.name+' eliminado',n.uridiumReward||0,n.honorReward||0).catch(()=>{});missionEvent(p,'alien',n.name);if(n.mapNPC)later(()=>spawnMapNPC(n.name,n.zone),5000);}}
 function setPetMode(p,mode){
  p.petMode=mode;p.petUntil=0;p.petX=null;p.petY=null;p.petGeneration=(p.petGeneration||0)+1;
  io.to(p.id).emit('v14:petState',{mode:'off',fuel:p.petFuel??null,pending:mode!=='off'});
 }
 // Section groups spawn in order. Protegit combat statistics remain provisional.
 function clearGateNPCs(p){for(const [id,n] of npcs)if(n.zone===p.zone&&p.zone!=='world')npcs.delete(id);for(const [id,m] of mines)if(m.zone===p.zone&&p.zone!=='world')mines.delete(id);}
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
  for(let i=0;i<count;i++){
   const killKey=groupIndex+':'+i;if(p.gate.kills.includes(killKey))continue;
   const a=i*Math.PI*2/count,n=spawnNPC(false,{x:WORLD.w/2+Math.cos(a)*850,y:WORLD.h/2+Math.sin(a)*850});
   n.zone=p.zone;n.name=name;n.target=p.id;n.gateNPC=true;n.hp=n.maxHp=base.hp*scale;n.shield=n.maxShield=base.shield*scale;n.damage=base.damage*scale;n.speed=base.speed;
   n.reward=base.credits*scale;n.xpReward=base.xp*scale;n.uridiumReward=base.uridium*scale;n.honorReward=base.honor*scale;n.gateShielded=shielded;n.gateKillKey=killKey;spawned++;
  }
  return spawned;
 }
 function nextGateGroup(p){
  if(!p.gate||p.gatePending||p.gateWaiting||p.gate.closed)return;
  const g=p.gate,queue=g.groups||[];
  while(queue.length){const [group,index]=queue.shift();if(spawnGateGroup(p,group,index))return;}
  const remaining=[...npcs.values()].filter(n=>sameZone(p,n));
  if(remaining.length){for(const n of remaining)n.gateShielded=false;return;}
  saveGate(p,'clear');
 }
 function gateWave(p,withCountdown=true){
  if(!p.gate)return;
  const g=p.gate,def=DEFS[g.gate];if(g.countdownPending||g.completed)return;g.countdownPending=true;
  if(g.gate==='hades')for(const member of groupPilots(g))member.gateWaiting=false;
  else p.gateWaiting=false;
  const launch=()=>{
   if(players.get(p.id)!==p||p.gate!==g||p.gateWaiting)return;
   g.countdownPending=false;
   const groups=WAVES[g.gate][g.wave];
   if(!Array.isArray(groups)||!groups.length){returnFromGate(p);io.to(p.id).emit('notice','Esta sección aún no está disponible');return;}
   g.groups=groups.map((group,i)=>[group,i]).filter(([group])=>!group[3]);
   for(const [group,index] of groups.map((group,i)=>[group,i]).filter(([group])=>group[3]))spawnGateGroup(p,group,index);
   nextGateGroup(p);
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
  const job=g.writes.then(fn);g.writes=job;
  for(const p of groupPilots(g))p.writes=job;
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
   if(outcome==='death'){const dead=players.get(deadId);if(dead?.gate===g){dead.hp=dead.maxHp;dead.shield=dead.maxShield;dead.lastHit=Date.now();dead.dest=null;dead.target=null;dead.attack=false;dead.protectedUntil=Date.now()+3000;setPetMode(dead,'off');}groupState(g,'combat');}
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
   if(r.complete){if(r.payout?.balance)Object.assign(p,{credits:Number(r.payout.balance.credits),experience:Number(r.payout.balance.experience),level:Number(r.payout.balance.level),honor:Number(r.payout.balance.honor)});io.to(p.id).emit('v17:gateReward',{gate:r.gate,completion:r.completions,payout:r.payout});gateIntermission(p,true);}
   else if(outcome==='death'||r.failed){if(r.payout?.balance)Object.assign(p,{credits:Number(r.payout.balance.credits),experience:Number(r.payout.balance.experience),level:Number(r.payout.balance.level)});returnFromGate(p,outcome==='death');refreshGalaxy(p).catch(()=>{});io.to(p.id).emit('v14:gateState',{inside:false,...r});io.to(p.id).emit('notice',r.complete?DEFS[r.gate].name+' completada · +'+r.payout.uridium+' uridium':r.failed?'Puerta perdida':'Vida perdida · vuelve a entrar desde Portales');}
   else{p.gate={gate:r.gate,wave:r.wave,lives:r.lives,kills:[]};gateIntermission(p);}
  }).catch(()=>{if(players.get(p.id)===p){returnFromGate(p,outcome==='death');io.to(p.id).emit('v14:gateState',{inside:false});io.to(p.id).emit('notice','No se pudo guardar la puerta. Vuelve a entrar.');}}).finally(()=>{p.gatePending=false;pending.delete(job);});
  p.writes=job;pending.add(job);
 }
 const publicPlayer=p=>({id:p.id,name:p.name,godAllowed:!!p.godAllowed,godMode:!!p.godMode,cpus:p.cpus||[],robot:p.robot,repairOn:!!p.repairOn,cloaked:!!p.cloaked,ishUntil:p.ishUntil||0,mineUntil:p.mineUntil||0,abilities:p.abilities||{},jamUntil:p.jamUntil||0,mineralUpgrades:p.mineralUpgrades||{},clanTag:p.clanTag||'',ship:p.ship,design:p.design||null,company:p.company,companyChosen:p.companyChosen,honor:p.honor,x:p.x,y:p.y,angle:p.angle,hp:p.hp,maxHp:p.maxHp,shield:p.shield,maxShield:p.maxShield,credits:p.credits,experience:p.experience,level:p.level,target:p.target,attack:p.attack,deadUntil:p.deadUntil,pet:p.petUntil>Date.now()&&p.petMode!=='off'&&!p.deadUntil?{mode:p.petMode,x:p.petX,y:p.petY}:null});
 function missionEvent(p,type,target,count=1){
  const job=p.writes.catch(()=>{}).then(()=>accounts.missionEvent(p.accountId,type,target,count));p.writes=job;pending.add(job);job.then(()=>pending.delete(job),()=>{pending.delete(job);io.to(p.id).emit('notice','No se pudo guardar el progreso de misión');});return job;
 }
 function collectCargo(p,b,byPet){
  if(closing||b.pending||boxes.get(b.id)!==b||p.cargoBusy||p.cargoRetry>Date.now())return;
  b.pending=true;p.cargoBusy=true;
  const job=p.writes.catch(()=>{}).then(async()=>{
   const r=await accounts.collectMinerals(p.accountId,b.contents,b.owner);p.honor=Number(r.balance.honor);
   if(!Object.keys(r.taken).length){p.cargoRetry=Date.now()+5000;io.to(p.id).emit('notice','Bodega llena');return;}
   for(const [k,n] of Object.entries(r.taken)){b.contents[k]-=n;if(b.contents[k]<=0)delete b.contents[k];}
   if(!Object.keys(b.contents).length){boxes.delete(b.id);if(b.kind==='paladio')later(spawnPalladium,6500);}
   else p.cargoRetry=Date.now()+3000;
   io.to(p.id).emit('notice',(byPet?'P.E.T.':'Carga')+': '+Object.entries(r.taken).map(([k,n])=>n+' '+k).join(' · ')+(r.penalty?' · Honor -'+r.penalty:''));
  });p.writes=job;pending.add(job);job.catch(()=>{p.cargoRetry=Date.now()+3000;io.to(p.id).emit('notice','No se pudo recoger la carga');}).finally(()=>{b.pending=false;p.cargoBusy=false;pending.delete(job);});
 }
 function collectBox(p,b,byPet=false){
  if(b.kind==='cargo'||b.kind==='paladio'){collectCargo(p,b,byPet);return;}
  if(!boxes.delete(b.id))return;
  if(closing)return;
  const job=p.writes.catch(()=>{}).then(async()=>{
   const r=await accounts.awardBox(p.accountId,b.zone,p.level);p.credits=Number(r.balance.credits);await accounts.missionEvent(p.accountId,'box','bonus').catch(()=>{});
   const label=({'credits':'créditos','uridium':'uridium','gate-energy':'energía de puerta'})[r.loot.code]||r.loot.code;
   io.to(p.id).emit('notice',(byPet?'P.E.T.':'Caja')+': +'+r.loot.quantity+' '+label);
   io.to(p.id).emit('v14:loot',r);
  });
  p.writes=job;pending.add(job);
  job.then(()=>{pending.delete(job);later(()=>spawnBox(point(),b.zone),6500);},()=>{pending.delete(job);later(()=>spawnBox(point(),b.zone),6500);io.to(p.id).emit('notice','No se pudo confirmar la recompensa');});
 }
 function awardGroup(p,credits,xp,message,uridium=0,honor=0){
  const ids=(groups.status(p.id)?.members||[p.id]).filter(id=>{const m=players.get(id);return m&&sameZone(p,m)&&!m.deadUntil&&!m.gate;});if(!ids.includes(p.id))ids.push(p.id);
  const shares=[credits,xp,uridium,honor].map(n=>groups.split(n,ids,p.id));return Promise.allSettled(ids.map(id=>award(players.get(id),shares[0][id],shares[1][id],message,shares[2][id],shares[3][id])));
 }
 function award(p,credits,xp,message,uridium=0,honor=0){if(closing)return Promise.reject(Error('Servidor cerrando'));const job=p.writes.catch(()=>{}).then(async()=>{const r=await accounts.reward(p.accountId,credits,xp,uridium,honor);Object.assign(p,{credits:Number(r.credits),experience:Number(r.experience),level:Number(r.level),honor:Number(r.honor??p.honor)});io.to(p.id).emit('notice',message+(xp?` · +${xp} EXP`:''));return p.credits;});p.writes=job;pending.add(job);job.then(()=>pending.delete(job),()=>{pending.delete(job);io.to(p.id).emit('notice','No se pudo confirmar una recompensa en la base de datos.');});return job;}
 app.disable('x-powered-by');app.use((req,res,next)=>{res.set({'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self' ws: wss:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"});next();});app.use(express.json({limit:'8kb'}));accounts.endpoints(app);
 app.get('/health',async(req,res)=>{try{await accounts.ready();res.json({ok:true,database:true,players:players.size});}catch{res.status(503).json({ok:false,database:false});}});
 app.get('/admin',(req,res)=>{res.set('Cache-Control','no-store').sendFile(path.join(__dirname,'public','admin.html'));});
 const admin=(req,res,next)=>{res.set('Cache-Control','no-store');if(!password)return res.status(503).json({error:'ADMIN_PASSWORD no configurada'});const now=Date.now();for(const[k,v]of attempts)if(v.until<now)attempts.delete(k);const key='global',a=attempts.get(key)||{count:0,until:now+60000};if(a.count>=20)return res.status(429).json({error:'Demasiados intentos. Reintenta en un minuto.'});const supplied=req.get('Authorization')||'',hash=s=>crypto.createHash('sha256').update(s).digest();if(!crypto.timingSafeEqual(hash(supplied),hash('Bearer '+password))){a.count++;attempts.set(key,a);return res.status(401).json({error:'Contraseña incorrecta'});}next();};
 app.get('/api/admin/players',admin,(req,res)=>res.json({players:[...players.values()].map(publicPlayer),npcs:npcs.size,boxes:boxes.size}));
 app.post('/api/admin/credits',admin,async(req,res)=>{const{playerId,amount}=req.body||{},p=players.get(playerId);if(!p||!Number.isSafeInteger(amount)||amount<1||amount>1000000||!Number.isSafeInteger(p.credits+amount))return res.status(400).json({error:'Jugador o monto inválido'});try{const credits=await award(p,amount,0,`Administración: +${amount} créditos`);res.json({ok:true,credits});}catch{res.status(503).json({error:'No se pudo confirmar el guardado'});}});
 app.post('/api/admin/boss',admin,(req,res)=>{if(npcs.size>=100||[...npcs.values()].filter(n=>n.type==='boss').length>=5)return res.status(409).json({error:'Límite de enemigos o jefes alcanzado'});const p=players.get(req.body?.playerId),pos=p?{x:clamp(p.x+650,80,WORLD.w-80),y:p.y}:{x:WORLD.w/2+700,y:WORLD.h/2};const n=spawnNPC(true,pos);n.zone=p&&!p.gate?p.zone:'1-1';initMap(n.zone);io.to(n.zone).emit('notice','¡Un TITAN ha aparecido en el sector!');res.json({ok:true,id:n.id,x:n.x,y:n.y});});app.use(express.static(path.join(__dirname,'public')));
 io.on('connection',socket=>{let budget=50,windowStart=Date.now(),joining=false;const allowed=()=>{const now=Date.now();if(now-windowStart>=1000){budget=50;windowStart=now;}return --budget>=0;};
 socket.on('join',async(data,ack)=>{if(typeof ack!=='function'||!allowed()||joining||closing)return;if(players.has(socket.id))return ack({ok:true,id:socket.id,world:WORLD});if(players.size>=40)return ack({ok:false,error:'Servidor lleno (40 pilotos)'});joining=true;try{const a=await accounts.authenticate(socket.handshake.headers);if(!socket.connected)return;if(!a)return ack({ok:false,error:'Inicia sesión o regístrate primero'});if(active.has(a.id))return ack({ok:false,error:'Cuenta ya conectada o guardando. Reintenta.'});if(players.size>=40||closing)return ack({ok:false,error:'Servidor no disponible'});const ship=Object.hasOwn(SHIPS,a.ship)?a.ship:'scout',s=SHIPS[ship];const p={id:socket.id,accountId:a.id,name:a.username,godAllowed:a.id==='14733365-e185-4d81-90a8-b3c95baf0af7',godMode:false,ship,maxHp:s.hp,maxShield:s.shield,speed:s.speed,damage:s.damage,credits:Number(a.credits),experience:Number(a.experience),level:Number(a.level),honor:Number(a.honor),lastShot:0,writes:Promise.resolve()};const loadout=await accounts.combatLoadout?.(a.id);p.mineralUpgrades=(await accounts.upgradeStatus(a.id)).upgrades;p.baseSpeed=s.speed;p.baseShield=s.shield;const loc=await accounts.location(a.id);const daily=await accounts.dailyClaim(a.id);p.credits=Number(daily.balance.credits);p.company=loc.company;p.companyChosen=loc.company_chosen;p.zone=loc.map;initMap(p.zone);if(!socket.connected||closing||active.has(a.id)||players.size>=40)return ack({ok:false,error:'Cuenta o servidor no disponible'});applyLoadout(p,loadout);if(!loadout)applyMineralStats(p,p.mineralUpgrades);spawnPlayer(p);p.protectedUntil=Date.now()+3000;active.set(a.id,p);players.set(socket.id,p);socket.join(p.zone);ack({ok:true,id:socket.id,world:WORLD,map:p.zone});refreshGalaxy(p).catch(()=>{});if(!daily.already)io.to(p.id).emit('notice','Recompensa diaria '+daily.day+'/28 acreditada');}catch{ack({ok:false,error:'Base de datos no disponible'});}finally{joining=false;}});
 socket.on('move',data=>{const p=players.get(socket.id);if(!allowed()||!p||p.deadUntil||!validPoint(data))return;p.dest={x:clamp(data.x,25,WORLD.w-25),y:clamp(data.y,25,WORLD.h-25)};});socket.on('select',target=>{const p=players.get(socket.id);if(!allowed()||!p||p.deadUntil)return;const n=npcs.get(target)||players.get(target);p.target=n&&sameZone(p,n)&&distance(p,n)<1800&&(npcs.has(target)||canPvp(p,n)||groupMates(p,1800).includes(n))?n.id:null;p.attack=false;});socket.on('attack',on=>{const p=players.get(socket.id);if(!allowed()||!p||p.deadUntil||typeof on!=='boolean')return;const n=npcs.get(p.target)||players.get(p.target);p.attack=on&&!!n&&sameZone(p,n)&&!p.gatePending&&(npcs.has(p.target)||canPvp(p,n));if(p.attack)p.protectedUntil=0;});
 socket.on('v13:ammo',code=>{const p=players.get(socket.id);if(allowed()&&p&&catalogV13.ammo.some(a=>a.id===code))p.ammo=code;});
 socket.on('v18:cpu',(code,ack)=>{
  if(typeof ack!=='function'||!allowed())return;const p=players.get(socket.id),now=Date.now();
  if(!p||p.deadUntil||p.gatePending||p.gateWaiting||p.upgradePending||p.shotPending||p.reloadPending)return ack({ok:false,error:'CPU no disponible ahora'});
  if(code==='repair'){if(!p.robot)return ack({ok:false,error:'Equipa un robot primero'});p.repairOn=!p.repairOn;return ack({ok:true,repairOn:p.repairOn});}
  if(!p.cpus?.includes(code)||!['ISH-01','SMB-01','CLO4K-CPU','CLO4K-XL-CPU'].includes(code))return ack({ok:false,error:'Equipa el CPU en el hangar'});
  const mineBased=['ISH-01','SMB-01'].includes(code),zone=p.zone;
  if(mineBased&&now<(p.mineUntil||0))return ack({ok:false,error:'Minas en recarga'});
  if(code==='SMB-01'&&safeZone(p))return ack({ok:false,error:'No disponible en zona segura'});
  if(!mineBased&&(p.cloaked||abilityActive(p,'ultimate-cloak',now)))return ack({ok:false,error:'Ya estás camuflado'});
  p.upgradePending=true;const job=p.writes.catch(()=>{}).then(()=>accounts.useCpu(p.accountId,code));p.writes=job;pending.add(job);
  job.then(remaining=>{
   if(mineBased)p.mineUntil=Date.now()+(p.cpus.includes('MIN-T02')?30000:60000);
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
   const cd=p.cpus?.includes('MIN-T02')?MR.cooldownMs/2:MR.cooldownMs;p.mineUntil=Date.now()+cd;breakCloak(p);io.to(p.id).emit('v13:ammoStock',{code,quantity:stock});
   if(players.get(p.id)===p&&!p.deadUntil&&!p.gatePending&&p.zone===zone)spawnMine(zone,pos,code,p.id);
   ack({ok:true,stock,cooldown:cd});
  }).catch(()=>ack({ok:false,error:'No se pudo colocar la mina'})).finally(()=>{p.upgradePending=false;pending.delete(job);});
 });
 socket.on('v18:ordnance',(code,ack)=>{
  if(typeof ack!=='function'||!allowed())return;
  const p=players.get(socket.id),special=catalogV13.specialRockets.find(r=>r.id===code),shell=catalogV13.launcherAmmo.find(r=>r.id===code);
  if(!p||(!special&&!shell)||p.deadUntil||p.gatePending||p.gateWaiting||p.shotPending||p.upgradePending||p.reloadPending)return ack({ok:false,error:'Arma no disponible ahora'});
  const n=npcs.get(p.target)||players.get(p.target),pvp=!!n&&players.get(n.id)===n;
  if(!n||n.gateShielded||!sameZone(p,n)||distance(p,n)>600||(pvp&&!canPvp(p,n)))return ack({ok:false,error:'Selecciona un objetivo válido a menos de 600 unidades'});
  const launcher=catalogV13.launchers.find(l=>l.id===p.launcher);
  if(shell&&!launcher)return ack({ok:false,error:'Equipa un Hellstorm en el hangar'});
  const key=special?code:'hellstorm',cooldown=special?special.cooldown:5000,count=special?1:launcher.capacity,zone=p.zone;
  p.ordnanceUntil??={};
  if(Date.now()<(p.ordnanceUntil[key]||0))return ack({ok:false,error:'Arma en recarga'});
  p.upgradePending=true;
  const job=p.writes.catch(()=>{}).then(()=>accounts.consumeOrdnance(p.accountId,code,count));p.writes=job;pending.add(job);
  job.then(stock=>{
   if(stock===null)return ack({ok:false,error:'Necesitas '+count+' '+code});
   p.ordnanceUntil[key]=Date.now()+cooldown;breakCloak(p);
   io.to(p.id).emit('v13:ammoStock',{code,quantity:stock});
   if(players.get(p.id)!==p||p.deadUntil||p.gatePending||p.zone!==zone||!sameZone(p,n)||distance(p,n)>600||n.gateShielded||(pvp?players.get(n.id)!==n||!canPvp(p,n):npcs.get(n.id)!==n))return ack({ok:true,damage:0,stock,cooldown,count,key});
   io.to(zone).emit('laser',{x:p.x,y:p.y,tx:n.x,ty:n.y,kind:'rocket'});
   let amount=0;
   if(!immune(n)){
    if(special){const field={accuracy:'accuracyUntil',slow:'slowUntil',freeze:'freezeUntil'}[special.effect];n[field]=Math.max(n[field]||0,Date.now()+special.duration);if(!pvp)n.target=p.id;}
    else{const scale=(pvp?damageFactor(p.honor):1)*markFactor(p,n,Date.now());const drain=Math.min(n.shield,Math.round((shell.drain||0)*count*scale));n.shield-=drain;p.shield=Math.min(p.maxShield,p.shield+drain);amount=Math.round((shell.damage||0)*count*scale);if(amount)damage(n,amount);if(drain||amount)finishCombat(p,n,pvp);}
   }
   ack({ok:true,damage:amount,stock,cooldown,count,key,effect:n.godMode?null:special?.effect||null});
  }).catch(()=>ack({ok:false,error:'No se pudo confirmar el disparo'})).finally(()=>{p.upgradePending=false;pending.delete(job);});
 });
 socket.on('v18:rocket',(code,ack)=>{
  if(typeof ack!=='function'||!allowed())return;
  const p=players.get(socket.id),rocket=catalogV13.rockets.find(r=>r.id===code);
  if(!p||!rocket||p.deadUntil||p.gatePending||p.gateWaiting||p.shotPending||p.upgradePending)return ack({ok:false,error:'Cohete no disponible ahora'});
  const n=npcs.get(p.target)||players.get(p.target),pvp=!!n&&players.get(n.id)===n;
  if(!n||n.gateShielded||!sameZone(p,n)||distance(p,n)>600||(pvp&&!canPvp(p,n)))return ack({ok:false,error:'Selecciona un objetivo válido a menos de 600 unidades'});
  if(Date.now()<(p.rocketUntil||0))return ack({ok:false,error:'Cohete en recarga'});
  const zone=p.zone;p.upgradePending=true;
  const job=p.writes.catch(()=>{}).then(()=>accounts.upgradedShot(p.accountId,code,1,'rocket'));
  p.writes=job;pending.add(job);
  job.then(shot=>{
   if(!shot)return ack({ok:false,error:'No tienes '+code});
   const cd=p.cpus?.includes('R0K-T01')?1000:2000;p.rocketUntil=Date.now()+cd;breakCloak(p);applyMineralStats(p,shot.upgrades);
   io.to(p.id).emit('v13:ammoStock',{code,quantity:shot.stock});
   if(players.get(p.id)!==p||p.deadUntil||p.gatePending||p.zone!==zone||!sameZone(p,n)||distance(p,n)>600||n.gateShielded||(pvp?!canPvp(p,n):npcs.get(n.id)!==n))return ack({ok:true,damage:0,stock:shot.stock,cooldown:cd});
   const amount=Math.random()<1-(1-rocket.miss)*(p.accuracyUntil>Date.now()?.6:1)?0:Math.round(rocket.damage*shot.factor*markFactor(p,n,Date.now())*(pvp?damageFactor(p.honor):1));
   io.to(zone).emit('laser',{x:p.x,y:p.y,tx:n.x,ty:n.y,kind:'rocket'});
   if(amount&&!immune(n)){damage(n,amount);finishCombat(p,n,pvp);}
   ack({ok:true,damage:n.godMode?0:amount,stock:shot.stock,cooldown:cd});
  }).catch(()=>ack({ok:false,error:'No se pudo confirmar el disparo'})).finally(()=>{p.upgradePending=false;pending.delete(job);});
 });
 socket.on('v13:reload',()=>{const p=players.get(socket.id);if(!allowed()||!p)return;p.reloadRequested=true;p.attack=false;io.to(p.id).emit('notice','Equipamiento guardado. Activando configuración…');});

 socket.on('v18:upgrade',async(data,ack)=>{
  if(typeof ack!=='function'||!allowed())return;const p=players.get(socket.id);if(!p||p.deadUntil||p.gatePending||p.upgradePending||p.shotPending)return ack({ok:false,error:'Espera a que termine la acción actual'});
  p.upgradePending=true;const job=p.writes.catch(()=>{}).then(()=>accounts.chargeMineral(p.accountId,data));p.writes=job;pending.add(job);
  try{const r=await job;if(players.get(p.id)!==p)return;applyMineralStats(p,r.upgrades);p.nextGeneratorRound=Date.now()+10000;ack({ok:true,...r});}
  catch(e){ack({ok:false,error:e.status?e.message:'No se pudo cargar el mineral'});}finally{p.upgradePending=false;pending.delete(job);}
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
  const p=players.get(socket.id);if(!allowed()||!p||p.deadUntil||p.gatePending||p.gateWaiting||p.petPending||p.kamiPending)return;
  const now=Date.now();if((p.kamiUntil||0)>now){io.to(p.id).emit('notice','Kamikaze: espera '+Math.ceil((p.kamiUntil-now)/1000)+' s');return;}
  if(p.petMode==='off'||p.petUntil<=now||!Number.isFinite(p.petX)||!Number.isFinite(p.petY)){io.to(p.id).emit('notice','Activa tu P.E.T. primero');return;}
  const zone=p.zone,generation=p.petGeneration;p.kamiPending=true;
  const job=accounts.petKamikaze(p.accountId).then(r=>{
   if(players.get(p.id)!==p||p.zone!==zone||p.deadUntil||p.gatePending||p.gateWaiting||p.petGeneration!==generation)return;
   const center={x:p.petX,y:p.petY};if(!Number.isFinite(center.x)||!Number.isFinite(center.y))return;
   p.petFuel=r.fuel;p.kamiUntil=Date.now()+KAMIKAZE.cooldown;setPetMode(p,'off');
   const targets=[...npcs.values()].filter(n=>sameZone(p,n)&&!n.gateShielded&&distance(center,n)<=KAMIKAZE.radius);
   let kills=0;for(const n of targets){damage(n,KAMIKAZE.damage);if(n.hp<=0)kills++;finishNPC(p,n,true);}
   io.to(zone).emit('v16:kamikazeEffect',{...center,radius:KAMIKAZE.radius});
   io.to(p.id).emit('notice','Kamikaze · '+targets.length+' NPC afectados · '+kills+' eliminados · recarga 10 s');
   if(targets.length&&p.gate&&!([...npcs.values()].some(n=>sameZone(p,n)&&!n.gateShielded)))nextGateGroup(p);
  }).catch(e=>io.to(p.id).emit('notice',e.status?e.message:'Kamikaze no disponible')).finally(()=>{p.kamiPending=false;pending.delete(job);});
  pending.add(job);
 });
 socket.on('v14:pet',mode=>{const p=players.get(socket.id);if(!allowed()||!p||!['off','passive','loot'].includes(mode))return;if(mode==='off'){setPetMode(p,mode);return;}if(p.deadUntil||p.petPending||p.petMode===mode)return;setPetMode(p,mode);});
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
    const member={id:p.id,name:p.name,wave:eligible.wave};
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
   const action=data?.action,old=groups.status(p.id)?.members||[p.id];let affected=[...old];
   if(action==='create')groups.create(p.id);
   else if(action==='invite'){const target=players.get(data.target);if(!target||p.gate||target.gate)throw Error('Piloto no disponible');groups.invite(p.id,target.id);affected.push(target.id);io.to(target.id).emit('notice',p.name+' te invitó a un grupo');}
   else if(action==='accept'){if(p.gate)throw Error('Sal de la puerta primero');const g=groups.accept(p.id,data.from);affected.push(...g.members);}
   else if(action==='leave')groups.leave(p.id);
   else if(action==='kick'){groups.kick(p.id,data.target);affected.push(data.target);}
   else if(action!=='status')throw Error('Acción inválida');
   notifyGroup(new Set(affected));ack({ok:true,...groupView(p.id)});
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
 socket.on('v14:jump',async(portalId,ack)=>{
  if(typeof ack!=='function'||!allowed())return;const p=players.get(socket.id);
  if(!p||p.gate||p.gatePending||p.deadUntil||p.shotPending||p.reloadPending)return ack({ok:false,error:'Salto no disponible'});
  const portal=portals(p.zone,WORLD.w,WORLD.h).find(x=>x.id===portalId);
  if(!portal||distance(p,portal)>180)return ack({ok:false,error:'Acércate al portal'});
  const level=requiredLevel(portal,p.company);if(p.level<level)return ack({ok:false,error:'Necesitas nivel '+level});
  p.gatePending=true;p.attack=false;p.dest=null;
  try{await accounts.saveLocation(p.accountId,p.company,portal.to);if(players.get(p.id)!==p)return;
   const arrival=portals(portal.to,WORLD.w,WORLD.h).find(x=>x.to===portal.from);changeMap(p,portal.to,arrival);missionEvent(p,'map',portal.to);p.protectedUntil=Date.now()+3000;ack({ok:true,map:p.zone});
  }catch{ack({ok:false,error:'No se pudo guardar el salto'});}finally{p.gatePending=false;}
 });
 socket.on('v14:gateNext',()=>{const p=players.get(socket.id);if(allowed()&&p?.gateWaiting)io.to(p.id).emit('notice','La siguiente ronda comienza automáticamente');});
 socket.on('v14:gateLeave',()=>{const p=players.get(socket.id);if(allowed()&&p?.gate&&p.gateWaiting&&!p.gatePending&&!p.shotPending&&!p.deadUntil&&p.gate.exitPortal&&Date.now()<p.gate.intermissionUntil){if(distance(p,p.gate.exitPortal)>125){io.to(p.id).emit('notice','Acércate al portal de salida');return;}if(p.gate.gate==='hades'){if(p.gate.leader===p.id)endHades(p.gate,'El grupo regresó a la base');}else{returnFromGate(p);refreshGalaxy(p).catch(()=>{});socket.emit('v14:gateState',{inside:false});}}});
 socket.on('disconnect',()=>{const p=players.get(socket.id);if(p?.gate?.gate==='hades')endHades(p.gate,'Hades en pausa: un piloto se desconectó');else if(p?.gate)clearGateNPCs(p);broadcastHades(hadesLobbies.leave(socket.id));const oldGroup=groups.status(socket.id)?.members||[];groups.leave(socket.id);players.delete(socket.id);notifyGroup(oldGroup);if(p)p.writes.catch(()=>{}).finally(()=>{if(active.get(p.accountId)===p)active.delete(p.accountId);});});});
 // Run independently of simulation; never overlap or block a simulation tick.
 let maintenanceBusy=false;
 const maintenance=setInterval(()=>{
  if(closing||maintenanceBusy)return;maintenanceBusy=true;
  const job=(async()=>{
   const charges=await accounts.collectClanTaxes();
   for(const charge of charges){const p=active.get(charge.id);if(p){io.to(p.id).emit('notice','Impuesto del clan: '+charge.credits+' créditos / '+charge.uridium+' uridium');}}
   const tags=await accounts.clanTags([...active.keys()]);const byId=new Map(tags.map(t=>[t.account_id,t.tag]));
   for(const p of players.values())p.clanTag=byId.get(p.accountId)||'';
  })();pending.add(job);job.catch(e=>console.error('Maintenance:',e.code||e.message)).finally(()=>{maintenanceBusy=false;pending.delete(job);});
 },30000);
 let last=Date.now();const loop=setInterval(()=>{if(closing)return;const now=Date.now(),dt=Math.min((now-last)/1000,.1);last=now;
 for(const p of players.values()){if(p.gatePending)continue;if(p.deadUntil){if(now>=p.deadUntil){const home=p.company+'-1';changeMap(p,home);spawnPlayer(p);p.protectedUntil=Date.now()+3000;const job=p.writes.catch(()=>{}).then(()=>accounts.saveLocation(p.accountId,p.company,home));p.writes=job;pending.add(job);job.then(()=>pending.delete(job),()=>pending.delete(job));}else continue;}if(p.reloadRequested&&!p.reloadPending&&!p.shotPending){p.reloadRequested=false;p.reloadPending=true;p.attack=false;const job=Promise.resolve().then(()=>accounts.combatLoadout(p.accountId)).then(l=>{if(players.get(p.id)!==p)return;if(p.deadUntil){p.reloadRequested=true;return;}if(!l)throw Error('Sin configuración guardada');applyLoadout(p,l);io.to(p.id).emit('notice','Configuración '+(l.active+1)+' activa · '+l.lasers+' láseres');io.to(p.id).emit('v13:loadoutApplied',{active:l.active,lasers:l.lasers,damage:l.damage});}).catch(()=>{if(players.get(p.id)===p)io.to(p.id).emit('notice','No se pudo activar el equipo. Guarda de nuevo en el hangar.');}).finally(()=>{p.reloadPending=false;pending.delete(job);});pending.add(job);}generatorTick(p,now);abilityTick(p,now,dt);move(p,p.dest,dt);if(p.dest&&distance(p,p.dest)<2)p.dest=null;if(now-p.lastHit>6500)p.shield=Math.min(p.maxShield,p.shield+35*dt);
 if(p.petMode&&p.petMode!=='off'&&now>=p.petUntil&&!p.petPending){
  const mode=p.petMode,generation=p.petGeneration;p.petPending=true;
  const job=accounts.petInterval(p.accountId,mode).then(result=>{
   if(closing||players.get(p.id)!==p||p.deadUntil||p.petGeneration!==generation)return;
   p.petFuel=result.fuel;p.petUntil=Date.now()+10000;
   if(!Number.isFinite(p.petX)||!Number.isFinite(p.petY)||Math.hypot(p.petX-p.x,p.petY-p.y)>850){p.petX=p.x-55*Math.cos(p.angle);p.petY=p.y-55*Math.sin(p.angle);}
   io.to(p.id).emit('v14:petState',{mode,fuel:p.petFuel,pending:false});
  }).catch(e=>{if(players.get(p.id)!==p||p.petGeneration!==generation)return;setPetMode(p,'off');io.to(p.id).emit('notice',e.status===400?e.message:'P.E.T. no disponible');}).finally(()=>{p.petPending=false;pending.delete(job);});pending.add(job);
 }
 if(p.petUntil>now&&p.petMode!=='off'){
  let targetBox=null,best=700;
  if(p.petMode==='loot'&&!p.gate)for(const b of boxes.values()){if(!sameZone(p,b)||b.pending||(b.kind==='cargo'&&b.owner!==p.accountId))continue;const d=distance(p,b);if(d<best){best=d;targetBox=b;}}
  const goal=targetBox||{x:p.x-70*Math.cos(p.angle),y:p.y-70*Math.sin(p.angle)};
  if(Math.hypot(p.petX-p.x,p.petY-p.y)>850){p.petX=p.x;p.petY=p.y;}
  const dx=goal.x-p.petX,dy=goal.y-p.petY,len=Math.hypot(dx,dy);
  if(len>1){const step=Math.min(len,Math.max(550,p.speed+100)*dt);p.petX+=dx/len*step;p.petY+=dy/len*step;}
  if(targetBox&&Math.hypot(p.petX-targetBox.x,p.petY-targetBox.y)<35)collectBox(p,targetBox,true);
 }
 if(!p.gate)for(const b of boxes.values())if(sameZone(p,b)&&distance(p,b)<52)collectBox(p,b);
 const n=npcs.get(p.target)||players.get(p.target),pvp=!!n&&players.get(n.id)===n;if(!n||!sameZone(p,n)||(pvp&&!canPvp(p,n)&&!groupMates(p,1800).includes(n))){p.target=null;p.attack=false;}else if(p.attack&&(!pvp||canPvp(p,n))&&!p.reloadPending&&!p.reloadRequested&&distance(p,n)<=(p.v13?600:650)&&now-p.lastShot>=(p.v13?(catalogV13.ammo.find(a=>a.id===p.ammo)?.intervalMs||1000):450)&&!p.shotPending&&!p.upgradePending){
 p.lastShot=now;breakCloak(p);
 const finish=()=>finishCombat(p,n,pvp);
 if(n.gateShielded){p.attack=false;io.to(p.id).emit('notice','El jefe está protegido: elimina los demás alienígenas');}
 else if(!p.v13){p.angle=Math.atan2(n.y-p.y,n.x-p.x);laser(p,n);damage(n,p.damage*(pvp?damageFactor(p.honor):1));finish();}
 else if(!p.lasers){p.attack=false;io.to(p.id).emit('notice','Equipa un láser en el hangar');}
 else{p.shotPending=true;const ammo=p.ammo,count=p.lasers;const job=accounts.upgradedShot(p.accountId,ammo,count).then(shot=>{const stock=shot?.stock??null;if(shot)applyMineralStats(p,shot.upgrades);
 if(stock===null){p.attack=false;io.to(p.id).emit('notice','Munición insuficiente');return;}
 io.to(p.id).emit('v13:ammoStock',{code:ammo,quantity:stock});
 if(closing||players.get(p.id)!==p||p.deadUntil||p.gatePending||!p.attack||p.target!==n.id||distance(p,n)>600||(pvp?players.get(n.id)!==n||!canPvp(p,n):npcs.get(n.id)!==n))return;
 const result=salvo({...p,accuracyFactor:p.accuracyUntil>Date.now()?.6:1,damage:p.damage*shot.factor*markFactor(p,n,Date.now())*incoming(n,Date.now())*(abilityActive(p,'prism',Date.now())?.75:1)*(abilityActive(n,'prism',Date.now())?.1:1)*(pvp?damageFactor(p.honor):1)},n,ammo,stock+count,Math.random());p.angle=Math.atan2(n.y-p.y,n.x-p.x);laser(p,n);if(!immune(n)){if(result.damage>0){const resolved=hit(n,protectDamage(n,result.damage),n.absorption??.5);const shieldLoss=n.shield-resolved.shield;resolved.shield=Math.max(0,n.shield-shieldLoss*(n.weakenUntil>Date.now()?1.5:1)*(abilityActive(n,'fortress',Date.now())?.7:1));Object.assign(n,resolved);}else if(result.drained>0){const drained=protectDamage(n,result.drained);n.shield=Math.max(0,n.shield-drained);p.shield=Math.min(p.maxShield,p.shield+drained);}finish();}
 }).catch(()=>{p.attack=false;io.to(p.id).emit('notice','No se pudo confirmar el consumo de munición');}).finally(()=>{p.shotPending=false;pending.delete(job);});pending.add(job);}
 }}
 for(const n of npcs.values()){let target=players.get(n.target);if(!target||target.cloaked||abilityActive(target,'ultimate-cloak',now)||target.deadUntil||target.gatePending||safeZone(target)||!sameZone(n,target)||(!n.gateNPC&&distance(n,target)>1000)){target=null;let best=n.gateNPC?Infinity:n.type==='boss'?850:310;for(const p of players.values()){const d=distance(n,p);if(!p.deadUntil&&!p.gatePending&&!safeZone(p)&&!p.cloaked&&!abilityActive(p,'ultimate-cloak',now)&&sameZone(p,n)&&d<best){target=p;best=d;}}n.target=target?.id||null;}if(target){const d=distance(n,target);if(d>270)move(n,target,dt);else n.angle=Math.atan2(target.y-n.y,target.x-n.x);if(d<460&&now-n.lastShot>1100&&!safeZone(target)&&!(target.protectedUntil>now)){n.lastShot=now;laser(n,target);if(!(n.accuracyUntil>now)||Math.random()<.6)damage(target,n.damage);if(target.hp<=0){if(target.gate){saveGate(target,'death');continue;}target.deadUntil=now+4000;setPetMode(target,'off');target.attack=false;target.target=null;target.dest=null;io.to(target.id).emit('notice','Nave destruida. Reaparición en 4 segundos.');}}}else if(!n.gateNPC){if(distance(n,n.dest)<8)n.dest=point();move(n,n.dest,dt);}}
 updateMines(now);
 if(++tick%2===0&&players.size)for(const zone of new Set([...players.values()].map(zoneOf)))for(const viewer of players.values())if(zoneOf(viewer)===zone)io.to(viewer.id).volatile.emit('state',{time:now,players:[...players.values()].filter(p=>zoneOf(p)===zone&&(p===viewer||!abilityActive(p,'ultimate-cloak',now))).map(publicPlayer),npcs:[...npcs.values()].filter(n=>zoneOf(n)===zone).map(({dest,lastShot,damage,reward,speed,lastHit,target,zone,...n})=>n),map:MAPS[zone]?zone:null,base:homeBase(zone,WORLD.w,WORLD.h),portals:MAPS[zone]?portals(zone,WORLD.w,WORLD.h):[],mines:[...mines.values()].filter(m=>m.zone===zone).map(({id,x,y,code,armedAt})=>({id,x,y,code,armedAt})),boxes:MAPS[zone]?[...boxes.values()].filter(b=>b.zone===zone).map(({id,x,y,kind})=>({id,x,y,kind})):[]});},50);
 async function close(){closing=true;clearInterval(loop);clearInterval(maintenance);for(const t of timers)clearTimeout(t);await new Promise(resolve=>io.close(resolve));await Promise.allSettled([...pending]);await accounts.close();}return{app,server,io,close};}
 if(require.main===module){const accounts=createAccounts(process.env.DATABASE_URL);accounts.ready().then(()=>{const game=createGame({accounts}),PORT=process.env.PORT||3000;game.server.listen(PORT,'0.0.0.0',()=>console.log(`GOLD GAMING escuchando en ${PORT}`));for(const sig of ['SIGTERM','SIGINT'])process.once(sig,()=>game.close().then(()=>process.exit(0)));}).catch(async e=>{console.error('No se pudo conectar a PostgreSQL:',e.code||e.message);await accounts.close();process.exitCode=1;});}module.exports={createGame,WORLD,SHIPS};
