'use strict';
const $=id=>document.getElementById(id), canvas=$('space'), ctx=canvas.getContext('2d'), mini=$('mini'), m=mini.getContext('2d');
const socket=io({path:'/socket.io'}); let world={w:12000,h:8000}, meId=null, profile=null, state={players:[],npcs:[],boxes:[]}, joined=false, selected=null, attacking=false, pendingSelectUntil=0, pendingAttackUntil=0, dest=null, noticeTimer, W=innerWidth,H=innerHeight,DPR=1;
let camera={x:6000,y:4000}, entities=new Map(), lasers=[], last=performance.now(), lastHud=0;
const fmt=n=>Math.floor(n).toLocaleString('es-CL'), clamp=(n,a,b)=>Math.max(a,Math.min(b,n)), distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const qualityProfiles=Object.freeze({low:{dpr:1,stars:1,glow:0},medium:{dpr:1.5,stars:2,glow:.5},high:{dpr:2,stars:3,glow:1}});
let quality='high',qualityPreference='high';try{const p=JSON.parse(localStorage.getItem('gg.hud.layout.v1')||'{}');if(p?.quality==='auto'||Object.hasOwn(qualityProfiles,p?.quality))qualityPreference=p.quality;if(qualityPreference!=='auto')quality=qualityPreference;}catch{}
const adaptiveQuality={start:0,frames:0,slow:0,fast:0,changedAt:0};
function setEffectiveQuality(value){if(quality===value)return;quality=value;resize();}
function resetAdaptiveQuality(t=0){Object.assign(adaptiveQuality,{start:0,frames:0,slow:0,fast:0,changedAt:t});}
window.ggSetQuality=value=>{if(value!=='auto'&&!Object.hasOwn(qualityProfiles,value))return;if(qualityPreference===value)return;qualityPreference=value;resetAdaptiveQuality(performance.now());setEffectiveQuality(value==='auto'?'high':value);};
function nextAdaptiveQuality(current,fps,elapsed,metrics){
 if(!Number.isFinite(fps)||elapsed<1000)return current;
 metrics.slow=fps<48?metrics.slow+1:0;
 metrics.fast=fps>=58?metrics.fast+1:0;
 if(metrics.slow>=3)return current==='high'?'medium':current==='medium'?'low':'low';
 if(metrics.fast>=12)return current==='low'?'medium':current==='medium'?'high':'high';
 return current;
}
function adaptQuality(t){
 if(qualityPreference!=='auto')return;
 if((window.ggVisualTheme?.current()||'gold')!=='gold'){if(quality!=='high')setEffectiveQuality('high');resetAdaptiveQuality(t);return;}
 if(!joined||document.hidden){resetAdaptiveQuality(t);return;}
 const m=adaptiveQuality;
 if(!m.start){m.start=t;m.frames=0;return;}
 m.frames++;const elapsed=t-m.start;if(elapsed<1000)return;
 const fps=m.frames*1000/elapsed;m.start=t;m.frames=0;
 // Ignore suspended tabs and pause changes briefly after each resolution change.
 if(elapsed>2500||t-m.changedAt<4000){m.slow=m.fast=0;return;}
 const next=nextAdaptiveQuality(quality,fps,elapsed,m);
 if(next!==quality){setEffectiveQuality(next);m.changedAt=t;m.slow=m.fast=0;}
}

function resize(){W=innerWidth;H=innerHeight;DPR=Math.min(devicePixelRatio||1,qualityProfiles[quality].dpr);canvas.width=Math.round(W*DPR);canvas.height=Math.round(H*DPR);ctx.setTransform(DPR,0,0,DPR,0,0);}
addEventListener('resize',resize);resize();
const recentActivity=[];
window.gg17Activity=()=>recentActivity.slice();
function recordActivity(msg){recentActivity.unshift({at:Date.now(),message:String(msg)});if(recentActivity.length>100)recentActivity.pop();}
socket.on('v17:gateReward',r=>{if(joined&&r?.payout)rewardNotice('Portal '+String(r.gate||'').toUpperCase()+' completado',r.payout);window.dispatchEvent(new CustomEvent('gg17:gateReward',{detail:r}));});
function notice(msg){recordActivity(msg);const n=$('notice');n.textContent=msg;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>n.textContent='',3600);}
const rewardLabels={xp:'Experiencia',honor:'Honor',credits:'Créditos',uridium:'Uridium',ammo:'Munición UCB-100',disks:'Ficheros',xenomit:'Xenomit',vouchers:'Vales de reparación',keys:'Llaves de botín'};
const rewardNumber=new Intl.NumberFormat('es-CL',{maximumFractionDigits:0});
let rewardRemovalTimer=null;
function rewardNotice(title,amounts){
 const host=$('gg171-rewards');if(!host)return;
 const card=document.createElement('section');card.className='gg171-reward';
 const heading=document.createElement('strong');heading.textContent=String(title||'Recompensa');card.append(heading);
 const entries=[];
 for(const [key,label] of Object.entries(rewardLabels)){
  const value=Number(amounts?.[key]);if(!Number.isFinite(value)||value===0)continue;
  const line=document.createElement('span');line.className='gg171-reward-line';
  if(value<0)line.classList.add('negative');const name=document.createElement('span'),count=document.createElement('b');
  name.textContent=label;count.textContent=(value>0?'+':'')+rewardNumber.format(value);line.append(name,count);card.append(line);entries.push(label+' '+count.textContent);
 }
 if(typeof amounts?.item==='string'&&amounts.item){const line=document.createElement('span');line.textContent='Objeto: '+amounts.item+(amounts.itemQuantity>1?' ×'+amounts.itemQuantity:'');card.append(line);entries.push(line.textContent);}
 if(!entries.length)return;
 recordActivity(heading.textContent+' · '+entries.join(' · '));
 clearTimeout(rewardRemovalTimer);
 host.replaceChildren(card);
 rewardRemovalTimer=setTimeout(()=>{card.remove();rewardRemovalTimer=null;},4200);
}
socket.on('v171:reward',r=>{if(joined&&r&&typeof r.title==='string')rewardNotice(r.title,r.amounts);});

let joinGeneration=0,joinPending=false,joinRetryTimer=null,joinAttempts=0,recovering=false;
function retryJoinDelay(attempt,err,res){if(attempt>=6||(!err&&!['ACCOUNT_BUSY','DB_UNAVAILABLE','SERVER_UNAVAILABLE'].includes(res?.code)))return null;return Math.min(8000,500*2**attempt);}
function clearJoinRetry(){if(joinRetryTimer!==null){clearTimeout(joinRetryTimer);joinRetryTimer=null;}}
function connectionText(message){$('joinStatus').textContent=message;$('connection').textContent=message;}
function join(){if(!profile||!socket.connected||joinPending)return;clearJoinRetry();joinPending=true;$('launch').disabled=true;const generation=joinGeneration;
 socket.timeout(6000).emit('join',profile,(err,res)=>{if(generation!==joinGeneration||!profile||!socket.connected)return;joinPending=false;
 if(err||!res?.ok){const retry=retryJoinDelay(joinAttempts,err,res);if(retry!==null){joinAttempts++;connectionText('Recuperando sesión · intento '+joinAttempts+'/6');joinRetryTimer=setTimeout(()=>{joinRetryTimer=null;join();},retry);return;}
 connectionText(err?'El servidor no respondió. Inicia sesión nuevamente.':res?.error||'No se pudo recuperar la sesión');$('launch').disabled=false;$('hangar').hidden=false;$('hud').hidden=true;joined=false;$('connection').hidden=true;profile=null;recovering=false;return;}
 joinAttempts=0;recovering=false;meId=res.id;world=res.world;joined=true;socket.emit('v13:ammo',selectedAmmo);syncAmmoButtons();selected=null;attacking=false;dest=null;pendingSelectUntil=pendingAttackUntil=0;entities.clear();state={players:[],npcs:[],boxes:[]};$('hangar').hidden=true;$('hud').hidden=false;$('connection').hidden=true;$('launch').disabled=false;$('pilotName').textContent=profile.name;window.dispatchEvent(new Event('gg13:lootRefresh'));});
}
socket.on('connect',()=>{joinGeneration++;joinPending=false;joinAttempts=0;clearJoinRetry();connectionText(profile?'Recuperando sesión…':'Servidor conectado · listo para despegar');$('launch').disabled=!!profile;if(profile)join();});
socket.on('disconnect',()=>{joinGeneration++;joinPending=false;clearJoinRetry();recovering=recovering||joined;joined=false;selected=null;attacking=false;dest=null;pendingSelectUntil=pendingAttackUntil=0;dragging=false;entities.clear();state={players:[],npcs:[],boxes:[]};lasers=[];damageNumbers=[];connectionText('Sin conexión · reconectando');$('launch').disabled=true;if(recovering)$('connection').hidden=false;});
socket.on('connect_error',()=>{connectionText('Conectando… el hosting podría estar iniciando.');});
$('launch').disabled=true;$('join').addEventListener('submit',e=>{e.preventDefault();profile={name:$('nick').value.trim(),ship:new FormData(e.currentTarget).get('ship')};join();});
$('exit').onclick=()=>{profile=null;location.reload();};
socket.on('notice',notice);
socket.on('v14:loot',r=>{if(r?.keys!==undefined){window.dispatchEvent(new Event('gg13:lootRefresh'));}});
let gateState={inside:false};
window.gg14GateEnter=(gate='alpha')=>new Promise((resolve,reject)=>{
 if(!joined||!socket.connected){reject(Error('Conéctate primero'));return;}
 socket.timeout(10000).emit('v14:gateEnter',gate,(err,r)=>{if(err||!r?.ok)reject(Error(r?.error||'No se pudo entrar a la puerta'));else resolve(r);});
});
window.gg14GateNext=()=>{if(joined)socket.emit('v14:gateNext');};
window.gg14GateLeave=()=>{if(joined)socket.emit('v14:gateLeave');};
window.gg14GateState=()=>gateState;
window.gg15Pilot=()=>state.players.find(p=>p.id===meId)||null;
window.gg19Formation=code=>new Promise((resolve,reject)=>{if(!joined||!socket.connected)return reject(Error('Conéctate primero'));socket.timeout(8000).emit('v19:formation',code,(err,r)=>{if(err||!r?.ok)reject(Error(r?.error||'Formación no disponible'));else resolve(r);});});
window.gg19Tech=code=>new Promise((resolve,reject)=>{if(!joined||!socket.connected)return reject(Error('Conéctate primero'));socket.timeout(8000).emit('v19:technology',code,(err,r)=>{if(err||!r?.ok)reject(Error(r?.error||'Tecnología no disponible'));else resolve(r);});});
window.gg18Jump=destination=>new Promise((resolve,reject)=>{if(!joined||!socket.connected)return reject(Error('Conéctate primero'));socket.timeout(8000).emit('v18:advancedJump',destination,(err,r)=>{if(err||!r?.ok)reject(Error(r?.error||'Salto no disponible'));else resolve(r);});});
window.gg18Cpu=code=>new Promise((resolve,reject)=>{if(!joined||!socket.connected)return reject(Error('Conéctate primero'));socket.timeout(8000).emit('v18:cpu',code,(err,r)=>{if(err||!r?.ok)reject(Error(r?.error||'CPU no disponible'));else resolve(r);});});
window.gg18Ability=code=>new Promise((resolve,reject)=>{if(!joined||!socket.connected)return reject(Error('Conéctate primero'));socket.timeout(8000).emit('v18:ability',code,(err,r)=>{if(err||!r?.ok)reject(Error(r?.error||'Habilidad no disponible'));else resolve(r.ability);});});
window.gg18Charge=data=>new Promise((resolve,reject)=>{
 if(!joined||!socket.connected)return reject(Error('Conéctate primero'));
 socket.timeout(10000).emit('v18:upgrade',data,(err,r)=>{if(err||!r?.ok)reject(Error(r?.error||'No se pudo cargar mineral'));else resolve(r);});
});
window.gg17God=enabled=>new Promise((resolve,reject)=>{
 if(!joined||!socket.connected)return reject(Error('Conéctate primero'));
 socket.timeout(8000).emit('v17:god',enabled,(err,r)=>{if(err||!r?.ok)reject(Error(r?.error||'No se pudo cambiar DIOS'));else resolve(r.enabled);});
});
window.ggAdminOneShot=enabled=>new Promise((resolve,reject)=>{
 if(!joined||!socket.connected)return reject(Error('Conéctate primero'));
 socket.timeout(8000).emit('admin:oneShot',enabled,(err,r)=>{if(err||!r?.ok)reject(Error(r?.error||'No se pudo cambiar daño de prueba'));else resolve(r.enabled);});
});
window.ggAdminMapList=()=>new Promise((resolve,reject)=>{
 if(!joined||!socket.connected)return reject(Error('Conéctate primero'));
 socket.timeout(8000).emit('admin:mapList',(err,r)=>{if(err||!r?.ok)reject(Error(r?.error||'No se pudo cargar los mapas'));else resolve(r);});
});
window.ggAdminMapJump=destination=>new Promise((resolve,reject)=>{
 if(!joined||!socket.connected)return reject(Error('Conéctate primero'));
 socket.timeout(10000).emit('admin:mapJump',destination,(err,r)=>{if(err||!r?.ok)reject(Error(r?.error||'Salto no disponible'));else resolve(r);});
});
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
let petMode='off',petFuel=null,petPending=false,petOwned=null,petGear=null,petVitals=null,petVitalsLoading=false,petRepairPending=false,petVitalsEpoch=0,petRepairRequest=null;
async function refreshPetVitals(){
 if(petOwned!==true||petVitalsLoading)return;
 petVitalsLoading=true;const epoch=petVitalsEpoch;
 try{const response=await fetch('/api/v13/pet/vitals',{credentials:'same-origin',cache:'no-store'});if(!response.ok)return;const v=await response.json();if(epoch===petVitalsEpoch&&petOwned===true){petVitals=v.enabled?v:null;renderPetPanel();}}
 catch{}finally{petVitalsLoading=false;}
}
async function repairPet(){
 if(petRepairPending||!joined||!petVitals?.enabled||!petVitals.destroyed)return;
 if(!confirm('¿Reparar el P.E.T. por '+fmt(petVitals.repairPrice)+' uridium?'))return;
 petRepairPending=true;petRepairRequest=petRepairRequest||crypto.randomUUID();renderPetPanel();
 try{const r=await fetch('/api/v13/pet/repair',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId:petRepairRequest})});const d=await r.json();if(!r.ok){if(r.status<500)petRepairRequest=null;throw Error(d.error||'No se pudo reparar');}petRepairRequest=null;petVitals={...petVitals,...d.vitals};notice('P.E.T. reparado');await refreshPetVitals();}
 catch(e){notice(e.message||'Reparación no disponible');}finally{petRepairPending=false;renderPetPanel();}
}
function renderPetPanel(){
 const panel=document.querySelector('.gg-window[data-key="pet"]');if(!panel)return;
 let controls=panel.querySelector('.pet-controls');
 if(!controls){
  panel.querySelector('p')?.remove();controls=document.createElement('div');controls.className='pet-controls gg-pet-compact';panel.append(controls);
  const make=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n;};
  const top=make('div','gg-pet-top'),portrait=make('div','gg-pet-portrait'),art=window.ggShopVisual.art('pet',{id:'pet-10',name:'P.E.T. 10'}),stats=make('div','gg-pet-stats');portrait.append(art);top.append(portrait,stats);controls.append(top);
  const info=make('p','gg-pet-status'),fuelLabel=make('p','gg-pet-fuel'),meter=make('progress');meter.max=50000;meter.setAttribute('aria-label','Combustible P.E.T.');stats.append(info,fuelLabel,meter);
  const unavailable=make('small','gg-pet-unavailable','Vida y escudo: —');stats.append(unavailable);
  const hpLabel=make('small','gg-pet-hp-label'),hpBar=make('progress','gg-pet-hp-bar'),shieldLabel=make('small','gg-pet-shield-label'),shieldBar=make('progress','gg-pet-shield-bar');
  hpBar.setAttribute('aria-label','Vida del P.E.T.');shieldBar.setAttribute('aria-label','Escudo del P.E.T.');stats.append(hpLabel,hpBar,shieldLabel,shieldBar);
  const repair=make('button','gg-pet-repair','Reparar');repair.type='button';repair.onclick=repairPet;stats.append(repair);
  const actions=make('div','gg-pet-actions'),power=make('button','gg-pet-power','▶'),store=make('button','gg-pet-shop','+'),modes=make('select','gg-pet-mode-select');
  power.type='button';power.onclick=()=>{if(!joined||petPending)return;const mode=petMode==='off'?'passive':'off';socket.emit('v14:pet',mode);};
  store.type='button';store.title='Tienda de P.E.T. y combustible';store.setAttribute('aria-label',store.title);store.onclick=()=>window.gg13Open?.('Tienda');
  modes.setAttribute('aria-label','Modo y módulos del P.E.T.');for(const [value,label] of [['passive','Modo pasivo'],['guard','Modo guardia'],['loot','Auto-botín'],['kami','Detonador kamikaze']]){const o=make('option',null,label);o.value=value;modes.append(o);}
  modes.onchange=()=>{if(!joined||petPending)return;const mode=modes.value;if(mode==='kami'){socket.emit('v16:kamikaze');modes.value=petMode==='loot'?'loot':petMode==='guard'?'guard':'passive';}else socket.emit('v14:pet',mode);};
  const kami=make('button','gg-pet-kami','✹');kami.type='button';kami.title='Detonador kamikaze · módulo de prueba';kami.setAttribute('aria-label',kami.title);kami.onclick=()=>{if(joined)socket.emit('v16:kamikaze');};actions.append(power,store,modes,kami);controls.append(actions);
  const gear=make('small','gg-pet-gear');controls.append(gear);
 }
 const info=controls.querySelector('.gg-pet-status'),fuelLabel=controls.querySelector('.gg-pet-fuel'),meter=controls.querySelector('progress'),gear=controls.querySelector('.gg-pet-gear'),power=controls.querySelector('.gg-pet-power'),modes=controls.querySelector('.gg-pet-mode-select');
 setHudText(info,petOwned===false?'P.E.T. no adquirido':petPending?'Activando…':petMode==='off'?'P.E.T. apagado':petMode==='loot'?'Auto-botín':petMode==='guard'?'Modo guardia':'Modo pasivo');
 info.dataset.phase=petPending?'pending':petMode==='off'?'off':'active';
 setHudText(fuelLabel,'Combustible '+(petFuel===null?'—':fmt(petFuel))+' / 50.000');
 if(petFuel===null)meter.removeAttribute('value');else setHudValue(meter,Math.max(0,Math.min(50000,petFuel)));
 const active=petMode!=='off';power.disabled=petPending||petOwned!==true||!!petVitals?.destroyed||petRepairPending;
 const vitalsAvailable=!!petVitals?.enabled;
 controls.querySelector('.gg-pet-unavailable').hidden=vitalsAvailable;
 for(const [key,label,max] of [['hp','Vida','maxHp'],['shield','Escudo','maxShield']]){
  const l=controls.querySelector('.gg-pet-'+key+'-label'),b=controls.querySelector('.gg-pet-'+key+'-bar');
  l.hidden=b.hidden=!vitalsAvailable;
  if(vitalsAvailable){setHudText(l,label+' '+fmt(petVitals[key])+' / '+fmt(petVitals[max]));b.max=Math.max(1,petVitals[max]);setHudValue(b,Math.max(0,Math.min(b.max,petVitals[key])));}
 }
 const repair=controls.querySelector('.gg-pet-repair');repair.hidden=!vitalsAvailable||!petVitals.destroyed;repair.disabled=petRepairPending||!joined;setHudText(repair,petRepairPending?'Reparando…':'Reparar · '+fmt(petVitals?.repairPrice||0)+' U');
 if(petVitals?.destroyed)setHudText(info,'P.E.T. destruido');setHudText(power,active?'■':'▶');power.title=active?'Apagar P.E.T.':'Activar P.E.T.';power.setAttribute('aria-label',power.title);power.setAttribute('aria-pressed',String(active));
 modes.disabled=petPending||petOwned!==true||!active;modes.value=petMode==='loot'?'loot':petMode==='guard'?'guard':'passive';modes.querySelector('[value="loot"]').disabled=petGear===null||!petGear.has('G-AL1');modes.querySelector('[value="kami"]').disabled=petGear===null||!petGear.has('G-KK1');
 controls.querySelector('.gg-pet-kami').disabled=petPending||!active||petOwned!==true||petGear===null||!petGear.has('G-KK1');
 setHudText(gear,petGear===null?'Módulos: —':(petGear.has('G-AL1')?'Auto-botín':'Sin auto-botín')+' · '+(petGear.has('G-KK1')?'Kamikaze':'Sin kamikaze'));
}
socket.on('v14:petState',s=>{petMode=s.mode;petFuel=s.fuel;petPending=!!s.pending;if(s.vitals?.enabled){petVitalsEpoch++;petVitals=s.vitals;}renderPetPanel();if(petOwned===true&&!petVitals)refreshPetVitals();});
window.addEventListener('gg13:inventory',e=>{petFuel=Number(e.detail.ammo?.find(a=>a.code==='pet-fuel')?.quantity||0);petOwned=e.detail.items.some(i=>i.category==='pet');petGear=new Set(e.detail.items.map(i=>i.code).filter(code=>['G-AL1','G-KK1'].includes(code)));if(!petOwned){petVitals=null;petVitalsEpoch++;}renderPetPanel();if(petOwned)refreshPetVitals();});
socket.on('disconnect',()=>{petMode='off';petFuel=null;petPending=false;petOwned=null;petGear=null;petVitals=null;petVitalsEpoch++;petRepairRequest=null;renderPetPanel();});
document.addEventListener('DOMContentLoaded',()=>queueMicrotask(renderPetPanel));
const ammoCodes=['LCB-10','MCB-25','MCB-50','UCB-100','SAB-50','RSB-75'];let selectedAmmo='LCB-10';const ammoStock={};
const rocketCodes=['R-310','PLT-2026','PLT-2021','PLT-3030'];let rocketBusy=false,rocketUntil=0;
function fireRocket(code){
 if(!joined||rocketBusy||performance.now()<rocketUntil)return;
 if(!selected){notice('Selecciona un objetivo');return;}
 rocketBusy=true;socket.timeout(10000).emit('v18:rocket',code,(err,r)=>{
  rocketBusy=false;if(err||!r?.ok){notice(r?.error||'Cohete no disponible');return;}
  rocketUntil=performance.now()+r.cooldown;ammoStock[code]=r.stock;syncAmmoButtons();notice(code+' · '+(r.damage?fmt(r.damage)+' daño':'Sin daño'));
 });
}
const ordnanceCodes=['PLD-8','DCR-250','R-IC3','ECO-10','SAR-01','SAR-02','HSTRM-01','UBR-100','CBR'];
const ordnanceUntil={};let ordnanceBusy=false;
function fireOrdnance(code){
 if(!joined||ordnanceBusy)return;
 const key=ordnanceCodes.indexOf(code)<3?code:'hellstorm';
 if(performance.now()<(ordnanceUntil[key]||0)){notice('Arma en recarga');return;}
 if(!selected){notice('Selecciona un objetivo');return;}
 ordnanceBusy=true;socket.timeout(10000).emit('v18:ordnance',code,(err,r)=>{
  ordnanceBusy=false;if(err||!r?.ok){notice(r?.error||'Arma no disponible');return;}
  ordnanceUntil[r.key]=performance.now()+r.cooldown;ammoStock[code]=r.stock;syncAmmoButtons();notice(code+' ×'+r.count+' · '+(r.effect?'Efecto aplicado':r.damage?fmt(r.damage)+' daño':'Disparo confirmado'));
 });
}
function decorateAmmoSlot(b,category,code,action,active=false){
 const visual=window.ggShopVisual;
 const theme=window.ggVisualTheme?.current()||'gold';
 if(b.dataset.ammoCode!==code||b.dataset.ammoTheme!==theme){b.dataset.ammoTheme=theme;
  b.dataset.ammoCode=code;b.classList.add('gg-ammo-slot');b.style.setProperty('--ammo-color',visual.itemColor(category,{id:code}));
  const icon=visual.art(category,{id:code});icon.setAttribute('aria-hidden','true');icon.removeAttribute('role');icon.removeAttribute('aria-label');
  const name=document.createElement('span');name.className='gg-ammo-code';name.textContent=code;
  const count=document.createElement('span');count.className='gg-ammo-count';b.replaceChildren(icon,name,count);
 }
 const qty=ammoStock[code],count=b.querySelector('.gg-ammo-count'),label=qty===undefined?'—':fmt(qty);
 if(count.textContent!==label)count.textContent=label;
 b.title=action+' '+code+' · '+(qty===undefined?'Cantidad sin actualizar':label+' disponibles');
 if(b.getAttribute('aria-label')!==b.title)b.setAttribute('aria-label',b.title);
 b.classList.toggle('active',active);b.classList.toggle('gg-ammo-empty',qty===0);
 if(category==='ammo')b.setAttribute('aria-pressed',String(active));
 b.disabled=false;
}
function syncAmmoButtons(){const buttons=document.querySelectorAll('.gg-slots button');ammoCodes.forEach((code,i)=>{const b=buttons[i+1];if(!b)return;decorateAmmoSlot(b,'ammo',code,'Seleccionar',code===selectedAmmo);b.onclick=()=>{if(!joined||!socket.connected)return;selectedAmmo=code;socket.emit('v13:ammo',code);syncAmmoButtons();};});rocketCodes.forEach((code,i)=>{const b=buttons[i+7];if(!b)return;decorateAmmoSlot(b,'rockets',code,'Disparar');b.onclick=()=>fireRocket(code);});ordnanceCodes.forEach((code,i)=>{const b=buttons[i+11];if(!b)return;decorateAmmoSlot(b,i<3?'specialRockets':'launcherAmmo',code,'Disparar');b.onclick=()=>fireOrdnance(code);});}
window.addEventListener('gg:visualTheme',()=>{if(joined)syncAmmoButtons();});
socket.on('v13:ammoStock',({code,quantity})=>{ammoStock[code]=quantity;syncAmmoButtons();});
window.addEventListener('gg13:loadout',()=>socket.emit('v13:reload'));
window.addEventListener('gg13:inventory',e=>{for(const a of e.detail.ammo||[])ammoStock[a.code]=a.quantity;syncAmmoButtons();});
document.addEventListener('DOMContentLoaded',()=>queueMicrotask(syncAmmoButtons));
let damageNumbers=[];
function receiveLaserDamage(d){if(!joined||!Number.isFinite(d?.amount)||d.amount<=0||!Number.isFinite(d.x)||!Number.isFinite(d.y))return;if(state.map!==undefined&&d.map!==state.map)return;if(damageNumbers.length>=100)damageNumbers.shift();damageNumbers.push({...d,born:performance.now()});}
socket.on('gg:laserDamage',receiveLaserDamage);
socket.on('laser',l=>{if(l&&lasers.length<250)lasers.push({...l,born:performance.now()});});
socket.on('state',s=>{if(!joined)return;if(state.map!==s.map){entities.clear();selected=null;attacking=false;dest=null;lasers=[];damageNumbers=[];kamiEffects=[];mineEffects=[];}state=s;const present=new Set();for(const [list,prefix] of [[s.players,'p'],[s.npcs,'n']])for(const o of list){const k=prefix+o.id;present.add(k);const old=entities.get(k);if(old&&distance(old,o)<1100&&!o.deadUntil&&!old.data.deadUntil){old.tx=o.x;old.ty=o.y;old.ta=o.angle;old.data=o;if(prefix==='p'&&(!o.pet||!Number.isFinite(o.pet.x)||!Number.isFinite(o.pet.y)))old.petVisual=null;}else{entities.set(k,{x:o.x,y:o.y,tx:o.x,ty:o.y,a:o.angle,ta:o.angle,data:o});if(o.id===meId){camera.x=o.x;camera.y=o.y;}}}for(const k of entities.keys())if(!present.has(k))entities.delete(k);const p=s.players.find(p=>p.id===meId);if(p){const now=performance.now();if(now>pendingSelectUntil)selected=p.target;if(now>pendingAttackUntil)attacking=p.attack;if(p.deadUntil){selected=null;attacking=false;dest=null;}}});
function sendMove(x,y){if(!joined||!socket.connected)return;dest={x:clamp(x,25,world.w-25),y:clamp(y,25,world.h-25)};socket.emit('move',dest);}
function intersectsViewport(q,r,w=W,h=H){return q.x+r>=0&&q.x-r<=w&&q.y+r>=0&&q.y-r<=h;}
function screen(x,y){return {x:x-camera.x+W/2,y:y-camera.y+H/2};}
function select(id){if(!joined||!socket.connected)return;selected=id;attacking=false;pendingSelectUntil=pendingAttackUntil=performance.now()+250;socket.emit('select',id);}
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
// Stellar map navigation uses existing movement and portal authorization.
window.gg171StarMap=()=>new Promise((resolve,reject)=>{
 if(!joined||!socket.connected)return reject(Error('Inicia sesión para consultar el sistema estelar'));
 socket.timeout(6000).emit('v171:starMap',(err,r)=>{if(err||!r?.ok)reject(Error(r?.error||'Sistema estelar no disponible'));else resolve(r);});
});
window.gg171TravelSector=destination=>{
 if(!joined||!socket.connected||gateState.inside)throw Error('Salto no disponible en este momento');
 const portal=(state.portals||[]).find(q=>q.to===destination);
 if(!portal)throw Error('No hay portal directo hacia ese sector');
 const me=entities.get('p'+meId);
 if(!me||me.data.deadUntil)throw Error('Espera a reaparecer');
 if(distance(me,portal)<=portalRange(portal)){jumpPortal(portal);return 'Solicitud de salto enviada';}
 sendMove(portal.x,portal.y);notice('Portal a '+destination+' · Pulsa J al llegar');return 'Navegando al portal de '+destination+' · Pulsa J al llegar';
};
function nearestPortal(list=visiblePortals()){const me=entities.get('p'+meId);if(!me)return null;let best=null,min=Infinity;for(const p of list){const d=distance(me,p);if(d<=portalRange(p)&&d<min){min=d;best=p;}}return best;}
socket.on('v14:map',s=>{entities.clear();selected=null;attacking=false;dest=null;lasers=[];damageNumbers=[];notice('Sector '+s.map);window.dispatchEvent(new CustomEvent('gg171:sectorChanged',{detail:{map:s.map}}));});
$('fire').onclick=toggleAttack;window.ggArsenalCanUse=()=>joined&&socket.connected;addEventListener('keydown',e=>{if(joined&&e.key==='Escape')select(null);if(joined&&e.key.toLowerCase()==='j'&&!e.repeat&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)){const portal=nearestPortal();if(portal)jumpPortal(portal);else notice('Acércate a un portal para saltar');}});
function clickedLoot(boxes,x,y,project){let best=null,dist=22;for(const b of boxes||[]){const p=project(b.x,b.y),d=Math.hypot(p.x-x,p.y-y);if(d<dist){dist=d;best=b;}}return best;}
let dragging=false,lastMove=0;function mapPointer(e,initial){const x=e.clientX,y=e.clientY;if(initial){const loot=clickedLoot(state.boxes,x,y,screen);if(loot){sendMove(loot.x,loot.y);lastMove=performance.now();return false;}const iceUnits=state.ice?.phase==='active'?[state.ice.boss,...state.ice.icy].filter(Boolean):[];const icy=iceUnits.find(u=>{const q=screen(u.x,u.y);return Math.hypot(q.x-x,q.y-y)<(u.name==='Icy'?24:45);});if(icy){select('ice:'+icy.id);return false;}const target=(state.hitac?.units||[]).find(u=>{const q=screen(u.x,u.y);return Math.hypot(q.x-x,q.y-y)<(u.name==='Hitac Mothership'?42:28);});if(target){select('hitac:'+target.id);return false;}const ball=state.spaceball?.ball;if(ball){const q=screen(ball.x,ball.y);if(Math.hypot(q.x-x,q.y-y)<40){select('event:spaceball');return false;}}for(const portal of visiblePortals()){const q=screen(portal.x,portal.y);if(Math.hypot(q.x-x,q.y-y)<55){if(nearestPortal()?.id===portal.id)jumpPortal(portal);else{sendMove(portal.x,portal.y);notice('Portal a '+portal.to+' · Pulsa J al llegar');}return false;}}let closest=null,best=42;for(const [n,prefix] of [...state.npcs.map(n=>[n,'n']),...state.players.filter(p=>p.id!==meId&&!p.deadUntil&&!p.cloaked).map(p=>[p,'p'])]){const v=entities.get(prefix+n.id);if(!v)continue;const p=screen(v.x,v.y),d=Math.hypot(p.x-x,p.y-y);if(d<best){best=d;closest=n;}}if(closest){select(closest.id);return false;}}sendMove(x+camera.x-W/2,y+camera.y-H/2);lastMove=performance.now();return true;}
canvas.addEventListener('pointerdown',e=>{if(!joined||e.button!==0)return;dragging=mapPointer(e,true);if(dragging)canvas.setPointerCapture(e.pointerId);});canvas.addEventListener('pointermove',e=>{if(dragging&&performance.now()-lastMove>90)mapPointer(e,false);});for(const ev of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(ev,()=>dragging=false);
mini.addEventListener('pointerdown',e=>{
 if(!joined||e.button!==0)return;const bounds=mini.getBoundingClientRect(),x=(e.clientX-bounds.left)/bounds.width*mini.width,y=(e.clientY-bounds.top)/bounds.height*mini.height,r=radarProjection(mini.width,mini.height,world.w,world.h);
 let portal=null,best=9;for(const p of visiblePortals()){const d=Math.hypot(x-r.left-p.x*r.sx,y-r.top-p.y*r.sy);if(d<best){best=d;portal=p;}}
 if(portal){sendMove(portal.x,portal.y);notice('Portal a '+portal.to+' · Pulsa J al llegar');return;}
 if(x<r.left||x>r.left+r.width||y<r.top||y>r.top+r.height)return;
 sendMove((x-r.left)/r.sx,(y-r.top)/r.sy);
});
// Deterministic procedural stars: no external graphics or CDN.
function hash(x,y,k){const n=Math.sin(x*127.1+y*311.7+k*74.7)*43758.5453;return n-Math.floor(n);}
// GOLD: repeat cached star fields at three parallax speeds, avoiding per-star work every frame.
const goldStarLayers=[[1,.12,.7,110],[2,.38,1.0,155],[3,.75,1.5,240]];
const goldStarTiles=new Map();
function goldStarTile(layer,size,cell){
 if(goldStarTiles.has(layer))return goldStarTiles.get(layer);
 const count=6,span=cell*count,tile=document.createElement('canvas');
 tile.width=tile.height=span;const a=tile.getContext('2d');
 a.fillStyle=layer===3?'#a4d6ff':'#d1dcf3';
 // Include the wrapped edge cells so the tile has no visible seams.
 for(let ix=-1;ix<=count;ix++)for(let iy=-1;iy<=count;iy++){
  const hx=(ix+count)%count,hy=(iy+count)%count;
  const x=ix*cell+hash(hx,hy,layer)*cell,y=iy*cell+hash(hx,hy,layer+4)*cell;
  const r=size*(.35+hash(hx,hy,layer+15)*.65);
  if(x+r<0||x-r>span||y+r<0||y-r>span)continue;
  a.globalAlpha=.18+hash(hx,hy,layer+9)*.55;
  a.beginPath();a.arc(x,y,r,0,Math.PI*2);a.fill();
 }
 a.globalAlpha=1;goldStarTiles.set(layer,tile);return tile;
}
function drawGoldStars(){
 for(let i=0;i<qualityProfiles[quality].stars;i++){
  const [layer,par,size,cell]=goldStarLayers[i],tile=goldStarTile(layer,size,cell),span=tile.width;
  const ox=camera.x*par-W/2,oy=camera.y*par-H/2;
  const startX=-((ox%span+span)%span),startY=-((oy%span+span)%span);
  for(let x=startX;x<W;x+=span)for(let y=startY;y<H;y+=span)ctx.drawImage(tile,x,y);
 }
}
function stars(){window.ggGraphics161.sky(ctx,W,H);if((window.ggVisualTheme?.current()||'gold')==='gold'){drawGoldStars();}else{for(const [layer,par,size,cell] of [[1,.12,.7,110],[2,.38,1.0,155],[3,.75,1.5,240]].slice(0,qualityProfiles[quality].stars)){const ox=camera.x*par-W/2,oy=camera.y*par-H/2;for(let ix=Math.floor(ox/cell);ix<=Math.ceil((ox+W)/cell);ix++)for(let iy=Math.floor(oy/cell);iy<=Math.ceil((oy+H)/cell);iy++){const x=ix*cell+hash(ix,iy,layer)*cell-ox,y=iy*cell+hash(ix,iy,layer+4)*cell-oy;ctx.globalAlpha=.18+hash(ix,iy,layer+9)*.55;ctx.fillStyle=layer===3?'#a4d6ff':'#d1dcf3';ctx.beginPath();ctx.arc(x,y,size*(.35+hash(ix,iy,layer+15)*.65),0,Math.PI*2);ctx.fill();}}}ctx.globalAlpha=1;const corner=screen(0,0);ctx.strokeStyle='#647d994d';ctx.lineWidth=2;ctx.strokeRect(corner.x,corner.y,world.w,world.h);}
function poly(points,fill,stroke){ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1.3;ctx.stroke();}}
function ship(v,isMe,npc){
 const o=v.data,p=screen(v.x,v.y);if(p.x<-160||p.y<-160||p.x>W+160||p.y>H+160||o.deadUntil)return;
 const boss=o.type==='boss',tank=o.ship==='tank',size=boss?1.7:tank?1.2:1,graphics=window.ggGraphics161;
 const visual=npc?graphics.npcStyle(o.name,o.type):graphics.playerStyle(o.ship,o.design,isMe);
 const offsets=npc?[]:graphics.formationOffsets(o.droneCount,o.formation),layout=graphics.labelLayout(o,visual,npc,size,v.a,offsets);
 ctx.save();ctx.translate(p.x,p.y);ctx.scale(size,size);ctx.rotate(v.a);graphics.draw(ctx,visual.kind,visual.color);
 if(!npc)drawFormation(o,offsets);ctx.restore();
 if(!isMe&&selected===o.id){ctx.strokeStyle='#ff725e';ctx.lineWidth=1.5;ctx.setLineDash([6,4]);ctx.beginPath();ctx.arc(p.x,p.y,layout.ring,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);}
 if(isMe){ctx.strokeStyle='#71ecc04d';ctx.beginPath();ctx.arc(p.x,p.y,layout.ring,0,Math.PI*2);ctx.stroke();}
 const top=p.y-layout.top,bw=layout.width,classic=window.ggVisualTheme?.current()==='classic';ctx.save();if(classic&&window.ggClassicHud){window.ggClassicHud.vitals(ctx,p.x,top,bw,graphics.safeRatio(o.hp,o.maxHp),graphics.safeRatio(o.shield,o.maxShield));}else{ctx.fillStyle='#101a28';ctx.fillRect(p.x-bw/2,top,bw,4);ctx.fillRect(p.x-bw/2,top+6,bw,4);
 ctx.fillStyle='#63e6a2';ctx.fillRect(p.x-bw/2,top,bw*graphics.safeRatio(o.hp,o.maxHp),4);
 ctx.fillStyle='#57aaff';ctx.fillRect(p.x-bw/2,top+6,bw*graphics.safeRatio(o.shield,o.maxShield),4);}
 ctx.textAlign='center';ctx.font=(boss?'bold 13px':'11px')+' system-ui';ctx.fillStyle=window.ggVisualTheme?.current()==='classic'?(npc?'#ff6d6a':'#f3f4f5'):(npc?'#ff9b89':isMe?'#ddfff0':'#badbff');ctx.strokeStyle='#060a12';ctx.lineWidth=3;ctx.lineJoin='round';
 const name=(o.clanTag?'['+o.clanTag+'] ':'')+o.name,marks=npc?null:window.ggRankVisual.gateMarks(o.gateRings),nameY=p.y+layout.name+(marks?.offset||0);ctx.strokeText(name,p.x,nameY);ctx.fillText(name,p.x,nameY);if(!npc){const badge=window.ggRankVisual.badge(o.rank);const badgeX=p.x-ctx.measureText(name).width/2-20;if(badge){ctx.drawImage(badge,badgeX,nameY-13,17,17);window.ggRankVisual.drawGateMarks(ctx,marks,badgeX+8.5,nameY);}if(o.title){ctx.fillStyle=classic?'#ff7167':'#e9c980';ctx.font='bold 10px system-ui';ctx.strokeText(o.title,p.x,top-7);ctx.fillText(o.title,p.x,top-7);}}
 ctx.restore();
}
function drawFormation(o,offsets){
 const graphics=window.ggGraphics161;offsets.forEach(({x,y},i)=>{ctx.save();ctx.translate(x,y);const drone=o.droneVisuals?.[i],color=graphics.droneColor(drone?.design);graphics.draw(ctx,graphics.droneKind(drone?.code),color);if(drone?.rank>1){ctx.fillStyle=color;ctx.font='8px system-ui';ctx.fillText(String(drone.rank),-2,10);}ctx.restore();});
}
// Visual-only interpolation: server positions remain authoritative for combat and rewards.
function smoothPetPosition(previous,pet,alpha){
 if(!pet||!Number.isFinite(pet.x)||!Number.isFinite(pet.y))return null;
 const angle=Number.isFinite(pet.angle)?pet.angle:0;
 if(!previous||Math.hypot(pet.x-previous.x,pet.y-previous.y)>1100)return {x:pet.x,y:pet.y,angle};
 const dx=pet.x-previous.x,dy=pet.y-previous.y,prior=Number.isFinite(previous.angle)?previous.angle:angle;
 const da=Math.atan2(Math.sin(angle-prior),Math.cos(angle-prior));
 return {x:Math.abs(dx)<.01?pet.x:previous.x+dx*alpha,y:Math.abs(dy)<.01?pet.y:previous.y+dy*alpha,angle:prior+da*alpha};
}
function drawPet(p,v,alpha){
 if(v)v.petVisual=smoothPetPosition(v.petVisual,p.pet,alpha);
 if(!p.pet||!Number.isFinite(p.pet.x)||!Number.isFinite(p.pet.y))return;
 const position=v?.petVisual||p.pet;
 const q=screen(position.x,position.y);if(q.x<-50||q.y<-50||q.x>W+50||q.y>H+50)return;
 ctx.save();ctx.translate(q.x,q.y);ctx.save();ctx.rotate(Number.isFinite(position.angle)?position.angle:0);
 window.ggGraphics161.draw(ctx,'pet','#5ae5ff');ctx.restore();
 const pv=p.pet.vitals;if(pv?.enabled){const bar=(y,value,max,color)=>{ctx.fillStyle='#17212d';ctx.fillRect(-21,y,42,4);ctx.fillStyle=color;ctx.fillRect(-21,y,42*Math.max(0,Math.min(1,value/Math.max(1,max))),4);};bar(-28,pv.hp,pv.maxHp,'#4ee07a');bar(-22,pv.shield,pv.maxShield,'#52a9ff');}
 ctx.font='10px system-ui';ctx.textAlign='center';ctx.fillStyle='#c2e7f5';ctx.strokeStyle='#060a12';ctx.lineWidth=3;ctx.strokeText('P.E.T.',0,28);ctx.fillText('P.E.T.',0,28);ctx.restore();
}
let kamiEffects=[];
socket.on('v16:kamikazeEffect',e=>{kamiEffects.push({...e,born:performance.now()});});
function drawKamikaze(t){kamiEffects=kamiEffects.filter(e=>t-e.born<850);for(const e of kamiEffects){const q=screen(e.x,e.y),f=Math.max(0,Math.min(1,(t-e.born)/850));if(!intersectsViewport(q,e.radius*Math.sqrt(f)+32))continue;ctx.save();ctx.globalAlpha=1-f;ctx.strokeStyle='#ffd27a';ctx.shadowColor='#ff9b40';ctx.shadowBlur=24*qualityProfiles[quality].glow;ctx.lineWidth=7;ctx.beginPath();ctx.arc(q.x,q.y,Math.max(2,e.radius*Math.sqrt(f)),0,Math.PI*2);ctx.stroke();ctx.fillStyle='#ffab3820';ctx.fill();ctx.restore();}}
function drawBase(t){
 const b=state.base;if(!b)return;const q=screen(b.x,b.y);if(!intersectsViewport(q,Math.max(b.radius||0,180)+20))return;ctx.save();ctx.translate(q.x,q.y);
 ctx.strokeStyle=b.color+'55';ctx.fillStyle=b.color+'09';ctx.setLineDash([12,10]);ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,b.radius,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.setLineDash([]);
 if(window.ggVisualTheme?.current()==='classic'&&window.ggClassicArt?.base){window.ggClassicArt.base(ctx,b.color,t);ctx.fillStyle='#fff';ctx.font='bold 20px system-ui';ctx.textAlign='center';ctx.fillText(b.name,0,7);ctx.font='bold 13px system-ui';ctx.fillText('BASE '+b.name+' · ZONA SEGURA',0,125);ctx.restore();return;}
 ctx.shadowColor=b.color;ctx.shadowBlur=12*qualityProfiles[quality].glow;ctx.strokeStyle=b.color;ctx.fillStyle='#182533';
 for(let i=0;i<6;i++){ctx.save();ctx.rotate(i*Math.PI/3);poly([[55,-24],[145,-17],[170,0],[145,17],[55,24]],'#253747',b.color);ctx.restore();}
 ctx.lineWidth=5;ctx.beginPath();ctx.arc(0,0,94,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,68,0,Math.PI*2);ctx.stroke();
 ctx.fillStyle=b.color;ctx.beginPath();ctx.arc(0,0,36+Math.sin(t/500)*3,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#fff';ctx.font='bold 20px system-ui';ctx.textAlign='center';ctx.fillText(b.name,0,7);ctx.font='bold 13px system-ui';ctx.fillText('BASE '+b.name+' · ZONA SEGURA',0,125);ctx.restore();
}
function drawPortals(t){
 const list=visiblePortals(),near=nearestPortal(list);for(const portal of list){const q=screen(portal.x,portal.y);if(q.x<-100||q.x>W+100||q.y<-100||q.y>H+100)continue;
 ctx.save();ctx.translate(q.x,q.y);const color=portal.kind==='exit'?'#6df3b4':portal.kind==='galaxy'?'#eac66d':'#5fd9ff';window.ggGraphics161.portal(ctx,color,t);ctx.restore();
 ctx.save();ctx.font='bold 12px system-ui';ctx.fillStyle='#b7eaff';ctx.textAlign='center';ctx.fillText(portal.kind==='exit'?'SALIDA · '+Math.max(0,Math.ceil((gateState.localUntil-performance.now())/1000))+' s':(portal.kind==='galaxy'?'GG ':'PORTAL ')+portal.to,q.x,q.y+66);if(near?.id===portal.id)ctx.fillText('[J] SALTAR',q.x,q.y+82);ctx.restore();
 }
}
let mineEffects=[];
socket.on('v18:mineBlast',e=>mineEffects.push({...e,born:performance.now()}));
let empPending=false;
window.gg120Sell=data=>new Promise((resolve,reject)=>{if(!joined||!socket.connected)return reject(Error('Conéctate primero'));socket.timeout(8000).emit('v120:cbsSell',data,(err,r)=>{if(err||!r?.ok)reject(Error(r?.error||'Comercio no disponible'));else resolve(r);});});
window.gg129ArenaCommand=data=>new Promise((resolve,reject)=>{if(!joined||!socket.connected)return reject(Error('Conéctate primero'));socket.timeout(3000).emit('v129:arenaCommand',data,(err,r)=>{if(err||!r?.ok)reject(Error(r?.error||'Acción no disponible'));else resolve(r);});});
socket.on('v129:arena',state=>window.dispatchEvent(new CustomEvent('gg129:arena',{detail:state})));
window.gg136InvasionCommand=data=>new Promise((resolve,reject)=>{if(!joined||!socket.connected)return reject(Error('Conéctate primero'));socket.timeout(3000).emit('v136:invasionCommand',data,(err,r)=>{if(err||!r?.ok)reject(Error(r?.error||'Acción no disponible'));else resolve(r);});});
socket.on('v136:invasionState',state=>window.dispatchEvent(new CustomEvent('gg136:invasionState',{detail:state})));
window.gg135Invasion=data=>new Promise((resolve,reject)=>{if(!joined||!socket.connected)return reject(Error('Conéctate primero'));socket.timeout(8000).emit('v135:invasion',data,(err,r)=>{if(err||!r?.ok)reject(Error(r?.error||'Invasión no disponible'));else resolve(r);});});
socket.on('v135:invasion',state=>window.dispatchEvent(new CustomEvent('gg135:invasion',{detail:state})));
window.gg127UBA=data=>new Promise((resolve,reject)=>{if(!joined||!socket.connected)return reject(Error('Conéctate primero'));socket.timeout(8000).emit('v127:uba',data,(err,r)=>{if(err||!r?.ok)reject(Error(r?.error||'Sala UBA no disponible'));else resolve(r);});});
socket.on('v127:ubaState',state=>window.dispatchEvent(new CustomEvent('gg127:ubaState',{detail:state})));
window.gg116Shot=data=>new Promise((resolve,reject)=>{if(!joined||!socket.connected)return reject(Error('Conéctate primero'));socket.timeout(8000).emit('v116:cbsShot',data,(err,r)=>{if(err||!r?.ok)reject(Error(r?.error||'Disparo no disponible'));else{cbsPoll=0;resolve(r);}});});
window.gg115CBS=data=>new Promise((resolve,reject)=>{if(!joined||!socket.connected)return reject(Error('Conéctate primero'));socket.timeout(8000).emit('v115:cbs',data,(err,r)=>{if(err||!r?.ok)reject(Error(r?.error||'Estación no disponible'));else resolve(r);});});
window.gg115Map=()=>state.map;
window.gg115Travel=a=>{if(!joined||state.map!==a.map)throw Error('Viaja primero al sector '+a.map);sendMove(a.x,a.y);};
let cbsMarkers=[],cbsMarkerMap=null,cbsPoll=0,cbsLoading=false;
function refreshCBS(t){
 if(!joined||cbsLoading||!state.map||gateState.inside)return;
 if(cbsMarkerMap===state.map&&t<cbsPoll)return;
 const map=state.map;if(cbsMarkerMap!==map)cbsMarkers=[];cbsMarkerMap=map;cbsPoll=t+15000;cbsLoading=true;
 fetch('/api/v13/stations',{credentials:'same-origin'}).then(r=>{if(!r.ok)throw Error('CBS');return r.json();}).then(d=>{if(state.map===map)cbsMarkers=d.asteroids.filter(a=>a.map===map);}).catch(()=>{}).finally(()=>{cbsLoading=false;});
}
function drawCBS(t){
 refreshCBS(t);if(cbsMarkerMap!==state.map||gateState.inside)return;
 for(const a of cbsMarkers){const p=screen(a.x,a.y);if(p.x<-120||p.x>W+120||p.y<-120||p.y>H+120)continue;
 ctx.save();ctx.translate(p.x,p.y);const color=a.station?.state==='protected'?'#8dc5ff':a.station?'#e7bb67':'#aaa5a0';
 if(a.station&&window.ggVisualTheme?.current()==='classic'&&window.ggClassicArt?.station){window.ggClassicArt.station(ctx,color);}else{ctx.fillStyle='#2c2930';ctx.strokeStyle=color;ctx.lineWidth=3;ctx.beginPath();for(let i=0;i<10;i++){const ang=i*Math.PI/5,r=38+(i%2)*10;const x=Math.cos(ang)*r,y=Math.sin(ang)*r;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.closePath();ctx.fill();ctx.stroke();}
 if(a.station){for(let i=0;i<8;i++){const angle=i*Math.PI/4;ctx.fillStyle=a.station.modules?.find(m=>m.slot===i+2)?.hp===0?'#302323':'#605542';ctx.strokeStyle=color;ctx.beginPath();ctx.arc(Math.cos(angle)*62,Math.sin(angle)*62,9,0,2*Math.PI);ctx.fill();ctx.stroke();}if(a.station.state==='protected'){ctx.strokeStyle='#70baff90';ctx.beginPath();ctx.arc(0,0,82,0,Math.PI*2);ctx.stroke();}}
 ctx.font='12px system-ui';ctx.textAlign='center';ctx.fillStyle=color;ctx.fillText(a.station?'CBS ['+a.station.clan_tag+']':'Asteroide libre',0,99);ctx.restore();}
}
window.gg114Bid=data=>new Promise((resolve,reject)=>{if(!joined||!socket.connected)return reject(Error('Conéctate primero'));socket.timeout(8000).emit('v114:bid',data,(err,r)=>{if(err||!r?.ok)reject(Error(r?.error||'Puja no disponible'));else resolve(r);});});
window.gg112Booster=data=>new Promise((resolve,reject)=>{if(!joined||!socket.connected)return reject(Error('Conéctate primero'));socket.timeout(8000).emit('v112:booster',data,(err,r)=>{if(err||!r?.ok)reject(Error(r?.error||'Booster no disponible'));else resolve(r);});});
window.gg110Emp=()=>new Promise((resolve,reject)=>{if(!joined||!socket.connected)return reject(Error('Conéctate primero'));if(empPending)return reject(Error('EMP pendiente'));empPending=true;socket.timeout(8000).emit('v110:emp',(err,r)=>{empPending=false;if(err||!r?.ok)reject(Error(r?.error||'EMP no disponible'));else resolve(r);});});
addEventListener('keydown',e=>{if(joined&&e.key.toLowerCase()==='e'&&!e.repeat&&!e.ctrlKey&&!e.altKey&&!e.metaKey&&!document.querySelector('dialog[open]')&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))window.gg110Emp().catch(e=>notice(e.message));});
window.gg18Mine=code=>new Promise((resolve,reject)=>{if(!joined)return reject(Error('Conéctate primero'));socket.timeout(8000).emit('v18:mine',code,(err,r)=>{if(err||!r?.ok)reject(Error(r?.error||'Mina no disponible'));else resolve(r);});});
function drawMines(t){for(const m of state.mines||[]){const p=screen(m.x,m.y);if(p.x<-20||p.x>W+20||p.y<-20||p.y>H+20)continue;ctx.save();ctx.translate(p.x,p.y);if(window.ggVisualTheme?.current()==='classic'&&window.ggClassicArt?.mine){window.ggClassicArt.mine(ctx,Date.now()>=m.armedAt,t);ctx.restore();continue;}ctx.strokeStyle='#ff8668';ctx.fillStyle='#472a27';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,11,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle=Date.now()>=m.armedAt?'#ff6246':'#e9b76a';ctx.beginPath();ctx.arc(0,0,3+Math.sin(t/120)*1.5,0,Math.PI*2);ctx.fill();ctx.restore();}mineEffects=mineEffects.filter(e=>t-e.born<650);for(const e of mineEffects){const q=screen(e.x,e.y),f=(t-e.born)/650;ctx.save();ctx.globalAlpha=1-f;ctx.strokeStyle='#ffad72';ctx.lineWidth=4;ctx.beginPath();ctx.arc(q.x,q.y,Math.max(1,e.radius*f),0,Math.PI*2);ctx.stroke();ctx.restore();}}
let hitacPing=null;socket.on('v142:hitacPing',p=>{hitacPing={...p,until:Date.now()+5000};notice('Hitac en '+p.map);});
let icePing=null;socket.on('v147:icePing',p=>{icePing={...p,until:Date.now()+5000};});
function drawIce(t){const e=state.ice;if(!e)return;ctx.save();if(e.phase==='countdown'){ctx.fillStyle='#a9eaff';ctx.font='bold 16px system-ui';ctx.textAlign='center';ctx.fillText('METEORITO DE HIELO · '+Math.max(0,Math.ceil((e.startAt-Date.now())/1000))+' s',W/2,115);}for(const u of [e.boss,...e.icy].filter(Boolean)){const q=screen(u.x,u.y),r=u.name==='Icy'?20:45;if(!intersectsViewport(q,r+35))continue;if(window.ggVisualTheme?.current()==='classic'&&window.ggClassicArt?.ice){ctx.save();ctx.translate(q.x,q.y);ctx.rotate(t/9500);window.ggClassicArt.ice(ctx,r);ctx.restore();if(selected==='ice:'+u.id){ctx.strokeStyle='#ffcf76';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(q.x,q.y,r+5,0,Math.PI*2);ctx.stroke();}}else{ctx.beginPath();for(let i=0;i<8;i++){const a=i*Math.PI/4,k=i%2?.75:1,x=q.x+Math.cos(a)*r*k,y=q.y+Math.sin(a)*r*k;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.closePath();ctx.fillStyle='#346f9d';ctx.strokeStyle=selected==='ice:'+u.id?'#fff2b7':'#a9eaff';ctx.lineWidth=2;ctx.fill();ctx.stroke();}ctx.fillStyle='#30d080';ctx.fillRect(q.x-r,q.y-r-12,2*r*u.hp/u.maxHp,4);ctx.fillStyle='#539cff';ctx.fillRect(q.x-r,q.y-r-6,2*r*u.shield/u.maxShield,4);ctx.font='11px system-ui';ctx.textAlign='center';ctx.fillStyle='#d7f7ff';ctx.fillText(u.name,q.x,q.y+r+15);}for(const b of e.boxes){const q=screen(b.x,b.y);if(!intersectsViewport(q,10))continue;ctx.strokeStyle='#a9eaff';ctx.strokeRect(q.x-8,q.y-8,16,16);}ctx.restore();}
function drawHitac(t){const e=state.hitac;if(!e)return;ctx.save();for(const u of e.units){const q=screen(u.x,u.y),r=u.name==='Hitac Mothership'?40:22;if(!intersectsViewport(q,r+35))continue;ctx.fillStyle='#9c73db';ctx.strokeStyle=u.immune?'#8cdcff':'#d4b6ff';ctx.lineWidth=2;ctx.beginPath();for(let i=0;i<6;i++){const a=i*Math.PI/3;const x=q.x+Math.cos(a)*r,y=q.y+Math.sin(a)*r;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.closePath();ctx.fill();ctx.stroke();if(u.immune||selected==='hitac:'+u.id){ctx.beginPath();ctx.arc(q.x,q.y,r+9,0,Math.PI*2);ctx.strokeStyle=u.immune?'#55d5ff':'#eacc78';ctx.stroke();}ctx.fillStyle='#2fd080';ctx.fillRect(q.x-r,q.y-r-12,2*r*u.hp/u.maxHp,4);ctx.fillStyle='#4c9cff';ctx.fillRect(q.x-r,q.y-r-6,2*r*u.shield/u.maxShield,4);ctx.fillStyle='#e9e0f6';ctx.font='11px system-ui';ctx.textAlign='center';ctx.fillText(u.name,q.x,q.y+r+15);}ctx.restore();}
function drawSpaceball(t){const e=state.spaceball;if(!e)return;const colors={1:'#f06452',2:'#57aaff',3:'#72df91'};ctx.save();for(const g of e.goals){const q=screen(g.x,g.y);if(!intersectsViewport(q,154))continue;ctx.strokeStyle=colors[g.company];ctx.lineWidth=3;ctx.beginPath();ctx.arc(q.x,q.y,150,0,Math.PI*2);ctx.stroke();}if(e.ball&&intersectsViewport(screen(e.ball.x,e.ball.y),50)){const q=screen(e.ball.x,e.ball.y);ctx.shadowBlur=20*qualityProfiles[quality].glow;ctx.shadowColor='#f9da80';ctx.fillStyle='#e7c36c';ctx.beginPath();ctx.arc(q.x,q.y,24,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.strokeStyle=selected==='event:spaceball'?'#ffedb1':'#735b30';ctx.stroke();}for(const b of e.boxes){const q=screen(b.x,b.y);if(!intersectsViewport(q,10))continue;ctx.strokeStyle='#e7c36c';ctx.strokeRect(q.x-7,q.y-7,14,14);}ctx.fillStyle='#e7c36c';ctx.textAlign='center';ctx.font='bold 15px system-ui';ctx.fillText('SPACEBALL · MMO '+e.scores[1]+' | EIC '+e.scores[2]+' | VRU '+e.scores[3],W/2,90);if(e.resetAt)ctx.fillText('Reinicio en '+Math.max(0,Math.ceil((e.resetAt-Date.now())/1000))+' s',W/2,110);ctx.restore();}
function drawBoxes(t){for(const b of state.boxes){const p=screen(b.x,b.y);if(p.x<-20||p.x>W+20||p.y<-20||p.y>H+20)continue;ctx.save();ctx.translate(p.x,p.y);if(window.ggVisualTheme?.current()==='classic'&&window.ggClassicArt?.loot){ctx.rotate(b.kind==='pirate'?0:t/2500);window.ggClassicArt.loot(ctx,b.kind);ctx.restore();continue;}ctx.rotate(b.kind==='pirate'?0:t/1800);if(b.kind==='pirate'){ctx.shadowColor='#49f79a';ctx.shadowBlur=14*qualityProfiles[quality].glow;poly([[-13,-8],[13,-8],[13,9],[-13,9]],'#124937','#81ffb4');ctx.shadowBlur=0;ctx.fillStyle='#2bd979';ctx.fillRect(-13,-2,26,3);ctx.fillStyle='#d0ffe4';ctx.fillRect(-3,-4,6,8);ctx.restore();continue;}const palette=b.kind==='paladio'?['#50dfdb','#276a78','#b6ffff']:b.kind==='cargo'?['#9ecbff','#365f95','#e1f2ff']:['#fbc45b','#896331','#ffe2a0'];ctx.shadowColor=palette[0];ctx.shadowBlur=12*qualityProfiles[quality].glow;poly([[0,-10],[10,0],[0,10],[-10,0]],palette[1],palette[2]);ctx.shadowBlur=0;poly([[0,-4],[4,0],[0,4],[-4,0]],palette[2]);ctx.restore();}}
function segmentIntersectsViewport(a,b,w,h,padding=20){return Math.max(a.x,b.x)>=-padding&&Math.min(a.x,b.x)<=w+padding&&Math.max(a.y,b.y)>=-padding&&Math.min(a.y,b.y)<=h+padding;}
function drawLasers(t){lasers=lasers.filter(l=>t-l.born<180);for(const l of lasers){const a=screen(l.x,l.y),b=screen(l.tx,l.ty);if(!segmentIntersectsViewport(a,b,W,H))continue;if(window.ggVisualTheme?.current()==='classic'&&window.ggClassicArt?.beam){window.ggClassicArt.beam(ctx,a,b,l,(t-l.born)/180,qualityProfiles[quality].glow);continue;}const color=l.kind==='rocket'?'#ffcf68':l.kind==='player'?'#83ffb5':l.kind==='boss'?'#79aaff':'#ff7766';ctx.save();ctx.globalAlpha=1-(t-l.born)/180;ctx.strokeStyle=color;ctx.shadowColor=color;ctx.shadowBlur=13*qualityProfiles[quality].glow;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.lineWidth=1;ctx.strokeStyle='#fff';ctx.stroke();ctx.restore();}}
function drawDamageNumbers(t){const duration=1500;damageNumbers=damageNumbers.filter(d=>t-d.born<duration);for(const d of damageNumbers){const target=d.targetId&&entities.get('n'+d.targetId);if(target){d.x=target.x;d.y=target.y;}const q=screen(d.x,d.y);if(!intersectsViewport(q,180))continue;const age=Math.max(0,(t-d.born)/duration);ctx.save();ctx.globalAlpha=Math.min(1,(1-age)*3);ctx.font='900 23px system-ui';ctx.textAlign='center';ctx.lineJoin='round';ctx.lineWidth=4;ctx.strokeStyle='#160307';ctx.fillStyle='#ff5c59';const y=q.y-Math.max(72,d.offset||64)-age*32,label=fmt(d.amount);ctx.strokeText(label,q.x,y);ctx.fillText(label,q.x,y);ctx.restore();}}
let radarGrid=null,radarLast=0,radarMap=null,radarTheme=null;const radarIntervals={low:200,medium:150,high:100};
const radarColumns=8,radarRows=6,radarMargin=13;
function radarProjection(w,h,worldW,worldH){return {left:radarMargin,top:radarMargin,width:w-radarMargin-2,height:h-radarMargin-2,sx:(w-radarMargin-2)/worldW,sy:(h-radarMargin-2)/worldH};}
function radarSector(x,y,w,h){const col=Math.max(0,Math.min(radarColumns-1,Math.floor(x/w*radarColumns))),row=Math.max(0,Math.min(radarRows-1,Math.floor(y/h*radarRows)));return String.fromCharCode(65+row)+(col+1);}
function radar(){
 const now=performance.now(),w=mini.width,h=mini.height,theme=window.ggVisualTheme?.current()||'gold',r=radarProjection(w,h,world.w,world.h),{left,top,width,height,sx,sy}=r;
 if(radarTheme===theme&&radarMap===state.map&&radarGrid?.width===w&&radarGrid?.height===h&&now-radarLast<radarIntervals[quality])return;
 radarLast=now;radarMap=state.map;
 if(!radarGrid||radarTheme!==theme||radarGrid.width!==w||radarGrid.height!==h){
  radarTheme=theme;radarGrid=document.createElement('canvas');radarGrid.width=w;radarGrid.height=h;const g=radarGrid.getContext('2d');
  g.fillStyle=theme==='classic'?'#020609':'#060d17';g.fillRect(0,0,w,h);
  g.strokeStyle=theme==='classic'?'#314d5b':'#344354';g.lineWidth=1;g.beginPath();
  for(let i=0;i<=radarColumns;i++){const x=left+i*width/radarColumns;g.moveTo(x,top);g.lineTo(x,top+height);}
  for(let i=0;i<=radarRows;i++){const y=top+i*height/radarRows;g.moveTo(left,y);g.lineTo(left+width,y);}
  g.stroke();g.fillStyle='#c5d4e0';g.font='9px system-ui';g.textAlign='center';g.textBaseline='middle';
  for(let i=0;i<radarColumns;i++)g.fillText(String(i+1),left+(i+.5)*width/radarColumns,6);
  for(let i=0;i<radarRows;i++)g.fillText(String.fromCharCode(65+i),6,top+(i+.5)*height/radarRows);
 }
 const wallNow=Date.now();m.drawImage(radarGrid,0,0);
 function dot(x,y,c,radius){const px=left+x*sx,py=top+y*sy;if(theme==='classic'&&window.ggClassicHud){window.ggClassicHud.marker(m,px,py,c,radius);return;}m.fillStyle=c;m.beginPath();m.arc(px,py,radius,0,Math.PI*2);m.fill();}
 for(const mine of state.mines||[])dot(mine.x,mine.y,'#ff654b',1.5);
 for(const b of state.boxes)dot(b.x,b.y,b.kind==='pirate'?'#49f79a':b.kind==='paladio'?'#50dfdb':b.kind==='cargo'?'#9ecbff':'#bc9551',b.kind==='pirate'||b.kind==='paladio'?2:1.2);
 if(icePing?.map===state.map&&icePing.until>wallNow)dot(icePing.x,icePing.y,'#4fff89',4);
 if(hitacPing?.map===state.map&&hitacPing.until>wallNow)dot(hitacPing.x,hitacPing.y,'#bc86ff',4);
 if(state.base)dot(state.base.x,state.base.y,state.base.color,6);
 const me=state.players.find(p=>p.id===meId),recon=me?.abilities?.recon?.until>wallNow,range=recon?6000:3000;
 for(const n of state.npcs)if(!me||distance(me,n)<=range)dot(n.x,n.y,n.type==='boss'?'#6b9fff':'#ef785b',n.type==='boss'?3.5:2);
 for(const p of state.players)if(!p.deadUntil&&(!me||distance(me,p)<=range))dot(p.x,p.y,p.id===meId?'#6df3b4':'#79baff',p.id===meId?3:2);
 m.strokeStyle=theme==='classic'?'#dce8ec':'#b8d5f5';m.strokeRect(left+(camera.x-W/2)*sx,top+(camera.y-H/2)*sy,W*sx,H*sy);
 // Portals remain visible at any radar range and are drawn above other markers.
 for(const p of visiblePortals()){const x=left+p.x*sx,y=top+p.y*sy;m.save();m.fillStyle='#081321';m.strokeStyle=p.kind==='galaxy'?'#f0cc73':'#7fe8ff';m.lineWidth=2;m.beginPath();m.arc(x,y,6,0,Math.PI*2);m.fill();m.stroke();m.fillStyle=m.strokeStyle;m.beginPath();m.arc(x,y,2,0,Math.PI*2);m.fill();m.restore();}
 setHudText($('gg171-radar-map'),state.map||(gateState.inside?'GG '+gateState.gate.toUpperCase():'—'));
 setHudText($('gg171-radar-sector'),me?'Cuadrante '+radarSector(me.x,me.y,world.w,world.h):'Cuadrante —');
}
socket.on('gg:pilotSummary',r=>{const fields={userUridium:r.uridium,userPoints:r.points,userAliens:r.aliens,userKills:r.kills,userDeaths:r.deaths,userKeys:r.keys,shipCargo:r.cargo};for(const [id,value] of Object.entries(fields))setHudText($(id),value==null?'—':fmt(Number(value)));const id=$('userId');if(id){id.title=String(r.id);setHudText(id,String(r.id).slice(0,8)+'…');}setHudText($('userPremium'),fmt(Math.floor(Number(r.premiumSeconds||0)/3600))+' h');});
const configButton=$('shipConfigSwitch');let activeConfigNumber=null,configPending=null,configTimer=null;
function updateConfigButton(n){if(n!==1&&n!==2)return;activeConfigNumber=n;setHudText($('shipConfig'),n);if(configPending===n){configPending=null;clearTimeout(configTimer);}if(configButton)configButton.disabled=configPending!==null;}
socket.on('gg:shipStats',r=>{setHudText($('shipDamage'),fmt(r.damage));setHudText($('shipSpeed'),fmt(r.speed));updateConfigButton(r.config);});
socket.on('v13:loadoutApplied',r=>updateConfigButton(r.active+1));
if(configButton)configButton.onclick=async()=>{if(!joined||!socket.connected||configPending!==null||!activeConfigNumber)return;const target=activeConfigNumber===1?2:1;configPending=target;configButton.disabled=true;try{const response=await fetch('/api/v13/config/activate',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({active:target-1})});const result=await response.json();if(!response.ok||result.active!==target-1)throw Error(result.error||'No se pudo cambiar la configuración');socket.emit('v13:reload');configTimer=setTimeout(()=>{if(configPending!==target)return;configPending=null;configButton.disabled=false;notice('Configuración guardada; activación sin confirmar');},8000);}catch(e){configPending=null;configButton.disabled=false;notice(e.message);}};

function setHudText(node,value){if(node&&node.textContent!==String(value))node.textContent=String(value);}
function setHudValue(node,value){if(node&&Number(node.value)!==value)node.value=value;}
function updateHud(p){if(!p)return;const rank=$('pilotRank');const rankTheme=window.ggVisualTheme?.current()||'gold';if(rank&&(rank.dataset.rank!==String(p.rank)||rank.dataset.rankTheme!==rankTheme)){rank.dataset.rank=String(p.rank);rank.dataset.rankTheme=rankTheme;rank.replaceChildren(window.ggRankVisual.icon(p.rank));}setHudText($('pilotName'),(p.clanTag?'['+p.clanTag+'] ':'')+p.name);setHudText($('pilotTitle'),p.title||'');setHudText($('userLevel'),p.level);setHudText($('userXp'),fmt(p.experience));setHudText($('userHonor'),fmt(p.honor||0));window.dispatchEvent(new CustomEvent('gg18:abilityState',{detail:p}));const sector=document.querySelector('.topbar .brand small');setHudText(sector,state.map?'SECTOR '+state.map:gateState.inside?'GG '+gateState.gate.toUpperCase():'ESPACIO');const god=document.getElementById('godMenu');if(god){const visible=!!p.godAllowed,enabled=!!(p.godMode||p.oneShot);if(god.hidden===visible)god.hidden=!visible;const pressed=String(enabled);if(god.getAttribute('aria-pressed')!==pressed){god.setAttribute('aria-pressed',pressed);god.textContent=enabled?'CONTROL ACTIVO':'CONTROLADOR';god.title='Controlador de administrador';}}const progress=document.getElementById('progressInfo');setHudText(progress,'Nivel '+p.level+' · '+fmt(p.experience)+' EXP · Honor '+fmt(p.honor||0)+' · '+(['','MMO','EIC','VRU'][p.company]||''));setHudText($('online'),state.players.length+' pilotos');setHudText($('credits'),fmt(p.credits));setHudValue($('hp'),window.ggGraphics161.safeRatio(p.hp,p.maxHp)*100);setHudValue($('shield'),window.ggGraphics161.safeRatio(p.shield,p.maxShield)*100);setHudText($('hpText'),fmt(p.hp)+' / '+fmt(p.maxHp));setHudText($('shieldText'),fmt(p.shield)+' / '+fmt(p.maxShield));setHudText($('coords'),p.deadUntil?'Reapareciendo…':`X ${Math.round(p.x)} / Y ${Math.round(p.y)}`);const n=state.npcs.find(n=>n.id===selected)||state.players.find(n=>n.id===selected&&n.id!==meId)||(state.hitac?.units||[]).find(u=>'hitac:'+u.id===selected)||[state.ice?.boss,...(state.ice?.icy||[])].filter(Boolean).find(u=>'ice:'+u.id===selected);if($('targetPanel').hidden!==!n)$('targetPanel').hidden=!n;if(n){setHudText($('targetName'),n.name);setHudValue($('targetHp'),window.ggGraphics161.safeRatio(n.hp,n.maxHp)*100);setHudValue($('targetShield'),window.ggGraphics161.safeRatio(n.shield,n.maxShield)*100);setHudText($('targetRange'),distance(p,n)<=650?'En alcance de láser':`Distancia ${Math.round(distance(p,n))} / 650`);} $('fire').classList.toggle('active',attacking);if($('fire').getAttribute('aria-pressed')!==String(attacking))$('fire').setAttribute('aria-pressed',String(attacking));setHudText($('attackStatus'),attacking?'ATAQUE ACTIVO':'EN ESPERA');if(!mini.closest('[hidden]'))radar();}
// Keep a generous warm-up area around the viewport so entering entities interpolate normally.
let perfStart=0,perfFrames=0,perfFps=null,perfRtt=null,perfProbeAt=0,perfPending=false,perfGeneration=0;
function performanceFrame(t){const panel=document.getElementById('gg-performance');if(!joined||document.hidden||!panel||panel.hidden){perfStart=0;perfFrames=0;return;}if(!perfStart){perfStart=t;perfFrames=0;}perfFrames++;const elapsed=t-perfStart;if(elapsed>=1000){perfFps=Math.round(perfFrames*1000/elapsed);perfStart=t;perfFrames=0;setHudText(panel.querySelector('[data-fps]'),perfFps+' FPS');}
 if(!socket.connected){perfRtt=null;setHudText(panel.querySelector('[data-rtt]'),'— ms');return;}
 if(!perfPending&&t-perfProbeAt>=5000){perfProbeAt=t;perfPending=true;const start=performance.now(),generation=perfGeneration;socket.timeout(3000).emit('gg:latency',(err,r)=>{if(generation!==perfGeneration)return;perfPending=false;perfRtt=err||!r?.ok?null:Math.round(performance.now()-start);setHudText(panel.querySelector('[data-rtt]'),perfRtt===null?'— ms':perfRtt+' ms');});}
}
socket.on('disconnect',()=>{perfGeneration++;perfPending=false;perfRtt=null;perfProbeAt=0;const p=document.getElementById('gg-performance');if(p)setHudText(p.querySelector('[data-rtt]'),'— ms');});
document.addEventListener('visibilitychange',()=>{perfStart=0;perfFrames=0;});
function advanceVisual(v,alpha,camera,w,h,local=false){
 if(v.x===v.tx&&v.y===v.ty&&v.a===v.ta)return;
 const margin=700,hx=w/2+margin,hy=h/2+margin;
 const off=(x,y)=>Math.abs(x-camera.x)>hx||Math.abs(y-camera.y)>hy;
 // Snap only when both positions are on the same side of the expanded viewport.
 const outsideSameSide=(v.x<camera.x-hx&&v.tx<camera.x-hx)||(v.x>camera.x+hx&&v.tx>camera.x+hx)||(v.y<camera.y-hy&&v.ty<camera.y-hy)||(v.y>camera.y+hy&&v.ty>camera.y+hy);
 if(!local&&off(v.x,v.y)&&off(v.tx,v.ty)&&outsideSameSide){v.x=v.tx;v.y=v.ty;v.a=v.ta;return;}
 if(v.x!==v.tx){const dx=v.tx-v.x;v.x=Math.abs(dx)<.01?v.tx:v.x+dx*alpha;}
 if(v.y!==v.ty){const dy=v.ty-v.y;v.y=Math.abs(dy)<.01?v.ty:v.y+dy*alpha;}
 if(v.a!==v.ta){const da=Math.atan2(Math.sin(v.ta-v.a),Math.cos(v.ta-v.a));v.a=Math.abs(da)<.0001?v.ta:v.a+da*alpha;}
}
function frame(t){adaptQuality(t);performanceFrame(t);const dt=Math.min((t-last)/1000,.1);last=t;const alpha=1-Math.exp(-dt*16);const me=entities.get('p'+meId);for(const v of entities.values())advanceVisual(v,alpha,camera,W,H,v===me);if(me){camera.x+=(me.x-camera.x)*alpha;camera.y+=(me.y-camera.y)*alpha;}stars();if(joined){drawBase(t);drawPortals(t);drawCBS(t);drawMines(t);drawBoxes(t);drawSpaceball(t);drawHitac(t);drawIce(t);if(dest&&me&&!me.data.deadUntil){if(distance(me,dest)<8)dest=null;else{const p=screen(dest.x,dest.y);ctx.strokeStyle='#7fe5c7a0';ctx.beginPath();ctx.arc(p.x,p.y,12,0,Math.PI*2);ctx.stroke();}}for(const n of state.npcs){const v=entities.get('n'+n.id);if(v)ship(v,false,true);}for(const p of state.players){if(p.cloaked&&p.id!==meId)continue;const v=entities.get('p'+p.id);if(v)ship(v,p.id===meId,false);drawPet(p,v,alpha);}drawLasers(t);drawKamikaze(t);if(window.ggVisualTheme?.current()==='classic'&&window.ggClassicArt?.impact){for(const d of damageNumbers){const age=t-d.born;if(age<0||age>=260)continue;const v=d.targetId&&entities.get('n'+d.targetId),q=screen(v?.x??d.x,v?.y??d.y);if(!intersectsViewport(q,40))continue;ctx.save();ctx.translate(q.x,q.y);window.ggClassicArt.impact(ctx,age/260);ctx.restore();}}drawDamageNumbers(t);if(gateState.inside&&gateState.phase==='between'){const seconds=Math.max(0,Math.ceil((gateState.localUntil-performance.now())/1000));ctx.save();ctx.textAlign='center';ctx.font='bold 21px system-ui';ctx.fillStyle='#eac66d';ctx.fillText(gateState.completed?'PUERTA COMPLETADA · SALIDA '+seconds+' s':'SIGUIENTE RONDA EN '+seconds+' s',W/2,Math.max(120,H*.17));ctx.restore();}if(t-lastHud>100){updateHud(me?.data);lastHud=t;}}requestAnimationFrame(frame);}requestAnimationFrame(frame);
