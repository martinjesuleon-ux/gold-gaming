(()=>{'use strict';
const labels={ships:'Naves',designs:'Diseños',lasers:'Armas',ammo:'Munición',rockets:'Cohetes',specialRockets:'Cohetes especiales',launchers:'Hellstorm',launcherAmmo:'Munición Hellstorm',mines:'Minas',shields:'Escudos',engines:'Motores',drones:'VANT',pet:'P.E.T.',fuel:'Combustible P.E.T.',petGear:'Módulos P.E.T.'};
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
const fmt=n=>Number(n).toLocaleString('es-CL');
async function api(path,body){const res=await fetch('/api/v13/'+path,{credentials:'same-origin',...(body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})});const data=await res.json();if(!res.ok)throw Error(data.error||'Operación no disponible');return data;}
let modal,body,status,cat,state,busy=false,mode;
function button(text,fn){const b=el('button',text);b.type='button';b.onclick=fn;return b;}
function balance(){return 'Créditos: '+fmt(state.balance.credits)+'   |   Uridium: '+fmt(state.balance.uridium);}
async function refresh(){state=await api('inventory');window.dispatchEvent(new CustomEvent('gg13:inventory',{detail:state}));}
async function open(which,gate){if(busy)return;if(modal?.open){modal.close();if(!gate)return;}mode=which;if(gate)pendingGate=gate; if(!modal){modal=el('dialog',null,'gg13');const head=el('header');head.append(el('strong','GOLD GAMING • V1.7'),button('Cerrar',()=>{if(!busy)modal.close();}));body=el('main');status=el('footer');status.setAttribute('role','status');modal.append(head,body,status);modal.addEventListener('cancel',e=>{if(busy)e.preventDefault();});document.body.append(modal);}modal.showModal();body.replaceChildren(el('p','Cargando…'));status.textContent='';busy=true;try{cat=await api('catalog');await refresh();render();}catch(e){body.replaceChildren(el('p',e.message));}finally{busy=false;}}
function render(){body.replaceChildren();status.textContent=balance();if(mode==='Minas'){mineMenu();return;}if(mode==='Habilidades'){abilityMenu();return;}if(mode==='Portales'){gates();return;}if(mode==='Facción'){faction();return;}if(mode==='Grupo'){socialGroup();return;}if(mode==='Clan'){clanMenu();return;}if(mode==='Misiones'){missionMenu();return;}if(mode==='Registro'){activityMenu();return;}if(mode==='Registro diario'){dailyMenu();return;}if(mode==='Potenciación'){upgradeMenu();return;}if(['Skylab','Refinación','Comercio'].includes(mode)){mineralMenu(mode);return;}if(mode==='Tienda')shop();else if(mode==='Hangar')hangar();else inventory();}
function shop(){const layout=el('div',null,'gg13-shop'),nav=el('aside'),grid=el('section',null,'gg13-grid'),detail=el('section',null,'gg13-detail');layout.append(nav,grid,detail);body.append(layout);
function list(category){grid.replaceChildren();detail.replaceChildren(el('p','Selecciona un objeto'));for(const p of (category==='petGear'?[{id:'G-AL1',name:'G-AL1 Auto-botín',price:state.items.some(i=>i.category==='pet')&&!state.items.some(i=>i.code==='G-AL1')?7500:null,currency:'uridium'},{id:'G-KK1',name:'G-KK1 Kamikaze · PRUEBA',damage:1000000,price:state.items.some(i=>i.category==='pet')&&!state.items.some(i=>i.code==='G-KK1')?7500:null,currency:'uridium'}]:category==='fuel'?[{id:'pet-fuel',name:'Combustible P.E.T.',price:state.items.some(i=>i.category==='pet')?.25:null,currency:'uridium'}]:category==='pet'?[{id:'pet-10',name:'P.E.T. 10',hp:50000,price:state.items.some(i=>i.category==='pet')?null:50000,currency:'uridium'}]:category==='drones'?['flax','iris'].map(id=>({id,name:id.toUpperCase(),...cat.drones[id],price:cat.drones[id].prices[state.items.filter(i=>i.category==='drones'&&['flax','iris'].includes(i.code)).length]??null})):cat[category])){const card=button('',()=>select(category,p));card.append(el('span',category==='ships'?'◇':category==='lasers'?'╱╱':category==='ammo'?'•••':category==='shields'?'◈':'»','gg13-symbol'),el('strong',p.name||p.id),el('small',p.price==null?'Recompensa':fmt(p.price)+' '+p.currency));grid.append(card);}}
function select(category,p){detail.replaceChildren(el('h3',p.name||p.id));for(const k of ['hp','speed','damage','shield','absorption','lasers','generators','multiplier','capacity','drain','duration','cooldown'])if(p[k]!=null)detail.append(el('p',k+': '+p[k]));if(p.price==null||p.id==='phoenix'){detail.append(el('p','No disponible para compra'));return;}const qty=el('input');qty.type='number';qty.min='1';qty.max=category==='petGear'?'1':category==='pet'?'1':category==='drones'?'1':['ships','designs'].includes(category)?'1':['ammo','rockets','specialRockets','launcherAmmo','mines'].includes(category)?'100000':'100';qty.value=category==='fuel'?'1000':'1';if(category==='fuel'){qty.min='4';qty.max=String(50000-Number(state.ammo.find(a=>a.code==='pet-fuel')?.quantity||0));qty.step='4';}const total=el('p');const buy=button('COMPRAR',async()=>{if(busy||!qty.checkValidity())return;busy=true;buy.disabled=true;const requestId=crypto.randomUUID();try{await api('purchase',{category,code:p.id,quantity:Number(qty.value),requestId});await refresh();status.textContent='Compra confirmada • '+balance();if(['drones','pet','petGear','fuel'].includes(category))list(category);}catch(e){status.textContent=e.message;}finally{busy=false;buy.disabled=false;}});const update=()=>{total.textContent='Total: '+fmt(Number(qty.value)*p.price)+' '+p.currency;};qty.oninput=update;update();detail.append(qty,total,buy);}
for(const k of Object.keys(labels))nav.append(button(labels[k],()=>list(k)));list('ships');}
function inventory(){body.append(el('h2','Inventario'));const grid=el('div',null,'gg13-grid');for(const i of state.items)grid.append(el('div',i.code+' · Nivel '+i.level,'gg13-tile'));for(const i of state.ammo)grid.append(el('div',i.code+' × '+fmt(i.quantity),'gg13-tile'));body.append(grid);if(!grid.children.length)grid.append(el('p','Inventario vacío'));}
function hangar(){const draft=JSON.parse(JSON.stringify(state.hangar));let tab=draft.active, destination='ship';draft.configs=draft.configs.map(c=>Array.isArray(c)?{ship:c,drones:[]}:c);const drones=state.items.filter(i=>i.category==='drones');for(const c of draft.configs)for(const d of drones)if(!c.drones.some(v=>v.id===d.instanceId))c.drones.push({id:d.instanceId,items:[]});const layout=el('div',null,'gg13-hangar'),left=el('section'),middle=el('section'),right=el('section');layout.append(left,middle,right);body.append(layout);left.append(el('h3','Naves disponibles'));const select=el('select');for(const s of cat.ships.filter(s=>s.id==='phoenix'||state.items.some(i=>i.category==='ships'&&i.code===s.id))){const op=el('option',s.name);op.value=s.id;select.append(op);}select.value=draft.ship;const designSelect=el('select');function designs(){designSelect.replaceChildren();const base=el('option','Sin diseño');base.value='';designSelect.append(base);for(const d of (cat.designs||[]).filter(d=>d.ship===draft.ship&&state.items.some(i=>i.category==='ship-designs'&&i.code===d.id))){const o=el('option',d.name||d.id);o.value=d.id;designSelect.append(o);}designSelect.value=draft.design||'';if(!designSelect.value)draft.design=null;}designSelect.onchange=()=>{draft.design=designSelect.value||null;draw();};select.onchange=()=>{draft.ship=select.value;draft.design=null;designs();draw();};designs();left.append(select,el('h3','Diseño'),designSelect,el('div','◇','gg13-ship'));const save=button('Guardar y activar',async()=>{if(busy)return;busy=true;save.disabled=true;try{const v=await api('equip',{ship:draft.ship,configs:draft.configs,active:tab,design:draft.design||null});await refresh();window.dispatchEvent(new Event('gg13:loadout'));status.textContent='Guardado • Daño '+fmt(v.stats.damage)+' • Escudo '+fmt(v.stats.shield)+' • '+balance();}catch(e){status.textContent=e.message;}finally{busy=false;save.disabled=false;}});left.append(save);
const items=state.items.filter(i=>['lasers','engines','shields','launchers'].includes(i.category));
const all=c=>[c.ship,...c.drones.map(d=>d.items)];
function current(){return destination==='ship'?draft.configs[tab].ship:draft.configs[tab].drones.find(d=>d.id===destination).items;}
function move(id){const i=items.find(i=>i.instanceId===id);if(busy||!i)return;const dest=current(),ship=cat.ships.find(s=>s.id===draft.ship);if(dest.includes(id))return;
if(destination!=='ship'){const d=drones.find(x=>x.instanceId===destination);if(['engines','launchers'].includes(i.category)||dest.length>=cat.drones[d.code].slots){status.textContent='Equipo incompatible o VANT lleno';return;}}
else if(i.category==='launchers'){if(dest.some(x=>items.find(y=>y.instanceId===x)?.category==='launchers')){status.textContent='Solo un lanzador por configuración';return;}}
else{const n=dest.filter(x=>{const k=items.find(y=>y.instanceId===x)?.category;return k!=='launchers'&&(k==='lasers')===(i.category==='lasers');}).length;if(n>=(i.category==='lasers'?ship.lasers:ship.generators)){status.textContent='Espacios de nave llenos';return;}}
for(const c of draft.configs)for(const a of all(c)){const pos=a.indexOf(id);if(pos>=0)a.splice(pos,1);}dest.push(id);draw();}
function draw(){middle.replaceChildren(el('h3','Equipamiento'));for(let t=0;t<2;t++){const b=button('Configuración '+(t+1),()=>{tab=t;destination='ship';draw();});b.disabled=tab===t;middle.append(b);}const ship=cat.ships.find(s=>s.id===draft.ship);middle.append(el('p','Láseres: '+ship.lasers+' | Generadores: '+ship.generators));const pick=el('select');for(const [id,label] of [['ship','NAVE'],...drones.map((d,i)=>[d.instanceId,d.code.toUpperCase()+' '+(i+1)])]){const o=el('option',label);o.value=id;pick.append(o);}pick.value=destination;pick.onchange=()=>{destination=pick.value;draw();};middle.append(pick);const slots=el('div',null,'gg13-grid');slots.ondragover=e=>e.preventDefault();slots.ondrop=e=>{e.preventDefault();move(e.dataTransfer.getData('text/plain'));};for(const id of current()){const i=items.find(x=>x.instanceId===id);if(i)slots.append(button(i.code+' ×',()=>{const a=current();a.splice(a.indexOf(id),1);draw();}));}slots.append(el('p','Arrastra o selecciona equipo'));middle.append(slots);right.replaceChildren(el('h3','Inventario'));const bag=el('div',null,'gg13-grid');for(const i of items.filter(i=>!draft.configs.some(c=>all(c).some(a=>a.includes(i.instanceId)))&&(destination==='ship'||!['engines','launchers'].includes(i.category)))){const b=button(i.code+' · N'+i.level,()=>move(i.instanceId));b.draggable=true;b.ondragstart=e=>e.dataTransfer.setData('text/plain',i.instanceId);bag.append(b);}right.append(bag);}
draw();}
const rewardText=r=>Object.entries(r||{}).map(([code,n])=>fmt(code.endsWith('-seconds')?n/3600:n)+' '+({'booster-damage-seconds':'h booster daño','booster-experience-seconds':'h booster EXP','booster-honor-seconds':'h booster honor','premium-seconds':'h premium'}[code]||code)).join(' + ');
function mineMenu(){
 body.replaceChildren(el('h2','Minas'),el('p','Armado: 1 segundo · Recarga compartida: 60 segundos'));
 const details={'ACM-01':'Daño de área 20 %','DDM-01':'Casco -20 %','SABM-01':'Escudo -15 %','SLM-01':'Velocidad -50 % durante 5 s','EMPM-01':'Camuflaje (pendiente)'};
 const grid=el('div',null,'gg13-grid');
 for(const m of cat.mines||[]){const tile=el('section',null,'gg13-tile'),n=Number(state.ammo.find(a=>a.code===m.id)?.quantity||0);tile.append(el('h3',m.id),el('p',details[m.id]),el('p',fmt(n)+' disponibles'));
 const b=button('COLOCAR',async()=>{if(busy)return;busy=true;try{await window.gg18Mine(m.id);modal.close();}catch(e){status.textContent=e.message;}finally{busy=false;}});b.disabled=n===0||m.id==='EMPM-01';tile.append(b);grid.append(tile);}
 body.append(grid);
}
let abilityRefresh=null;
window.addEventListener('gg18:abilityState',e=>{if(modal?.open&&mode==='Habilidades')abilityRefresh?.(e.detail);});
function abilityMenu(){
 const p=window.gg15Pilot?.();body.replaceChildren(el('h2','Habilidades'));
 if(!p){body.append(el('p','Entra en una partida.'));return;}
 const definitions={aegis:[['repair-hp','Reparar PV','20.000/s propio o 40.000/s aliado · 7 s'],['repair-shield','Reparar escudo','15.000/s propio o 25.000/s aliado · 5 s'],['repair-pod','Cápsula de reparación','18.000 PV/s · 10 s']],citadel:[['draw-fire','Atraer fuego','Atrae NPC a 500 unidades · 5 s'],['fortify','Atrincherarse','Daño recibido -50 % · inmóvil · 10 s'],['protect','Protección','Absorbe 25 % del daño del grupo · 10 s'],['travel','Viaje','Velocidad +50 % · 5 s']],spearhead:[['recon','Reconocimiento','Alcance del radar ×2 · 30 s'],['jam','JAM-X','Bloquea habilidades enemigas · 8 s'],['mark','Marca de objetivo','Daño del grupo +5 % · 15 s'],['ultimate-cloak','Camuflaje Definitivo','Invisible hasta disparar · 15 s']]};
 const grid=el('div',null,'gg13-grid'),rows=[];
 const designSkills={Diminisher:['weaken','Debilitar escudos','Daño al escudo por láser +50 % · 15 s'],Sentinel:['fortress','Fortaleza','Daño al escudo -30 % · 35 s'],Solace:['nano-repair','Nano-Clúster','Repara 35 % de PV propios y 15 % del grupo'],Spectrum:['prism','Escudo prismático','Láser recibido -90 % · propio -25 % · 10 s'],Venom:['singularity','Singularidad II','Daño creciente directo al casco · 35 s'],Lightning:['afterburner','Postcombustión','Empuje durante 5 s']};const available=[...(definitions[p.ship]||[]),...(designSkills[p.design]?[designSkills[p.design]]:[])];for(const [code,name,desc] of available){const tile=el('section',null,'gg13-tile'),info=el('p','Disponible'),b=button('ACTIVAR',async()=>{if(busy)return;busy=true;b.disabled=true;try{await window.gg18Ability(code);status.textContent=name+' activada';modal.close();}catch(e){status.textContent=e.message;}finally{busy=false;}});tile.append(el('h3',name),el('p',desc),info,b);grid.append(tile);rows.push({code,info,b});}
 if(rows.length)body.append(grid);else body.append(el('p','Este casco no dispone de habilidades propias.'));
 abilityRefresh=q=>{const now=Date.now();for(const {code,info,b} of rows){const a=q.abilities?.[code],active=Math.max(0,Math.ceil(((a?.until||0)-now)/1000)),cool=Math.max(0,Math.ceil(((a?.readyAt||0)-now)/1000));const message=active?'ACTIVA · '+active+' s':cool?'Recarga · '+cool+' s':q.jamUntil>now?'Bloqueada por JAM-X':'Disponible';if(info.textContent!==message)info.textContent=message;b.disabled=busy||!!cool||q.jamUntil>now;}};abilityRefresh(p);
 if(p.godAllowed){ let enabled=!!p.godMode;
 const tile=el('section',null,'gg13-tile'),label=el('h3','DIOS'),info=el('p'),b=button('',async()=>{
  if(busy)return;busy=true;b.disabled=true;
  try{enabled=await window.gg17God(!enabled);draw();status.textContent=enabled?'DIOS ACTIVADO':'DIOS DESACTIVADO';}catch(e){status.textContent=e.message;}finally{busy=false;b.disabled=false;}
 });
 function draw(){info.textContent=enabled?'ACTIVA · Sin daño de NPC ni jugadores':'INACTIVA';b.textContent=enabled?'DESACTIVAR DIOS':'ACTIVAR DIOS';b.style.color=enabled?'#70ffa5':'';b.setAttribute('aria-pressed',String(enabled));}
 tile.append(label,info,el('p','Sin coste, duración ni recarga. Permanece activa entre mapas y puertas hasta desactivarla o cerrar sesión.'),b);body.append(tile);draw();
 }
}
async function upgradeMenu(){
 body.replaceChildren(el('h2','Potenciación de equipo'),el('p','Cargando minerales…'));
 try{let data=await api('upgrades'),cargo=(await api('minerals')).cargo;
 function draw(){if(!modal.open||mode!=='Potenciación')return;body.replaceChildren(el('h2','Potenciación de equipo'),el('p','1 mineral = 10 rondas. Los generadores consumen una ronda por intervalo de uso de 10 segundos (provisional).'));
 const grid=el('div',null,'gg13-grid');const names={laser:'Láseres',rocket:'Cohetes',speed:'Motores',shield:'Escudos'};
 for(const slot of data.slots){
  const active=data.upgrades[slot],tile=el('section',null,'gg13-tile');tile.append(el('h3',names[slot]),el('p',active?.rounds>0?active.code.toUpperCase()+' · '+fmt(active.rounds)+' rondas':'Sin mineral activo'));
  for(const [code,values] of Object.entries(data.bonus)){if(!values[slot])continue;
   const n=cargo[code]||0,q=el('input');q.type='number';q.min=1;q.max=Math.min(n,1000000);q.value=1;q.style.width='85px';
   const b=button('CARGAR',async()=>{if(busy||!q.checkValidity())return;busy=true;b.disabled=true;try{data=await window.gg18Charge({slot,code,quantity:Number(q.value),requestId:crypto.randomUUID()});cargo=(await api('minerals')).cargo;status.textContent='Mineral cargado';draw();}catch(e){status.textContent=e.message;}finally{busy=false;b.disabled=false;}});
   b.disabled=n===0||!!(active?.rounds>0&&active.code!==code);tile.append(el('p',code.toUpperCase()+' · +'+Math.round((values[slot]-1)*100)+' % · Bodega '+fmt(n)),q,b);
  }grid.append(tile);
 }body.append(grid,button('ACTUALIZAR',()=>upgradeMenu()),button('VOLVER A REFINACIÓN',()=>{mode='Refinación';mineralMenu(mode);}));
 }draw();
 }catch(e){body.append(el('p',e.message));}
}
async function mineralMenu(tab){
 body.replaceChildren(el('h2',tab),el('p','Cargando recursos…'));
 try{let data=await api('minerals');
 function draw(){
  if(!modal.open||!['Skylab','Refinación','Comercio'].includes(mode))return;
  body.replaceChildren(el('h2',tab));
  const nav=el('div',null,'gg13-grid');for(const name of ['Skylab','Refinación','Comercio']){const b=button(name,()=>{if(busy)return;tab=name;mode=name;draw();});b.disabled=tab===name;nav.append(b);}body.append(nav,button('POTENCIACIÓN',()=>{if(!busy){mode='Potenciación';upgradeMenu();}}));
  body.append(el('p','Bodega '+fmt(data.cargoUsed)+' / '+fmt(data.capacity)+' · Xenomit sin peso'));
  async function run(action,fields){if(busy)return;busy=true;try{data=await api('minerals',{action,...fields,requestId:crypto.randomUUID()});state.balance=data.balance;status.textContent=balance();draw();}catch(e){status.textContent=e.message;}finally{busy=false;}}
  function quantity(max,step=1){const n=el('input');n.type='number';n.min=step;n.max=Math.max(0,max);n.step=step;n.value=step;n.style.width='95px';return n;}
  function qtyButton(tile,label,action,code,max,step=1){const q=quantity(max,step),b=button(label,()=>{if(q.checkValidity())run(action,{code,quantity:Number(q.value)});});b.disabled=max<step;tile.append(q,b);}
  const grid=el('div',null,'gg13-grid');
  if(tab==='Skylab'){
   body.append(el('p','Energía: '+fmt(data.metrics.used)+' / '+fmt(data.metrics.power)+' · Rendimiento '+fmt(Math.round(data.metrics.efficiency*100))+' %'),el('p','Estación persistente. Producción y transporte directo de prueba; mejoras pendientes.'));
   for(const [code,level] of Object.entries(data.lab.levels)){
    const tile=el('section',null,'gg13-tile');tile.append(el('h3',code.toUpperCase()),el('p','Nivel '+level));
    if(Object.hasOwn(data.lab.enabled,code)){const enabled=data.lab.enabled[code],stock=data.lab.stock[code]||0;
     tile.append(el('p',(enabled?'Activo':'Apagado')+' · '+fmt(data.rates[code])+'/h'),el('p',fmt(stock)+' / '+fmt(data.limits[code])),button(enabled?'APAGAR':'ACTIVAR',()=>run('toggle',{code,enabled:!enabled})));
     qtyButton(tile,'TRANSPORTAR','transfer',code,Math.min(stock,code==='xenomit'?1000000:Math.max(0,data.capacity-data.cargoUsed)));
    }grid.append(tile);
   }
  }else if(tab==='Refinación'){
   body.append(el('p','Convierte minerales de la bodega pagando la comisión indicada.'));
   for(const [code,r] of Object.entries(data.recipes)){if(code==='xenomit'||r.premium)continue;const tile=el('section',null,'gg13-tile');tile.append(el('h3',code.toUpperCase()),el('p',Object.entries(r.inputs).map(([k,n])=>n+' '+k).join(' + ')),el('p','Comisión '+fmt(r.fee)+' créditos/u'));
    const max=Math.min(Math.floor(Number(data.balance.credits)/r.fee),...Object.entries(r.inputs).map(([k,n])=>Math.floor((data.cargo[k]||0)/n)),1000000);
    qtyButton(tile,'REFINAR','refine',code,max);grid.append(tile);
   }
  }else{
   body.append(el('p','Venta en mapas con base. Honor '+fmt(data.honor)+'. Paladio se cambia en 5-2.'));
   for(const [code,price] of Object.entries(data.prices)){const tile=el('section',null,'gg13-tile'),n=data.cargo[code]||0;tile.append(el('h3',code.toUpperCase()),el('p',fmt(n)+' disponibles'),el('p','Precio base '+fmt(price)+' créditos/u'));qtyButton(tile,'VENDER','sell',code,n);grid.append(tile);}
   const tile=el('section',null,'gg13-tile');tile.append(el('h3','PALADIO'),el('p',fmt(data.cargo.paladio||0)+' · 10 = 1 energía'));qtyButton(tile,'CANJEAR','exchange','paladio',Math.floor((data.cargo.paladio||0)/10)*10,10);grid.append(tile);
  }
  body.append(grid,button('ACTUALIZAR',()=>{if(!busy)mineralMenu(tab);}));
 }
 draw();
 }catch(e){body.append(el('p',e.message));}
}
function gateRewardText(p){const labels={uridium:'Uridium',xp:'Experiencia',honor:'Honor',ammo:'UCB-100',disks:'Discos de registro',xenomit:'Xenomit',vouchers:'Vales de reparación',keys:'Llaves verdes'};return Object.entries(labels).filter(([k])=>Number(p?.[k])>0).map(([k,label])=>fmt(p[k])+' '+label).concat(p?.item?[fmt(p.itemQuantity||1)+' '+p.item]:[],Object.entries(p?.extras||{}).map(([k,n])=>fmt(n)+' '+k));}
window.addEventListener('gg17:gateReward',e=>{
 const r=e.detail;document.getElementById('gg-gate-reward')?.remove();const box=el('section',null,'gg-gate-reward');box.id='gg-gate-reward';box.setAttribute('role','status');
 box.append(el('h2',r.gate.toUpperCase()+' COMPLETADA'),el('p','Recompensas acreditadas'));
 for(const line of gateRewardText(r.payout))box.append(el('p',line));
 box.append(button('VER REGISTRO',()=>{box.remove();open('Registro');}),button('CERRAR',()=>box.remove()));document.body.append(box);
});
async function activityMenu(){
 body.replaceChildren(el('h2','Registro de actividad'),button('RECOMPENSAS DIARIAS',()=>{mode='Registro diario';dailyMenu();}));
 try{const data=await api('gate-log');if(!modal.open||mode!=='Registro')return;
 body.append(el('h3','Puertas completadas'));
 if(!data.completed.length)body.append(el('p','Todavía no has completado puertas.'));
 for(const g of data.completed){const tile=el('section',null,'gg13-tile');tile.append(el('h3',g.gate.toUpperCase()+' · '+g.completions+' completadas'),el('p','Premio base por finalización'),el('p',gateRewardText(g.baseReward).join(' · ')));body.append(tile);}
 body.append(el('h3','Historial de pagos confirmados'));
 if(!data.entries.length)body.append(el('p','El detalle individual comienza con esta actualización. Las finalizaciones anteriores siguen contabilizadas arriba.'));
 for(const r of data.entries){const tile=el('section',null,'gg13-tile');tile.append(el('strong',r.gate.toUpperCase()+' · N.º '+r.completion),el('small',new Date(r.created_at).toLocaleString('es-CL')),el('p',gateRewardText(r.payout).join(' · ')));body.append(tile);}
 body.append(el('h3','Actividad de esta sesión'));
 for(const r of (window.gg17Activity?.()||[]))body.append(el('p',new Date(r.at).toLocaleTimeString('es-CL')+' · '+r.message));
 }catch(e){body.append(el('p',e.message));}
}
async function dailyMenu(){
 body.replaceChildren(el('h2','Recompensas diarias · 28 días'));
 try{const data=await api('daily');if(!modal.open||mode!=='Registro diario')return;
 body.append(el('p','Día '+data.day+'/28 · '+(data.claimedToday?'Regalo de hoy acreditado':'Regalo disponible')+' · Reinicio UTC'));
 const grid=el('div',null,'gg13-grid');
 for(let i=0;i<data.calendar.length;i++){const d=i+1,tile=el('div',null,'gg13-tile');tile.append(el('strong',(d<=data.day?'✓ ':'')+'Día '+d),el('p',rewardText(data.calendar[i])));if(d%7===0)tile.style.borderColor='#d4af37';grid.append(tile);}
 body.append(grid,el('p','Los boosters y premium se guardan como tiempo disponible; activación de sus efectos pendiente.'));
 if(!data.claimedToday)body.append(button('RECLAMAR',async()=>{if(busy)return;busy=true;try{await api('daily',{});await refresh();status.textContent=balance();dailyMenu();}catch(e){status.textContent=e.message;}finally{busy=false;}}));
 }catch(e){body.append(el('p',e.message));}
}
async function missionMenu(){
 body.replaceChildren(el('h2','Libro de misiones'));
 try{
 let data=await api('missions');
 function draw(){if(!modal.open||mode!=='Misiones')return;body.replaceChildren(el('h2','Libro de misiones'),el('p','Catálogo inicial de prueba; las misiones originales aún no están cargadas.'));
 body.append(button('REGALOS DIARIOS',()=>{mode='Registro diario';dailyMenu();}));
 const grid=el('div',null,'gg13-grid');
 for(const m of data.missions){const tile=el('section',null,'gg13-tile');tile.append(el('h3',m.name),el('p','Nivel '+m.level));
 for(const [i,c] of m.conditions.entries()){const progress=el('progress');progress.max=c.count;progress.value=m.progress[i]||0;tile.append(el('p',({'alien':'Eliminar alien','box':'Recoger cajas','map':'Visitar mapa','gate':'Completar puerta','pilot':'Eliminar piloto'}[c.type]||c.type)+' '+(c.target==='*'?'':c.target)+' · '+(m.progress[i]||0)+'/'+c.count),progress);}
 tile.append(el('p',rewardText(m.reward)));
 const done=m.conditions.every((c,i)=>m.progress[i]>=c.count);
 if(m.claimed)tile.append(el('p','Completada'));
 else if(m.accepted&&!done)tile.append(el('p','En curso'));
 else{const b=button(m.accepted?'RECLAMAR':'ACEPTAR',async()=>{if(busy)return;busy=true;try{data=await api('missions',{action:m.accepted?'claim':'accept',mission:m.id});await refresh();status.textContent=balance();draw();}catch(e){status.textContent=e.message;}finally{busy=false;}});b.disabled=!m.available;tile.append(b);}
 grid.append(tile);}
 body.append(grid,button('ACTUALIZAR',()=>missionMenu()));}
 draw();
 }catch(e){body.append(el('p',e.message));}
}
async function socialGroup(){
 body.replaceChildren(el('h2','Grupo'));
 try{
  let data=await window.gg15Group('status');
  function draw(){
   if(!modal.open||mode!=='Grupo')return;
   body.replaceChildren(el('h2','Grupo · máximo 8 pilotos'));
   const run=async(action,fields={})=>{if(busy)return;busy=true;try{data=await window.gg15Group(action,fields);draw();}catch(e){status.textContent=e.message;}finally{busy=false;}};
   const me=window.gg15Pilot?.();
   if(data.invite)body.append(el('p','Invitación pendiente'),button('ACEPTAR INVITACIÓN',()=>run('accept',{from:data.invite.from})));
   if(!data.group)body.append(button('CREAR GRUPO',()=>run('create')));
   else{
    body.append(el('p',data.group.members.length+'/8 pilotos'));
    for(const m of data.group.members){body.append(el('p',m.name+(m.id===data.group.leader?' · Líder':'')+' · '+m.map));if(me?.id===data.group.leader&&m.id!==me.id)body.append(button('Expulsar '+m.name,()=>run('kick',{target:m.id})));}
    if(me?.id===data.group.leader)for(const p of data.pilots.filter(x=>!data.group.members.some(m=>m.id===x.id)))body.append(button('Invitar '+p.name,()=>run('invite',{target:p.id})));
    body.append(button('SALIR DEL GRUPO',()=>run('leave')));
   }
   body.append(button('ACTUALIZAR',()=>run('status')));
  }
  draw();
 }catch(e){body.append(el('p',e.message));}
}
async function clanMenu(){
 body.replaceChildren(el('h2','Clan'));
 try{
 let data=await api('clan');
 function draw(){
  if(!modal.open||mode!=='Clan')return;
  body.replaceChildren(el('h2','Clanes'));
  async function run(action,fields={}){if(busy)return;busy=true;try{data=await api('clan',{action,...fields});await refresh();status.textContent='Operación confirmada · '+balance();draw();}catch(e){status.textContent=e.message;}finally{busy=false;}}
  if(!data.clan){
   const name=el('input'),tag=el('input');name.placeholder='Nombre del clan';name.maxLength=32;tag.placeholder='Etiqueta';tag.maxLength=6;
   body.append(el('p','Fundación: 500.000 créditos'),name,tag,button('FUNDAR CLAN',()=>run('create',{name:name.value,tag:tag.value})));
   for(const c of data.list)body.append(button('Solicitar ingreso a ['+c.tag+'] '+c.name,()=>run('apply',{target:c.id})));
  }else{
   const c=data.clan,leader=c.leader===data.self,can=k=>leader||c.permissions.includes(k);
   body.append(el('h3','['+c.tag+'] '+c.name),el('p','Banco: '+fmt(c.credits)+' créditos · '+fmt(c.uridium)+' uridium'));
   for(const m of data.members){body.append(el('p',m.username+(m.account_id===c.leader?' · Líder':'')));
    if(can('expulsar')&&m.account_id!==c.leader&&m.account_id!==data.self)body.append(button('Expulsar '+m.username,()=>run('kick',{target:m.account_id})));
    if(leader&&m.account_id!==data.self){const picks=['expulsar','reclutar','diplomacia','cbs'].map(k=>{const input=el('input');input.type='checkbox';input.checked=m.permissions.includes(k);const label=el('label',' '+k+' ');label.prepend(input);body.append(label);return [k,input];});body.append(button('Guardar permisos',()=>run('permissions',{target:m.account_id,permissions:picks.filter(x=>x[1].checked).map(x=>x[0])})));}
   }
   if(can('reclutar'))for(const q of data.requests)body.append(button('Aceptar '+q.username,()=>run('accept',{target:q.account_id})));
   if(can('diplomacia'))for(const other of data.list.filter(x=>x.id!==c.id)){body.append(el('p','['+other.tag+'] '+other.name+' · '+(data.diplomacy.find(x=>x.target===other.id)?.state||'neutral')));for(const [state,label] of [['war','Guerra'],['alliance','Alianza'],['neutral','Neutral']])body.append(button(label,()=>run('diplomacy',{target:other.id,state})));}
   if(leader){const credit=el('select'),uridium=el('select');for(let i=0;i<=5;i++){const o=el('option',i+' % diario');o.value=i;credit.append(o);}for(let i=0;i<=3;i++){const o=el('option',i/10+' % semanal');o.value=i;uridium.append(o);}credit.value=c.credit_tax;uridium.value=c.uridium_tax;body.append(el('p','Impuestos: créditos cada 24 horas, uridium cada 7 días'),credit,uridium,button('Guardar impuestos',()=>run('tax',{credit:Number(credit.value),uridium:Number(uridium.value)})));}
   else body.append(button('ABANDONAR CLAN',()=>run('leave')));
  }
 }
 draw();
 }catch(e){body.append(el('p',e.message));}
}
function faction(){
 const pilot=window.gg15Pilot?.();
 body.append(el('h2','Compañías'),el('p','MMO · EIC · VRU'));
 if(!pilot){body.append(el('p','Entra al juego primero.'));return;}
 body.append(el('p','Compañía actual: '+(['','MMO','EIC','VRU'][pilot.company]||'Sin elegir')),el('p','Honor: '+fmt(pilot.honor||0)),el('p',pilot.companyChosen?'Cambiar cuesta 5.000 uridium y reduce a la mitad el honor positivo.':'La primera elección es gratuita.'));
 const confirm=el('input');confirm.type='checkbox';const label=el('label',' Confirmo la elección y sus condiciones');label.prepend(confirm);body.append(label);
 const grid=el('div',null,'gg13-grid');
 for(const [id,name] of [[1,'MMO'],[2,'EIC'],[3,'VRU']]){
  const b=button(name,async()=>{if(busy)return;if(!confirm.checked){status.textContent='Confirma la elección';return;}busy=true;b.disabled=true;
   try{const r=await window.gg15Company(id);state.balance=r.balance;modal.close();}
   catch(e){status.textContent=e.message;}finally{busy=false;b.disabled=false;}
  });b.disabled=pilot.companyChosen&&pilot.company===id;grid.append(b);
 }
 body.append(grid,el('p','Disponible en una base segura, fuera de combate.'));
}
let pendingGate=null;
async function gates(){
 body.replaceChildren(el('h2','Puertas galácticas'),el('p','Cargando generador…'));
 try{
  let data=await api('gates'),selected=pendingGate||'alpha',multiplier=false,paid=false;
  pendingGate=null;if(!modal.open||mode!=='Portales')return;
  async function action(kind,count=1){
   if(busy)return;busy=true;draw();
   try{
    data=await api('gates/'+kind,{gate:selected,requestId:crypto.randomUUID(),useMultiplier:multiplier,allowUridium:paid,count});
    if(kind==='build')window.gg16RefreshGalaxy?.();state.balance=data.balance;if(data.batch&&kind==='spin'){const b=data.batch;status.textContent=fmt(b.spins)+' / '+fmt(b.requested)+' tiradas · '+fmt(b.uridiumUsed)+' uridium · '+fmt(b.energyUsed)+' energía · '+b.rewards.map(r=>(r.gate?r.gate.toUpperCase()+' ': '')+r.code+' ×'+fmt(r.quantity)).join(' | ')+' · '+balance();}else status.textContent=(data.reward?'Resultado: '+data.reward.code+' ×'+data.reward.quantity+(data.reward.gate?' · '+data.reward.gate.toUpperCase():''):'Operación realizada')+' · '+balance();
   }catch(e){status.textContent=e.message;}finally{busy=false;if(modal.open&&mode==='Portales')draw();}
  }
  function draw(){
   body.replaceChildren(el('h2','Generador de puertas galácticas'));
   const nav=el('div',null,'gg13-grid');
   for(const id of data.gates){const g=data.states[id];const b=button(id.toUpperCase()+' '+g.pieces.length+'/'+g.required+(g.built?' ✓':''),()=>{selected=id;draw();});b.disabled=busy||id===selected;nav.append(b);}
   const a=data.states[selected];
   body.append(nav,el('h3',selected.toUpperCase()),el('p','Secciones: '+a.waves+' · Energía extra: '+fmt(data.energy)+' · Multiplicador ×'+a.multiplier));
   if(a.provisional)body.append(el('p','Configuración provisional: '+a.provisional));
   const progress=el('progress');progress.max=a.required;progress.value=a.pieces.length;body.append(progress,el('p',a.pieces.length+' / '+a.required+' piezas'));
   const grid=el('div',null,'gg13-grid');for(let i=1;i<=a.required;i++)grid.append(el('span',(a.pieces.includes(i)?'✓ ':'○ ')+i,'gg13-tile'));body.append(grid);
   const mult=el('input');mult.type='checkbox';mult.checked=multiplier;mult.onchange=()=>{multiplier=mult.checked;};const label=el('label',' Activar multiplicador');label.prepend(mult);
   const pay=el('input');pay.type='checkbox';pay.checked=paid;pay.onchange=()=>{paid=pay.checked;};const pl=el('label',' Autorizar uridium (100 por tirada / 25.000 por vida)');pl.prepend(pay);body.append(label,pl);
   if(selected==='kronos')body.append(el('p','Se obtiene completando las otras puertas.'));
   else{const row=el('div',null,'gg13-grid');for(const n of [1,10,100,1000]){const spin=button(fmt(n)+' TIRADA'+(n===1?'':'S')+' · '+fmt(n*100)+' U máx.',()=>action('spin',n));spin.disabled=busy;row.append(spin);}body.append(row,el('p','Se utiliza primero la energía extra. Autoriza uridium para completar las tiradas. El lote se detiene cuando ya no hay piezas disponibles o falta saldo.'));}
   if(a.canBuild){const b=button('CONSTRUIR PUERTA',()=>action('build'));b.disabled=busy;body.append(b);}
   if(a.built){
    body.append(el('p','Secciones completadas: '+a.wave+'/'+a.waves+' · Vidas: '+a.lives+'/10 · Completadas: '+a.completions));
    const life=button('COMPRAR VIDA',()=>action('life'));life.disabled=busy||a.lives>=10;body.append(life);
    if(window.gg14GateState?.().inside){const current=window.gg14GateState();if(current.phase==='between'){body.append(el('p',current.completed?'Puerta completada. Regreso automático a la base.':'Siguiente ronda automática en 10 segundos. Usa el portal de salida para regresar.'),button('VOLVER A LA PARTIDA',()=>modal.close()));if(current.gate==='hades'&&!current.leader)body.append(el('p','En Hades, el líder puede sacar al grupo.'));}else body.append(el('p',current.phase==='countdown'?'La oleada comenzará tras la cuenta atrás.':'Los portales se abren al eliminar la oleada.'));}
    else if(a.combatAvailable){const enter=button('IR AL PORTAL',async()=>{if(busy)return;busy=true;enter.disabled=true;try{window.gg16TravelGate(selected);modal.close();}catch(e){status.textContent=e.message;}finally{busy=false;enter.disabled=false;}});body.append(enter);}
    else if(selected==='hades'&&window.gg14HadesAction){
     body.append(button('IR A HADES',()=>{try{window.gg16TravelGate('hades');modal.close();}catch(e){status.textContent=e.message;}}));const room=window.gg14HadesState?.();const box=el('section');box.append(el('h3','Grupo Hades'),el('p','Se requieren de 4 a 8 pilotos con la puerta construida y la misma sección. El líder puede iniciar cuando todos estén listos.'));
     async function lobbyAction(action,data={}){if(busy)return;busy=true;try{await window.gg14HadesAction(action,data);if(action==='start'){modal.close();return;}status.textContent='Grupo actualizado';}catch(e){status.textContent=e.message;}finally{busy=false;if(modal.open&&mode==='Portales')draw();}}
     if(room){
      box.append(el('p','Código del grupo: '+room.code),el('p','Pilotos: '+room.players.length+'/8 · Sección '+(room.wave+1)));
      for(const member of room.players)box.append(el('p',member.name+(member.id===room.leader?' · líder':'')+(member.ready?' · listo':' · esperando')));
      box.append(button('LISTO',()=>lobbyAction('ready',{ready:true})),button('NO LISTO',()=>lobbyAction('ready',{ready:false})),button('SALIR DEL GRUPO',()=>lobbyAction('leave')));
      if(room.canStart)box.append(button('INICIAR HADES (LÍDER)',()=>lobbyAction('start')));
     }else{
      const code=el('input');code.placeholder='Código del grupo';code.maxLength=10;
      box.append(button('CREAR GRUPO',()=>lobbyAction('create')),code,button('UNIRSE',()=>lobbyAction('join',{code:code.value})));
     }
     box.append(button('ACTUALIZAR GRUPO',()=>lobbyAction('status')));body.append(box);
    }
    else body.append(el('p','Combate de esta puerta aún en desarrollo.'));
   }
  }
  draw();
 }catch(e){if(modal.open&&mode==='Portales')body.replaceChildren(el('p',e.message));}
}
window.gg13Open=open;window.gg16OpenGate=gate=>open('Portales',gate);
document.getElementById('godMenu')?.addEventListener('click',()=>open('Habilidades'));
document.getElementById('gateMenu')?.addEventListener('click',()=>open('Portales'));
})();