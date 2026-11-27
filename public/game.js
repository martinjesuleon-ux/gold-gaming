'use strict';
const $=id=>document.getElementById(id), canvas=$('space'), ctx=canvas.getContext('2d'), mini=$('mini'), m=mini.getContext('2d');
const socket=io({path:'/socket.io'}); let world={w:12000,h:8000}, meId=null, profile=null, state={players:[],npcs:[],boxes:[]}, joined=false, selected=null, attacking=false, pendingSelectUntil=0, pendingAttackUntil=0, dest=null, noticeTimer, W=innerWidth,H=innerHeight,DPR=1;
let camera={x:6000,y:4000}, entities=new Map(), lasers=[], last=performance.now(), lastHud=0;
const fmt=n=>Math.floor(n).toLocaleString('es-CL'), clamp=(n,a,b)=>Math.max(a,Math.min(b,n)), distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function resize(){W=innerWidth;H=innerHeight;DPR=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(W*DPR);canvas.height=Math.round(H*DPR);ctx.setTransform(DPR,0,0,DPR,0,0);}
addEventListener('resize',resize);resize();
function notice(msg){$('notice').textContent=msg;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('notice').textContent='',3600);}
function join(){if(!profile||!socket.connected)return;$('launch').disabled=true;socket.timeout(6000).emit('join',profile,(err,res)=>{$('launch').disabled=false;if(err||!res?.ok){$('joinStatus').textContent=err?'El servidor no respondió':res?.error||'Error';$('hangar').hidden=false;$('hud').hidden=true;joined=false;$('connection').hidden=true;profile=null;return;}meId=res.id;world=res.world;joined=true;socket.emit('v13:ammo',selectedAmmo);syncAmmoButtons();selected=null;attacking=false;dest=null;pendingSelectUntil=pendingAttackUntil=0;entities.clear();state={players:[],npcs:[],boxes:[]};$('hangar').hidden=true;$('hud').hidden=false;$('connection').hidden=true;$('pilotName').textContent=profile.name;});}
socket.on('connect',()=>{$('joinStatus').textContent='Servidor conectado · listo para despegar';$('launch').disabled=false;if(profile)join();});
socket.on('disconnect',()=>{$('joinStatus').textContent='Sin conexión · reconectando';$('launch').disabled=true;if(joined)$('connection').hidden=false;});
socket.on('connect_error',()=>{$('joinStatus').textContent='Conectando… el hosting podría estar iniciando.';});
$('launch').disabled=true;$('join').addEventListener('submit',e=>{e.preventDefault();profile={name:$('nick').value.trim(),ship:new FormData(e.currentTarget).get('ship')};join();});
$('exit').onclick=()=>{profile=null;location.reload();};
socket.on('notice',notice);
let gateState={inside:false};
window.gg14GateEnter=(gate='alpha')=>new Promise((resolve,reject)=>{
 if(!joined||!socket.connected){reject(Error('Conéctate primero'));return;}
 socket.timeout(10000).emit('v14:gateEnter',gate,(err,r)=>{if(err||!r?.ok)reject(Error(r?.error||'No se pudo entrar a la puerta'));else resolve(r);});
});
window.gg14GateNext=()=>{if(joined)socket.emit('v14:gateNext');};
window.gg14GateLeave=()=>{if(joined)socket.emit('v14:gateLeave');};
window.gg14GateState=()=>gateState;
window.gg15Pilot=()=>state.players.find(p=>p.id===meId)||null;
let groupState=null;
window.gg15Group=(action,data={})=>new Promise((resolve,reject)=>{
 if(!joined||!socket.connected){reject(Error('Conéctate primero'));return;}
 socket.timeout(10000).emit('v15:group',{...data,action},(err,r)=>{if(err||!r?.ok)reject(Error(r?.error||'Grupo no disponible'));else{groupState=r;resolve(r);}});
});
socket.on('v15:group',r=>{groupState=r;window.dispatchEvent(new CustomEvent('gg15:group',{detail:r}));});
socket.on('disconnect',()=>{groupState=null;});
window.gg15Company=company=>new Promise((resolve,reject)=>{
 if(!joined||!socket.connected){reject(Error('Conéctate primero'));return;}
 socket.timeout(10000).emit('v15:company',company,(err,r)=>{if(err||!r?.ok)reject(Error(r?.error||'Cambio no disponible'));else resolve(r);});
});
let hadesLobby=null;
window.gg14HadesState=()=>hadesLobby;
window.gg14HadesAction=(action,data={})=>new Promise((resolve,reject)=>{
 if(!joined||!socket.connected){reject(Error('Conéctate primero'));return;}
 socket.timeout(10000).emit('v14:hadesLobby',{...data,action},(err,r)=>{if(err||!r?.ok)reject(Error(r?.error||'No se pudo actualizar el grupo'));else{hadesLobby=r.room;resolve(r.room);}});
});
socket.on('v14:hadesLobby',room=>{hadesLobby=room;window.dispatchEvent(new CustomEvent('gg14:hadesLobby',{detail:room}));});
socket.on('disconnect',()=>{hadesLobby=null;});
socket.on('v14:gateState',s=>{gateState={...s,localUntil:s.phase==='between'?performance.now()+1000*(s.seconds||10):0};entities.clear();selected=null;attacking=false;dest=null;notice(s.inside?(s.gate||'Puerta').toUpperCase()+' · Oleada '+s.wave+'/'+s.total+' · Vidas '+s.lives+(s.phase==='countdown'?' · Inicio en '+s.seconds+' s':s.phase==='between'?' · Portal de salida abierto durante 10 s':''):'De vuelta al sector');window.dispatchEvent(new CustomEvent('gg14:gateState',{detail:s}));});
socket.on('disconnect',()=>{gateState={inside:false};});
let petMode='off',petFuel=null,petPending=false;
function renderPetPanel(){
 const panel=document.querySelector('.gg-window[data-key="pet"]');if(!panel)return;
 let controls=panel.querySelector('.pet-controls');
 if(!controls){panel.querySelector('p')?.remove();controls=document.createElement('div');controls.className='pet-controls';panel.append(controls);}
 controls.replaceChildren();
 const info=document.createElement('p');info.textContent='P.E.T. '+(petPending?'Activando…':petMode==='off'?'Apagado':petMode==='loot'?'Auto-botín':'Pasivo')+' · Combustible '+(petFuel===null?'—':fmt(petFuel));controls.append(info);
 for(const [mode,label] of [['off','Apagar'],['passive','Pasivo'],['loot','Auto-botín']]){
  const b=document.createElement('button');b.type='button';b.textContent=label;b.disabled=petPending&&mode!=='off';b.onclick=()=>{if(joined)socket.emit('v14:pet',mode);};controls.append(b);
 }
 const kami=document.createElement('button');kami.type='button';kami.textContent='KAMIKAZE';kami.title='PRUEBA: 1.000.000 de daño a NPC en radio 1.500 · recarga 10 s';kami.disabled=petPending||petMode==='off';kami.onclick=()=>{if(joined)socket.emit('v16:kamikaze');};controls.append(kami);
}
socket.on('v14:petState',s=>{petMode=s.mode;petFuel=s.fuel;petPending=!!s.pending;renderPetPanel();});
window.addEventListener('gg13:inventory',e=>{petFuel=Number(e.detail.ammo?.find(a=>a.code==='pet-fuel')?.quantity||0);renderPetPanel();});
document.addEventListener('DOMContentLoaded',()=>queueMicrotask(renderPetPanel));
const ammoCodes=['LCB-10','MCB-25','MCB-50','UCB-100','SAB-50','RSB-75'];let selectedAmmo='LCB-10';const ammoStock={};
function syncAmmoButtons(){const buttons=document.querySelectorAll('.gg-slots button');ammoCodes.forEach((code,i)=>{const b=buttons[i+1];if(!b)return;b.disabled=false;b.textContent=code;b.title=code+(ammoStock[code]===undefined?'':' · '+ammoStock[code]);b.classList.toggle('active',code===selectedAmmo);b.onclick=()=>{if(!joined)return;selectedAmmo=code;socket.emit('v13:ammo',code);syncAmmoButtons();};});}
socket.on('v13:ammoStock',({code,quantity})=>{ammoStock[code]=quantity;syncAmmoButtons();});
window.addEventListener('gg13:loadout',()=>socket.emit('v13:reload'));
window.addEventListener('gg13:inventory',e=>{for(const a of e.detail.ammo||[])ammoStock[a.code]=a.quantity;syncAmmoButtons();});
document.addEventListener('DOMContentLoaded',()=>queueMicrotask(syncAmmoButtons));
socket.on('laser',l=>{if(l&&lasers.length<250)lasers.push({...l,born:performance.now()});});
socket.on('state',s=>{if(!joined)return;if(state.map!==s.map){entities.clear();selected=null;attacking=false;dest=null;lasers=[];kamiEffects=[];}state=s;const present=new Set();for(const [list,prefix] of [[s.players,'p'],[s.npcs,'n']])for(const o of list){const k=prefix+o.id;present.add(k);const old=entities.get(k);if(old&&distance(old,o)<1100&&!o.deadUntil&&!old.data.deadUntil){old.tx=o.x;old.ty=o.y;old.ta=o.angle;old.data=o;}else{entities.set(k,{x:o.x,y:o.y,tx:o.x,ty:o.y,a:o.angle,ta:o.angle,data:o});if(o.id===meId){camera.x=o.x;camera.y=o.y;}}}for(const k of entities.keys())if(!present.has(k))entities.delete(k);const p=s.players.find(p=>p.id===meId);if(p){const now=performance.now();if(now>pendingSelectUntil)selected=p.target;if(now>pendingAttackUntil)attacking=p.attack;if(p.deadUntil){selected=null;attacking=false;dest=null;}}});
function sendMove(x,y){if(!joined||!socket.connected)return;dest={x:clamp(x,25,world.w-25),y:clamp(y,25,world.h-25)};socket.emit('move',dest);}
function screen(x,y){return {x:x-camera.x+W/2,y:y-camera.y+H/2};}
function select(id){selected=id;attacking=false;pendingSelectUntil=pendingAttackUntil=performance.now()+250;socket.emit('select',id);}
function toggleAttack(){if(!joined||!socket.connected)return;if(!selected){notice('Selecciona un enemigo primero');return;}attacking=!attacking;pendingAttackUntil=performance.now()+250;socket.emit('attack',attacking);}
let jumpPending=false,personalGalaxy={map:null,portals:[]};
function visiblePortals(){return [...(state.portals||[]),...(state.map&&state.map===personalGalaxy.map?personalGalaxy.portals:[]),...(gateState.inside&&gateState.phase==='between'&&gateState.exitPortal&&performance.now()<gateState.localUntil?[gateState.exitPortal]:[])];}
function portalRange(p){return p.kind==='galaxy'||p.kind==='exit'?125:180;}
socket.on('v16:basePortals',data=>{personalGalaxy=data;});
window.gg16RefreshGalaxy=()=>{if(joined)socket.emit('v16:refreshGalaxy');};
window.gg16TravelGate=gate=>{const q=visiblePortals().find(p=>p.gate===gate);if(!q){window.gg16RefreshGalaxy();throw Error('Vuelve a la base X-1 de tu empresa y localiza el portal.');}sendMove(q.x,q.y);notice('Portal '+q.to+' · pulsa J al llegar');};

function jumpPortal(portal){
 if(!joined||jumpPending||!portal)return;
 const me=entities.get('p'+meId);if(!me||distance(me,portal)>portalRange(portal)){notice('Acércate al portal y pulsa J');return;}
 if(portal.kind==='exit'){window.gg14GateLeave();return;}
 if(portal.kind==='galaxy'){if(portal.gate==='hades'){window.gg16OpenGate?.('hades');return;}jumpPending=true;window.gg14GateEnter(portal.gate).catch(e=>notice(e.message)).finally(()=>jumpPending=false);return;}
 jumpPending=true;socket.timeout(10000).emit('v14:jump',portal.id,(err,r)=>{jumpPending=false;if(err||!r?.ok)notice(r?.error||'Salto no disponible');else notice('Sector '+r.map);});
}
function nearestPortal(){const me=entities.get('p'+meId);return me?visiblePortals().filter(p=>distance(me,p)<=portalRange(p)).sort((a,b)=>distance(me,a)-distance(me,b))[0]:null;}
socket.on('v14:map',s=>{entities.clear();selected=null;attacking=false;dest=null;lasers=[];notice('Sector '+s.map);});
$('fire').onclick=toggleAttack;addEventListener('keydown',e=>{if(joined&&e.key==='Control'&&!e.repeat){e.preventDefault();toggleAttack();}if(joined&&e.key==='Escape')select(null);if(joined&&e.key.toLowerCase()==='j'&&!e.repeat&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)){const portal=nearestPortal();if(portal)jumpPortal(portal);else notice('Acércate a un portal para saltar');}});
let dragging=false,lastMove=0;function mapPointer(e,initial){const x=e.clientX,y=e.clientY;if(initial){for(const portal of visiblePortals()){const q=screen(portal.x,portal.y);if(Math.hypot(q.x-x,q.y-y)<55){if(nearestPortal()?.id===portal.id)jumpPortal(portal);else{sendMove(portal.x,portal.y);notice('Portal a '+portal.to+' · Pulsa J al llegar');}return false;}}let closest=null,best=42;for(const [n,prefix] of [...state.npcs.map(n=>[n,'n']),...state.players.filter(p=>p.id!==meId&&!p.deadUntil).map(p=>[p,'p'])]){const v=entities.get(prefix+n.id);if(!v)continue;const p=screen(v.x,v.y),d=Math.hypot(p.x-x,p.y-y);if(d<best){best=d;closest=n;}}if(closest){select(closest.id);return false;}}sendMove(x+camera.x-W/2,y+camera.y-H/2);lastMove=performance.now();return true;}
canvas.addEventListener('pointerdown',e=>{if(!joined||e.button!==0)return;dragging=mapPointer(e,true);if(dragging)canvas.setPointerCapture(e.pointerId);});canvas.addEventListener('pointermove',e=>{if(dragging&&performance.now()-lastMove>90)mapPointer(e,false);});for(const ev of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(ev,()=>dragging=false);
mini.addEventListener('pointerdown',e=>{const r=mini.getBoundingClientRect();sendMove((e.clientX-r.left)/r.width*world.w,(e.clientY-r.top)/r.height*world.h);});
// Deterministic procedural stars: no external graphics or CDN.
function hash(x,y,k){const n=Math.sin(x*127.1+y*311.7+k*74.7)*43758.5453;return n-Math.floor(n);}
function stars(){ctx.fillStyle='#03060d';ctx.fillRect(0,0,W,H);const g=ctx.createRadialGradient(W*.72,H*.34,0,W*.72,H*.34,Math.max(W,H)*.75);g.addColorStop(0,'#111e35');g.addColorStop(.55,'#080f20');g.addColorStop(1,'#03060d');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);for(const [layer,par,size,cell] of [[1,.15,.9,80],[2,.45,1.3,115],[3,.8,1.8,170]]){const ox=camera.x*par-W/2,oy=camera.y*par-H/2;for(let ix=Math.floor(ox/cell);ix<=Math.ceil((ox+W)/cell);ix++)for(let iy=Math.floor(oy/cell);iy<=Math.ceil((oy+H)/cell);iy++){const x=ix*cell+hash(ix,iy,layer)*cell-ox,y=iy*cell+hash(ix,iy,layer+4)*cell-oy;ctx.globalAlpha=.25+hash(ix,iy,layer+9)*.65;ctx.fillStyle=layer===3?'#a4d6ff':'#d1dcf3';ctx.beginPath();ctx.arc(x,y,size*(.35+hash(ix,iy,layer+15)*.65),0,Math.PI*2);ctx.fill();}}ctx.globalAlpha=1;const corner=screen(0,0);ctx.strokeStyle='#647d994d';ctx.lineWidth=2;ctx.strokeRect(corner.x,corner.y,world.w,world.h);}
function poly(points,fill,stroke){ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1.3;ctx.stroke();}}
function ship(v,isMe,npc){const o=v.data,p=screen(v.x,v.y);if(p.x<-100||p.y<-100||p.x>W+100||p.y>H+100||o.deadUntil)return;ctx.save();ctx.translate(p.x,p.y);const boss=o.type==='boss',tank=o.ship==='tank',size=boss?1.7:tank?1.2:1;ctx.scale(size,size);ctx.rotate(v.a);const color=npc?(boss?'#70a7ff':'#ff795f'):(isMe?'#76f5bd':'#77c6ff');ctx.shadowColor=color;ctx.shadowBlur=14;poly([[-18,-6],[-35,0],[-18,6]],color);ctx.shadowBlur=0;
if(npc){poly([[26,0],[13,-18],[-8,-27],[-20,-16],[-12,0],[-20,16],[-8,27],[13,18]],boss?'#152d60':'#4c252e',color);poly([[20,0],[1,-9],[-9,0],[1,9]],color);for(const s of [-1,1])poly([[7,9*s],[-9,23*s],[-14,15*s]],'#9aafd6',color);}else if(tank){poly([[30,0],[13,-17],[-11,-23],[-25,-14],[-17,0],[-25,14],[-11,23],[13,17]],'#393b34',color);poly([[25,0],[5,-7],[-15,-7],[-10,0],[-15,7],[5,7]],'#d9d5a0');}else{poly([[32,0],[-2,-10],[-20,-24],[-13,-6],[-25,0],[-13,6],[-20,24],[-2,10]],'#173d39',color);poly([[29,0],[-5,-5],[3,0],[-5,5]],color);}
ctx.restore();if(!isMe&&selected===o.id){ctx.strokeStyle='#ff725e';ctx.lineWidth=1.5;ctx.setLineDash([6,4]);ctx.beginPath();ctx.arc(p.x,p.y,boss?55:36,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);}if(isMe){ctx.strokeStyle='#71ecc04d';ctx.beginPath();ctx.arc(p.x,p.y,35,0,Math.PI*2);ctx.stroke();}const top=p.y-(boss?62:35);const bw=boss?90:58;ctx.fillStyle='#101a28';ctx.fillRect(p.x-bw/2,top,bw,4);ctx.fillRect(p.x-bw/2,top+6,bw,4);ctx.fillStyle='#63e6a2';ctx.fillRect(p.x-bw/2,top,bw*o.hp/o.maxHp,4);ctx.fillStyle='#57aaff';ctx.fillRect(p.x-bw/2,top+6,bw*o.shield/o.maxShield,4);ctx.textAlign='center';ctx.font=(boss?'bold 13px':'11px')+' system-ui';ctx.fillStyle=npc?'#ff9b89':isMe?'#ddfff0':'#badbff';ctx.fillText((o.clanTag?'['+o.clanTag+'] ':'')+o.name,p.x,p.y+(boss?67:40));}
function drawPet(p){
 if(!p.pet||!Number.isFinite(p.pet.x)||!Number.isFinite(p.pet.y))return;
 const q=screen(p.pet.x,p.pet.y);ctx.save();ctx.translate(q.x,q.y);ctx.shadowColor='#5ae5ff';ctx.shadowBlur=8;poly([[16,0],[0,-10],[-12,-6],[-8,0],[-12,6],[0,10]],'#254c72','#84d8fa');ctx.shadowBlur=0;poly([[7,0],[0,-4],[-4,0],[0,4]],'#f5cc5c');ctx.font='10px system-ui';ctx.textAlign='center';ctx.fillStyle='#c2e7f5';ctx.fillText('P.E.T.',0,20);ctx.restore();
}
let kamiEffects=[];
socket.on('v16:kamikazeEffect',e=>{kamiEffects.push({...e,born:performance.now()});});
function drawKamikaze(t){kamiEffects=kamiEffects.filter(e=>t-e.born<850);for(const e of kamiEffects){const q=screen(e.x,e.y),f=Math.max(0,Math.min(1,(t-e.born)/850));ctx.save();ctx.globalAlpha=1-f;ctx.strokeStyle='#ffd27a';ctx.shadowColor='#ff9b40';ctx.shadowBlur=24;ctx.lineWidth=7;ctx.beginPath();ctx.arc(q.x,q.y,Math.max(2,e.radius*Math.sqrt(f)),0,Math.PI*2);ctx.stroke();ctx.fillStyle='#ffab3820';ctx.fill();ctx.restore();}}
function drawBase(t){
 const b=state.base;if(!b)return;const q=screen(b.x,b.y);ctx.save();ctx.translate(q.x,q.y);
 ctx.strokeStyle=b.color+'55';ctx.fillStyle=b.color+'09';ctx.setLineDash([12,10]);ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,b.radius,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.setLineDash([]);
 ctx.shadowColor=b.color;ctx.shadowBlur=12;ctx.strokeStyle=b.color;ctx.fillStyle='#182533';
 for(let i=0;i<6;i++){ctx.save();ctx.rotate(i*Math.PI/3);poly([[55,-24],[145,-17],[170,0],[145,17],[55,24]],'#253747',b.color);ctx.restore();}
 ctx.lineWidth=5;ctx.beginPath();ctx.arc(0,0,94,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,68,0,Math.PI*2);ctx.stroke();
 ctx.fillStyle=b.color;ctx.beginPath();ctx.arc(0,0,36+Math.sin(t/500)*3,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#fff';ctx.font='bold 20px system-ui';ctx.textAlign='center';ctx.fillText(b.name,0,7);ctx.font='bold 13px system-ui';ctx.fillText('BASE '+b.name+' · ZONA SEGURA',0,125);ctx.restore();
}
function drawPortals(t){
 for(const portal of visiblePortals()){const q=screen(portal.x,portal.y);if(q.x<-100||q.x>W+100||q.y<-100||q.y>H+100)continue;
 ctx.save();ctx.translate(q.x,q.y);const color=portal.kind==='exit'?'#6df3b4':portal.kind==='galaxy'?'#eac66d':'#5fd9ff';ctx.strokeStyle=color;ctx.shadowColor=color;ctx.shadowBlur=20;ctx.lineWidth=4;
 ctx.beginPath();ctx.arc(0,0,46,0,Math.PI*2);ctx.stroke();ctx.rotate(t/900);ctx.strokeStyle='#c5f6ff';ctx.setLineDash([18,9]);ctx.beginPath();ctx.arc(0,0,35,0,Math.PI*2);ctx.stroke();ctx.restore();
 ctx.save();ctx.font='bold 12px system-ui';ctx.fillStyle='#b7eaff';ctx.textAlign='center';ctx.fillText(portal.kind==='exit'?'SALIDA · '+Math.max(0,Math.ceil((gateState.localUntil-performance.now())/1000))+' s':(portal.kind==='galaxy'?'GG ':'PORTAL ')+portal.to,q.x,q.y+66);if(nearestPortal()?.id===portal.id)ctx.fillText('[J] SALTAR',q.x,q.y+82);ctx.restore();
 }
}
function drawBoxes(t){for(const b of state.boxes){const p=screen(b.x,b.y);if(p.x<-20||p.x>W+20||p.y<-20||p.y>H+20)continue;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(t/1800);const palette=b.kind==='paladio'?['#50dfdb','#276a78','#b6ffff']:b.kind==='cargo'?['#9ecbff','#365f95','#e1f2ff']:['#fbc45b','#896331','#ffe2a0'];ctx.shadowColor=palette[0];ctx.shadowBlur=12;poly([[0,-10],[10,0],[0,10],[-10,0]],palette[1],palette[2]);ctx.shadowBlur=0;poly([[0,-4],[4,0],[0,4],[-4,0]],palette[2]);ctx.restore();}}
function drawLasers(t){lasers=lasers.filter(l=>t-l.born<180);for(const l of lasers){const a=screen(l.x,l.y),b=screen(l.tx,l.ty),color=l.kind==='player'?'#83ffb5':l.kind==='boss'?'#79aaff':'#ff7766';ctx.save();ctx.globalAlpha=1-(t-l.born)/180;ctx.strokeStyle=color;ctx.shadowColor=color;ctx.shadowBlur=13;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.lineWidth=1;ctx.strokeStyle='#fff';ctx.stroke();ctx.restore();}}
function radar(){const w=mini.width,h=mini.height,sx=w/world.w,sy=h/world.h;m.fillStyle='#060d17';m.fillRect(0,0,w,h);m.strokeStyle='#22384b';m.lineWidth=1;for(let i=1;i<8;i++){m.beginPath();m.moveTo(i*w/8,0);m.lineTo(i*w/8,h);m.stroke();}for(let i=1;i<6;i++){m.beginPath();m.moveTo(0,i*h/6);m.lineTo(w,i*h/6);m.stroke();}function dot(x,y,c,r){m.fillStyle=c;m.beginPath();m.arc(x*sx,y*sy,r,0,Math.PI*2);m.fill();}for(const b of state.boxes)dot(b.x,b.y,b.kind==='paladio'?'#50dfdb':b.kind==='cargo'?'#9ecbff':'#bc9551',b.kind==='paladio'?2:1.2);if(state.base)dot(state.base.x,state.base.y,state.base.color,6);for(const p of visiblePortals())dot(p.x,p.y,p.kind==='galaxy'?'#eac66d':'#62d9ff',p.kind==='galaxy'?2.5:4);for(const n of state.npcs)dot(n.x,n.y,n.type==='boss'?'#6b9fff':'#ef785b',n.type==='boss'?3.5:2);for(const p of state.players)if(!p.deadUntil)dot(p.x,p.y,p.id===meId?'#6df3b4':'#79baff',p.id===meId?3:2);m.strokeStyle='#b8d5f5';m.strokeRect((camera.x-W/2)*sx,(camera.y-H/2)*sy,W*sx,H*sy);}
function updateHud(p){if(!p)return;const sector=document.querySelector('.topbar .brand small');if(sector)sector.textContent=state.map?'SECTOR '+state.map:gateState.inside?'GG '+gateState.gate.toUpperCase():'ESPACIO';const progress=document.getElementById('progressInfo');if(progress)progress.textContent='Nivel '+p.level+' · '+fmt(p.experience)+' EXP · Honor '+fmt(p.honor||0)+' · '+(['','MMO','EIC','VRU'][p.company]||'');$('online').textContent=state.players.length+' pilotos';$('credits').textContent=fmt(p.credits);$('hp').value=p.hp/p.maxHp*100;$('shield').value=p.maxShield?p.shield/p.maxShield*100:0;$('hpText').textContent=fmt(p.hp)+' / '+fmt(p.maxHp);$('shieldText').textContent=fmt(p.shield)+' / '+fmt(p.maxShield);$('coords').textContent=p.deadUntil?'Reapareciendo…':`X ${Math.round(p.x)} / Y ${Math.round(p.y)}`;const n=state.npcs.find(n=>n.id===selected)||state.players.find(n=>n.id===selected&&n.id!==meId);$('targetPanel').hidden=!n;if(n){$('targetName').textContent=n.name;$('targetHp').value=n.hp/n.maxHp*100;$('targetShield').value=n.shield/n.maxShield*100;$('targetRange').textContent=distance(p,n)<=650?'En alcance de láser':`Distancia ${Math.round(distance(p,n))} / 650`;} $('fire').classList.toggle('active',attacking);$('fire').setAttribute('aria-pressed',String(attacking));$('attackStatus').textContent=attacking?'ATAQUE ACTIVO':'EN ESPERA';radar();}
function frame(t){const dt=Math.min((t-last)/1000,.1);last=t;const alpha=1-Math.exp(-dt*16);for(const v of entities.values()){v.x+=(v.tx-v.x)*alpha;v.y+=(v.ty-v.y)*alpha;v.a+=Math.atan2(Math.sin(v.ta-v.a),Math.cos(v.ta-v.a))*alpha;}const me=entities.get('p'+meId);if(me){camera.x+=(me.x-camera.x)*alpha;camera.y+=(me.y-camera.y)*alpha;}stars();if(joined){drawBase(t);drawPortals(t);drawBoxes(t);if(dest&&me&&!me.data.deadUntil){if(distance(me,dest)<8)dest=null;else{const p=screen(dest.x,dest.y);ctx.strokeStyle='#7fe5c7a0';ctx.beginPath();ctx.arc(p.x,p.y,12,0,Math.PI*2);ctx.stroke();}}for(const n of state.npcs){const v=entities.get('n'+n.id);if(v)ship(v,false,true);}for(const p of state.players){const v=entities.get('p'+p.id);if(v)ship(v,p.id===meId,false);drawPet(p);}drawLasers(t);drawKamikaze(t);if(gateState.inside&&gateState.phase==='between'){const seconds=Math.max(0,Math.ceil((gateState.localUntil-performance.now())/1000));ctx.save();ctx.textAlign='center';ctx.font='bold 21px system-ui';ctx.fillStyle='#eac66d';ctx.fillText(gateState.completed?'PUERTA COMPLETADA · SALIDA '+seconds+' s':'SIGUIENTE RONDA EN '+seconds+' s',W/2,Math.max(120,H*.17));ctx.restore();}if(t-lastHud>100){updateHud(me?.data);lastHud=t;}}requestAnimationFrame(frame);}requestAnimationFrame(frame);
