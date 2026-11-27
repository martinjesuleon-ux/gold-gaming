(()=>{'use strict';
const labels={ships:'Naves',designs:'Diseños',lasers:'Armas',ammo:'Munición',rockets:'Cohetes',specialRockets:'Cohetes especiales',launchers:'Hellstorm',launcherAmmo:'Munición Hellstorm',mines:'Minas',consumables:'Consumibles',cpus:'CPU',robots:'Robots de reparación',shields:'Escudos',engines:'Motores',drones:'VANT',pet:'P.E.T.',fuel:'Combustible P.E.T.',petGear:'Módulos P.E.T.'};
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
const fmt=n=>Number(n).toLocaleString('es-CL');
async function api(path,body){const res=await fetch('/api/v13/'+path,{credentials:'same-origin',...(body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})});const data=await res.json();if(!res.ok)throw Error(data.error||'Operación no disponible');return data;}
let modal,body,status,cat,state,busy=false,mode;
function button(text,fn){const b=el('button',text);b.type='button';b.onclick=fn;return b;}
function balance(){return 'Créditos: '+fmt(state.balance.credits)+'   |   Uridium: '+fmt(state.balance.uridium);}
async function refresh(){state=await api('inventory');window.dispatchEvent(new CustomEvent('gg13:inventory',{detail:state}));}
window.addEventListener('gg13:lootRefresh',()=>{if(!busy&&modal?.open&&mode==='Inventario')refresh().then(()=>{if(!busy&&modal?.open&&mode==='Inventario')render();}).catch(()=>{});});
async function open(which,gate){if(busy)return;if(modal?.open){if(mode===which&&!gate)return;modal.close();}mode=which;if(gate)pendingGate=gate; if(!modal){modal=el('dialog',null,'gg13');const head=el('header');head.append(el('strong','GOLD GAMING • V1.56'),button('Cerrar',()=>{if(!busy)modal.close();}));body=el('main');status=el('footer');status.setAttribute('role','status');modal.append(head,body,status);modal.addEventListener('cancel',e=>{if(busy)e.preventDefault();});document.body.append(modal);}modal.showModal();body.replaceChildren(el('p','Cargando…'));status.textContent='';busy=true;try{cat=await api('catalog');await refresh();render();}catch(e){body.replaceChildren(el('p',e.message));}finally{busy=false;}}
function render(){body.replaceChildren();status.textContent=balance();if(mode==='Hielo'){iceMenu();return;}if(mode==='Hitac'){hitacMenu();return;}if(mode==='Spaceball'){spaceballMenu();return;}if(mode==='Invasión'){invasionMenu();return;}if(mode==='UBA'){ubaMenu();return;}if(mode==='Clasificación'){rankingMenu();return;}if(mode==='Subastas'){auctionMenu();return;}if(mode==='Estaciones CBS'){stationMenu();return;}if(mode==='Boosters'){boosterMenu();return;}if(mode==='Piloto'){pilotMenu();return;}if(mode==='VANT'){formationMenu();return;}if(mode==='Ensamblaje'){assemblyMenu();return;}if(mode==='Chip'){cpuMenu();return;}if(mode==='Minas'){mineMenu();return;}if(mode==='Habilidades'){abilityMenu();return;}if(mode==='Portales'){gates();return;}if(mode==='Facción'){faction();return;}if(mode==='Grupo'){socialGroup();return;}if(mode==='Clan'){clanMenu();return;}if(mode==='Misiones'){missionMenu();return;}if(mode==='Registro'){activityMenu();return;}if(mode==='Registro diario'){dailyMenu();return;}if(mode==='Potenciación'){upgradeMenu();return;}if(['Skylab','Refinación','Comercio'].includes(mode)){mineralMenu(mode);return;}if(mode==='Tienda')shop();else if(mode==='Hangar')hangar();else inventory();}
function shop(){const visual=window.ggShopVisual;const layout=el('div',null,'gg13-shop'),nav=el('aside'),grid=el('section',null,'gg13-grid'),detail=el('section',null,'gg13-detail');layout.append(nav,grid,detail);body.append(el('h2','Tienda de equipamiento'),layout);let activeCategory='ships';const search=el('input');search.type='search';search.placeholder='Buscar artículo…';search.setAttribute('aria-label','Buscar artículo');nav.append(search);search.oninput=()=>list(activeCategory);const categoryButtons=new Map();
function list(category){activeCategory=category;for(const [key,b] of categoryButtons)b.setAttribute('aria-pressed',String(key===category));grid.replaceChildren();detail.replaceChildren(el('p','Selecciona un artículo para ver sus características y precio antes de comprar.'));for(const p of (category==='petGear'?[{id:'G-AL1',name:'G-AL1 Auto-botín',price:state.items.some(i=>i.category==='pet')&&!state.items.some(i=>i.code==='G-AL1')?7500:null,currency:'uridium'},{id:'G-KK1',name:'G-KK1 Kamikaze · PRUEBA',damage:1000000,price:state.items.some(i=>i.category==='pet')&&!state.items.some(i=>i.code==='G-KK1')?7500:null,currency:'uridium'}]:category==='fuel'?[{id:'pet-fuel',name:'Combustible P.E.T.',price:state.items.some(i=>i.category==='pet')?.25:null,currency:'uridium'}]:category==='pet'?[{id:'pet-10',name:'P.E.T. 10',hp:50000,price:state.items.some(i=>i.category==='pet')?null:50000,currency:'uridium'}]:category==='drones'?['flax','iris'].map(id=>({id,name:id.toUpperCase(),...cat.drones[id],price:cat.drones[id].prices[state.items.filter(i=>i.category==='drones'&&['flax','iris'].includes(i.code)).length]??null})):cat[category])){if(!((p.name||p.id)+' '+p.id+' '+visual.describe(category,p)).toLowerCase().includes(search.value.trim().toLowerCase()))continue;const card=button('',()=>select(category,p));card.className='gg-shop-card';card.style.setProperty('--item-color',visual.itemColor(category,p));card.append(visual.art(category,p),el('strong',p.name||p.id),el('span',visual.describe(category,p),'gg-item-summary'),el('small',p.price==null?'No disponible para compra':fmt(p.price)+' '+(p.currency==='credits'?'Créditos':'Uridium')));grid.append(card);}}
function select(category,p){detail.style.setProperty('--item-color',visual.itemColor(category,p));detail.replaceChildren(el('h3',p.name||p.id),visual.art(category,p),el('p',visual.describe(category,p)));const statList=el('dl',null,'gg-shop-stats');for(const [label,value] of visual.stats(p)){statList.append(el('dt',label),el('dd',value));}detail.append(statList);const owned=state.items.filter(i=>i.code===p.id).length+Number(state.ammo.find(i=>i.code===p.id)?.quantity||0);if(owned)detail.append(el('p','En inventario: '+fmt(owned),'gg-shop-owned'));if(p.price==null||p.id==='phoenix'){detail.append(el('p','No disponible para compra'));return;}const qty=el('input');qty.type='number';qty.min='1';qty.max=category==='petGear'?'1':category==='pet'?'1':category==='drones'?'1':['ships','designs','cpus','robots'].includes(category)?'1':['ammo','rockets','specialRockets','launcherAmmo','mines','consumables'].includes(category)?'100000':'100';qty.value=category==='fuel'?'1000':'1';if(category==='fuel'){qty.min='4';qty.max=String(50000-Number(state.ammo.find(a=>a.code==='pet-fuel')?.quantity||0));qty.step='4';}const total=el('p');const buy=button('COMPRAR',async()=>{if(busy||!qty.checkValidity())return;busy=true;buy.disabled=true;const requestId=crypto.randomUUID();try{await api('purchase',{category,code:p.id,quantity:Number(qty.value),requestId});await refresh();status.textContent='Compra confirmada • '+balance();if(['drones','pet','petGear','fuel'].includes(category))list(category);}catch(e){status.textContent=e.message;}finally{busy=false;buy.disabled=false;}});const update=()=>{total.textContent='Total: '+fmt(Number(qty.value)*p.price)+' '+p.currency;};qty.oninput=update;update();detail.append(qty,total,buy);}
for(const k of Object.keys(labels)){const b=button(labels[k],()=>{search.value='';list(k);});b.style.setProperty('--item-color',visual.palette[k]||'#94afd2');categoryButtons.set(k,b);nav.append(b);}list('ships');}
function inventory(){
 const visual=window.ggShopVisual,search=el('input'),grid=el('div',null,'gg13-grid gg-inventory-grid'),filters=el('select');search.type='search';search.placeholder='Buscar en inventario…';search.setAttribute('aria-label','Buscar en inventario');filters.setAttribute('aria-label','Categoría de inventario');
 const groups=new Map(),add=(category,p,quantity,level)=>{const key=category+':'+p.id+':'+(level??'');const previous=groups.get(key);if(previous)previous.quantity+=quantity;else groups.set(key,{category,p,quantity,level});};
 const lookup=(category,code)=>{const list=cat[category];return (Array.isArray(list)?list.find(p=>p.id===code):list?.[code])||{id:code};};
 for(const i of state.items){const category=i.category==='ship-designs'?'designs':i.category==='drone-designs'?'droneDesigns':i.category==='pet-gear'?'petGear':i.category;add(category,{...lookup(category,i.code),id:i.code},1,i.level);}
 for(const i of state.ammo){const category=Object.keys(labels).find(k=>Array.isArray(cat[k])&&cat[k].some(p=>p.id===i.code))||(i.code==='pet-fuel'?'fuel':'consumables');add(category,{...lookup(category,i.code),id:i.code},Number(i.quantity),null);}
 const categoryName=k=>labels[k]||(k==='droneDesigns'?'Diseños VANT':k);
 const all=el('option','Todas las categorías');all.value='';filters.append(all);
 for(const k of [...new Set([...groups.values()].map(g=>g.category))]){const o=el('option',categoryName(k));o.value=k;filters.append(o);}
 function draw(){grid.replaceChildren();const q=search.value.trim().toLowerCase();for(const {category,p,quantity,level} of groups.values()){if(filters.value&&filters.value!==category||!((p.name||p.id)+' '+p.id).toLowerCase().includes(q))continue;const tile=el('section',null,'gg13-tile gg-inventory-card');tile.style.setProperty('--item-color',visual.itemColor(category,p));tile.append(visual.art(category,p),el('h3',p.name||p.id),el('small',categoryName(category)),el('strong','Cantidad: '+fmt(quantity)+(level!=null?' · Nivel '+level:'')),el('p',visual.describe(category,p)));grid.append(tile);}if(!grid.children.length)grid.append(el('p','No hay artículos que coincidan.'));}
 search.oninput=draw;filters.onchange=draw;const controls=el('div',null,'gg-inventory-filters');controls.append(search,filters);body.append(el('h2','Inventario'),controls,grid);draw();
}
function hangar(){const visual=window.ggShopVisual;const draft=JSON.parse(JSON.stringify(state.hangar));let tab=draft.active, destination='ship';draft.configs=draft.configs.map(c=>Array.isArray(c)?{ship:c,drones:[]}:c);const drones=state.items.filter(i=>i.category==='drones');for(const c of draft.configs)for(const d of drones)if(!c.drones.some(v=>v.id===d.instanceId))c.drones.push({id:d.instanceId,items:[]});const layout=el('div',null,'gg13-hangar'),left=el('section'),middle=el('section'),right=el('section');layout.append(left,middle,right);body.append(layout);left.append(el('h3','Naves disponibles'));const select=el('select');for(const s of cat.ships.filter(s=>s.id==='phoenix'||state.items.some(i=>i.category==='ships'&&i.code===s.id))){const op=el('option',s.name);op.value=s.id;select.append(op);}select.value=draft.ship;const designSelect=el('select');function designs(){designSelect.replaceChildren();const base=el('option','Sin diseño');base.value='';designSelect.append(base);for(const d of (cat.designs||[]).filter(d=>d.ship===draft.ship&&state.items.some(i=>i.category==='ship-designs'&&i.code===d.id))){const o=el('option',d.name||d.id);o.value=d.id;designSelect.append(o);}designSelect.value=draft.design||'';if(!designSelect.value)draft.design=null;}designSelect.onchange=()=>{draft.design=designSelect.value||null;draw();};select.onchange=()=>{draft.ship=select.value;draft.design=null;designs();draw();};designs();const preview=el('div',null,'gg-hangar-preview');left.append(select,el('h3','Diseño'),designSelect,preview);const save=button('Guardar y activar',async()=>{if(busy)return;busy=true;save.disabled=true;try{const v=await api('equip',{ship:draft.ship,configs:draft.configs,active:tab,design:draft.design||null});await refresh();window.dispatchEvent(new Event('gg13:loadout'));status.textContent='Guardado • Daño '+fmt(v.stats.damage)+' • Escudo '+fmt(v.stats.shield)+' • '+balance();}catch(e){status.textContent=e.message;}finally{busy=false;save.disabled=false;}});left.append(save);
const items=state.items.filter(i=>['lasers','engines','shields','launchers','cpus','robots'].includes(i.category));
const all=c=>[c.ship,...c.drones.map(d=>d.items)];
const itemData=i=>({...cat[i.category]?.find?.(p=>p.id===i.code),id:i.code});
let filter='',query='';
const categoryText=k=>labels[k]||k;
function equipmentTile(i,fn,action){const p=itemData(i),b=button('',fn);b.className='gg-hangar-item';b.style.setProperty('--item-color',visual.itemColor(i.category,p));b.title=visual.describe(i.category,p);b.append(visual.art(i.category,p),el('strong',i.code),el('small',categoryText(i.category)+' · Nivel '+i.level),el('small',action,'gg-hangar-action'));return b;}
function current(){return destination==='ship'?draft.configs[tab].ship:draft.configs[tab].drones.find(d=>d.id===destination).items;}
function move(id){const i=items.find(i=>i.instanceId===id);if(busy||!i)return;const dest=current(),ship=cat.ships.find(s=>s.id===draft.ship);if(dest.includes(id))return;
if(destination!=='ship'){const d=drones.find(x=>x.instanceId===destination);if(['engines','launchers','cpus','robots'].includes(i.category)||dest.length>=cat.drones[d.code].slots){status.textContent='Equipo incompatible o VANT lleno';return;}}
else if(['launchers','cpus','robots'].includes(i.category)){const mounted=dest.map(x=>items.find(y=>y.instanceId===x)).filter(Boolean);const extras=mounted.filter(x=>['launchers','cpus','robots'].includes(x.category));const slotBonus=mounted.reduce((n,x)=>n+(cat.cpus.find(y=>y.id===x.code)?.slots||0),0);const added=cat.cpus.find(y=>y.id===i.code)?.slots||0;if((i.category!=='cpus'&&extras.some(x=>x.category===i.category))||extras.some(x=>x.code===i.code)||(slotBonus&&added)||extras.length+1>ship.extras+slotBonus+added){status.textContent='Extra incompatible o espacios llenos';return;}}
else{const n=dest.filter(x=>{const k=items.find(y=>y.instanceId===x)?.category;return !['launchers','cpus','robots'].includes(k)&&(k==='lasers')===(i.category==='lasers');}).length;if(n>=(i.category==='lasers'?ship.lasers:ship.generators)){status.textContent='Espacios de nave llenos';return;}}
for(const c of draft.configs)for(const a of all(c)){const pos=a.indexOf(id);if(pos>=0)a.splice(pos,1);}dest.push(id);draw();}
function draw(){const ship=cat.ships.find(s=>s.id===draft.ship);preview.replaceChildren(el('strong',ship.name),visual.art(draft.design?'designs':'ships',draft.design?{id:draft.design,ship:ship.id}:ship));const info=el('dl',null,'gg-shop-stats');for(const [label,value] of visual.stats(ship))info.append(el('dt',label),el('dd',value));preview.append(info);middle.replaceChildren(el('h3','Equipamiento'));const tabs=el('div',null,'gg-hangar-tabs');middle.append(tabs);for(let t=0;t<2;t++){const b=button('Configuración '+(t+1),()=>{tab=t;destination='ship';draw();});b.setAttribute('aria-pressed',String(tab===t));tabs.append(b);}const mounted=current().map(id=>items.find(i=>i.instanceId===id)).filter(Boolean);const usage=el('div',null,'gg-hangar-usage');if(destination==='ship'){const extras=mounted.filter(i=>['launchers','cpus','robots'].includes(i.category));const extraLimit=ship.extras+extras.reduce((n,i)=>n+(cat.cpus.find(p=>p.id===i.code)?.slots||0),0);for(const [label,n,max] of [['Láseres',mounted.filter(i=>i.category==='lasers').length,ship.lasers],['Generadores',mounted.filter(i=>['shields','engines'].includes(i.category)).length,ship.generators],['Extras',extras.length,extraLimit]])usage.append(el('span',label+' '+n+' / '+max));}else{const d=drones.find(i=>i.instanceId===destination);usage.append(el('span','Ranuras VANT '+mounted.length+' / '+cat.drones[d.code].slots));}middle.append(usage);const pick=el('select');for(const [id,label] of [['ship','NAVE'],...drones.map((d,i)=>[d.instanceId,d.code.toUpperCase()+' '+(i+1)])]){const o=el('option',label);o.value=id;pick.append(o);}pick.value=destination;pick.onchange=()=>{destination=pick.value;draw();};middle.append(pick);const targets=el('div',null,'gg-hangar-targets');for(const [id,name,p,category] of [['ship',ship.name,ship,'ships'],...drones.map((d,i)=>[d.instanceId,d.code.toUpperCase()+' '+(i+1),{id:d.code},'drones'])]){const b=button('',()=>{destination=id;draw();});b.setAttribute('aria-pressed',String(destination===id));b.append(visual.art(category,p),el('small',name));targets.append(b);}middle.append(targets);const slots=el('div',null,'gg13-grid gg-hangar-equipped');slots.ondragover=e=>e.preventDefault();slots.ondrop=e=>{e.preventDefault();move(e.dataTransfer.getData('text/plain'));};for(const id of current()){const i=items.find(x=>x.instanceId===id);if(i)slots.append(equipmentTile(i,()=>{if(busy)return;const a=current();a.splice(a.indexOf(id),1);draw();},'Retirar'));}if(!mounted.length)slots.append(el('p','Sin equipo instalado'));middle.append(el('p','Selecciona un equipo disponible o arrástralo aquí.'),slots);right.replaceChildren(el('h3','Equipo disponible'));const search=el('input');search.type='search';search.placeholder='Buscar equipo…';search.value=query;search.setAttribute('aria-label','Buscar equipo disponible');const selectFilter=el('select');for(const k of ['', 'lasers','shields','engines','launchers','cpus','robots']){const op=el('option',k?categoryText(k):'Todas las categorías');op.value=k;selectFilter.append(op);}selectFilter.value=filter;const bag=el('div',null,'gg13-grid gg-hangar-bag');function drawBag(){bag.replaceChildren();for(const i of items.filter(i=>!draft.configs.some(c=>all(c).some(a=>a.includes(i.instanceId)))&&(destination==='ship'||!['engines','launchers','cpus','robots'].includes(i.category))&&(!filter||i.category===filter)&&i.code.toLowerCase().includes(query.toLowerCase()))){const b=equipmentTile(i,()=>move(i.instanceId),'Equipar');b.draggable=true;b.ondragstart=e=>e.dataTransfer.setData('text/plain',i.instanceId);bag.append(b);}if(!bag.children.length)bag.append(el('p','Sin equipos disponibles'));}search.oninput=()=>{query=search.value;drawBag();};selectFilter.onchange=()=>{filter=selectFilter.value;drawBag();};right.append(search,selectFilter,bag);drawBag();}
draw();}
const rewardText=r=>Object.entries(r||{}).map(([code,n])=>fmt(code.endsWith('-seconds')?n/3600:n)+' '+({'booster-damage-seconds':'h booster daño','booster-experience-seconds':'h booster EXP','booster-honor-seconds':'h booster honor','premium-seconds':'h premium'}[code]||code)).join(' + ');
let ubaState=null,arenaDialog=null,arenaCanvas=null,arenaInfo=null,arenaAmmo=null,arenaAttack=false;
window.addEventListener('gg129:arena',e=>{
 const a=e.detail;if(!a||a.closed){if(arenaDialog?.open)arenaDialog.close();arenaAttack=false;return;}
 if(!arenaDialog){
  arenaDialog=el('dialog',null,'gg13');const main=el('main');arenaInfo=el('p');arenaCanvas=el('canvas');arenaCanvas.width=900;arenaCanvas.height=600;arenaCanvas.style.maxWidth='100%';arenaCanvas.style.cursor='crosshair';
  arenaCanvas.addEventListener('pointerdown',ev=>{const b=arenaCanvas.getBoundingClientRect();window.gg129ArenaCommand({action:'move',x:(ev.clientX-b.left)/b.width*2400,y:(ev.clientY-b.top)/b.height*1600}).catch(err=>arenaInfo.textContent=err.message);});
  arenaAmmo=el('select');for(const code of ['LCB-10','MCB-25','MCB-50','UCB-100','RSB-75','SAB-50']){const o=el('option',code);o.value=code;arenaAmmo.append(o);}arenaAmmo.addEventListener('change',()=>window.gg129ArenaCommand({action:'ammo',code:arenaAmmo.value}).catch(err=>arenaInfo.textContent=err.message));
  const attack=button('ATACAR / DETENER',()=>{const on=!arenaAttack;window.gg129ArenaCommand({action:'attack',on}).then(()=>{arenaAttack=on;}).catch(err=>arenaInfo.textContent=err.message);});
  const leave=button('ABANDONAR DUELO',()=>{if(confirm('Abandonar cuenta como derrota. ¿Continuar?'))window.gg127UBA({action:'leave'}).catch(err=>arenaInfo.textContent=err.message);});
  main.append(el('h2','UBA · Arena independiente'),arenaInfo,arenaCanvas,arenaAmmo,attack,leave,el('p','Clic para moverte · Atacar para activar o detener los láseres.'));arenaDialog.append(main);arenaDialog.addEventListener('cancel',ev=>ev.preventDefault());document.body.append(arenaDialog);
 }
 if(!arenaDialog.open){arenaAttack=false;arenaDialog.showModal();}
 const ctx=arenaCanvas.getContext('2d'),w=arenaCanvas.width,h=arenaCanvas.height;ctx.fillStyle='#05080e';ctx.fillRect(0,0,w,h);ctx.strokeStyle='#192634';ctx.lineWidth=1;for(let x=0;x<w;x+=45){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}for(let y=0;y<h;y+=45){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
 const me=window.gg15Pilot?.()?.id;for(const p of a.fighters){const x=p.x/a.width*w,y=p.y/a.height*h;ctx.fillStyle=p.id===me?'#58dca2':'#f16e64';ctx.beginPath();ctx.moveTo(x+15,y);ctx.lineTo(x-12,y-10);ctx.lineTo(x-7,y);ctx.lineTo(x-12,y+10);ctx.closePath();ctx.fill();ctx.fillStyle='#202c3a';ctx.fillRect(x-30,y-26,60,4);ctx.fillRect(x-30,y-20,60,4);ctx.fillStyle='#58dca2';ctx.fillRect(x-30,y-26,60*p.hp/p.maxHp,4);ctx.fillStyle='#58aaff';ctx.fillRect(x-30,y-20,p.maxShield?60*p.shield/p.maxShield:0,4);ctx.fillStyle='#e7dbbd';ctx.textAlign='center';ctx.font='12px system-ui';ctx.fillText(p.name,x,y+26);}
 const own=a.fighters.find(p=>p.id===me);if(own){arenaAttack=own.attack;arenaAmmo.value=own.ammo||'LCB-10';}arenaInfo.textContent='Ronda '+a.round+' · '+a.fighters.map(p=>p.name+': '+fmt(Math.ceil(p.hp))+' PV').join(' | ')+(own?.stock!=null?' · '+own.ammo+': '+fmt(own.stock):'');
});
window.addEventListener('gg127:ubaState',e=>{ubaState=e.detail;if(modal?.open&&mode==='UBA')drawUBALobby();});
function drawUBALobby(){const panel=document.getElementById('gg-uba-lobby');if(!panel)return;panel.replaceChildren();const m=ubaState?.match;
 const run=async(action,matchId)=>{if(busy)return;busy=true;try{ubaState=await window.gg127UBA({action,matchId});drawUBALobby();}catch(e){status.textContent=e.message;}finally{busy=false;}};
 if(m?.phase==='fight'){panel.append(el('h3','Combate contra '+m.opponent),el('p','Ronda '+m.round+' · Marcador '+(m.score||[0,0]).join(' : ')),button('ABANDONAR DUELO',()=>{if(confirm('Abandonar después de comenzar cuenta como derrota. ¿Continuar?'))run('leave');}));}
 else if(m&&['offer','countdown'].includes(m.phase)){panel.append(el('h3','Rival: '+m.opponent),el('p','Ronda '+m.round+' · '+(m.phase==='offer'?'Aceptación':'Cuenta atrás')+' hasta '+new Date(m.until).toLocaleTimeString()),el('p','Tú: '+(m.accepted?'Aceptado':'Pendiente')+' · Rival: '+(m.opponentAccepted?'Aceptado':'Pendiente')));if(m.phase==='offer'){const b=button('ACEPTAR DUELO',()=>run('accept',m.id));b.disabled=m.accepted;panel.append(b);}panel.append(button('CANCELAR',()=>run('leave')));}
 else{if(m?.phase==='finished')panel.append(el('p',(m.winner==='you'?'Victoria':m.winner==='opponent'?'Derrota':'Empate')+(m.reason==='forfeit'?' por abandono':'')+' · Actualiza la clasificación.'));else if(m?.phase==='preview-complete')panel.append(el('p','Prueba de emparejamiento completada. No se inició combate ni se modificaron puntos.'));else if(m?.phase==='cancelled')panel.append(el('p','Oferta cancelada o vencida.'));if(ubaState?.queued)panel.append(el('p','Buscando rival…'),button('SALIR DE LA COLA',()=>run('leave')));else panel.append(button('BUSCAR RIVAL',()=>run('join')));}}
let invasionState=null,invDialog=null,invCanvas=null,invInfo=null,invAmmo=null,invLive=null;
window.addEventListener('gg136:invasionState',e=>{
 invLive=e.detail;if(!invLive){if(invDialog?.open)invDialog.close();return;}
 if(!invDialog){invDialog=el('dialog',null,'gg13');const main=el('main');invInfo=el('p');invCanvas=el('canvas');invCanvas.width=800;invCanvas.height=800;invCanvas.style.maxWidth='100%';invCanvas.style.maxHeight='60vh';
 const run=d=>window.gg136InvasionCommand(d).catch(err=>invInfo.textContent=err.message);
 invCanvas.addEventListener('pointerdown',ev=>{if(!invLive)return;const b=invCanvas.getBoundingClientRect(),x=(ev.clientX-b.left)/b.width*invLive.size,y=(ev.clientY-b.top)/b.height*invLive.size;const n=invLive.aliens.find(a=>Math.hypot(a.x-x,a.y-y)<180);if(n)run({action:'target',id:n.id});else run({action:'move',x,y});});
 invAmmo=el('select');for(const code of ['LCB-10','MCB-25','MCB-50','UCB-100','RSB-75']){const o=el('option',code);o.value=code;invAmmo.append(o);}invAmmo.addEventListener('change',()=>run({action:'ammo',code:invAmmo.value}));
 const attack=button('ATACAR / DETENER',()=>{const own=invLive?.players.find(p=>p.id===window.gg15Pilot?.()?.id);run({action:'attack',on:!own?.attack});});
 main.append(el('h2','Invasión · Combate cooperativo'),invInfo,invCanvas,invAmmo,attack,button('SALIR DEL EVENTO',()=>window.gg135Invasion({action:'leave'}).catch(err=>invInfo.textContent=err.message)),el('p','Clic en el mapa para moverte; clic sobre un alien para seleccionarlo.'));invDialog.append(main);invDialog.addEventListener('cancel',ev=>ev.preventDefault());document.body.append(invDialog);}
 if(!invDialog.open)invDialog.showModal();
 const ctx=invCanvas.getContext('2d'),scale=invCanvas.width/invLive.size,me=window.gg15Pilot?.()?.id,own=invLive.players.find(p=>p.id===me);
 ctx.fillStyle='#050810';ctx.fillRect(0,0,800,800);
 for(const p of [...invLive.aliens,...invLive.players]){const x=p.x*scale,y=p.y*scale,isAlien=invLive.aliens.includes(p);ctx.fillStyle=isAlien?'#e87d64':p.id===me?'#66e9aa':'#78a9ef';ctx.beginPath();ctx.arc(x,y,isAlien?6:5,0,Math.PI*2);ctx.fill();ctx.fillStyle='#4eda8b';ctx.fillRect(x-12,y-12,24*p.hp/p.maxHp,3);ctx.fillStyle='#4aa4ff';ctx.fillRect(x-12,y-8,p.maxShield?24*p.shield/p.maxShield:0,3);if(p.id===own?.target){ctx.strokeStyle='#e9c980';ctx.beginPath();ctx.arc(x,y,12,0,Math.PI*2);ctx.stroke();}}
 if(own)invAmmo.value=own.ammo||'LCB-10';invInfo.textContent=invLive.map+' · '+invLive.phase+' · Oleada '+invLive.wave+' · '+invLive.aliens.length+' enemigos'+(own?' · '+fmt(Math.ceil(own.hp))+' PV · '+fmt(invLive.scores.find(r=>r.id===me)?.points||0)+' puntos':'');
});
window.addEventListener('gg135:invasion',e=>{invasionState=e.detail;if(modal?.open&&mode==='Invasión')drawInvasionLobby();});
function drawInvasionLobby(){const panel=document.getElementById('gg-invasion-lobby');if(!panel)return;panel.replaceChildren();const e=invasionState?.event;if(!e){panel.append(el('p','Portal cerrado. Espera la apertura del evento.'));return;}
 const run=async action=>{if(busy)return;busy=true;try{invasionState=await window.gg135Invasion({action});drawInvasionLobby();}catch(err){status.textContent=err.message;}finally{busy=false;}};
 panel.append(el('h3',e.map+' · '+e.participants+'/'+e.capacity+' pilotos'),el('p','Inscripciones hasta '+new Date(e.entryUntil).toLocaleTimeString()),button(invasionState.joined?'CANCELAR INSCRIPCIÓN':'INSCRIBIRME',()=>run(invasionState.joined?'leave':'join')));
}
async function iceMenu(){
 body.replaceChildren(el('h2','Meteorito de Hielo'),el('p','Cargando…'));
 try{const d=await api('ice');if(!modal?.open||mode!=='Hielo')return;
 body.replaceChildren(el('h2','Super Ice Meteoroid'),el('p',fmt(d.boss.hp)+' PV · '+fmt(d.boss.shield)+' escudo'),el('p','Cuenta atrás: 60 s · duración: 1 hora'),el('p','Un Icy cada 6 s, máximo 25. Cada Icy eliminado cura '+fmt(d.rules.heal)+' PV al jefe.'),el('h3','Bolsa compartida de recompensas'));
 body.append(rewardCards(Object.fromEntries(['credits','uridium','xp','honor'].map(k=>[k,d.reward[k]]))));
 body.append(el('p','15 cajas de 2.000 uridium, disponibles 5 minutos.'),el('p',d.enabled?(d.rewardsEnabled?'Combate y recompensas disponibles cuando se abre el evento.':'Combate de prueba. Recompensas deshabilitadas.'):'Evento en desarrollo. Combate y premios todavía deshabilitados.'));
 }catch(e){body.replaceChildren(el('p',e.message));}
}
async function hitacMenu(){
 body.replaceChildren(el('h2','Convoy Hitac'),el('p','Cargando…'));
 try{const d=await api('hitac');if(!modal?.open||mode!=='Hitac')return;
 body.replaceChildren(el('h2','Convoy Hitac'),el('p',d.route.join(' → ')),el('p','1 nave nodriza y '+d.rules.guards+' guardias'));
 const ships=el('div',null,'gg13-grid gg-event-cards');for(const [name,n] of [['Nave nodriza',d.boss],['Guardia',d.guard]]){const tile=el('section',null,'gg13-tile gg-event-card');tile.append(el('h3',name),el('p',fmt(n.hp)+' PV · '+fmt(n.shield)+' escudo · '+fmt(n.damage)+' daño'),rewardCards({credits:n.credits,uridium:n.uridium,xp:n.xp,honor:n.honor}));ships.append(tile);}body.append(ships);body.append(el('p',d.rewardsEnabled?'Recompensas al piloto que elimina la unidad.':'Recompensas todavía deshabilitadas.'));
 body.append(el('p','Protección alterna cada 10 s en la nodriza y 20 s en los guardias.'),el('p','Guardias: ralentización 30 % durante 4 s, explosión de 100.000 de daño al morir.'),el('p',d.enabled?'Combate de prueba: selecciona un Hitac y dispara cuando baje su protección.':'Evento en desarrollo. Combate todavía deshabilitado.'));const lottery=await api('hitac-lottery');if(!modal?.open||mode!=='Hitac')return;body.append(el('h3','Lotería Hitac'),el('p','Cápsulas: '+fmt(lottery.capsules)+' · '+(lottery.bag?'Bolsa abierta':'Bolsa cerrada')),el('p','Premios ilimitados'));for(const p of lottery.unlimited)body.append(el('p',p.code+' × '+fmt(p.quantity)));body.append(el('h3','Premios limitados'));for(const p of lottery.limited)body.append(el('p',(p.entitlement?'Premium (7 días)':p.code+' × '+fmt(p.quantity)+(p.level===16?' (+16)':''))+' · '+(lottery.bag?lottery.bag.stock[p.id]+' disponibles':p.stock+' por bolsa')));if(lottery.enabled&&lottery.bag){let requestId=null,running=false;const result=el('p'),draw=button('ABRIR CÁPSULA',async()=>{if(running)return;running=true;draw.disabled=true;requestId??=crypto.randomUUID();try{const r=await api('hitac-lottery/draw',{requestId});requestId=null;result.textContent='Premio: '+(r.prize.premiumPending?'Premium pendiente de activación':r.prize.code+' × '+fmt(r.prize.quantity)+(r.prize.level===16?' (+16)':''));draw.textContent='PREMIO RECIBIDO';body.append(button('ACTUALIZAR LOTERÍA',()=>hitacMenu()));}catch(e){result.textContent=e.message;draw.disabled=false;}finally{running=false;}});draw.disabled=lottery.capsules<1;body.append(draw,result,el('p','Cápsulas obtenidas en combate. Sin compras ni pagos.'));}else body.append(el('p','Lotería cerrada o deshabilitada.'));
 }catch(e){body.replaceChildren(el('p',e.message));}
}
async function spaceballMenu(){
 body.replaceChildren(el('h2','Spaceball'),el('p','Cargando…'));
 try{const d=await api('spaceball');if(!modal?.open||mode!=='Spaceball')return;
 body.replaceChildren(el('h2','Spaceball · Mapa 4-4'),el('p','Las tres compañías compiten por empujar la pelota hacia una portería rival.'),el('p','15 cajas por gol · reinicio de pelota 10 s · cajas disponibles durante 5 minutos'),el('h3','Potencia de empuje'));
 for(const [code,push] of Object.entries(d.push))body.append(el('p',code+' · ×'+push));
 body.append(el('h3','Recompensas por caja'));const names={gateEnergy:'Energía de puerta',jumpVouchers:'Vales de salto',repairVouchers:'Vales de reparación',credits:'Créditos',uridium:'Uridium'};
 for(const [key,[min,max]] of Object.entries(d.rewards))body.append(el('p',(names[key]||key)+' · '+fmt(min)+' – '+fmt(max)));
 body.append(el('p',d.enabled?'Cuando el evento esté abierto, selecciona la pelota en 4-4 y dispara.':'Evento en desarrollo. Disparos y recogida de cajas todavía deshabilitados.'));if(d.enabled)body.append(el('p',d.claimsEnabled?'Acércate a las cajas para recoger los seis premios.':'Recogida de cajas deshabilitada.'));
 }catch(e){body.replaceChildren(el('p',e.message));}
}
async function invasionMenu(){
 body.replaceChildren(el('h2','Invasión'),el('p','Cargando…'));
 try{const d=await api('invasion');if(!modal?.open||mode!=='Invasión')return;
 const names={easy:'Fácil · nivel 5–9',medium:'Media · nivel 10–14',hard:'Difícil · nivel 15+'};
 body.replaceChildren(el('h2','Evento Invasión'),el('p','25 pilotos por mapa · portal abierto 60 s · descanso de 10 s entre oleadas'),el('p',d.difficulty?'Tu dificultad: '+names[d.difficulty]:'Requiere nivel 5'));
 const difficulties=el('div',null,'gg13-grid gg-event-cards');for(const [key,waves] of Object.entries(d.waves)){const section=el('section',null,'gg13-tile gg-event-card');section.dataset.current=String(key===d.difficulty);section.append(el('h3',names[key]),el('small',key===d.difficulty?'Tu dificultad': 'Oleadas'));for(const [i,[name,count]] of waves.entries())section.append(el('p','Oleada '+(i+1)+' · '+name+' ×'+count));difficulties.append(section);}body.append(difficulties);
 body.append(el('p','Jefe final: Boss Kucurbium · 20 millones de vida y 20 millones de escudo · 4 escoltas'),el('p',d.enabled?'Combate cooperativo de prueba.':'Combate del evento todavía deshabilitado.'));if(d.lobbyEnabled){const panel=el('section');panel.id='gg-invasion-lobby';body.append(panel,el('p','Inscripción de prueba desde la base X-1 de tu compañía.'));try{invasionState=await window.gg135Invasion({action:'status'});}catch(err){invasionState=null;status.textContent=err.message;}drawInvasionLobby();}
 body.append(el('h3','Clasificación de Invasión'),el('p','Puntos de daño acumulados en eventos completados, sin premios monetarios.'));
 const scores=el('table');for(const [i,r] of (d.rows||[]).entries()){const tr=el('tr');for(const v of [i+1,r.name,fmt(r.points),r.completed+' eventos'])tr.append(el('td',String(v)));if(r.own)tr.className='gg13-own';scores.append(tr);}body.append(scores);
 body.append(el('h3','Mis últimos eventos'));for(const r of d.history||[]){const result={finished:'Completado',failed:'Fallido',cancelled:'Cancelado'}[r.phase];body.append(el('p',new Date(r.finished_at).toLocaleString()+' · '+names[r.difficulty]+' · '+result+' · '+fmt(r.points)+' puntos'+(r.abandoned?' · Abandono':'')));}
 }catch(e){body.replaceChildren(el('p',e.message));}
}
async function ubaMenu(){
 body.replaceChildren(el('h2','Ultimate Battle Arena'),el('p','Cargando clasificación…'));
 try{const d=await api('uba');if(!modal?.open||mode!=='UBA')return;
 body.replaceChildren(el('h2','UBA · Arena competitiva'),el('p','Nivel mínimo 14 · 1 contra 1 · 2 victorias de 3 rondas'),el('p','Aceptación 40 s · rondas siguientes 30 s · cuenta atrás 15 s · combate 315 s'),el('p','Victoria +10 / +5 frente a rival mucho más débil · derrota -5 · mínimo 50 puntos'),el('h3','Tu puntuación: '+fmt(d.own.score)),el('p',fmt(d.own.wins)+' victorias · '+fmt(d.own.losses)+' derrotas'),el('p',d.champion?'Campeón actual: '+d.champion.name+' · '+fmt(d.champion.score)+' puntos':'Todavía no hay campeón UBA.'));
 if(d.lobbyEnabled){const panel=el('section');panel.id='gg-uba-lobby';body.append(panel,el('p',d.enabled?'Duelos de prueba: entra desde una base segura.':'Vista previa de sala: no se inicia combate ni se modifican puntos.'));try{ubaState=await window.gg127UBA({action:'status'});}catch(e){ubaState=null;status.textContent=e.message;}drawUBALobby();}else{const join=button('BUSCAR RIVAL',()=>{});join.disabled=true;body.append(join,el('p','Sala UBA en pruebas: acceso deshabilitado.'));}
 const table=el('table'),head=el('tr');for(const v of ['#','Piloto','Puntos','Victorias','Derrotas'])head.append(el('th',v));table.append(head);
 d.rows.forEach((r,i)=>{const tr=el('tr');for(const v of [i+1,r.name,fmt(r.score),fmt(r.wins),fmt(r.losses)])tr.append(el('td',String(v)));if(r.own)tr.style.color='#d4af37';table.append(tr);});body.append(table);
 }catch(e){body.replaceChildren(el('p',e.message));}
}
async function achievementsMenu(){
 body.replaceChildren(el('h2','Logros y títulos'),el('p','Cargando…'));
 try{const d=await api('achievements');if(!modal?.open||mode!=='Piloto')return;
 body.replaceChildren(el('h2','Logros y títulos'),button('VOLVER A HABILIDADES',()=>pilotMenu()));
 const grid=el('div',null,'gg13-grid');for(const [code,name] of [['alien','Alienígenas eliminados'],['box','Cajas recogidas'],['distance','Distancia volada (px)'],['pvp','Bajas PvP'],['gates','Puertas completadas']]){const tile=el('section',null,'gg13-tile');tile.append(el('h3',name),el('strong',fmt(d.counters[code])));grid.append(tile);}body.append(grid,el('h3','Anillos permanentes'),el('p',d.rings.length?d.rings.map(x=>x.toUpperCase()).join(' · '):'Todavía sin puertas completadas'));
 body.append(el('p','El título Campeón de UBA corresponde al líder actual de la clasificación.'));const pick=el('select'),none=el('option','Sin título');none.value='';pick.append(none);for(const t of d.unlocked){const o=el('option',t.name);o.value=t.id;pick.append(o);}pick.value=d.selected||'';
 body.append(el('h3','Título de piloto'),pick,button('GUARDAR TÍTULO',async()=>{if(busy)return;busy=true;try{await api('achievements',{title:pick.value||null});await achievementsMenu();}catch(e){status.textContent=e.message;}finally{busy=false;}}),el('p','Los contadores nuevos comienzan desde esta actualización. Los anillos y títulos reconocen puertas ya completadas.'));
 }catch(e){body.replaceChildren(el('p',e.message));}
}
async function pilotMenu(){
 body.replaceChildren(el('h2','Hoja de piloto'),el('p','Cargando habilidades…'));
 try{const d=await api('pilot');if(!modal.open||mode!=='Piloto')return;body.replaceChildren(el('h2','Hoja de piloto'),el('p',d.points+'/50 puntos · '+d.free+' libres · '+d.used+' asignados'),el('p',fmt(d.stock['log-disk']||0)+' discos de registro · '+fmt(d.stock.seprom||0)+' Seprom'),el('p','Costes intermedios y requisitos de habilidades provisionales.'));
 const run=async(action,code)=>{if(busy)return;busy=true;try{await api('pilot',{action,code,requestId:crypto.randomUUID()});await refresh();window.dispatchEvent(new Event('gg13:loadout'));await pilotMenu();}catch(e){status.textContent=e.message;}finally{busy=false;}};
 body.append(button('LOGROS Y TÍTULOS',()=>achievementsMenu()));
 const b=button(d.nextDisk?'CANJEAR '+fmt(d.nextDisk)+' DISCOS':'MÁXIMO 50 PUNTOS',()=>run('point'));b.disabled=!d.nextDisk||(d.stock['log-disk']||0)<d.nextDisk;body.append(b);
 for(const branch of ['Defensa','Ataque','Ganancias']){body.append(el('h3',branch));const grid=el('div',null,'gg13-grid');for(const k of d.catalog.filter(x=>x.branch===branch)){const level=d.skills[k.id]||0,tile=el('section',null,'gg13-tile'),req=k.requires&&d.catalog.find(x=>x.id===k.requires),locked=req&&(d.skills[req.id]||0)<req.max,learn=button(level===k.max?'NIVEL MÁXIMO':'APRENDER',()=>run('skill',k.id));learn.disabled=level===k.max||d.free<1||!!locked||(d.stock.seprom||0)<k.cost.seprom||Number(d.balance.credits)<k.cost.credits;tile.append(el('h3',k.name+' · '+level+'/'+k.max),el('p',k.description));if(locked)tile.append(el('p','Requiere '+req.name+' al máximo'));if(level<k.max)tile.append(el('p',fmt(k.cost.credits)+' C + '+fmt(k.cost.seprom)+' Seprom + 1 punto'));tile.append(learn);grid.append(tile);}body.append(grid);}
 const reset=button('REINICIAR · '+fmt(d.resetCost)+' U',()=>{if(confirm('¿Reiniciar todas las habilidades? Se recuperan los puntos asignados, no los recursos gastados.'))run('reset');});reset.disabled=!d.used||Number(d.balance.uridium)<d.resetCost;body.append(reset);
 }catch(e){body.replaceChildren(el('p',e.message));}
}
async function formationMenu(){
 body.replaceChildren(el('h2','VANT · Formaciones'),el('p','Cargando escuadrón…'));
 try{const [d,fleet]=await Promise.all([api('formations'),api('drones')]);if(!modal.open||mode!=='VANT')return;body.replaceChildren(el('h2','VANT · Formaciones'),el('p',d.count+' VANT montados · mínimo 6 para activar una formación · recarga 2 s'));
 const run=async(fn)=>{if(busy)return;busy=true;try{await fn();await refresh();await formationMenu();}catch(e){status.textContent=e.message;}finally{busy=false;}};
 const visual=window.ggShopVisual,graphics=window.ggGraphics161;const fleetGrid=el('div',null,'gg13-grid gg-drone-fleet');body.append(el('h3','Escuadrón · rangos y diseños'),el('p','Havoc: +10 % daño · Hercules: +10 % escudo · Spartan: ambos. Se aplica al equipo montado en cada VANT.'));for(const drone of fleet.drones){const tile=el('section',null,'gg13-tile'),pick=el('select');const none=el('option','Sin diseño');none.value='';pick.append(none);for(const design of fleet.designs.filter(x=>!fleet.drones.some(y=>y.instanceId!==drone.instanceId&&y.designId===x.instanceId))){const o=el('option',design.code+' · '+({Havoc:'+10 % daño',Hercules:'+10 % escudo',Spartan:'+10 % daño y escudo'}[design.code]||'')+' · '+design.instanceId.slice(0,6));o.value=design.instanceId;pick.append(o);}pick.value=drone.designId||'';const next=[100,300,700,1500,3100][drone.rank-1];const art=el('canvas',null,'gg-item-art');art.width=144;art.height=96;art.setAttribute('role','img');art.setAttribute('aria-label','VANT '+drone.code.toUpperCase());const c=art.getContext('2d');const drawDrone=()=>{if(!c)return;c.clearRect(0,0,144,96);c.save();c.fillStyle='#0a1420';c.fillRect(0,0,144,96);c.translate(72,48);c.scale(2,2);const selectedDesign=fleet.designs.find(x=>x.instanceId===pick.value);graphics.draw(c,graphics.droneKind(drone.code),graphics.droneColor(selectedDesign?.code));c.restore();};pick.onchange=drawDrone;drawDrone();tile.append(art,el('h3',drone.code.toUpperCase()+' · Rango '+drone.rank),el('p','Nivel de mejora '+drone.level+' · '+(next?fmt(drone.points)+' / '+fmt(next)+' puntos':'Rango máximo')),pick,button('GUARDAR DISEÑO',()=>run(async()=>{await api('drones/design',{droneId:drone.instanceId,designId:pick.value||null});window.dispatchEvent(new Event('gg13:loadout'));})));fleetGrid.append(tile);}body.append(fleetGrid,el('h3','Formaciones'),el('p','Vista previa de la formación con 10 VANT. Los efectos y requisitos se indican en cada ficha.'));const grid=el('div',null,'gg13-grid gg-formation-grid');for(const f of [{id:'normal',name:'Normal',description:'Sin bonificaciones ni penalizaciones'},...d.catalog]){const owned=f.id==='normal'||d.owned.includes(f.id),tile=el('section',null,'gg13-tile'),selected=d.active===f.id;tile.classList.add('gg-formation-card');if(selected)tile.dataset.active='true';const preview=el('canvas',null,'gg-item-art');preview.width=220;preview.height=150;preview.setAttribute('role','img');preview.setAttribute('aria-label','Formación '+f.name);const c=preview.getContext('2d');if(c){c.fillStyle='#0a1420';c.fillRect(0,0,220,150);c.translate(110,75);c.scale(.65,.65);const pilot=window.gg15Pilot?.();const ship=graphics.playerStyle(pilot?.ship,pilot?.design,true);graphics.draw(c,ship.kind,ship.color);for(const {x,y} of graphics.formationOffsets(10,f.id)){c.save();c.translate(x,y);graphics.draw(c,'drone-iris',graphics.droneColor());c.restore();}}tile.append(preview,el('h3',f.name+(selected?' · ACTIVA':'')),el('p',f.description));if(!owned){tile.append(el('p',fmt(f.price)+' '+(f.currency==='credits'?'créditos':'uridium')),button('COMPRAR',()=>run(()=>api('formations/buy',{code:f.id}))));}else{const b=button(selected?'ACTIVA':'ACTIVAR',()=>run(()=>window.gg19Formation(f.id)));b.disabled=selected||(f.id!=='normal'&&d.count<6)||Date.now()<d.readyAt;tile.append(b);}grid.append(tile);}
 body.append(grid,button('ACTUALIZAR',()=>formationMenu()));
 }catch(e){body.replaceChildren(el('p',e.message));}
}
async function assemblyMenu(){
 body.replaceChildren(el('h2','Ensamblaje'),el('p','Cargando recetas…'));
 try{const d=await api('assembly');if(!modal.open||mode!=='Ensamblaje')return;body.replaceChildren(el('h2','Ensamblaje'),el('p','Tecnologías de un solo uso. Fabrica las unidades y actívalas durante una partida.'));
 const grid=el('div',null,'gg13-grid'),desc={'backup-shields':'75.000 puntos de escudo al instante','battle-repair':'10.000 PV/s durante 10 s','energy-leech':'Recupera 10 % del daño efectivo de armas durante 30 min','precision-targeter':'Mejor puntería durante 15 min'};
 for(const [code,r] of Object.entries(d.recipes)){const tile=el('section',null,'gg13-tile'),q=el('input'),stock=d.stock[code]||0;q.type='number';q.min=1;q.max=999;q.value=1;const total=el('p');const update=()=>{total.textContent=fmt(Number(q.value)*r.price)+' '+r.currency+' · '+Number(q.value)*3+' s';};q.oninput=update;update();
 const craft=button('ENSAMBLAR',async()=>{if(busy||!q.checkValidity())return;busy=true;try{await api('assembly',{code,quantity:Number(q.value),requestId:crypto.randomUUID()});await refresh();status.textContent=balance();await assemblyMenu();}catch(e){status.textContent=e.message;}finally{busy=false;}});
 const until=d.active[code]?.until||0,ready=d.active[code]?.readyAt||0,now=Date.now();const use=button('ACTIVAR',async()=>{if(busy)return;busy=true;try{await window.gg19Tech(code);await assemblyMenu();}catch(e){status.textContent=e.message;}finally{busy=false;}});use.disabled=!stock||until>now||ready>now;tile.append(el('h3',r.name),el('p',desc[code]),el('p','Disponibles: '+fmt(stock)+' · Recarga: '+r.cooldown/1000+' s'),el('p',until>now?'Activa '+Math.ceil((until-now)/1000)+' s':ready>now?'Recargando '+Math.ceil((ready-now)/1000)+' s':'Disponible'),q,total,craft,use);grid.append(tile);}
 body.append(grid);
 const run=async(path,data,reload=false)=>{if(busy)return;busy=true;try{await api(path,data);await refresh();if(reload)window.dispatchEvent(new Event('gg13:loadout'));await assemblyMenu();}catch(e){status.textContent=e.message;}finally{busy=false;}};
 body.append(el('h3','Pedidos de tecnologías'));
 for(const j of d.jobs||[]){const tile=el('section',null,'gg13-tile'),ready=Number(j.readyAt)<=Date.now(),b=button('RECOGER',()=>run('assembly/collect',{jobId:j.jobId}));b.disabled=!ready;tile.append(el('strong',d.recipes[j.code]?.name+' × '+fmt(j.quantity)),el('p',ready?'Listo para recoger':'Disponible en '+Math.ceil((Number(j.readyAt)-Date.now())/1000)+' s'),b);body.append(tile);}
 if(!d.jobs?.length)body.append(el('p','Sin pedidos pendientes.'));
 body.append(el('h3','Mejora de equipamiento · nivel máximo 16'));
 const credit=new Set(['LF-1','LF-2','SG3N-A01','SG3N-A02','SG3N-A03','flax']),eg=el('div',null,'gg13-grid');
 for(const item of d.equipment||[]){const tile=el('section',null,'gg13-tile'),job=d.equipmentJobs.find(j=>j.instanceId===item.instanceId);tile.append(el('h3',item.code.toUpperCase()+' +'+item.level),el('small',item.instanceId.slice(0,8)));
 if(job){tile.append(el('p','En mejora: nivel '+job.steps.at(-1).level),el('p','Próximo nivel en '+Math.max(0,Math.ceil((job.steps[0].at-Date.now())/1000))+' s'));}
 else if(item.level<16){const q=el('input'),total=el('p');q.type='number';q.min=1;q.max=16-item.level;q.value=1;const update=()=>{let cost=0,min=0;for(let n=item.level+1;n<=item.level+Number(q.value)&&n<=16;n++){cost+=(3905+435*(n-2))*(credit.has(item.code)?100:1);min+=(n-1)*2;}total.textContent=fmt(cost)+' '+(credit.has(item.code)?'créditos':'uridium')+' · '+min+' min';};q.oninput=update;update();tile.append(q,total,button('MEJORAR',()=>{if(q.checkValidity())run('assembly/upgrade',{instanceId:item.instanceId,levels:Number(q.value),requestId:crypto.randomUUID()},true);}));}
 else tile.append(el('p','Nivel máximo alcanzado'));eg.append(tile);}
 body.append(eg,el('h3','VANT especiales APIS / ZEUS'));
 const dg=el('div',null,'gg13-grid');for(const code of ['apis','zeus']){const own=d.ownedDrones.includes(code),pieces=d.pieces[code+'-piece']||0,tile=el('section',null,'gg13-tile');const a=button('ENSAMBLAR CON PIEZAS',()=>run('assembly/drone',{code,method:'pieces',requestId:crypto.randomUUID()})),b=button('ENSAMBLAR CON URIDIUM',()=>run('assembly/drone',{code,method:'uridium',requestId:crypto.randomUUID()}));a.disabled=own||pieces<45;b.disabled=own;tile.append(el('h3',code.toUpperCase()),el('p',own?'Ya adquirido':'2 espacios de equipo · '+pieces+'/45 piezas'),a,el('p','2.500.000 U'),b);dg.append(tile);}body.append(dg,button('ACTUALIZAR',()=>assemblyMenu()));
 }catch(e){body.replaceChildren(el('p',e.message));}
}
function cpuMenu(){
 const p=window.gg15Pilot?.();body.replaceChildren(el('h2','CPU y reparación'));
 if(!p){body.append(el('p','Entra en una partida'));return;}
 const grid=el('div',null,'gg13-grid');
 function add(code,title,desc,enabled){const tile=el('section',null,'gg13-tile'),b=button(title,async()=>{if(busy)return;busy=true;b.disabled=true;try{await window.gg18Cpu(code);await refresh();cpuMenu();}catch(e){status.textContent=e.message;}finally{busy=false;b.disabled=!enabled;}});b.disabled=!enabled;tile.append(el('h3',code),el('p',desc),b);grid.append(tile);}
 add('repair',p.repairOn?'DESACTIVAR':'ACTIVAR',p.robot||'Equipa un robot de reparación',!!p.robot);
 for(const code of p.cpus||[]){const uses=Number(state.ammo.find(a=>a.code===code+'-uses')?.quantity||0);if(code==='ISH-01'||code==='SMB-01')add(code,'ACTIVAR',code==='ISH-01'?'3 s de inmunidad · 10 ACM-01 + 100 Xenomit':'Explosión de prueba · 10 ACM-01 + 100 Xenomit',true);else if(code.startsWith('CLO4K-'))add(code,'CAMUFLAR','Usos restantes: '+fmt(uses),uses>0&&!p.cloaked);else if(code==='AJP-01'){const tile=el('section',null,'gg13-tile'),pick=el('select'),count=Number(state.ammo.find(a=>a.code==='jump-voucher')?.quantity||0);for(let c=1;c<=4;c++)for(let n=1;n<=(c===4?5:8);n++){const id=c+'-'+n,o=el('option',id);o.value=id;pick.append(o);}const b=button('SALTAR',async()=>{if(busy)return;busy=true;b.disabled=true;try{await window.gg18Jump(pick.value);modal.close();}catch(e){status.textContent=e.message;}finally{busy=false;b.disabled=false;}});b.disabled=count<1;tile.append(el('h3',code),el('p',fmt(count)+' vales de salto'),pick,b);grid.append(tile);}else{const tile=el('section',null,'gg13-tile');tile.append(el('h3',code),el('p',({'AROL-X':'Dispara el cohete elegido junto al láser','RL-LB1':'Dispara el Hellstorm elegido junto al láser','NC-AWB':'Carga el mejor mineral disponible cuando se agota la mejora','AIM-02':'Reduce el fallo del láser a la mitad · 10 Xenomit por salva','GEMINEX-XI':'Bodega ×2 permanente'}[code]||'Efecto pasivo equipado')));grid.append(tile);}}
 if(state.items.some(i=>i.code==='GEMINEX-XI'&&i.category==='cpus')&&!p.cpus?.includes('GEMINEX-XI'))grid.append(el('p','GEMINEX-XI activo permanentemente: bodega ×2'));
 body.append(grid);
}
let rankBoard='rank';
async function rankingMenu(){
 body.replaceChildren(el('h2','Clasificación'),el('p','Cargando…'));
 try{const d=await api('rankings?board='+rankBoard);if(!modal?.open||mode!=='Clasificación')return;
 body.replaceChildren(el('h2','Clasificación galáctica'));
 const nav=el('div',null,'gg-mission-tabs');for(const [key,label] of [['rank','RANGO'],['xp','EXPERIENCIA'],['honor','HONOR'],['clan','CLAN'],['war','GUERRA']]){const b=button(label,()=>{rankBoard=key;rankingMenu();});b.setAttribute('aria-pressed',String(rankBoard===key));nav.append(b);}body.append(nav);
 if(d.own){const own=el('section',null,'gg-social-summary');own.append(el('h3','Tu rango'),el('strong',d.names[d.own.rank]),el('small','Máximo histórico: '+d.names[d.own.highest]),el('p',fmt(d.own.points)+' puntos'));body.append(own);}
 const search=el('input');search.type='search';search.placeholder='Buscar piloto o clan…';search.setAttribute('aria-label','Buscar clasificación');const wrap=el('div',null,'gg-ranking-wrap'),table=el('table',null,'gg-ranking-table');const head=el('tr');for(const h of ['#','Nombre','Rango / clan','Puntos'])head.append(el('th',h));const thead=el('thead'),tbody=el('tbody');thead.append(head);table.append(thead,tbody);function list(){tbody.replaceChildren();d.rows.forEach((r,i)=>{if(!((r.name||'')+' '+(r.tag||'')).toLowerCase().includes(search.value.toLowerCase()))return;const tr=el('tr');for(const v of [i+1,r.name,r.tag?'['+r.tag+']':d.names[r.rank],fmt(r.value)])tr.append(el('td',String(v??'')));if(r.own)tr.dataset.own='true';if(i<3)tr.dataset.podium=String(i+1);tbody.append(tr);});if(!tbody.children.length){const tr=el('tr'),td=el('td','No hay resultados');td.colSpan=4;tr.append(td);tbody.append(tr);}}search.oninput=list;list();wrap.append(table);body.append(search,wrap,el('p','Máximo 100 posiciones. Rangos actualizados diariamente; distribución inferior provisional. Historial desde esta actualización.'));
 }catch(e){if(modal?.open&&mode==='Clasificación')body.replaceChildren(el('p',e.message));}
}
let auctionBoard='weekly-cbs';
async function auctionMenu(){
 body.replaceChildren(el('h2','Casa de subastas'),el('p','Cargando…'));
 try{const d=await api('auction-cbs?board='+encodeURIComponent(auctionBoard));if(!modal?.open||mode!=='Subastas')return;
 body.replaceChildren(el('h2','Casa de subastas'));
 const nav=el('div',null,'gg-mission-tabs');for(const [code,label] of [['hourly','POR HORAS'],['daily','DIARIA'],['weekly-cbs','SEMANAL']]){const b=button(label,()=>{if(!busy){auctionBoard=code;auctionMenu();}});b.setAttribute('aria-pressed',String(auctionBoard===code));nav.append(b);}const summary=el('section',null,'gg-social-summary');summary.append(el('strong','Cierre: '+new Date(d.roundEnd).toLocaleString('es-CL')),rewardCards({credits:d.credits,uridium:d.uridium}),el('small','Puja mínima 500.000 · Incremento 500.000 · Tu propia puja +1.500.000.'));body.append(nav,summary);const search=el('input');search.type='search';search.placeholder='Buscar artículo de subasta…';search.setAttribute('aria-label','Buscar artículo de subasta');body.append(search);
 const grid=el('div',null,'gg13-grid gg-auction-grid');
 const run=async data=>{if(busy)return;busy=true;try{await window.gg114Bid({...data,board:d.board,roundStart:d.roundStart,requestId:crypto.randomUUID()});await refresh();await auctionMenu();}catch(e){status.textContent=e.message;}finally{busy=false;}};
 for(const lot of d.lots){const tile=el('section',null,'gg13-tile gg-auction-card'),input=el('input');tile.dataset.code=lot.code.toLowerCase();if(lot.own)tile.dataset.own='true';const visual=window.ggShopVisual;const category=Object.keys(labels).find(k=>Array.isArray(cat[k])&&cat[k].some(p=>p.id===lot.code));const item=category?cat[category].find(p=>p.id===lot.code):{id:lot.code};tile.append(visual.art(category||'cpus',item));input.type='number';input.min=String(lot.minBid);input.step='1';input.value=String(lot.minBid);tile.append(el('h3',lot.code+' × '+lot.quantity),el('p','Puja actual: '+fmt(lot.amount)+(lot.own?' · Tu puja':'')),el('small','Mínimo para tu próxima puja: '+fmt(lot.minBid)),input);
 tile.append(button('PUJAR',()=>{const amount=Number(input.value);if(!Number.isSafeInteger(amount)||amount<lot.minBid){status.textContent='Puja insuficiente';return;}run({action:'bid',code:lot.code,amount});}));
 if(lot.directPrice!==null)tile.append(button('COMPRA DIRECTA · '+fmt(lot.directPrice)+(lot.currency==='credits'?' C':' U'),()=>run({action:'buy',code:lot.code})));else tile.append(el('p','Solo puja'));grid.append(tile);}
 search.oninput=()=>{const q=search.value.trim().toLowerCase();for(const tile of grid.children)tile.hidden=!tile.dataset.code.includes(q);};body.append(grid,el('p','Subastas por horas, diarias y semanales.'));status.textContent='Créditos: '+fmt(d.credits);
 }catch(e){if(modal?.open&&mode==='Subastas')body.replaceChildren(el('p',e.message));}
}
async function stationMenu(){
 body.replaceChildren(el('h2','Estaciones CBS'),el('p','Cargando…'));
 try{const d=await api('stations');if(!modal?.open||mode!=='Estaciones CBS')return;
  body.replaceChildren(el('h2','Estaciones de batalla de clan'),el('p','20 asteroides · 10 módulos · construcción de 5 a 60 minutos.'));
  if(!d.constructionEnabled)body.append(el('p','Vista previa: construcción bloqueada hasta completar el combate y la recuperación de módulos.'));
  const summary=el('section',null,'gg-social-summary');summary.append(rewardCards({Asteroides:d.asteroids.length,Libres:d.asteroids.filter(a=>!a.station).length,Propios:d.asteroids.filter(a=>a.station?.owned).length,Módulos:d.inventory.length}));body.append(summary);const search=el('input');search.type='search';search.placeholder='Buscar mapa o clan…';search.setAttribute('aria-label','Buscar estación');body.append(search);const grid=el('div',null,'gg13-grid gg-station-grid');
  const run=async data=>{if(busy)return;busy=true;try{await window.gg115CBS({...data,requestId:crypto.randomUUID()});await refresh();await stationMenu();}catch(e){status.textContent=e.message;}finally{busy=false;}};
  for(const a of d.asteroids){const tile=el('section',null,'gg13-tile gg-station-card'),local=window.gg115Map()===a.map;tile.dataset.search=(a.map+' '+(a.station?.clan_tag||'libre')).toLowerCase();tile.dataset.phase=a.station?.state||'free';const art=el('span','⬡','gg-station-icon');art.setAttribute('aria-hidden','true');tile.append(art);if(local)tile.append(el('small','MAPA ACTUAL'));
   tile.append(el('h3',a.map+' · Asteroide '+a.id.split(':')[1]),el('p','X: '+a.x+' · Y: '+a.y),el('p',a.station?'Clan '+a.station.clan_tag+' · '+({building:'En construcción',vulnerable:'Vulnerable',protected:'Deflector activo'}[a.station.state]||a.station.state):'Libre'));
   if(local)tile.append(button('VOLAR AL ASTEROIDE',()=>{try{window.gg115Travel(a);modal.close();}catch(e){status.textContent=e.message;}}));
   if(a.station?.deflector){tile.append(el('p','Carga: '+fmt(Math.floor(a.station.deflector.charge/60000))+' min'));if(Number(a.station.emergency_until)>Date.now())tile.append(el('p','Reparación de emergencia activa'));}
   if(a.station?.modules?.length){const detail=el('details');detail.append(el('summary','Módulos y estado de combate'));for(const m of a.station.modules){const row=el('div');row.append(el('p',m.code+' · PV '+fmt(m.hp)+' · Escudo '+fmt(m.shield)));if(local&&!a.station.owned&&a.station.state==='vulnerable'&&m.hp>0){const fire=button('DISPARAR',async()=>{if(busy)return;busy=true;try{const r=await window.gg116Shot({asteroidId:a.id,slot:m.slot});await stationMenu();status.textContent='Daño confirmado: '+fmt(r.applied);}catch(e){status.textContent=e.message;}finally{busy=false;}});fire.disabled=!d.combatEnabled;row.append(fire);}if(a.station.owned&&d.canManage&&a.station.state!=='building'&&m.hp>0){const repair=button('REPARACIÓN DE EMERGENCIA · 500 U',()=>run({action:'emergency',asteroidId:a.id,slot:m.slot}));repair.disabled=!d.repairEnabled;row.append(repair);}detail.append(row);}tile.append(detail);}
   if(a.station?.owned&&d.canManage&&a.station.state==='protected'){
    const input=el('input');input.type='number';input.min='30';input.max='2880';input.value='30';const lower=button('BAJAR DEFLECTOR',()=>run({action:'lower',asteroidId:a.id,minutes:Number(input.value)}));lower.disabled=!d.constructionEnabled;tile.append(input,lower);
   }
   if(!a.station&&local&&d.canManage){
    const details=el('details');details.append(el('summary','Configurar módulos'));const selects=[];
    for(let slot=0;slot<10;slot++){const row=el('label','Ranura '+(slot+1)+' '),sel=el('select'),blank=el('option','Seleccionar módulo');blank.value='';sel.append(blank);
     for(const item of d.inventory.filter(x=>slot===0?x.code==='HULM-1':slot===1?x.code==='DEFM-1':!['HULM-1','DEFM-1'].includes(x.code))){const o=el('option',item.code+' · Nv. '+item.level+' · '+item.instanceId.slice(0,8));o.value=item.instanceId;sel.append(o);}row.append(sel);details.append(row);selects.push(sel);}
    const minutes=el('input');minutes.type='number';minutes.min='5';minutes.max='60';minutes.value='5';details.append(el('p','Minutos de construcción'),minutes);
    const build=button('CONSTRUIR',()=>{const moduleIds=selects.map(x=>x.value);if(moduleIds.some(x=>!x)||new Set(moduleIds).size!==10){status.textContent='Selecciona diez módulos distintos';return;}run({action:'build',asteroidId:a.id,minutes:Number(minutes.value),moduleIds});});build.disabled=!d.constructionEnabled;details.append(build);tile.append(details);
   }grid.append(tile);}
  search.oninput=()=>{const q=search.value.trim().toLowerCase();for(const tile of grid.children)tile.hidden=!tile.dataset.search.includes(q);};body.append(grid,el('p','Módulos disponibles: '+d.inventory.length));if(d.broken?.length){body.append(el('h3','Módulos recuperados · rotos'));for(const item of d.broken)body.append(el('p',item.code+' · Nv. '+item.level+' · reparación pendiente'));}
 }catch(e){if(modal?.open&&mode==='Estaciones CBS')body.replaceChildren(el('p',e.message));}
}
async function boosterMenu(){
 body.replaceChildren(el('h2','Boosters'),el('p','Cargando…'));
 try{const d=await api('boosters');if(!modal?.open||mode!=='Boosters')return;
  body.replaceChildren(el('h2','Boosters'),el('p','10.000 uridium · 10 horas · activa el tiempo adquirido. Los compartidos benefician a aliados cercanos.'));
  const grid=el('div',null,'gg13-grid gg-booster-grid'),names={damage:'Daño',xp:'Experiencia',honor:'Honor',hp:'Vida',repair:'Reparación',box:'Recursos',shield:'Escudo'};
  const duration=s=>Math.floor(s/3600)+' h '+Math.floor(s%3600/60)+' min';
  for(const item of d.catalog){const tile=el('section',null,'gg13-tile gg-booster-card'),remaining=Math.max(0,Math.ceil(((d.active[item.code]||0)-Date.now())/1000)),stock=(d.stock[item.code]||0)+(item.legacy?d.stock[item.legacy]||0:0)+(item.code==='MUL-B03'?Number(state.ammo.find(a=>a.code==='MUL-B03')?.quantity||0)*18000:0);
   tile.dataset.active=String(remaining>0);const icon=el('span','✦','gg-booster-icon');icon.setAttribute('aria-hidden','true');const effects=el('div',null,'gg-reward-cards');for(const [k,v] of Object.entries(item.effects)){const chip=el('div',null,'gg-reward-chip');chip.append(el('strong','+'+Math.round(v*100)+'%'),el('small',names[k]||k));effects.append(chip);}tile.append(icon,el('h3',item.code+' · '+item.name),effects);
   if(Object.keys(item.shared).length)tile.append(el('p','Aliados: '+Object.entries(item.shared).map(([k,v])=>names[k]+' +'+Math.round(v*100)+'%').join(' · ')));
   const time=el('section',null,'gg-booster-time');time.append(el('strong',remaining>0?'ACTIVO':'INACTIVO'),el('p','Tiempo activo: '+duration(remaining)),el('p','Tiempo disponible: '+duration(stock)));tile.append(time);
   const run=async action=>{if(busy)return;busy=true;try{await window.gg112Booster({action,code:item.code,requestId:crypto.randomUUID()});await refresh();await boosterMenu();}catch(e){status.textContent=e.message;}finally{busy=false;}};
   if(item.price)tile.append(button('COMPRAR '+fmt(item.price)+' U',()=>run('buy')));
   const activate=button('ACTIVAR TIEMPO',()=>run('activate'));activate.disabled=stock<=0;tile.append(activate);grid.append(tile);
  }body.append(grid);status.textContent='Uridium: '+fmt(d.balance.uridium);
 }catch(e){if(modal?.open&&mode==='Boosters')body.replaceChildren(el('p',e.message));}
}
function mineMenu(){
 body.replaceChildren(el('h2','Minas'),el('p','Armado: 1 segundo · Recarga compartida: 60 segundos'));
 const details={'ACM-01':'Daño de área 20 %','DDM-01':'Casco -20 %','SABM-01':'Escudo -15 %','SLM-01':'Velocidad -50 % durante 5 s','EMPM-01':'Revela camuflaje normal'};
 const grid=el('div',null,'gg13-grid');
 for(const m of cat.mines||[]){const tile=el('section',null,'gg13-tile'),n=Number(state.ammo.find(a=>a.code===m.id)?.quantity||0);tile.append(el('h3',m.id),el('p',details[m.id]),el('p',fmt(n)+' disponibles'));
 const b=button('COLOCAR',async()=>{if(busy)return;busy=true;try{await window.gg18Mine(m.id);modal.close();}catch(e){status.textContent=e.message;}finally{busy=false;}});b.disabled=n===0;tile.append(b);grid.append(tile);}
 const emp=el('section',null,'gg13-tile'),stock=Number(state.ammo.find(a=>a.code==='EMP')?.quantity||0);emp.append(el('h3','EMP-01'),el('p','Limpia efectos negativos y desorienta aliens durante 3 s · recarga 35 s'),el('p',fmt(stock)+' disponibles · tecla E'));const fire=button('ACTIVAR EMP',async()=>{if(busy)return;busy=true;try{await window.gg110Emp();modal.close();}catch(e){status.textContent=e.message;}finally{busy=false;}});fire.disabled=stock===0;emp.append(fire);grid.append(emp);
 body.append(grid);
}
let abilityRefresh=null;
window.addEventListener('gg18:abilityState',e=>{if(modal?.open&&mode==='Habilidades')abilityRefresh?.(e.detail);});
function abilityMenu(){
 const p=window.gg15Pilot?.();body.replaceChildren(el('h2','Habilidades'));
 if(!p){body.append(el('p','Entra en una partida.'));return;}
 const definitions={aegis:[['repair-hp','Reparar PV','20.000/s propio o 40.000/s aliado · 7 s'],['repair-shield','Reparar escudo','15.000/s propio o 25.000/s aliado · 5 s'],['repair-pod','Cápsula de reparación','18.000 PV/s · 10 s']],citadel:[['draw-fire','Atraer fuego','Atrae NPC a 500 unidades · 5 s'],['fortify','Atrincherarse','Daño recibido -50 % · inmóvil · 10 s'],['protect','Protección','Absorbe 25 % del daño del grupo · 10 s'],['travel','Viaje','Velocidad +50 % · 5 s']],spearhead:[['recon','Reconocimiento','Alcance del radar ×2 · 30 s'],['jam','JAM-X','Bloquea habilidades enemigas · 8 s'],['mark','Marca de objetivo','Daño del grupo +5 % · 15 s'],['ultimate-cloak','Camuflaje Definitivo','Invisible hasta disparar · 15 s']]};
 const grid=el('div',null,'gg13-grid gg-ability-grid'),rows=[];
 const skillIcon=code=>{const repair=['repair-hp','repair-shield','repair-pod','nano-repair'].includes(code),defense=['fortify','protect','fortress','prism'].includes(code),move=['travel','afterburner'].includes(code),stealth=['ultimate-cloak','recon'].includes(code);const color=repair?'#71e3a2':defense?'#68b4ff':move?'#e7c579':stealth?'#b58cff':'#ff7d65';const n=el('span',repair?'✚':defense?'⬡':move?'➤':stealth?'◉':'✦','gg-skill-icon');n.style.setProperty('--skill-color',color);n.setAttribute('aria-hidden','true');return n;};
 const designSkills={Diminisher:['weaken','Debilitar escudos','Daño al escudo por láser +50 % · 15 s'],Sentinel:['fortress','Fortaleza','Daño al escudo -30 % · 35 s'],Solace:['nano-repair','Nano-Clúster','Repara 35 % de PV propios y 15 % del grupo'],Spectrum:['prism','Escudo prismático','Láser recibido -90 % · propio -25 % · 10 s'],Venom:['singularity','Singularidad II','Daño creciente directo al casco · 35 s'],Lightning:['afterburner','Postcombustión','Empuje durante 5 s']};const available=[...(definitions[p.ship]||[]),...(designSkills[p.design]?[designSkills[p.design]]:[])];for(const [code,name,desc] of available){const tile=el('section',null,'gg13-tile'),info=el('p','Disponible'),b=button('ACTIVAR',async()=>{if(busy)return;busy=true;b.disabled=true;try{await window.gg18Ability(code);status.textContent=name+' activada';modal.close();}catch(e){status.textContent=e.message;}finally{busy=false;}});tile.classList.add('gg-ability-card');info.classList.add('gg-ability-status');tile.append(skillIcon(code),el('h3',name),el('p',desc),info,b);grid.append(tile);rows.push({code,info,b});}
 if(rows.length)body.append(grid);else body.append(el('p','Este casco no dispone de habilidades propias.'));
 abilityRefresh=q=>{const now=Date.now();for(const {code,info,b} of rows){const a=q.abilities?.[code],active=Math.max(0,Math.ceil(((a?.until||0)-now)/1000)),cool=Math.max(0,Math.ceil(((a?.readyAt||0)-now)/1000));const message=active?'ACTIVA · '+active+' s':cool?'Recarga · '+cool+' s':q.jamUntil>now?'Bloqueada por JAM-X':'Disponible';if(info.textContent!==message)info.textContent=message;const phase=active?'active':cool?'cooldown':q.jamUntil>now?'blocked':'ready';if(info.dataset.phase!==phase)info.dataset.phase=phase;const disabled=busy||!!cool||q.jamUntil>now;if(b.disabled!==disabled)b.disabled=disabled;}};abilityRefresh(p);
 if(p.godAllowed){ let enabled=!!p.godMode;
 const tile=el('section',null,'gg13-tile'),label=el('h3','DIOS'),info=el('p'),b=button('',async()=>{
  if(busy)return;busy=true;b.disabled=true;
  try{enabled=await window.gg17God(!enabled);draw();status.textContent=enabled?'DIOS ACTIVADO':'DIOS DESACTIVADO';}catch(e){status.textContent=e.message;}finally{busy=false;b.disabled=false;}
 });
 function draw(){info.textContent=enabled?'ACTIVA · Sin daño de NPC ni jugadores':'INACTIVA';b.textContent=enabled?'DESACTIVAR DIOS':'ACTIVAR DIOS';b.style.color=enabled?'#70ffa5':'';b.setAttribute('aria-pressed',String(enabled));}
 tile.classList.add('gg-admin-controls');
 tile.append(label,info,el('p','Sin coste, duración ni recarga. Permanece activa entre mapas y puertas hasta desactivarla o cerrar sesión.'),b);body.append(tile);draw();
 const mapBox=el('section',null,'gg13-tile gg-admin-controls'),pick=el('select'),note=el('p','Cargando mapas…');
 pick.setAttribute('aria-label','Mapa de destino');pick.disabled=true;
 const jump=button('SALTAR AL MAPA',async()=>{if(busy||!pick.value)return;busy=true;jump.disabled=true;pick.disabled=true;try{const r=await window.ggAdminMapJump(pick.value);status.textContent='Salto confirmado: '+r.map;modal.close();}catch(e){status.textContent=e.message;}finally{busy=false;pick.disabled=false;jump.disabled=!pick.value;}});
 jump.disabled=true;mapBox.append(el('h3','SALTO ADMINISTRATIVO'),note,pick,jump);body.append(mapBox);
 window.ggAdminMapList().then(r=>{if(!mapBox.isConnected)return;const placeholder=el('option','Selecciona un mapa');placeholder.value='';pick.append(placeholder);
 for(const map of r.maps){const op=el('option',map+(map===r.current?' · actual':''));op.value=map;op.disabled=map===r.current;pick.append(op);}
 pick.value='';pick.disabled=false;note.textContent='Mapa actual: '+r.current+' · Sin coste ni requisito de nivel';pick.onchange=()=>{jump.disabled=!pick.value||busy;};
 }).catch(e=>{if(mapBox.isConnected)note.textContent=e.message;});
 const previousRefresh=abilityRefresh;abilityRefresh=q=>{previousRefresh(q);if(!busy&&q.godAllowed&&enabled!==!!q.godMode){enabled=!!q.godMode;draw();}};

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
 try{let data=await api('minerals'),stationData=await api('stations').catch(()=>null);
 const pilot=window.gg15Pilot?.(),ownStation=stationData?.combatEnabled&&pilot?stationData.asteroids.find(a=>a.map===window.gg115Map?.()&&a.station?.owned&&a.station.state!=='building'&&Math.hypot(pilot.x-a.x,pilot.y-a.y)<=250):null;
 function draw(){
  if(!modal.open||!['Skylab','Refinación','Comercio'].includes(mode))return;
  body.replaceChildren(el('h2',tab));
  const nav=el('div',null,'gg-mission-tabs');for(const name of ['Skylab','Refinación','Comercio']){const b=button(name,()=>{if(busy)return;tab=name;mode=name;draw();});b.setAttribute('aria-pressed',String(tab===name));nav.append(b);}body.append(nav,button('POTENCIACIÓN',()=>{if(!busy){mode='Potenciación';upgradeMenu();}}));
  const cargo=el('section',null,'gg-social-summary');const cargoMeter=el('progress');cargoMeter.max=Math.max(1,data.capacity);cargoMeter.value=data.cargoUsed;cargoMeter.setAttribute('aria-label','Ocupación de bodega');cargo.append(el('strong','Bodega '+fmt(data.cargoUsed)+' / '+fmt(data.capacity)),cargoMeter,el('small','Xenomit sin peso'));body.append(cargo);
  async function run(action,fields){if(busy)return;busy=true;try{data=action==='cbs-sell'?await window.gg120Sell({...fields,asteroidId:ownStation.id,requestId:crypto.randomUUID()}):await api('minerals',{action,...fields,requestId:crypto.randomUUID()});state.balance=data.balance;status.textContent=balance();draw();}catch(e){status.textContent=e.message;}finally{busy=false;}}
  function quantity(max,step=1){const n=el('input');n.type='number';n.min=step;n.max=Math.max(0,max);n.step=step;n.value=step;n.style.width='95px';return n;}
  function qtyButton(tile,label,action,code,max,step=1){const q=quantity(max,step),b=button(label,()=>{if(q.checkValidity())run(action,{code,quantity:Number(q.value)});});b.disabled=max<step;tile.append(q,b);}
  const grid=el('div',null,'gg13-grid gg-mineral-grid');const colors={prometium:'#e76c53',endurium:'#72b7e8',terbium:'#e6c96c',prometid:'#bd90df',duranium:'#73d4b5',promerium:'#d6b471',seprom:'#7fd1ed',xenomit:'#c1e2ef',paladio:'#9dc2f1'};function mineralTile(code){const tile=el('section',null,'gg13-tile gg-mineral-card');const art=el('span',null,'gg-mineral-art');art.style.setProperty('--mineral-color',colors[code]||'#92a9c1');art.append(el('span'),el('span'),el('span'));art.setAttribute('aria-hidden','true');tile.append(art);return tile;}
  if(tab==='Skylab'){
   const power=el('section',null,'gg-social-summary'),meter=el('progress');meter.max=Math.max(1,data.metrics.power);meter.value=data.metrics.used;meter.setAttribute('aria-label','Consumo energético');power.append(el('strong','Energía '+fmt(data.metrics.used)+' / '+fmt(data.metrics.power)),meter,el('p','Rendimiento '+fmt(Math.round(data.metrics.efficiency*100))+' %'),el('small','Producción y transporte directo de prueba; mejoras pendientes.'));body.append(power);
   for(const [code,level] of Object.entries(data.lab.levels)){
    const tile=mineralTile(code);tile.append(el('h3',code.toUpperCase()),el('p','Nivel '+level));
    if(Object.hasOwn(data.lab.enabled,code)){const enabled=data.lab.enabled[code],stock=data.lab.stock[code]||0;
     tile.dataset.enabled=String(enabled);const meter=el('progress');meter.max=Math.max(1,data.limits[code]);meter.value=stock;meter.setAttribute('aria-label','Almacenamiento '+code);tile.append(el('p',(enabled?'Activo':'Apagado')+' · '+fmt(data.rates[code])+'/h'),el('p',fmt(stock)+' / '+fmt(data.limits[code])),meter,button(enabled?'APAGAR':'ACTIVAR',()=>run('toggle',{code,enabled:!enabled})));
     qtyButton(tile,'TRANSPORTAR','transfer',code,Math.min(stock,code==='xenomit'?1000000:Math.max(0,data.capacity-data.cargoUsed)));
    }grid.append(tile);
   }
  }else if(tab==='Refinación'){
   body.append(el('p','Convierte minerales de la bodega pagando la comisión indicada.'));
   for(const [code,r] of Object.entries(data.recipes)){if(code==='xenomit'||r.premium)continue;const tile=mineralTile(code);tile.append(el('h3',code.toUpperCase()));for(const [k,n] of Object.entries(r.inputs))tile.append(el('p',k.toUpperCase()+' · '+fmt(data.cargo[k]||0)+' disponibles / '+fmt(n)+' requeridos por unidad'));tile.append(el('p','Comisión '+fmt(r.fee)+' créditos/u'));
    const max=Math.min(Math.floor(Number(data.balance.credits)/r.fee),...Object.entries(r.inputs).map(([k,n])=>Math.floor((data.cargo[k]||0)/n)),1000000);
    qtyButton(tile,'REFINAR','refine',code,max);grid.append(tile);
   }
  }else{
   body.append(el('p','Venta en mapas con base. Honor '+fmt(data.honor)+'. Paladio se cambia en 5-2.'));if(ownStation)body.append(el('p','Comercio de tu estación CBS: +10 % de créditos.'));
   for(const [code,price] of Object.entries(data.prices)){const tile=mineralTile(code),n=data.cargo[code]||0;tile.append(el('h3',code.toUpperCase()),el('p',fmt(n)+' disponibles'),el('p','Precio base '+fmt(price)+' créditos/u'));qtyButton(tile,'VENDER','sell',code,n);if(ownStation)qtyButton(tile,'VENDER CBS +10%','cbs-sell',code,n);grid.append(tile);}
   const tile=mineralTile('paladio');tile.append(el('h3','PALADIO'),el('p',fmt(data.cargo.paladio||0)+' · 10 = 1 energía'));qtyButton(tile,'CANJEAR','exchange','paladio',Math.floor((data.cargo.paladio||0)/10)*10,10);grid.append(tile);
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
function rewardCards(reward){const row=el('div',null,'gg-reward-cards');for(const [code,n] of Object.entries(reward||{})){const name=({'credits':'Créditos','uridium':'Uridium','experience':'Experiencia','xp':'Experiencia','honor':'Honor','energy':'Energía extra','log-disk':'Discos de registro','green-key':'Llaves de botín','booster-damage-seconds':'Booster de daño','booster-experience-seconds':'Booster EXP','booster-honor-seconds':'Booster de honor','premium-seconds':'Premium'})[code]||code;const tile=el('div',null,'gg-reward-chip');tile.dataset.kind=code==='credits'?'credits':code==='uridium'?'uridium':code.endsWith('-seconds')?'time':'other';tile.append(el('strong',fmt(code.endsWith('-seconds')?n/3600:n)+(code.endsWith('-seconds')?' h':'')),el('small',name));row.append(tile);}return row;}
async function dailyMenu(){
 body.replaceChildren(el('h2','Recompensas diarias · 28 días'));
 try{const data=await api('daily');if(!modal.open||mode!=='Registro diario')return;
 const head=el('section',null,'gg-daily-summary');head.append(el('strong','Día '+data.day+' / 28'),el('p',data.claimedToday?'Regalo de hoy acreditado':'Regalo disponible'),el('small','Reinicio diario UTC'));body.append(head);
 const grid=el('div',null,'gg-daily-grid');
 for(let i=0;i<data.calendar.length;i++){const d=i+1,tile=el('div',null,'gg13-tile gg-daily-card');const claimed=d<=data.day;tile.dataset.phase=claimed?'claimed':'pending';if(d%7===0)tile.dataset.milestone='true';tile.append(el('strong','Día '+d),el('small',claimed?'Obtenido':'Pendiente'),rewardCards(data.calendar[i]));grid.append(tile);}
 body.append(grid,el('p','Los boosters y premium se guardan como tiempo disponible; activación de sus efectos pendiente.'));
 if(!data.claimedToday)body.append(button('RECLAMAR REGALO DE HOY',async()=>{if(busy)return;busy=true;try{await api('daily',{});await refresh();status.textContent=balance();dailyMenu();}catch(e){status.textContent=e.message;}finally{busy=false;}}));
 }catch(e){body.append(el('p',e.message));}
}
function missionPhase(m){return m.claimed?'claimed':m.accepted?(m.conditions.every((c,i)=>Number(m.progress[i]||0)>=c.count)?'ready':'active'):m.available?'available':'locked';}
async function missionMenu(){
 body.replaceChildren(el('h2','Libro de misiones'));
 try{
 let data=await api('missions'),filter='all',query='';
 function draw(){if(!modal.open||mode!=='Misiones')return;body.replaceChildren(el('h2','Libro de misiones'),el('p','Catálogo inicial de prueba; las misiones originales aún no están cargadas.'));
 body.append(button('REGALOS DIARIOS',()=>{mode='Registro diario';dailyMenu();}));
 const phases={all:'Todas',available:'Disponibles',active:'En curso',ready:'Por reclamar',claimed:'Completadas',locked:'Bloqueadas'},nav=el('div',null,'gg-mission-tabs'),search=el('input'),grid=el('div',null,'gg13-grid gg-mission-grid');search.type='search';search.placeholder='Buscar misión…';search.value=query;search.setAttribute('aria-label','Buscar misión');
 for(const [key,label] of Object.entries(phases)){const count=data.missions.filter(m=>key==='all'||missionPhase(m)===key).length,b=button(label+' ('+count+')',()=>{filter=key;draw();});b.setAttribute('aria-pressed',String(filter===key));nav.append(b);}body.append(nav,search,grid);
 function list(){grid.replaceChildren();for(const m of data.missions){const phase=missionPhase(m);if(filter!=='all'&&phase!==filter||!m.name.toLowerCase().includes(query.toLowerCase()))continue;
 const tile=el('section',null,'gg13-tile gg-mission-card');tile.dataset.phase=phase;tile.append(el('h3',m.name),el('small','Nivel requerido '+m.level),el('strong',phases[phase],'gg-mission-status'));
 for(const [i,c] of m.conditions.entries()){const progress=el('progress');progress.max=Math.max(1,c.count);progress.value=Math.min(c.count,Number(m.progress[i]||0));const label=({'alien':'Eliminar alien','box':'Recoger cajas','map':'Visitar mapa','gate':'Completar puerta','pilot':'Eliminar piloto'}[c.type]||c.type)+' '+(c.target==='*'?'':c.target);progress.setAttribute('aria-label',label);tile.append(el('p',label+' · '+(m.progress[i]||0)+'/'+c.count),progress);}
 tile.append(el('small','Recompensas'),rewardCards(m.reward));
 if(!m.claimed&&phase!=='active'){const b=button(m.accepted?'RECLAMAR':'ACEPTAR',async()=>{if(busy)return;busy=true;try{data=await api('missions',{action:m.accepted?'claim':'accept',mission:m.id});await refresh();status.textContent=balance();draw();}catch(e){status.textContent=e.message;}finally{busy=false;}});b.disabled=!m.available;tile.append(b);}
 grid.append(tile);}if(!grid.children.length)grid.append(el('p','No hay misiones en esta categoría.'));}
 search.oninput=()=>{query=search.value;list();};list();body.append(button('ACTUALIZAR',()=>missionMenu()));}
 draw();
 }catch(e){body.append(el('p',e.message));}
}
async function socialGroup(){
 body.replaceChildren(el('h2','Grupo'));
 try{
  let data=await window.gg15Group('status'),query='';
  function draw(){
   if(!modal.open||mode!=='Grupo')return;
   body.replaceChildren(el('h2','Grupo · máximo 8 pilotos'));
   const run=async(action,fields={})=>{if(busy)return;busy=true;try{data=await window.gg15Group(action,fields);draw();}catch(e){status.textContent=e.message;}finally{busy=false;}};
   const me=window.gg15Pilot?.();
   if(data.invite)body.append(el('p','Invitación pendiente'),button('ACEPTAR INVITACIÓN',()=>run('accept',{from:data.invite.from})));
   if(!data.group)body.append(button('CREAR GRUPO',()=>run('create')));
   else{
    const summary=el('section',null,'gg-social-summary');summary.append(el('strong',data.group.members.length+' / 8 pilotos'),el('small',me?.id===data.group.leader?'Eres el líder':'Miembro del grupo'));const capacity=el('progress');capacity.max=8;capacity.value=data.group.members.length;capacity.setAttribute('aria-label','Ocupación del grupo');summary.append(capacity);body.append(summary,el('h3','Miembros'));const members=el('div',null,'gg-social-list');for(const m of data.group.members){const row=el('div',null,'gg-social-row'),info=el('div');info.append(el('strong',m.name+(m.id===me?.id?' · Tú':'')),el('small',(m.id===data.group.leader?'Líder · ':'')+'Mapa '+m.map));row.append(info);if(me?.id===data.group.leader&&m.id!==me.id)row.append(button('Expulsar',()=>run('kick',{target:m.id})));members.append(row);}body.append(members);if(me?.id===data.group.leader){const search=el('input'),list=el('div',null,'gg-social-list');search.type='search';search.placeholder='Buscar piloto para invitar…';search.value=query;function invites(){list.replaceChildren();for(const p of data.pilots.filter(x=>!data.group.members.some(m=>m.id===x.id)&&x.name.toLowerCase().includes(query.toLowerCase()))){const row=el('div',null,'gg-social-row');row.append(el('strong',p.name),button('Invitar',()=>run('invite',{target:p.id})));list.append(row);}if(!list.children.length)list.append(el('p','No hay pilotos disponibles.'));}search.oninput=()=>{query=search.value;invites();};body.append(el('h3','Invitar pilotos'),search,list);invites();}
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
   const create=el('section',null,'gg-social-summary');create.append(el('h3','Fundar clan'),el('p','Coste: 500.000 créditos'),name,tag,button('FUNDAR CLAN',()=>run('create',{name:name.value,tag:tag.value})));body.append(create,el('h3','Buscar clan'));const search=el('input'),list=el('div',null,'gg-social-list');search.type='search';search.placeholder='Nombre o etiqueta…';function clans(){list.replaceChildren();for(const c of data.list.filter(c=>('['+c.tag+'] '+c.name).toLowerCase().includes(search.value.toLowerCase()))){const row=el('div',null,'gg-social-row');row.append(el('strong','['+c.tag+'] '+c.name),button('Solicitar ingreso',()=>run('apply',{target:c.id})));list.append(row);}if(!list.children.length)list.append(el('p','No hay clanes que coincidan.'));}search.oninput=clans;body.append(search,list);clans();
  }else{
   const c=data.clan,leader=c.leader===data.self,can=k=>leader||c.permissions.includes(k);
   const summary=el('section',null,'gg-social-summary');summary.append(el('h3','['+c.tag+'] '+c.name),el('small',leader?'Líder':'Miembro'),rewardCards({credits:c.credits,uridium:c.uridium}),el('p',data.members.length+' miembros'));body.append(summary,el('h3','Miembros'));const memberList=el('div',null,'gg-social-list');body.append(memberList);
   for(const m of data.members){const row=el('section',null,'gg-social-member');row.append(el('strong',m.username+(m.account_id===c.leader?' · Líder':'')));memberList.append(row);
    if(can('expulsar')&&m.account_id!==c.leader&&m.account_id!==data.self)row.append(button('Expulsar '+m.username,()=>run('kick',{target:m.account_id})));
    if(leader&&m.account_id!==data.self){const detail=el('details');detail.append(el('summary','Permisos'));row.append(detail);const picks=['expulsar','reclutar','diplomacia','cbs'].map(k=>{const input=el('input');input.type='checkbox';input.checked=m.permissions.includes(k);const label=el('label',' '+k+' ');label.prepend(input);detail.append(label);return [k,input];});detail.append(button('Guardar permisos',()=>run('permissions',{target:m.account_id,permissions:picks.filter(x=>x[1].checked).map(x=>x[0])})));}
   }
   if(can('reclutar')){body.append(el('h3','Solicitudes de ingreso'));for(const q of data.requests)body.append(button('Aceptar '+q.username,()=>run('accept',{target:q.account_id})));if(!data.requests.length)body.append(el('p','Sin solicitudes pendientes.'));}
   if(can('diplomacia')){const detail=el('details',null,'gg-social-summary');detail.append(el('summary','Diplomacia'));for(const other of data.list.filter(x=>x.id!==c.id)){const row=el('section',null,'gg-social-member'),phase=data.diplomacy.find(x=>x.target===other.id)?.state||'neutral';row.append(el('strong','['+other.tag+'] '+other.name),el('small',({war:'Guerra',alliance:'Alianza',neutral:'Neutral'})[phase]||phase));for(const [state,label] of [['war','Guerra'],['alliance','Alianza'],['neutral','Neutral']]){const b=button(label,()=>run('diplomacy',{target:other.id,state}));b.disabled=state===phase;row.append(b);}detail.append(row);}body.append(detail);}
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
  pendingGate=null;if(!modal.open||mode!=='Portales')return;if(!data.gates.includes(selected))selected=data.gates[0];
  async function action(kind,count=1){
   if(busy)return;busy=true;draw();
   try{
    data=await api('gates/'+kind,{gate:selected,requestId:crypto.randomUUID(),useMultiplier:multiplier,allowUridium:paid,count});
    if(kind==='build')window.gg16RefreshGalaxy?.();state.balance=data.balance;if(data.batch&&kind==='spin'){const b=data.batch;status.textContent=fmt(b.spins)+' / '+fmt(b.requested)+' tiradas · '+fmt(b.uridiumUsed)+' uridium · '+fmt(b.energyUsed)+' energía · '+b.rewards.map(r=>(r.gate?r.gate.toUpperCase()+' ': '')+r.code+' ×'+fmt(r.quantity)).join(' | ')+' · '+balance();}else status.textContent=(data.reward?'Resultado: '+data.reward.code+' ×'+data.reward.quantity+(data.reward.gate?' · '+data.reward.gate.toUpperCase():''):'Operación realizada')+' · '+balance();
   }catch(e){status.textContent=e.message;}finally{busy=false;if(modal.open&&mode==='Portales')draw();}
  }
  function draw(){
   body.replaceChildren(el('h2','Generador de puertas galácticas'));
   const nav=el('div',null,'gg13-grid gg-gate-nav');
   for(const id of data.gates){const g=data.states[id];const b=button('',()=>{selected=id;draw();});b.className='gg-gate-card';b.disabled=busy;b.setAttribute('aria-pressed',String(id===selected));const ring=el('span',null,'gg-gate-ring');ring.style.setProperty('--gate-progress',String(Math.min(100,Math.max(0,g.required?100*g.pieces.length/g.required:0)))+'%');ring.append(el('strong',id.slice(0,2).toUpperCase()));const meter=el('progress');meter.max=Math.max(1,g.required);meter.value=g.pieces.length;meter.setAttribute('aria-label','Piezas '+id);b.append(ring,el('strong',id.toUpperCase()),el('small',g.built?'Construida':g.canBuild?'Lista para construir':g.pieces.length+' / '+g.required+' piezas'),meter);nav.append(b);}
   const a=data.states[selected];
   const summary=el('section',null,'gg-gate-summary');for(const [label,value] of [['Piezas',a.pieces.length+' / '+a.required],['Secciones',a.wave+' / '+a.waves],['Energía extra',fmt(data.energy)],['Multiplicador','×'+a.multiplier]]){const item=el('div');item.append(el('small',label),el('strong',value));summary.append(item);}body.append(nav,el('h3',selected.toUpperCase()),summary);
   if(a.provisional)body.append(el('p','Configuración provisional: '+a.provisional));
   const progress=el('progress');progress.max=a.required;progress.value=a.pieces.length;body.append(progress,el('p',a.pieces.length+' / '+a.required+' piezas'));
   const pieces=new Set(a.pieces),grid=el('div',null,'gg-gate-pieces');for(let i=1;i<=a.required;i++){const collected=pieces.has(i),piece=el('span',String(i));piece.dataset.collected=String(collected);piece.title='Pieza '+i+' · '+(collected?'Obtenida':'Pendiente');grid.append(piece);}const details=el('details',null,'gg-gate-detail');details.append(el('summary','Ver piezas individuales'),grid);body.append(details);
   const mult=el('input');mult.type='checkbox';mult.checked=multiplier;mult.onchange=()=>{multiplier=mult.checked;};const label=el('label',' Activar multiplicador','gg-gate-option');label.prepend(mult);
   const pay=el('input');pay.type='checkbox';pay.checked=paid;pay.onchange=()=>{paid=pay.checked;};const pl=el('label',' Autorizar uridium (100 por tirada / 25.000 por vida)','gg-gate-option');pl.prepend(pay);body.append(label,pl);
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