'use strict';
const express=require('express');const http=require('node:http');const path=require('node:path');const crypto=require('node:crypto');const {Server}=require('socket.io');const {createAccounts}=require('./accounts');
const catalogV13=require('./data/catalog-v13.json');const {DEFS,WAVES,SHARED}=require('./gates-v14');const alienStats=require('./data/npcs-v14.json');const {salvo}=require('./equipment-v13');
const WORLD={w:12000,h:8000};const SHIPS={scout:{hp:900,shield:450,speed:420,damage:110},tank:{hp:1800,shield:950,speed:255,damage:155}};
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n)),distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),random=(a,b)=>a+Math.random()*(b-a),point=()=>({x:random(150,WORLD.w-150),y:random(150,WORLD.h-150)}),validPoint=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
function createGame({password=process.env.ADMIN_PASSWORD||'',npcCount=42,boxCount=75,accounts=createAccounts(process.env.DATABASE_URL)}={}){
 const app=express(),server=http.createServer(app),io=new Server(server,{maxHttpBufferSize:8192});const players=new Map(),npcs=new Map(),boxes=new Map(),active=new Map(),pending=new Set();let seq=0,tick=0,closing=false;const timers=new Set(),attempts=new Map();
 const zoneOf=o=>o?.zone||'world';const sameZone=(a,b)=>zoneOf(a)===zoneOf(b);
 const later=(fn,ms)=>{if(closing)return;const t=setTimeout(()=>{timers.delete(t);fn();},ms);timers.add(t);};const id=()=>String(++seq);
 function spawnNPC(boss=false,pos=point()){const n={id:id(),type:boss?'boss':'drone',name:boss?'BOSS · TITAN':'Stellar Drone',x:pos.x,y:pos.y,angle:0,hp:boss?8500:650,maxHp:boss?8500:650,shield:boss?4500:220,maxShield:boss?4500:220,speed:boss?105:155,damage:boss?220:55,reward:boss?3500:180,target:null,dest:point(),lastShot:0};npcs.set(n.id,n);return n;}
 function spawnBox(pos=point()){const b={id:id(),x:pos.x,y:pos.y,value:Math.floor(random(35,101))};boxes.set(b.id,b);return b;}
 function applyLoadout(p,l){if(!l)return;const ratio=Number.isFinite(p.hp)?p.hp/p.maxHp:1;p.ship=l.ship;p.maxHp=l.hp;p.maxShield=l.shield;p.speed=l.speed;p.damage=l.damage;p.lasers=l.lasers;p.absorption=l.absorption;p.hp=Math.min(l.hp,Math.max(0,Math.round(l.hp*ratio)));p.shield=Math.min(Number.isFinite(p.shield)?p.shield:l.shield,l.shield);p.v13=true;p.ammo=p.ammo||'LCB-10';}
 function spawnPlayer(p){p.petMode='off';p.petUntil=0;p.petGeneration=(p.petGeneration||0)+1;Object.assign(p,{x:WORLD.w/2+random(-180,180),y:WORLD.h/2+random(-180,180),hp:p.maxHp,shield:p.maxShield,angle:0,dest:null,target:null,attack:false,deadUntil:0,lastHit:Date.now()});}
 function damage(v,amount){const absorbed=Math.min(v.shield,amount*(v.absorption??1));v.shield-=absorbed;v.hp=Math.max(0,v.hp-(amount-absorbed));v.lastHit=Date.now();}
 function move(v,d,dt){if(!d)return;const dx=d.x-v.x,dy=d.y-v.y,len=Math.hypot(dx,dy);if(len<1)return;v.angle=Math.atan2(dy,dx);const step=Math.min(len,v.speed*dt);v.x=clamp(v.x+dx/len*step,25,WORLD.w-25);v.y=clamp(v.y+dy/len*step,25,WORLD.h-25);}
 function laser(a,b){io.to(zoneOf(a)).emit('laser',{x:a.x,y:a.y,tx:b.x,ty:b.y,kind:a.type||'player'});}
 for(let i=0;i<npcCount;i++)spawnNPC(false,i<5?{x:WORLD.w/2+random(480,1000),y:WORLD.h/2+random(-650,650)}:point());for(let i=0;i<boxCount;i++)spawnBox(i<5?{x:WORLD.w/2+random(-420,420),y:WORLD.h/2+random(-420,420)}:point());
 function setPetMode(p,mode){
  p.petMode=mode;p.petUntil=0;p.petX=null;p.petY=null;p.petGeneration=(p.petGeneration||0)+1;
  io.to(p.id).emit('v14:petState',{mode:'off',fuel:p.petFuel??null,pending:mode!=='off'});
 }
 // Classical gates. Protegit statistics are not specified in the supplied wiki.
 function clearGateNPCs(p){for(const [id,n] of npcs)if(n.zone===p.zone&&p.zone!=='world')npcs.delete(id);}
 function gateWave(p,withCountdown=false){
  if(!p.gate)return;
  const g=p.gate,def=DEFS[g.gate];
  p.gateWaiting=false;
  const launch=()=>{
   if(players.get(p.id)!==p||p.gate!==g||p.gateWaiting)return;
   const [name,count,scale=1]=WAVES[g.gate][g.wave][0];
   // The only unspecified alien is Protegit; no invented reward is granted.
   const base=alienStats[name]||{hp:650,shield:220,damage:55,speed:155,credits:0,uridium:0,xp:0,honor:0};
   for(let i=0;i<count;i++){
    const a=i*Math.PI*2/count,n=spawnNPC(false,{x:WORLD.w/2+Math.cos(a)*850,y:WORLD.h/2+Math.sin(a)*850});
    n.zone=p.zone;n.name=name;n.target=p.id;n.hp=n.maxHp=base.hp*scale;n.shield=n.maxShield=base.shield*scale;n.damage=base.damage*scale;n.speed=base.speed;
    n.reward=base.credits*scale;n.xpReward=base.xp*scale;n.uridiumReward=base.uridium*scale;n.honorReward=base.honor*scale;
   }
   io.to(p.id).emit('v14:gateState',{inside:true,gate:g.gate,wave:g.wave+1,total:def.waves,lives:g.lives,phase:'combat'});
  };
  if(withCountdown){io.to(p.id).emit('v14:gateState',{inside:true,gate:g.gate,wave:g.wave+1,total:def.waves,lives:g.lives,phase:'countdown',seconds:def.countdown});later(launch,def.countdown*1000);}
  else launch();
 }
 function returnFromGate(p,repair=false){
  const old={hp:p.hp,shield:p.shield,lastHit:p.lastHit};const home=p.gateReturn;
  clearGateNPCs(p);const sock=io.sockets.sockets.get(p.id);
  sock?.leave(p.zone);p.zone='world';sock?.join('world');p.gate=null;p.gateWaiting=false;p.gateReturn=null;p.attack=false;p.target=null;spawnPlayer(p);if(!repair){p.hp=Math.max(1,old.hp);p.shield=old.shield;p.lastHit=old.lastHit;if(home){p.x=home.x;p.y=home.y;}}setPetMode(p,'off');
 }
 function saveGate(p,outcome){
  if(!p.gate||p.gatePending)return;
  p.gatePending=true;p.attack=false;p.target=null;p.dest=null;
  const wave=p.gate.wave;
  const job=p.writes.catch(()=>{}).then(()=>accounts.gateAdvance(p.accountId,wave,outcome,p.gate.gate)).then(r=>{
   if(players.get(p.id)!==p)return;
   if(outcome==='death'||r.complete||r.failed){if(r.payout?.balance)Object.assign(p,{credits:Number(r.payout.balance.credits),experience:Number(r.payout.balance.experience),level:Number(r.payout.balance.level)});returnFromGate(p,outcome==='death');io.to(p.id).emit('v14:gateState',{inside:false,...r});io.to(p.id).emit('notice',r.complete?DEFS[r.gate].name+' completada · +'+r.payout.uridium+' uridium':r.failed?'Puerta perdida':'Vida perdida · vuelve a entrar desde Portales');}
   else{p.gate={gate:r.gate,wave:r.wave,lives:r.lives};p.gateWaiting=true;io.to(p.id).emit('v14:gateState',{inside:true,gate:r.gate,wave:r.wave+1,total:DEFS[r.gate].waves,lives:r.lives,phase:'between'});}
  }).catch(()=>{if(players.get(p.id)===p){returnFromGate(p,outcome==='death');io.to(p.id).emit('v14:gateState',{inside:false});io.to(p.id).emit('notice','No se pudo guardar la puerta. Vuelve a entrar.');}}).finally(()=>{p.gatePending=false;pending.delete(job);});
  p.writes=job;pending.add(job);
 }
 const publicPlayer=p=>({id:p.id,name:p.name,ship:p.ship,x:p.x,y:p.y,angle:p.angle,hp:p.hp,maxHp:p.maxHp,shield:p.shield,maxShield:p.maxShield,credits:p.credits,experience:p.experience,level:p.level,target:p.target,attack:p.attack,deadUntil:p.deadUntil,pet:p.petUntil>Date.now()&&p.petMode!=='off'&&!p.deadUntil?{mode:p.petMode,x:p.petX,y:p.petY}:null});
 function collectBox(p,b,byPet=false){
  if(!boxes.delete(b.id))return;
  if(closing)return;
  const job=p.writes.catch(()=>{}).then(async()=>{
   const r=await accounts.awardBox(p.accountId);p.credits=Number(r.balance.credits);
   const label=({'credits':'créditos','uridium':'uridium','gate-energy':'energía de puerta'})[r.loot.code]||r.loot.code;
   io.to(p.id).emit('notice',(byPet?'P.E.T.':'Caja')+': +'+r.loot.quantity+' '+label);
   io.to(p.id).emit('v14:loot',r);
  });
  p.writes=job;pending.add(job);
  job.then(()=>{pending.delete(job);later(()=>spawnBox(),6500);},()=>{pending.delete(job);later(()=>spawnBox(),6500);io.to(p.id).emit('notice','No se pudo confirmar la recompensa');});
 }
 function award(p,credits,xp,message,uridium=0,honor=0){if(closing)return Promise.reject(Error('Servidor cerrando'));const job=p.writes.catch(()=>{}).then(async()=>{const r=await accounts.reward(p.accountId,credits,xp,uridium,honor);Object.assign(p,{credits:Number(r.credits),experience:Number(r.experience),level:Number(r.level)});io.to(p.id).emit('notice',message+(xp?` · +${xp} EXP`:''));return p.credits;});p.writes=job;pending.add(job);job.then(()=>pending.delete(job),()=>{pending.delete(job);io.to(p.id).emit('notice','No se pudo confirmar una recompensa en la base de datos.');});return job;}
 app.disable('x-powered-by');app.use((req,res,next)=>{res.set({'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self' ws: wss:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"});next();});app.use(express.json({limit:'8kb'}));accounts.endpoints(app);
 app.get('/health',async(req,res)=>{try{await accounts.ready();res.json({ok:true,database:true,players:players.size});}catch{res.status(503).json({ok:false,database:false});}});
 app.get('/admin',(req,res)=>{res.set('Cache-Control','no-store').sendFile(path.join(__dirname,'public','admin.html'));});
 const admin=(req,res,next)=>{res.set('Cache-Control','no-store');if(!password)return res.status(503).json({error:'ADMIN_PASSWORD no configurada'});const now=Date.now();for(const[k,v]of attempts)if(v.until<now)attempts.delete(k);const key='global',a=attempts.get(key)||{count:0,until:now+60000};if(a.count>=20)return res.status(429).json({error:'Demasiados intentos. Reintenta en un minuto.'});const supplied=req.get('Authorization')||'',hash=s=>crypto.createHash('sha256').update(s).digest();if(!crypto.timingSafeEqual(hash(supplied),hash('Bearer '+password))){a.count++;attempts.set(key,a);return res.status(401).json({error:'Contraseña incorrecta'});}next();};
 app.get('/api/admin/players',admin,(req,res)=>res.json({players:[...players.values()].map(publicPlayer),npcs:npcs.size,boxes:boxes.size}));
 app.post('/api/admin/credits',admin,async(req,res)=>{const{playerId,amount}=req.body||{},p=players.get(playerId);if(!p||!Number.isSafeInteger(amount)||amount<1||amount>1000000||!Number.isSafeInteger(p.credits+amount))return res.status(400).json({error:'Jugador o monto inválido'});try{const credits=await award(p,amount,0,`Administración: +${amount} créditos`);res.json({ok:true,credits});}catch{res.status(503).json({error:'No se pudo confirmar el guardado'});}});
 app.post('/api/admin/boss',admin,(req,res)=>{if(npcs.size>=100||[...npcs.values()].filter(n=>n.type==='boss').length>=5)return res.status(409).json({error:'Límite de enemigos o jefes alcanzado'});const p=players.get(req.body?.playerId),pos=p?{x:clamp(p.x+650,80,WORLD.w-80),y:p.y}:{x:WORLD.w/2+700,y:WORLD.h/2};const n=spawnNPC(true,pos);io.to('world').emit('notice','¡Un TITAN ha aparecido en el sector!');res.json({ok:true,id:n.id,x:n.x,y:n.y});});app.use(express.static(path.join(__dirname,'public')));
 io.on('connection',socket=>{let budget=50,windowStart=Date.now(),joining=false;const allowed=()=>{const now=Date.now();if(now-windowStart>=1000){budget=50;windowStart=now;}return --budget>=0;};
 socket.on('join',async(data,ack)=>{if(typeof ack!=='function'||!allowed()||joining||closing)return;if(players.has(socket.id))return ack({ok:true,id:socket.id,world:WORLD});if(players.size>=40)return ack({ok:false,error:'Servidor lleno (40 pilotos)'});joining=true;try{const a=await accounts.authenticate(socket.handshake.headers);if(!socket.connected)return;if(!a)return ack({ok:false,error:'Inicia sesión o regístrate primero'});if(active.has(a.id))return ack({ok:false,error:'Cuenta ya conectada o guardando. Reintenta.'});if(players.size>=40||closing)return ack({ok:false,error:'Servidor no disponible'});const ship=Object.hasOwn(SHIPS,a.ship)?a.ship:'scout',s=SHIPS[ship];const p={id:socket.id,accountId:a.id,name:a.username,ship,maxHp:s.hp,maxShield:s.shield,speed:s.speed,damage:s.damage,credits:Number(a.credits),experience:Number(a.experience),level:Number(a.level),lastShot:0,writes:Promise.resolve()};const loadout=await accounts.combatLoadout?.(a.id);if(!socket.connected||closing||active.has(a.id)||players.size>=40)return ack({ok:false,error:'Cuenta o servidor no disponible'});applyLoadout(p,loadout);spawnPlayer(p);active.set(a.id,p);players.set(socket.id,p);socket.join('world');ack({ok:true,id:socket.id,world:WORLD});}catch{ack({ok:false,error:'Base de datos no disponible'});}finally{joining=false;}});
 socket.on('move',data=>{const p=players.get(socket.id);if(!allowed()||!p||p.deadUntil||!validPoint(data))return;p.dest={x:clamp(data.x,25,WORLD.w-25),y:clamp(data.y,25,WORLD.h-25)};});socket.on('select',target=>{const p=players.get(socket.id);if(!allowed()||!p||p.deadUntil)return;const n=npcs.get(target);p.target=n&&sameZone(p,n)&&distance(p,n)<1800?n.id:null;p.attack=false;});socket.on('attack',on=>{const p=players.get(socket.id);if(!allowed()||!p||p.deadUntil||typeof on!=='boolean')return;p.attack=on&&!!npcs.get(p.target)&&sameZone(p,npcs.get(p.target))&&!p.gatePending;});
 socket.on('v13:ammo',code=>{const p=players.get(socket.id);if(allowed()&&p&&catalogV13.ammo.some(a=>a.id===code))p.ammo=code;});
 socket.on('v13:reload',()=>{const p=players.get(socket.id);if(!allowed()||!p)return;p.reloadRequested=true;p.attack=false;io.to(p.id).emit('notice','Equipamiento guardado. Activando configuración…');});

 socket.on('v14:pet',mode=>{const p=players.get(socket.id);if(!allowed()||!p||!['off','passive','loot'].includes(mode))return;if(mode==='off'){setPetMode(p,mode);return;}if(p.deadUntil||p.petPending||p.petMode===mode)return;setPetMode(p,mode);});
 socket.on('v14:gateEnter',async(gate,ack)=>{
  const p=players.get(socket.id);if(typeof ack!=='function'||!allowed()||!p||p.gatePending||p.gate||p.deadUntil||p.attack||p.shotPending||p.reloadPending)return;
  p.gatePending=true;
  try{const checkpoint=await accounts.gateCheckpoint(p.accountId,gate);if(players.get(p.id)!==p||p.deadUntil||p.attack||p.shotPending)return ack({ok:false,error:'No se puede entrar ahora'});
   const old={hp:p.hp,shield:p.shield,lastHit:p.lastHit};p.gateReturn={x:p.x,y:p.y};socket.leave('world');p.zone='gate:'+p.id;socket.join(p.zone);p.gate=checkpoint;spawnPlayer(p);Object.assign(p,old);setPetMode(p,'off');gateWave(p,true);ack({ok:true});
  }catch(e){ack({ok:false,error:e.status?e.message:'No se pudo abrir Alpha'});}finally{p.gatePending=false;}
 });
 socket.on('v14:gateNext',()=>{const p=players.get(socket.id);if(allowed()&&p?.gate&&p.gateWaiting&&!p.gatePending)gateWave(p);});
 socket.on('v14:gateLeave',()=>{const p=players.get(socket.id);if(allowed()&&p?.gate&&p.gateWaiting&&!p.gatePending&&!p.shotPending&&!p.deadUntil){returnFromGate(p);socket.emit('v14:gateState',{inside:false});}});
 socket.on('disconnect',()=>{const p=players.get(socket.id);if(p?.gate)clearGateNPCs(p);players.delete(socket.id);if(p)p.writes.catch(()=>{}).finally(()=>{if(active.get(p.accountId)===p)active.delete(p.accountId);});});});
 let last=Date.now();const loop=setInterval(()=>{if(closing)return;const now=Date.now(),dt=Math.min((now-last)/1000,.1);last=now;
 for(const p of players.values()){if(p.gatePending)continue;if(p.deadUntil){if(now>=p.deadUntil)spawnPlayer(p);else continue;}if(p.reloadRequested&&!p.reloadPending&&!p.shotPending){p.reloadRequested=false;p.reloadPending=true;p.attack=false;const job=Promise.resolve().then(()=>accounts.combatLoadout(p.accountId)).then(l=>{if(players.get(p.id)!==p)return;if(p.deadUntil){p.reloadRequested=true;return;}if(!l)throw Error('Sin configuración guardada');applyLoadout(p,l);io.to(p.id).emit('notice','Configuración '+(l.active+1)+' activa · '+l.lasers+' láseres');io.to(p.id).emit('v13:loadoutApplied',{active:l.active,lasers:l.lasers,damage:l.damage});}).catch(()=>{if(players.get(p.id)===p)io.to(p.id).emit('notice','No se pudo activar el equipo. Guarda de nuevo en el hangar.');}).finally(()=>{p.reloadPending=false;pending.delete(job);});pending.add(job);}move(p,p.dest,dt);if(p.dest&&distance(p,p.dest)<2)p.dest=null;if(now-p.lastHit>6500)p.shield=Math.min(p.maxShield,p.shield+35*dt);
 if(p.petMode&&p.petMode!=='off'&&now>=p.petUntil&&!p.petPending){
  const mode=p.petMode,generation=p.petGeneration;p.petPending=true;
  const job=accounts.petInterval(p.accountId,mode).then(result=>{
   if(closing||players.get(p.id)!==p||p.deadUntil||p.petGeneration!==generation)return;
   p.petFuel=result.fuel;p.petUntil=Date.now()+10000;
   if(!Number.isFinite(p.petX)||!Number.isFinite(p.petY)||Math.hypot(p.petX-p.x,p.petY-p.y)>850){p.petX=p.x-55*Math.cos(p.angle);p.petY=p.y-55*Math.sin(p.angle);}
   io.to(p.id).emit('v14:petState',{mode,fuel:p.petFuel,pending:false});
  }).catch(e=>{if(players.get(p.id)!==p||p.petGeneration!==generation)return;setPetMode(p,'off');io.to(p.id).emit('notice',e.status===400?e.message:'P.E.T. no disponible');}).finally(()=>{p.petPending=false;pending.delete(job);});pending.add(job);
 }
 if(p.petUntil>now&&p.petMode!=='off'){
  let targetBox=null,best=700;
  if(p.petMode==='loot'&&!p.gate)for(const b of boxes.values()){const d=distance(p,b);if(d<best){best=d;targetBox=b;}}
  const goal=targetBox||{x:p.x-70*Math.cos(p.angle),y:p.y-70*Math.sin(p.angle)};
  if(Math.hypot(p.petX-p.x,p.petY-p.y)>850){p.petX=p.x;p.petY=p.y;}
  const dx=goal.x-p.petX,dy=goal.y-p.petY,len=Math.hypot(dx,dy);
  if(len>1){const step=Math.min(len,Math.max(550,p.speed+100)*dt);p.petX+=dx/len*step;p.petY+=dy/len*step;}
  if(targetBox&&Math.hypot(p.petX-targetBox.x,p.petY-targetBox.y)<35)collectBox(p,targetBox,true);
 }
 if(!p.gate)for(const b of boxes.values())if(distance(p,b)<52)collectBox(p,b);
 const n=npcs.get(p.target);if(!n||!sameZone(p,n)){p.target=null;p.attack=false;}else if(p.attack&&!p.reloadPending&&!p.reloadRequested&&distance(p,n)<=(p.v13?600:650)&&now-p.lastShot>=(p.v13?(catalogV13.ammo.find(a=>a.id===p.ammo)?.intervalMs||1000):450)&&!p.shotPending){
 p.lastShot=now;
 const finish=()=>{n.target=p.id;if(n.hp<=0&&npcs.get(n.id)===n){npcs.delete(n.id);p.target=null;p.attack=false;if(p.gate){award(p,n.reward,n.xpReward,n.name+' eliminado · +'+n.uridiumReward+' uridium',n.uridiumReward,n.honorReward).catch(()=>{});if(![...npcs.values()].some(x=>sameZone(p,x)))saveGate(p,'clear');return;}award(p,n.reward,n.type==='boss'?500:50,n.name+' eliminado · +'+n.reward+' créditos').catch(()=>{});if(n.type!=='boss')later(()=>spawnNPC(),5000);}};
 if(!p.v13){p.angle=Math.atan2(n.y-p.y,n.x-p.x);laser(p,n);damage(n,p.damage);finish();}
 else if(!p.lasers){p.attack=false;io.to(p.id).emit('notice','Equipa un láser en el hangar');}
 else{p.shotPending=true;const ammo=p.ammo,count=p.lasers;const job=accounts.consumeAmmo(p.accountId,ammo,count).then(stock=>{
 if(stock===null){p.attack=false;io.to(p.id).emit('notice','Munición insuficiente');return;}
 io.to(p.id).emit('v13:ammoStock',{code:ammo,quantity:stock});
 if(closing||players.get(p.id)!==p||p.deadUntil||!p.attack||p.target!==n.id||distance(p,n)>600||npcs.get(n.id)!==n)return;
 const result=salvo(p,n,ammo,stock+count,Math.random());p.angle=Math.atan2(n.y-p.y,n.x-p.x);laser(p,n);Object.assign(n,result.target);if(result.attackerShield!==undefined)p.shield=result.attackerShield;finish();
 }).catch(()=>{p.attack=false;io.to(p.id).emit('notice','No se pudo confirmar el consumo de munición');}).finally(()=>{p.shotPending=false;pending.delete(job);});pending.add(job);}
 }}
 for(const n of npcs.values()){let target=players.get(n.target);if(!target||target.deadUntil||target.gatePending||!sameZone(n,target)||distance(n,target)>1000){target=null;let best=n.type==='boss'?850:310;for(const p of players.values()){const d=distance(n,p);if(!p.deadUntil&&!p.gatePending&&sameZone(p,n)&&d<best){target=p;best=d;}}n.target=target?.id||null;}if(target){const d=distance(n,target);if(d>270)move(n,target,dt);else n.angle=Math.atan2(target.y-n.y,target.x-n.x);if(d<460&&now-n.lastShot>1100){n.lastShot=now;laser(n,target);damage(target,n.damage);if(target.hp<=0){if(target.gate){saveGate(target,'death');continue;}target.deadUntil=now+4000;setPetMode(target,'off');target.attack=false;target.target=null;target.dest=null;io.to(target.id).emit('notice','Nave destruida. Reaparición en 4 segundos.');}}}else{if(distance(n,n.dest)<8)n.dest=point();move(n,n.dest,dt);}}
 if(++tick%2===0&&players.size)for(const zone of new Set([...players.values()].map(zoneOf)))io.to(zone).volatile.emit('state',{time:now,players:[...players.values()].filter(p=>zoneOf(p)===zone).map(publicPlayer),npcs:[...npcs.values()].filter(n=>zoneOf(n)===zone).map(({dest,lastShot,damage,reward,speed,lastHit,target,zone,...n})=>n),boxes:zone==='world'?[...boxes.values()].map(({id,x,y})=>({id,x,y})):[]});},50);
 async function close(){closing=true;clearInterval(loop);for(const t of timers)clearTimeout(t);await new Promise(resolve=>io.close(resolve));await Promise.allSettled([...pending]);await accounts.close();}return{app,server,io,close};}
 if(require.main===module){const accounts=createAccounts(process.env.DATABASE_URL);accounts.ready().then(()=>{const game=createGame({accounts}),PORT=process.env.PORT||3000;game.server.listen(PORT,'0.0.0.0',()=>console.log(`GOLD GAMING escuchando en ${PORT}`));for(const sig of ['SIGTERM','SIGINT'])process.once(sig,()=>game.close().then(()=>process.exit(0)));}).catch(async e=>{console.error('No se pudo conectar a PostgreSQL:',e.code||e.message);await accounts.close();process.exitCode=1;});}module.exports={createGame,WORLD,SHIPS};
