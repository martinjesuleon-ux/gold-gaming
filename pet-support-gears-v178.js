'use strict';
// Project wiki values. These definitions do not yet authorize or activate a module.
const SUPPORT=Object.freeze({
 'G-AR1':[{price:2500,range:700},{price:6000,range:1500},{price:25000,range:3000}],
 'G-RL1':[{price:2500,range:2000},{price:6000,range:3000},{price:25000,range:5000}],
 'G-EL1':[{price:null,range:2000},{price:12500,range:3000},{price:50000,range:5000}],
 'G-REP1':[{price:2500,repairPerSecond:2000,durationMs:120000},{price:6000,repairPerSecond:6000,durationMs:45000},{price:12500,repairPerSecond:12000,durationMs:30000}],
 'CSR-02':[{price:20000,repairPerSecond:10000,durationMs:5000,redirect:.65,cooldownMs:45000,fuel:200},{price:30000,repairPerSecond:15000,durationMs:5000,redirect:.75,cooldownMs:30000,fuel:400},{price:55000,repairPerSecond:25000,durationMs:5000,redirect:.85,cooldownMs:15000,fuel:750}],
 'CGM-02':[{price:20000,redirect:.65,fuelFactor:1.35},{price:30000,redirect:.75,fuelFactor:1.35},{price:65000,redirect:.85,fuelFactor:1.35}],
 'G-TRA1':[{price:6000,saleFactor:1.05,awayMs:300000},{price:12500,saleFactor:1.15,awayMs:120000},{price:37500,saleFactor:1.30,awayMs:30000}]
});
function supportSpec(code,level){return Object.hasOwn(SUPPORT,code)&&Number.isInteger(level)&&level>=1&&level<=3?SUPPORT[code][level-1]:null;}
function repairHull(hp,maxHp,rate,elapsedMs){
 if(![hp,maxHp,rate,elapsedMs].every(Number.isSafeInteger)||hp<0||maxHp<=0||hp>maxHp||rate<=0||elapsedMs<0||elapsedMs>120000)throw Error('Reparación inválida');
 if(hp===0)return 0;
 return Math.min(maxHp,hp+Math.floor(rate*elapsedMs/1000));
}
function locateNearest(origin,entities,range,accept=()=>true){
 if(!origin||!Number.isFinite(origin.x)||!Number.isFinite(origin.y)||!Number.isFinite(range)||range<=0)return null;
 let best=null,distance=range;
 for(const entity of entities){
  if(!entity||entity.zone!==origin.zone||!Number.isFinite(entity.x)||!Number.isFinite(entity.y)||!accept(entity))continue;
  const d=Math.hypot(entity.x-origin.x,entity.y-origin.y);
  if(d<=distance&&(!best||d<distance)){distance=d;best=entity;}
 }
 return best;
}
module.exports={SUPPORT,supportSpec,repairHull,locateNearest};
