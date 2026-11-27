'use strict';
const {MAPS}=require('./maps-v14');
const PAY={phoenix:[100,0],yamato:[200,2],leonov:[400,4],defcom:[800,8],liberator:[1600,16],piranha:[3200,32],nostromo:[6400,64],vengeance:[12800,128],bigboy:[25600,256],goliath:[51200,512],citadel:[11200,112,512,512],spearhead:[11200,112,512,512],aegis:[128000,1280]};
function damageFactor(h){return h< -10000?.1:h< -2000?.3:h< -1000?.6:h< -500?.8:h< -200?.9:1;}
function penalty(level,prior=0,last=0,now=Date.now(),base=100){const elapsed=last?Math.max(0,Math.floor((now-last)/86400000)):0;const step=level<7?0:Math.min(24,Math.max(0,prior-elapsed));return {amount:Math.min(100000000,base*2**step),next:level<7?0:Math.min(24,step+1),last:now};}
function eligible(a,b,now=Date.now()){return !!(a&&b&&a.id!==b.id&&a.zone===b.zone&&MAPS[a.zone]?.pvp&&!a.gate&&!b.gate&&!a.deadUntil&&!b.deadUntil&&!b.gatePending&&!b.safe&&!(b.protectedUntil>now)&&!(a.group&&a.group===b.group));}
function rewardFor(a,b,prior,last,now){const [xp,honor,credits=0,uridium=0]=PAY[b.ship]||[0,0];if(a.company===b.company&&b.honor> -500){const p=penalty(a.level,prior,last,now);return {xp:0,honor:-p.amount,credits:-1000,uridium:0,penalty:p};}return {xp,honor,credits,uridium,penalty:null};}
module.exports={PAY,damageFactor,penalty,eligible,rewardFor};
