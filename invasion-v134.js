'use strict';
const crypto=require('node:crypto');
const NPCS=require('./data/npcs-v14.json');
const RULES=Object.freeze({entryMs:60000,capacity:25,intermissionMs:10000,radius:5000,bossRechargeMs:2000,announcementMs:120000});
const WAVES=Object.freeze({
 easy:[['Streuner',20],['Lordakia',16],['Saimon',14],['Uber-Streuner',12],['Uber-Lordakia',10],['Mordon',8],['Sibelonit',6],['StreuneR',8]],
 medium:[['Saimon',20],['Mordon',16],['Sibelonit',14],['Kristallin',12],['Devolarium',10],['Uber-Mordon',8],['Sibelon',7],['Uber-Sibelonit',6],['Kristallon',5],['Uber-Devolarium',3]],
 hard:[['Devolarium',20],['Lordakium',16],['Uber-StreuneR',18],['Uber-Sibelonit',20],['Uber Kristallin',22],['Devourer',7],['Uber-Devolarium',16],['Uber Sibelon',10],['Uber-Lordakium',10],['Uber-Kristallon',9],['Kucurbium',6]]
});
const fail=message=>Object.assign(Error(message),{status:400});
function tier(level){return Number.isInteger(level)&&level>=5?(level<=9?'easy':level<=14?'medium':'hard'):null;}
function createEvent(difficulty,now=Date.now()){
 if(!Object.hasOwn(WAVES,difficulty))throw fail('Dificultad inválida');
 return {id:crypto.randomUUID(),difficulty,map:{easy:'INV-1',medium:'INV-2',hard:'INV-3'}[difficulty],phase:'entry',entryUntil:now+RULES.entryMs,players:new Set(),scores:new Map(),wave:0,next:0,aliens:new Map(),nextAnnounce:now+RULES.announcementMs,nextRecharge:0};
}
function enter(e,id,level,now=Date.now()){
 if(e.phase!=='entry'||now>=e.entryUntil||tier(level)!==e.difficulty)throw fail('Entrada no disponible');
 if(e.players.has(id))return false;
 if(e.players.size>=RULES.capacity)throw fail('Invasión llena');
 e.players.add(id);e.scores.set(id,0);return true;
}
function spawn(e,now){
 const waves=WAVES[e.difficulty],boss=e.wave===waves.length;
 if(e.wave>waves.length)throw fail('Oleada inválida');
 const defs=boss?[['Boss Kucurbium',1],['Kucurbium',4]]:[waves[e.wave]];
 const total=defs.reduce((n,[,count])=>n+count,0);let i=0;
 for(const [name,count] of defs)for(let n=0;n<count;n++){
  const a=2*Math.PI*i++/total,data=NPCS[name];if(!data)throw Error('NPC desconocido: '+name);
  const id=e.id+':'+e.wave+':'+i;
  e.aliens.set(id,{id,name,x:Math.round(6000+RULES.radius*Math.cos(a)),y:Math.round(6000+RULES.radius*Math.sin(a)),hp:data.hp,shield:data.shield,maxHp:data.hp,maxShield:data.shield});
 }
 e.phase=boss?'boss':'wave';e.nextRecharge=now+RULES.bossRechargeMs;
}
function advance(e,now=Date.now()){
 if(e.phase==='entry'&&now>=e.entryUntil){if(!e.players.size){e.phase='cancelled';return;}spawn(e,now);}
 else if(e.phase==='intermission'&&now>=e.next)spawn(e,now);
 if(e.phase==='boss'&&now>=e.nextRecharge){for(const a of e.aliens.values())if(a.name==='Boss Kucurbium')a.shield=a.maxShield;e.nextRecharge=now+RULES.bossRechargeMs;}
}
function hit(e,pilotId,npcId,damage,now=Date.now()){
 if(!['wave','boss'].includes(e.phase)||!e.players.has(pilotId)||!Number.isSafeInteger(damage)||damage<=0)throw fail('Ataque inválido');
 const a=e.aliens.get(npcId);if(!a)throw fail('Objetivo no disponible');
 const applied=Math.min(damage,a.hp+a.shield),absorbed=Math.min(a.shield,Math.floor(applied*.8));
 a.shield-=absorbed;const hpLoss=Math.min(a.hp,applied-absorbed);a.hp-=hpLoss;
 e.scores.set(pilotId,e.scores.get(pilotId)+absorbed+hpLoss);
 if(a.hp===0)e.aliens.delete(npcId);
 if(!e.aliens.size){if(e.phase==='boss')e.phase='finished';else{e.wave++;e.phase='intermission';e.next=now+RULES.intermissionMs;}}
 return {killed:a.hp===0,hp:a.hp,shield:a.shield};
}
function standings(e){return [...e.scores].map(([id,points])=>({id,points})).sort((a,b)=>b.points-a.points||String(a.id).localeCompare(String(b.id)));}
function announcement(e,now=Date.now()){if(!['wave','boss','intermission'].includes(e.phase)||now<e.nextAnnounce)return null;e.nextAnnounce=now+RULES.announcementMs;return standings(e);}
function createAdmission({eligible=()=>true}={}){
 const events=new Map(),membership=new Map();
 function open(difficulty,now=Date.now()){
  const old=events.get(difficulty);if(old?.phase==='entry'&&now<old.entryUntil)throw fail('Portal ya abierto');
  if(old)close(old,'cancelled');
  const e=createEvent(difficulty,now);events.set(difficulty,e);return e;
 }
 function join(p,now=Date.now()){
  if(!p||!eligible(p))throw fail('Piloto no disponible');
  const difficulty=tier(p.level),e=events.get(difficulty);
  if(!e)throw fail('Portal cerrado');
  if(membership.has(p.id)&&membership.get(p.id)!==e)throw fail('Ya estás inscrito');
  enter(e,p.id,p.level,now);membership.set(p.id,e);return e;
 }
 function leave(id){const e=membership.get(id);if(!e)return false;membership.delete(id);e.players.delete(id);e.scores.delete(id);return true;}
 function close(e,phase){e.phase=phase;for(const id of e.players)membership.delete(id);if(events.get(e.difficulty)===e)events.delete(e.difficulty);}
 function tick(now=Date.now()){
  const closed=[];
  for(const e of events.values())if(now>=e.entryUntil){const ids=[...e.players];close(e,ids.length?'preview-complete':'cancelled');closed.push({event:e,ids});}
  return closed;
 }
 function view(p){const e=events.get(tier(p?.level));return {enabled:true,joined:!!e&&membership.get(p?.id)===e,event:e?{id:e.id,difficulty:e.difficulty,map:e.map,phase:e.phase,entryUntil:e.entryUntil,participants:e.players.size,capacity:RULES.capacity}:null};}
 return {open,join,leave,tick,view};
}
function preview(level){return {rules:RULES,difficulty:tier(level),waves:WAVES,enabled:process.env.GG_INVASION_COMBAT_ENABLED==='1'&&process.env.GG_INVASION_LOBBY_ENABLED==='1',lobbyEnabled:process.env.GG_INVASION_LOBBY_ENABLED==='1'};}
module.exports={RULES,WAVES,tier,createEvent,enter,advance,hit,standings,announcement,preview,createAdmission};
