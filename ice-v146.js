'use strict';
const crypto=require('node:crypto'),NPCS=require('./data/npcs-v14.json'),{MAPS}=require('./maps-v14');
const RULES=Object.freeze({countdownMs:60000,durationMs:3600000,spawnMs:6000,maxIcy:25,heal:70000,noticeMs:30000,pingMs:5000,boxCount:15,boxUridium:2000,boxTtl:300000,range:600});
const REWARD=Object.freeze({credits:50000000,uridium:500000,xp:5000000,honor:500000});
const fail=message=>Object.assign(Error(message),{status:400}),dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function createEvent(map,now=Date.now(),w=12000,h=8000){
 if(!Object.hasOwn(MAPS,map))throw fail('Mapa inválido');
 const id=crypto.randomUUID(),spec=NPCS['Super Ice Meteoroid'],startAt=now+RULES.countdownMs;
 return {id,map,w,h,phase:'countdown',startAt,endAt:startAt+RULES.durationMs,nextSpawn:startAt+RULES.spawnMs,nextNotice:startAt+RULES.noticeMs,nextPing:startAt+RULES.pingMs,boss:{id:id+':boss',name:'Super Ice Meteoroid',x:w/2,y:h/2,hp:spec.hp,maxHp:spec.hp,shield:spec.shield,maxShield:spec.shield,damage:spec.damage*5,speed:spec.speed},icy:new Map(),contributors:new Map(),boxes:new Map()};
}
function spawn(e){const spec=NPCS.Icy,a=e.icy.size*2.399963229728653,id=crypto.randomUUID();e.icy.set(id,{id,name:'Icy',x:Math.max(25,Math.min(e.w-25,e.boss.x+350*Math.cos(a))),y:Math.max(25,Math.min(e.h-25,e.boss.y+350*Math.sin(a))),hp:spec.hp,maxHp:spec.hp,shield:spec.shield,maxShield:spec.shield,damage:spec.damage,speed:spec.speed});}
function advance(e,now=Date.now()){
 for(const [id,b] of e.boxes)if(now>=b.expires)e.boxes.delete(id);
 if(e.phase==='countdown'&&now>=e.startAt)e.phase='active';
 if(e.phase==='active'&&now>=e.endAt){e.phase='expired';e.icy.clear();return {notice:null,ping:null};}
 if(e.phase!=='active')return {notice:null,ping:null};
 if(now>=e.nextSpawn){const due=1+Math.floor((now-e.nextSpawn)/RULES.spawnMs);const count=Math.min(due,RULES.maxIcy-e.icy.size);for(let i=0;i<count;i++)spawn(e);e.nextSpawn+=due*RULES.spawnMs;}
 const point={map:e.map,x:e.boss.x,y:e.boss.y};let notice=null,ping=null;
 if(now>=e.nextNotice){e.nextNotice=now+RULES.noticeMs;notice=point;}
 if(now>=e.nextPing){e.nextPing=now+RULES.pingMs;ping=point;}
 return {notice,ping};
}
function shares(contributors){
 const rows=[...contributors.entries()].filter(([id,n])=>typeof id==='string'&&Number.isSafeInteger(n)&&n>0).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])),total=rows.reduce((n,r)=>n+BigInt(r[1]),0n);
 if(!total)return [];
 const out=rows.map(([id])=>({accountId:id}));
 for(const [key,pool] of Object.entries(REWARD)){let used=0;for(let i=0;i<rows.length;i++){out[i][key]=Number(BigInt(pool)*BigInt(rows[i][1])/total);used+=out[i][key];}for(let i=0;i<pool-used;i++)out[i][key]++;}
 return out;
}
function hit(e,p,id,amount,now=Date.now()){
 advance(e,now);const boss=id===e.boss.id,u=boss?e.boss:e.icy.get(id);
 if(e.phase!=='active'||!u||!p||p.zone!==e.map||p.deadUntil||p.godMode||!p.accountId||!Number.isFinite(p.x)||!Number.isFinite(p.y)||dist(p,u)>RULES.range||!Number.isSafeInteger(amount)||amount<=0)throw fail('Ataque inválido');
 const absorb=Math.min(u.shield,Math.floor(amount*.8)),hull=Math.min(u.hp,amount-absorb);u.shield-=absorb;u.hp-=hull;const dealt=absorb+hull;
 if(boss)e.contributors.set(p.accountId,(e.contributors.get(p.accountId)||0)+dealt);
 if(u.hp>0)return {killed:false,dealt};
 if(!boss){e.icy.delete(id);e.boss.hp=Math.min(e.boss.maxHp,e.boss.hp+RULES.heal);return {killed:true,dealt,boss:false};}
 e.phase='defeated';e.icy.clear();
 for(let i=0;i<RULES.boxCount;i++){const a=i*2*Math.PI/RULES.boxCount,boxId=crypto.randomUUID();e.boxes.set(boxId,{id:boxId,x:Math.max(25,Math.min(e.w-25,u.x+250*Math.cos(a))),y:Math.max(25,Math.min(e.h-25,u.y+250*Math.sin(a))),expires:now+RULES.boxTtl,uridium:RULES.boxUridium});}
 return {killed:true,boss:true,dealt,shares:shares(e.contributors)};
}
function view(e){return {id:e.id,map:e.map,phase:e.phase,startAt:e.startAt,endAt:e.endAt,boss:e.phase==='countdown'||e.phase==='active'?e.boss:null,icy:[...e.icy.values()],boxes:[...e.boxes.values()].map(({id,x,y,expires})=>({id,x,y,expires}))};}
function preview(){return {rules:RULES,reward:REWARD,boss:NPCS['Super Ice Meteoroid'],icy:NPCS.Icy,enabled:false};}
module.exports={RULES,REWARD,createEvent,advance,hit,shares,view,preview};
