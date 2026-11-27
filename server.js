'use strict';
const express = require('express');
const http = require('node:http');
const path = require('node:path');
const crypto = require('node:crypto');
const { Server } = require('socket.io');
const WORLD = { w: 12000, h: 8000 };
const SHIPS = { scout: { hp: 900, shield: 450, speed: 420, damage: 110 }, tank: { hp: 1800, shield: 950, speed: 255, damage: 155 } };
const clamp = (n,min,max) => Math.max(min,Math.min(max,n));
const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
const random = (a,b) => a+Math.random()*(b-a);
const point = () => ({x:random(150,WORLD.w-150),y:random(150,WORLD.h-150)});
const validPoint = p => p && Number.isFinite(p.x) && Number.isFinite(p.y);
function createGame({password=process.env.ADMIN_PASSWORD || '', npcCount=42, boxCount=75}={}) {
 const app=express(), server=http.createServer(app), io=new Server(server,{maxHttpBufferSize:8192});
 const players=new Map(), npcs=new Map(), boxes=new Map(); let seq=0, tick=0;
 const timers=new Set(), attempts=new Map();
 const later=(fn,ms)=>{const t=setTimeout(()=>{timers.delete(t);fn();},ms);timers.add(t);};
 const id=()=>String(++seq);
 function spawnNPC(boss=false, pos=point()) {
  const n={id:id(),type:boss?'boss':'drone',name:boss?'BOSS · TITAN':'Stellar Drone',x:pos.x,y:pos.y,angle:0,hp:boss?8500:650,maxHp:boss?8500:650,shield:boss?4500:220,maxShield:boss?4500:220,speed:boss?105:155,damage:boss?220:55,reward:boss?3500:180,target:null,dest:point(),lastShot:0}; npcs.set(n.id,n);return n;
 }
 function spawnBox(pos=point()){const b={id:id(),x:pos.x,y:pos.y,value:Math.floor(random(35,101))};boxes.set(b.id,b);return b;}
 function spawnPlayer(p){Object.assign(p,{x:WORLD.w/2+random(-180,180),y:WORLD.h/2+random(-180,180),hp:p.maxHp,shield:p.maxShield,angle:0,dest:null,target:null,attack:false,deadUntil:0,lastHit:Date.now()});}
 function damage(v,amount){const absorbed=Math.min(v.shield,amount);v.shield-=absorbed;v.hp=Math.max(0,v.hp-(amount-absorbed));v.lastHit=Date.now();}
 function move(v,d,dt){if(!d)return;const dx=d.x-v.x,dy=d.y-v.y,len=Math.hypot(dx,dy);if(len<1)return;v.angle=Math.atan2(dy,dx);const step=Math.min(len,v.speed*dt);v.x=clamp(v.x+dx/len*step,25,WORLD.w-25);v.y=clamp(v.y+dy/len*step,25,WORLD.h-25);}
 function laser(a,b){io.to('world').emit('laser',{x:a.x,y:a.y,tx:b.x,ty:b.y,kind:a.type||'player'});}
 for(let i=0;i<npcCount;i++)spawnNPC(false,i<5?{x:WORLD.w/2+random(480,1000),y:WORLD.h/2+random(-650,650)}:point());
 for(let i=0;i<boxCount;i++)spawnBox(i<5?{x:WORLD.w/2+random(-420,420),y:WORLD.h/2+random(-420,420)}:point());
 const publicPlayer=p=>({id:p.id,name:p.name,ship:p.ship,x:p.x,y:p.y,angle:p.angle,hp:p.hp,maxHp:p.maxHp,shield:p.shield,maxShield:p.maxShield,credits:p.credits,target:p.target,attack:p.attack,deadUntil:p.deadUntil});
 app.disable('x-powered-by');
 app.use((req,res,next)=>{res.set({'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self' ws: wss:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"});next();});
 app.use(express.json({limit:'8kb'}));
 app.get('/health',(req,res)=>res.json({ok:true,players:players.size}));
 app.get('/admin',(req,res)=>{res.set('Cache-Control','no-store').sendFile(path.join(__dirname,'public','admin.html'));});
 const admin=(req,res,next)=>{
  res.set('Cache-Control','no-store');
  if(!password)return res.status(503).json({error:'ADMIN_PASSWORD no configurada'});
  const now=Date.now(); for(const [k,v] of attempts)if(v.until<now)attempts.delete(k);
  // Global limit on failed attempts, independent of potentially spoofed proxy IPs.
  const key='global', a=attempts.get(key)||{count:0,until:now+60000};
  if(a.count>=20)return res.status(429).json({error:'Demasiados intentos. Reintenta en un minuto.'});
  const supplied=req.get('Authorization')||'';
  const hash=s=>crypto.createHash('sha256').update(s).digest();
  if(!crypto.timingSafeEqual(hash(supplied),hash('Bearer '+password))){a.count++;attempts.set(key,a);return res.status(401).json({error:'Contraseña incorrecta'});} next();
 };
 app.get('/api/admin/players',admin,(req,res)=>res.json({players:[...players.values()].map(publicPlayer),npcs:npcs.size,boxes:boxes.size}));
 app.post('/api/admin/credits',admin,(req,res)=>{const {playerId,amount}=req.body||{};const p=players.get(playerId);if(!p||!Number.isSafeInteger(amount)||amount<1||amount>1000000||!Number.isSafeInteger(p.credits+amount))return res.status(400).json({error:'Jugador o monto inválido'});p.credits+=amount;io.to(p.id).emit('notice',`Administración: +${amount} créditos`);res.json({ok:true,credits:p.credits});});
 app.post('/api/admin/boss',admin,(req,res)=>{if(npcs.size>=100||[...npcs.values()].filter(n=>n.type==='boss').length>=5)return res.status(409).json({error:'Límite de enemigos o jefes alcanzado'});const p=players.get(req.body?.playerId);const pos=p?{x:clamp(p.x+650,80,WORLD.w-80),y:p.y}:{x:WORLD.w/2+700,y:WORLD.h/2};const n=spawnNPC(true,pos);io.to('world').emit('notice','¡Un TITAN ha aparecido en el sector!');res.json({ok:true,id:n.id,x:n.x,y:n.y});});
 app.use(express.static(path.join(__dirname,'public')));
 io.on('connection',socket=>{
  let budget=50, windowStart=Date.now(); const allowed=()=>{const now=Date.now();if(now-windowStart>=1000){budget=50;windowStart=now;}return --budget>=0;};
  socket.on('join',(data,ack)=>{if(typeof ack!=='function'||!allowed())return;if(players.has(socket.id))return ack({ok:true,id:socket.id,world:WORLD});if(players.size>=40)return ack({ok:false,error:'Servidor lleno (40 pilotos)'});if(typeof data?.name!=='string'||typeof data.ship!=='string'||!Object.hasOwn(SHIPS,data.ship))return ack({ok:false,error:'Datos inválidos'});const name=data.name.trim();if(!/^[\p{L}\p{N} _-]{2,18}$/u.test(name))return ack({ok:false,error:'Nickname de 2 a 18 caracteres'});if([...players.values()].some(p=>p.name.toLowerCase()===name.toLowerCase()))return ack({ok:false,error:'Nickname en uso'});const s=SHIPS[data.ship];const p={id:socket.id,name,ship:data.ship,maxHp:s.hp,maxShield:s.shield,speed:s.speed,damage:s.damage,credits:0,lastShot:0};spawnPlayer(p);players.set(socket.id,p);socket.join('world');ack({ok:true,id:socket.id,world:WORLD});});
  socket.on('move',data=>{const p=players.get(socket.id);if(!allowed()||!p||p.deadUntil||!validPoint(data))return;p.dest={x:clamp(data.x,25,WORLD.w-25),y:clamp(data.y,25,WORLD.h-25)};});
  socket.on('select',target=>{const p=players.get(socket.id);if(!allowed()||!p||p.deadUntil)return;const n=npcs.get(target);p.target=n&&distance(p,n)<1800?n.id:null;p.attack=false;});
  socket.on('attack',on=>{const p=players.get(socket.id);if(!allowed()||!p||p.deadUntil||typeof on!=='boolean')return;p.attack=on&&npcs.has(p.target);});
  socket.on('disconnect',()=>players.delete(socket.id));
 });
 let last=Date.now();
 const loop=setInterval(()=>{
  const now=Date.now(),dt=Math.min((now-last)/1000,0.1);last=now;
  for(const p of players.values()){
   if(p.deadUntil){if(now>=p.deadUntil)spawnPlayer(p);else continue;}
   move(p,p.dest,dt);if(p.dest&&distance(p,p.dest)<2)p.dest=null;
   if(now-p.lastHit>6500)p.shield=Math.min(p.maxShield,p.shield+35*dt);
   for(const b of boxes.values())if(distance(p,b)<52){p.credits+=b.value;boxes.delete(b.id);io.to(p.id).emit('notice',`Caja: +${b.value} créditos`);later(()=>spawnBox(),6500);}
   const n=npcs.get(p.target);if(!n){p.target=null;p.attack=false;}else if(p.attack&&distance(p,n)<=650&&now-p.lastShot>=450){p.lastShot=now;p.angle=Math.atan2(n.y-p.y,n.x-p.x);laser(p,n);damage(n,p.damage);n.target=p.id;if(n.hp<=0){p.credits+=n.reward;npcs.delete(n.id);p.target=null;p.attack=false;io.to(p.id).emit('notice',`${n.name} eliminado · +${n.reward} créditos`);if(n.type!=='boss')later(()=>spawnNPC(),5000);}}
  }
  for(const n of npcs.values()){
   let target=players.get(n.target);if(!target||target.deadUntil||distance(n,target)>1000){target=null;let best=n.type==='boss'?850:310;for(const p of players.values()){const d=distance(n,p);if(!p.deadUntil&&d<best){target=p;best=d;}}n.target=target?.id||null;}
   if(target){const d=distance(n,target);if(d>270)move(n,target,dt);else n.angle=Math.atan2(target.y-n.y,target.x-n.x);if(d<460&&now-n.lastShot>1100){n.lastShot=now;laser(n,target);damage(target,n.damage);if(target.hp<=0){target.deadUntil=now+4000;target.attack=false;target.target=null;target.dest=null;io.to(target.id).emit('notice','Nave destruida. Reaparición en 4 segundos.');}}}else{if(distance(n,n.dest)<8)n.dest=point();move(n,n.dest,dt);}
  }
  if(++tick%2===0&&players.size){io.to('world').volatile.emit('state',{time:now,players:[...players.values()].map(publicPlayer),npcs:[...npcs.values()].map(({dest,lastShot,damage,reward,speed,lastHit,target,...n})=>n),boxes:[...boxes.values()].map(({id,x,y})=>({id,x,y}))});}
 },50);
 function close(){clearInterval(loop);for(const t of timers)clearTimeout(t);return new Promise(resolve=>io.close(resolve));}
 return {app,server,io,close};
}
if(require.main===module){const game=createGame();const PORT=process.env.PORT||3000;game.server.listen(PORT,'0.0.0.0',()=>console.log(`GOLD GAMING escuchando en ${PORT}`));for(const sig of ['SIGTERM','SIGINT'])process.on(sig,()=>game.close().then(()=>process.exit(0)));}
module.exports={createGame,WORLD,SHIPS};
