'use strict';
function logoutDelay(premium){return premium?5000:15000;}
function logoutBlocked(p,now=Date.now()){
 return !p||!!(p.deadUntil||p.gate||p.gatePending||p.ubaReturn||p.invasionReturn||p.attack||p.dest)||/^4-[1-4]$/.test(p.zone)||now-Number(p.lastHit||0)<5000;
}
function logoutState(p,now=Date.now()){
 if(!p.logoutRequest)return 'idle';
 const r=p.logoutRequest;
 if(logoutBlocked(p,now)||p.zone!==r.zone||p.x!==r.x||p.y!==r.y||p.lastHit!==r.lastHit)return 'cancel';
 return now>=r.until?'done':'waiting';
}
module.exports={logoutDelay,logoutBlocked,logoutState};
