'use strict';
// Gate NPCs only engage pilots in an active combat phase of their own instance.
function gatePilotEligible(n,p){
 if(!n?.gateNPC)return true;
 const g=p?.gate;
 return !!g&&!g.closed&&!g.completed&&!g.countdownPending&&!g.transition&&!p.gatePending&&!p.gateWaiting&&!p.deadUntil&&p.hp>0&&g.launchedWave===g.wave;
}
function npcPilotEligible(n,p,{now,sameZone,safeZone,cloaked}){
 return !!p&&p.hp>0&&!p.deadUntil&&!p.gatePending&&!p.cloaked&&!cloaked(p,now)&&sameZone(n,p)&&!safeZone(p)&&gatePilotEligible(n,p);
}
// Normal-map pursuit cap is per pilot, not per zone. Gate waves remain unlimited.
const NORMAL_PURSUIT_LIMIT=4;
function createNpcPursuitSlots(npcs,players,ctx,distance,isNormalMap){
 const occupied=new Map();
 const limited=n=>!n.gateNPC&&isNormalMap(n);
 const key=p=>p.id;
 const eligible=(n,p)=>npcPilotEligible(n,p,ctx)&&(!n.gateNPC?distance(n,p)<=1000:true);
 // Preserve existing eligible pursuers first; if a mass taunt overfills the
 // cap, retain the nearest four (with stable ordering for ties).
 const groups=new Map();
 for(const n of npcs){
  if(!limited(n)||!n.target)continue;
  const p=players.get(n.target);
  if(n.hp<=0||n.empUntil>ctx.now||!eligible(n,p)){n.target=null;continue;}
  if(!groups.has(key(p)))groups.set(key(p),[]);
  groups.get(key(p)).push(n);
 }
 for(const [id,list] of groups){
  const p=players.get(id);
  list.sort((a,b)=>distance(a,p)-distance(b,p));
  const keep=list.slice(0,NORMAL_PURSUIT_LIMIT);
  occupied.set(id,new Set(keep));
  for(const n of list.slice(NORMAL_PURSUIT_LIMIT))n.target=null;
 }
 return {
  available(n,p){const set=occupied.get(key(p));return !limited(n)||!set||set.has(n)||set.size<NORMAL_PURSUIT_LIMIT;},
  claim(n,p){if(!limited(n))return;if(!occupied.has(key(p)))occupied.set(key(p),new Set());occupied.get(key(p)).add(n);}
 };
}
module.exports={gatePilotEligible,npcPilotEligible,NORMAL_PURSUIT_LIMIT,createNpcPursuitSlots};
