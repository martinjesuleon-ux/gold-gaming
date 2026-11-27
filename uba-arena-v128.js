'use strict';
const {RULES,finishRound}=require('./uba-v126');const AMMO=require('./data/catalog-v13.json').ammo;
const WIDTH=2400,HEIGHT=1600,RANGE=600,COOLDOWN=1000;
const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
const finite=(n,min,max)=>Number.isFinite(n)&&n>=min&&n<=max;
const fail=msg=>Object.assign(Error(msg),{status:400});
// Separate simulation: never mutates persistent hangar, health, cargo or currency.
function createArena(match,pilots,now=Date.now()){
 if(!match||match.players.length!==2||!['countdown','fight'].includes(match.phase))throw fail('Duelo no disponible');
 const fighters=match.players.map((id,i)=>{
  const p=pilots.find(x=>x.id===id);
  if(!p||!finite(p.maxHp,1,100000000)||!finite(p.maxShield,0,100000000)||!finite(p.damage,1,10000000)||!finite(p.speed,1,2000))throw fail('Configuración inválida');
  return {id,name:String(p.name||'Piloto').slice(0,18),x:i?WIDTH-300:300,y:HEIGHT/2,hp:p.maxHp,maxHp:p.maxHp,shield:p.maxShield,maxShield:p.maxShield,damage:p.damage,speed:p.speed,absorption:clamp(Number(p.absorption)||.8,0,1),dest:null,lastShot:now-COOLDOWN,attack:false,lasers:Number.isSafeInteger(p.lasers)?p.lasers:0,ammo:'LCB-10',stock:null};
 });
 return {matchId:match.id,round:match.round,last:now,fighters,closed:false};
}
function command(arena,match,id,data){
 if(arena.closed||arena.matchId!==match.id||arena.round!==match.round||match.phase!=='fight')throw fail('Ronda no activa');
 const p=arena.fighters.find(x=>x.id===id);if(!p||p.hp<=0)throw fail('Piloto no disponible');
 if(data?.action==='move'&&finite(data.x,0,WIDTH)&&finite(data.y,0,HEIGHT)){p.dest={x:data.x,y:data.y};return;}
 if(data?.action==='attack'&&typeof data.on==='boolean'){p.attack=data.on;return;}
 if(data?.action==='ammo'&&AMMO.some(a=>a.id===data.code)){p.ammo=data.code;p.stock=null;return;}
 throw fail('Acción inválida');
}
function tickArena(arena,match,now=Date.now(),random=Math.random){
 if(arena.closed||arena.matchId!==match.id||arena.round!==match.round||match.phase!=='fight')return [];
 const dt=clamp((now-arena.last)/1000,0,.1);arena.last=now;const shots=[];
 for(const p of arena.fighters){if(p.dest&&p.hp>0){const dx=p.dest.x-p.x,dy=p.dest.y-p.y,len=Math.hypot(dx,dy);if(len>0){const step=Math.min(len,p.speed*dt);p.x=clamp(p.x+dx/len*step,0,WIDTH);p.y=clamp(p.y+dy/len*step,0,HEIGHT);if(step===len)p.dest=null;}}}
 // Resolve simultaneous shots from the pre-hit state; no first-player advantage.
 if(now<match.until){for(const p of arena.fighters){const target=arena.fighters.find(x=>x!==p);if(p.hp<=0||target.hp<=0||!p.attack||now-p.lastShot<COOLDOWN||Math.hypot(target.x-p.x,target.y-p.y)>RANGE)continue;p.lastShot=now;shots.push({from:p.id,to:target.id,damage:random()<.8?Math.round(p.damage):0});}}
 for(const shot of shots){const target=arena.fighters.find(p=>p.id===shot.to),absorbed=Math.min(target.shield,shot.damage*target.absorption);target.shield-=absorbed;target.hp=Math.max(0,target.hp-(shot.damage-absorbed));}
 const living=arena.fighters.filter(p=>p.hp>0);
 if(living.length<2||now>=match.until){arena.closed=true;finishRound(match,living.length===1?living[0].id:null,now);}
 return shots;
}
// Paid shots are collected together before any damage is applied. A disconnected
// pilot may spend the ammunition for a shot already submitted to the database.
async function tickArenaPaid(arena,match,authorize,now=Date.now(),random=Math.random){
 if(arena.closed||arena.busy||arena.matchId!==match.id||arena.round!==match.round||match.phase!=='fight')return [];
 arena.busy=true;
 try{
  const dt=clamp((now-arena.last)/1000,0,.1);arena.last=now;
  for(const p of arena.fighters){if(p.dest&&p.hp>0){const dx=p.dest.x-p.x,dy=p.dest.y-p.y,len=Math.hypot(dx,dy);if(len>0){const step=Math.min(len,p.speed*dt);p.x=clamp(p.x+dx/len*step,0,WIDTH);p.y=clamp(p.y+dy/len*step,0,HEIGHT);if(step===len)p.dest=null;}}}
  const plans=[];
  if(now<match.until)for(const p of arena.fighters){const target=arena.fighters.find(x=>x!==p),a=AMMO.find(x=>x.id===p.ammo);if(!p.attack||p.hp<=0||target.hp<=0||!a||p.lasers<1||p.lasers>100||now-p.lastShot<a.intervalMs||Math.hypot(target.x-p.x,target.y-p.y)>RANGE)continue;p.lastShot=now;plans.push({id:p.id,code:a.id,count:p.lasers,target:target.id,damage:random()>=a.miss?Math.round(p.damage*a.multiplier):0,shieldOnly:a.shieldOnly});}
  const paid=plans.length?await authorize(plans):{};
  if(arena.closed||match.phase!=='fight'||arena.round!==match.round)return [];
  const shots=[];
  for(const plan of plans){const p=arena.fighters.find(x=>x.id===plan.id);const stock=paid[plan.id];if(stock===null||stock===undefined){p.attack=false;continue;}if(p.ammo===plan.code)p.stock=stock;shots.push(plan);}
  const drains=[];
  for(const shot of shots){const target=arena.fighters.find(p=>p.id===shot.target);if(shot.shieldOnly){const drain=Math.min(target.shield,shot.damage);target.shield-=drain;drains.push([shot.id,drain]);}else{const absorbed=Math.min(target.shield,shot.damage*target.absorption);target.shield-=absorbed;target.hp=Math.max(0,target.hp-(shot.damage-absorbed));}}
  for(const [id,amount] of drains){const p=arena.fighters.find(x=>x.id===id);p.shield=Math.min(p.maxShield,p.shield+amount);}
  const living=arena.fighters.filter(p=>p.hp>0);if(living.length<2||now>=match.until){arena.closed=true;finishRound(match,living.length===1?living[0].id:null,now);}
  return shots;
 }finally{arena.busy=false;}
}
function viewArena(arena){return {width:WIDTH,height:HEIGHT,round:arena.round,closed:arena.closed,fighters:arena.fighters.map(({id,name,x,y,hp,maxHp,shield,maxShield,attack,ammo,stock})=>({id,name,x,y,hp,maxHp,shield,maxShield,attack,ammo,stock}))};}
module.exports={createArena,command,tickArena,tickArenaPaid,viewArena,WIDTH,HEIGHT,RANGE,COOLDOWN};
