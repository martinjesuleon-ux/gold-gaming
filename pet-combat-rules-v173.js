'use strict';
// No XP percentage is assumed from the reference table. Missing/invalid settings disable grants.
function xpPercent(raw){
 if(typeof raw!=='string'||!/^\d{1,3}$/.test(raw))return 0;
 const n=Number(raw);return n>=1&&n<=100?n:0;
}
function eligibleForNpcXp(p,now){
 return !!p&&!p.deadUntil&&p.hp>0&&!p.godMode&&!p.oneShot&&!p.gate&&!p.gatePending&&!p.ubaReturn&&!p.invasionReturn&&['passive','guard','loot'].includes(p.petMode)&&p.petUntil>now;
}
function petXpFromReward(xp,eligible,raw){
 const percent=xpPercent(raw);
 if(!eligible||!percent||!Number.isSafeInteger(xp)||xp<=0)return 0;
 return Number(BigInt(xp)*BigInt(percent)/100n);
}
// Guard defends its owner independently of their selected target or firing state.
function guardTarget(p,n,now,range){
 if(!p||p.petMode!=='guard'||p.petUntil<=now||p.hp<=0||p.deadUntil||p.gatePending||p.gateWaiting||p.ubaReturn||p.invasionReturn||p.petVitals?.destroyed||p.cloaked||p.safe||!n||n.target!==p.id||p.zone!==n.zone||n.hp<=0||n.gateShielded||n.accountId||n.godMode||n.empUntil>now||!Number.isFinite(range)||range<=0)return false;
 if(!Number.isFinite(n.lastShot)||now-n.lastShot>2500||n.lastShot>now)return false;
 return Math.hypot(p.petX-n.x,p.petY-n.y)<=range&&Math.hypot(p.x-n.x,p.y-n.y)<=range;
}
function selectGuardTarget(p,npcs,now,range){
 let best=null,dist=Infinity;
 for(const n of npcs){if(!guardTarget(p,n,now,range))continue;if(n.id===p.petLastHitNpc)return n;const d=Math.hypot(p.petX-n.x,p.petY-n.y);if(d<dist){best=n;dist=d;}}
 return best;
}
// Experimental NPC retaliation: only the NPC recently hit by this guard PET may target it.
function npcRetaliatesAgainstPet(p,n,now){
 return !!p?.petVitals?.enabled&&!p.petVitals.destroyed&&!p.petDamagePending&&p.petLastHitNpc===n?.id&&Number.isFinite(p.petLastAttackAt)&&now>=p.petLastAttackAt&&now-p.petLastAttackAt<=3000&&guardTarget(p,n,now,460);
}
module.exports={xpPercent,eligibleForNpcXp,petXpFromReward,guardTarget,selectGuardTarget,npcRetaliatesAgainstPet};
