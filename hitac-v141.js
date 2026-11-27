'use strict';
const crypto=require('node:crypto'),NPCS=require('./data/npcs-v14.json');
const ROUTE=Object.freeze(['3-4','3-3','2-4','2-3','1-3','1-4']);
const RULES=Object.freeze({guards:6,speed:100,attackRange:670,aggroRange:1000,bossToggleMs:10000,guardToggleMs:20000,slowIntervalMs:5000,slowMs:4000,slowFactor:.7,slowRadius:700,explosionRadius:700,explosionDamage:100000,pingMs:30000});
const fail=message=>Object.assign(Error(message),{status:400}),dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function createConvoy(now=Date.now(),w=12000,h=8000){
 const id=crypto.randomUUID(),units=new Map();
 for(let i=0;i<=RULES.guards;i++){
  const name=i?'Hitac Minion':'Hitac Mothership',spec=NPCS[name],a=i*Math.PI*2/RULES.guards;
  units.set(id+':'+i,{id:id+':'+i,name,boss:i===0,offsetX:i?Math.cos(a)*300:0,offsetY:i?Math.sin(a)*300:0,x:600+(i?Math.cos(a)*300:0),y:h/2+(i?Math.sin(a)*300:0),hp:spec.hp,maxHp:spec.hp,shield:spec.shield,maxShield:spec.shield,damage:spec.damage,protected:true,nextSlow:now+RULES.slowIntervalMs});
 }
 return {id,phase:'active',routeIndex:0,map:ROUTE[0],w,h,x:600,y:h/2,startedAt:now,last:now,nextPing:now+RULES.pingMs,units,damageByPilot:new Map()};
}
function sync(c,now){for(const u of c.units.values()){u.x=c.x+u.offsetX;u.y=c.y+u.offsetY;u.protected=Math.floor((now-c.startedAt)/(u.boss?RULES.bossToggleMs:RULES.guardToggleMs))%2===0;}}
function advance(c,now=Date.now()){
 if(c.phase!=='active'||now<c.last)return;
 const dt=(now-c.last)/1000;c.last=now;
 // The event path is independent of regular portal topology. Use a provisional straight crossing.
 let travel=dt*RULES.speed;const length=c.w-1200;
 while(travel>0&&c.phase==='active'){
  const remaining=c.w-600-c.x;
  if(travel<remaining){c.x+=travel;break;}
  travel-=remaining;
  if(c.routeIndex===ROUTE.length-1){c.x=c.w-600;c.phase='escaped';break;}
  c.routeIndex++;c.map=ROUTE[c.routeIndex];c.x=600;
  if(length<=0)throw fail('Mapa inválido');
 }
 sync(c,now);
}
function pilotValid(c,p){return p&&p.zone===c.map&&!p.deadUntil&&!p.godMode&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.hp>0;}
function validateShot(c,p,id,now=Date.now()){advance(c,now);const u=c.units.get(id);if(c.phase!=='active'||!u||!pilotValid(c,p)||dist(p,u)>RULES.attackRange)throw fail('Ataque inválido');return u;}
function hit(c,p,id,damage,now=Date.now()){
 const u=validateShot(c,p,id,now);if(!Number.isSafeInteger(damage)||damage<=0)throw fail('Ataque inválido');
 if(u.protected)return {blocked:true,killed:false,damage:0};
 const absorbed=Math.min(u.shield,Math.floor(damage*.8)),hpLoss=Math.min(u.hp,damage-absorbed);
 u.shield-=absorbed;u.hp-=hpLoss;const dealt=absorbed+hpLoss;c.damageByPilot.set(p.id,(c.damageByPilot.get(p.id)||0)+dealt);
 if(u.hp>0)return {blocked:false,killed:false,damage:dealt};
 c.units.delete(id);if(u.boss)c.phase='defeated';
 return {blocked:false,killed:true,damage:dealt,reward:{credits:NPCS[u.name].credits,uridium:NPCS[u.name].uridium,xp:NPCS[u.name].xp,honor:NPCS[u.name].honor},explosion:u.boss?null:{x:u.x,y:u.y,radius:RULES.explosionRadius,damage:RULES.explosionDamage}};
}
function effects(c,pilots,now=Date.now()){
 advance(c,now);if(c.phase!=='active')return {slows:[],targets:[],ping:null};
 const eligible=pilots.filter(p=>pilotValid(c,p)),slows=new Map(),targets=[];
 for(const u of c.units.values()){
  const nearby=eligible.filter(p=>dist(p,u)<=RULES.aggroRange).sort((a,b)=>dist(a,u)-dist(b,u));
  if(nearby[0]&&dist(nearby[0],u)<=RULES.attackRange)targets.push({unitId:u.id,pilotId:nearby[0].id,damage:u.damage});
  if(!u.boss&&now>=u.nextSlow){u.nextSlow=now+RULES.slowIntervalMs;for(const p of eligible)if(dist(p,u)<=RULES.slowRadius)slows.set(p.id,{pilotId:p.id,factor:RULES.slowFactor,until:now+RULES.slowMs});}
 }
 let ping=null;if(now>=c.nextPing){c.nextPing=now+RULES.pingMs;ping={map:c.map,x:c.x,y:c.y};}
 return {slows:[...slows.values()],targets,ping};
}
function explosionTargets(c,explosion,pilots){if(!explosion)return [];return pilots.filter(p=>pilotValid(c,p)&&dist(p,explosion)<=explosion.radius).map(p=>({pilotId:p.id,damage:explosion.damage}));}
function view(c){return {id:c.id,phase:c.phase,map:c.map,routeIndex:c.routeIndex,units:[...c.units.values()].map(({id,name,x,y,hp,maxHp,shield,maxShield,protected:immune})=>({id,name,x,y,hp,maxHp,shield,maxShield,immune}))};}
function preview(){return {route:ROUTE,rules:RULES,boss:NPCS['Hitac Mothership'],guard:NPCS['Hitac Minion'],enabled:process.env.GG_HITAC_ENABLED==='1'};}
module.exports={ROUTE,RULES,createConvoy,advance,hit,effects,explosionTargets,view,preview,validateShot};
