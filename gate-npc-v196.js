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
module.exports={gatePilotEligible,npcPilotEligible};
