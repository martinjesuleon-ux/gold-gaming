'use strict';
const {advance,hit,standings,announcement}=require('./invasion-v134');
const NPCS=require('./data/npcs-v14.json'),AMMO=require('./data/catalog-v13.json').ammo;
const SIZE=12000,clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const fail=msg=>Object.assign(Error(msg),{status:400});
function createCombat(event,pilots,now=Date.now()){
 const fighters=new Map();
 for(const p of pilots){if(!event.players.has(p.id)||!Number.isFinite(p.maxHp)||p.maxHp<=0||!Number.isFinite(p.maxShield)||p.maxShield<0||!Number.isFinite(p.speed)||p.speed<=0||!Number.isFinite(p.damage)||p.damage<0)throw fail('Piloto inválido');
 fighters.set(p.id,{id:p.id,name:p.name,x:6000,y:6000,hp:p.maxHp,maxHp:p.maxHp,shield:p.maxShield,maxShield:p.maxShield,speed:p.speed,damage:p.damage,lasers:p.lasers||0,absorption:clamp(p.absorption??.8,0,1),ammo:'LCB-10',stock:null,lastShot:now-3000,target:null,attack:false,dest:null});}
 if(!fighters.size)throw fail('Sin participantes');
 advance(event,now);return {event,fighters,roster:new Map(pilots.map(p=>[p.id,{accountId:p.accountId,left:false}])),last:now,busy:false,closed:false};
}
function command(c,id,d){const p=c.fighters.get(id);if(c.closed||!p||p.hp<=0)throw fail('Piloto no disponible');
 if(d?.action==='move'&&Number.isFinite(d.x)&&Number.isFinite(d.y)&&d.x>=0&&d.x<=SIZE&&d.y>=0&&d.y<=SIZE){p.dest={x:d.x,y:d.y};return;}
 if(d?.action==='target'&&c.event.aliens.has(d.id)){p.target=d.id;p.attack=false;return;}
 if(d?.action==='attack'&&typeof d.on==='boolean'){p.attack=d.on&&c.event.aliens.has(p.target);return;}
 if(d?.action==='ammo'&&AMMO.some(a=>a.id===d.code&&!a.shieldOnly)){p.ammo=d.code;p.stock=null;return;}
 throw fail('Acción inválida');
}
function move(p,target,dt,speed=p.speed){const dx=target.x-p.x,dy=target.y-p.y,len=Math.hypot(dx,dy);if(len){const step=Math.min(len,speed*dt);p.x=clamp(p.x+dx/len*step,0,SIZE);p.y=clamp(p.y+dy/len*step,0,SIZE);}}
function leave(c,id){if(c.roster.has(id))c.roster.get(id).left=true;c.fighters.delete(id);c.event.players.delete(id);if(!c.fighters.size){c.event.phase='cancelled';c.closed=true;}}
async function tick(c,authorize,now=Date.now(),random=Math.random){
 if(c.closed||c.busy)return;c.busy=true;
 try{const e=c.event,dt=clamp((now-c.last)/1000,0,.1);c.last=now;advance(e,now);const plans=[];
 for(const p of c.fighters.values()){if(p.hp<=0)continue;if(p.dest)move(p,p.dest,dt);const n=e.aliens.get(p.target),a=AMMO.find(x=>x.id===p.ammo);if(!n){p.target=null;p.attack=false;continue;}if(p.attack&&a&&p.lasers>0&&p.lasers<=100&&Number.isInteger(p.lasers)&&dist(p,n)<=600&&now-p.lastShot>=a.intervalMs){p.lastShot=now;plans.push({id:p.id,code:a.id,count:p.lasers,target:n.id,damage:random()>=a.miss?Math.round(p.damage*a.multiplier):0});}}
 const stocks=plans.length?await authorize(plans):{};if(c.closed)return;
 for(const plan of plans){const p=c.fighters.get(plan.id);if(!p)continue;const stock=stocks[p.id];if(stock==null){p.attack=false;continue;}if(p.ammo===plan.code)p.stock=stock;if(plan.damage>0&&e.aliens.has(plan.target)&&e.players.has(p.id))hit(e,p.id,plan.target,plan.damage,now);}
 for(const n of e.aliens.values()){const live=[...c.fighters.values()].filter(p=>p.hp>0).sort((a,b)=>dist(n,a)-dist(n,b));const p=live[0];if(!p)break;const spec=NPCS[n.name];if(dist(n,p)>350)move(n,p,dt,spec.speed||100);if(dist(n,p)<=460&&now-(n.lastShot||0)>=1100){n.lastShot=now;const damage=random()<.8?spec.damage:0;const absorbed=Math.min(p.shield,Math.round(damage*p.absorption));p.shield-=absorbed;p.hp=Math.max(0,p.hp-(damage-absorbed));}}
 if(e.phase==='finished'||![...c.fighters.values()].some(p=>p.hp>0)){if(e.phase!=='finished')e.phase='failed';c.closed=true;}
 return announcement(e,now);
 }finally{c.busy=false;}
}
function view(c,id){const e=c.event;return {id:e.id,map:e.map,phase:e.phase,wave:e.wave+1,next:e.next,size:SIZE,closed:c.closed,players:[...c.fighters.values()].map(p=>({id:p.id,name:p.name,x:p.x,y:p.y,hp:p.hp,maxHp:p.maxHp,shield:p.shield,maxShield:p.maxShield,target:p.target,attack:p.attack,ammo:p.id===id?p.ammo:undefined,stock:p.id===id?p.stock:undefined})),aliens:[...e.aliens.values()].map(({id,name,x,y,hp,shield,maxHp,maxShield})=>({id,name,x,y,hp,shield,maxHp,maxShield})),scores:standings(e)};}
function result(c){if(!c.closed||!['finished','failed','cancelled'].includes(c.event.phase))throw fail('Evento no finalizado');return {id:c.event.id,difficulty:c.event.difficulty,phase:c.event.phase,pilots:[...c.roster].map(([id,p])=>({accountId:p.accountId,points:c.event.scores.get(id)||0,left:p.left}))};}
module.exports={createCombat,command,leave,tick,view,result};
