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
// Guard targeting is deliberately limited to an NPC already engaged by the owner.
function guardTarget(p,n,now,range){
 if(!p||p.petMode!=='guard'||!eligibleForNpcXp(p,now)||p.cloaked||p.safe||!p.attack||!n||p.target!==n.id||p.zone!==n.zone||n.hp<=0||n.gateShielded||n.accountId||n.godMode||!Number.isFinite(range)||range<=0)return false;
 return Math.hypot(p.petX-n.x,p.petY-n.y)<=range&&Math.hypot(p.x-n.x,p.y-n.y)<=range;
}
module.exports={xpPercent,eligibleForNpcXp,petXpFromReward,guardTarget};
