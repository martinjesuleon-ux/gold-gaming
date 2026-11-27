(()=>{'use strict';
const labels={ships:'Naves',lasers:'Armas',ammo:'Munición',shields:'Escudos',engines:'Motores',drones:'VANT',pet:'P.E.T.',fuel:'Combustible P.E.T.',petGear:'Módulos P.E.T.'};
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
const fmt=n=>Number(n).toLocaleString('es-CL');
async function api(path,body){const res=await fetch('/api/v13/'+path,{credentials:'same-origin',...(body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})});const data=await res.json();if(!res.ok)throw Error(data.error||'Operación no disponible');return data;}
let modal,body,status,cat,state,busy=false,mode;
function button(text,fn){const b=el('button',text);b.type='button';b.onclick=fn;return b;}
function balance(){return 'Créditos: '+fmt(state.balance.credits)+'   |   Uridium: '+fmt(state.balance.uridium);}
async function refresh(){state=await api('inventory');window.dispatchEvent(new CustomEvent('gg13:inventory',{detail:state}));}
async function open(which){if(busy)return;if(modal?.open){modal.close();return;}mode=which; if(!modal){modal=el('dialog',null,'gg13');const head=el('header');head.append(el('strong','GOLD GAMING • V1.5'),button('Cerrar',()=>{if(!busy)modal.close();}));body=el('main');status=el('footer');status.setAttribute('role','status');modal.append(head,body,status);modal.addEventListener('cancel',e=>{if(busy)e.preventDefault();});document.body.append(modal);}modal.showModal();body.replaceChildren(el('p','Cargando…'));status.textContent='';busy=true;try{cat=await api('catalog');await refresh();render();}catch(e){body.replaceChildren(el('p',e.message));}finally{busy=false;}}
function render(){body.replaceChildren();status.textContent=balance();if(mode==='Portales'){gates();return;}if(mode==='Facción'){faction();return;}if(mode==='Grupo'){socialGroup();return;}if(mode==='Clan'){clanMenu();return;}if(mode==='Misiones'){missionMenu();return;}if(mode==='Registro diario'){dailyMenu();return;}if(mode==='Tienda')shop();else if(mode==='Hangar')hangar();else inventory();}
function shop(){const layout=el('div',null,'gg13-shop'),nav=el('aside'),grid=el('section',null,'gg13-grid'),detail=el('section',null,'gg13-detail');layout.append(nav,grid,detail);body.append(layout);
function list(category){grid.replaceChildren();detail.replaceChildren(el('p','Selecciona un objeto'));for(const p of (category==='petGear'?[{id:'G-AL1',name:'G-AL1 Auto-botín',price:state.items.some(i=>i.category==='pet')&&!state.items.some(i=>i.code==='G-AL1')?7500:null,currency:'uridium'}]:category==='fuel'?[{id:'pet-fuel',name:'Combustible P.E.T.',price:state.items.some(i=>i.category==='pet')?.25:null,currency:'uridium'}]:category==='pet'?[{id:'pet-10',name:'P.E.T. 10',hp:50000,price:state.items.some(i=>i.category==='pet')?null:50000,currency:'uridium'}]:category==='drones'?['flax','iris'].map(id=>({id,name:id.toUpperCase(),...cat.drones[id],price:cat.drones[id].prices[state.items.filter(i=>i.category==='drones'&&['flax','iris'].includes(i.code)).length]??null})):cat[category])){const card=button('',()=>select(category,p));card.append(el('span',category==='ships'?'◇':category==='lasers'?'╱╱':category==='ammo'?'•••':category==='shields'?'◈':'»','gg13-symbol'),el('strong',p.name||p.id),el('small',p.price==null?'Recompensa':fmt(p.price)+' '+p.currency));grid.append(card);}}
function select(category,p){detail.replaceChildren(el('h3',p.name||p.id));for(const k of ['hp','speed','damage','shield','absorption','lasers','generators','multiplier'])if(p[k]!=null)detail.append(el('p',k+': '+p[k]));if(p.price==null||p.id==='phoenix'){detail.append(el('p','No disponible para compra'));return;}const qty=el('input');qty.type='number';qty.min='1';qty.max=category==='petGear'?'1':category==='pet'?'1':category==='drones'?'1':category==='ships'?'1':category==='ammo'?'100000':'100';qty.value=category==='fuel'?'1000':'1';if(category==='fuel'){qty.min='4';qty.max=String(50000-Number(state.ammo.find(a=>a.code==='pet-fuel')?.quantity||0));qty.step='4';}const total=el('p');const buy=button('COMPRAR',async()=>{if(busy||!qty.checkValidity())return;busy=true;buy.disabled=true;const requestId=crypto.randomUUID();try{await api('purchase',{category,code:p.id,quantity:Number(qty.value),requestId});await refresh();status.textContent='Compra confirmada • '+balance();if(['drones','pet','petGear','fuel'].includes(category))list(category);}catch(e){status.textContent=e.message;}finally{busy=false;buy.disabled=false;}});const update=()=>{total.textContent='Total: '+fmt(Number(qty.value)*p.price)+' '+p.currency;};qty.oninput=update;update();detail.append(qty,total,buy);}
for(const k of Object.keys(labels))nav.append(button(labels[k],()=>list(k)));list('ships');}
function inventory(){body.append(el('h2','Inventario'));const grid=el('div',null,'gg13-grid');for(const i of state.items)grid.append(el('div',i.code+' · Nivel '+i.level,'gg13-tile'));for(const i of state.ammo)grid.append(el('div',i.code+' × '+fmt(i.quantity),'gg13-tile'));body.append(grid);if(!grid.children.length)grid.append(el('p','Inventario vacío'));}
function hangar(){const draft=JSON.parse(JSON.stringify(state.hangar));let tab=draft.active, destination='ship';draft.configs=draft.configs.map(c=>Array.isArray(c)?{ship:c,drones:[]}:c);const drones=state.items.filter(i=>i.category==='drones');for(const c of draft.configs)for(const d of drones)if(!c.drones.some(v=>v.id===d.instanceId))c.drones.push({id:d.instanceId,items:[]});const layout=el('div',null,'gg13-hangar'),left=el('section'),middle=el('section'),right=el('section');layout.append(left,middle,right);body.append(layout);left.append(el('h3','Naves disponibles'));const select=el('select');for(const s of cat.ships.filter(s=>s.id==='phoenix'||state.items.some(i=>i.category==='ships'&&i.code===s.id))){const op=el('option',s.name);op.value=s.id;select.append(op);}select.value=draft.ship;select.onchange=()=>{draft.ship=select.value;draw();};left.append(select,el('div','◇','gg13-ship'));const save=button('Guardar y activar',async()=>{if(busy)return;busy=true;save.disabled=true;try{const v=await api('equip',{ship:draft.ship,configs:draft.configs,active:tab});await refresh();window.dispatchEvent(new Event('gg13:loadout'));status.textContent='Guardado • Daño '+fmt(v.stats.damage)+' • Escudo '+fmt(v.stats.shield)+' • '+balance();}catch(e){status.textContent=e.message;}finally{busy=false;save.disabled=false;}});left.append(save);
const items=state.items.filter(i=>['lasers','engines','shields'].includes(i.category));
const all=c=>[c.ship,...c.drones.map(d=>d.items)];
function current(){return destination==='ship'?draft.configs[tab].ship:draft.configs[tab].drones.find(d=>d.id===destination).items;}
function move(id){const i=items.find(i=>i.instanceId===id);if(busy||!i)return;const dest=current(),ship=cat.ships.find(s=>s.id===draft.ship);if(dest.includes(id))return;
if(destination!=='ship'){const d=drones.find(x=>x.instanceId===destination);if(i.category==='engines'||dest.length>=cat.drones[d.code].slots){status.textContent='Equipo incompatible o VANT lleno';return;}}
else{const n=dest.filter(x=>(items.find(y=>y.instanceId===x)?.category==='lasers')===(i.category==='lasers')).length;if(n>=(i.category==='lasers'?ship.lasers:ship.generators)){status.textContent='Espacios de nave llenos';return;}}
for(const c of draft.configs)for(const a of all(c)){const pos=a.indexOf(id);if(pos>=0)a.splice(pos,1);}dest.push(id);draw();}
function draw(){middle.replaceChildren(el('h3','Equipamiento'));for(let t=0;t<2;t++){const b=button('Configuración '+(t+1),()=>{tab=t;destination='ship';draw();});b.disabled=tab===t;middle.append(b);}const ship=cat.ships.find(s=>s.id===draft.ship);middle.append(el('p','Láseres: '+ship.lasers+' | Generadores: '+ship.generators));const pick=el('select');for(const [id,label] of [['ship','NAVE'],...drones.map((d,i)=>[d.instanceId,d.code.toUpperCase()+' '+(i+1)])]){const o=el('option',label);o.value=id;pick.append(o);}pick.value=destination;pick.onchange=()=>{destination=pick.value;draw();};middle.append(pick);const slots=el('div',null,'gg13-grid');slots.ondragover=e=>e.preventDefault();slots.ondrop=e=>{e.preventDefault();move(e.dataTransfer.getData('text/plain'));};for(const id of current()){const i=items.find(x=>x.instanceId===id);if(i)slots.append(button(i.code+' ×',()=>{const a=current();a.splice(a.indexOf(id),1);draw();}));}slots.append(el('p','Arrastra o selecciona equipo'));middle.append(slots);right.replaceChildren(el('h3','Inventario'));const bag=el('div',null,'gg13-grid');for(const i of items.filter(i=>!draft.configs.some(c=>all(c).some(a=>a.includes(i.instanceId)))&&(destination==='ship'||i.category!=='engines'))){const b=button(i.code+' · N'+i.level,()=>move(i.instanceId));b.draggable=true;b.ondragstart=e=>e.dataTransfer.setData('text/plain',i.instanceId);bag.append(b);}right.append(bag);}
draw();}
const rewardText=r=>Object.entries(r||{}).map(([code,n])=>fmt(code.endsWith('-seconds')?n/3600:n)+' '+({'booster-damage-seconds':'h booster daño','booster-experience-seconds':'h booster EXP','booster-honor-seconds':'h booster honor','premium-seconds':'h premium'}[code]||code)).join(' + ');
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
   if(leader){const credit=el('select'),uridium=el('select');for(let i=0;i<=5;i++){const o=el('option',i+' % diario');o.value=i;credit.append(o);}for(let i=0;i<=3;i++){const o=el('option',i/10+' % semanal');o.value=i;uridium.append(o);}credit.value=c.credit_tax;uridium.value=c.uridium_tax;body.append(el('p','Impuestos: configuración (cobro automático pendiente)'),credit,uridium,button('Guardar impuestos',()=>run('tax',{credit:Number(credit.value),uridium:Number(uridium.value)})));}
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
async function gates(){
 body.replaceChildren(el('h2','Puertas galácticas'),el('p','Cargando generador…'));
 try{
  let data=await api('gates'),selected='alpha',multiplier=false,paid=false;
  if(!modal.open||mode!=='Portales')return;
  async function action(kind,count=1){
   if(busy)return;busy=true;draw();
   try{
    data=await api('gates/'+kind,{gate:selected,requestId:crypto.randomUUID(),useMultiplier:multiplier,allowUridium:paid,count});
    state.balance=data.balance;if(data.batch&&kind==='spin'){const b=data.batch;status.textContent=fmt(b.spins)+' / '+fmt(b.requested)+' tiradas · '+fmt(b.uridiumUsed)+' uridium · '+fmt(b.energyUsed)+' energía · '+b.rewards.map(r=>(r.gate?r.gate.toUpperCase()+' ': '')+r.code+' ×'+fmt(r.quantity)).join(' | ')+' · '+balance();}else status.textContent=(data.reward?'Resultado: '+data.reward.code+' ×'+data.reward.quantity+(data.reward.gate?' · '+data.reward.gate.toUpperCase():''):'Operación realizada')+' · '+balance();
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
    if(window.gg14GateState?.().inside){const current=window.gg14GateState();if(current.phase==='between'&&current.gate==='hades'&&!current.leader){body.append(el('p','El líder decide cuándo continuar o regresar.'));}else if(current.phase==='between'){body.append(button('SIGUIENTE OLEADA',()=>{window.gg14GateNext();modal.close();}),button('VOLVER AL SECTOR',()=>{window.gg14GateLeave();modal.close();}));}else body.append(el('p',current.phase==='countdown'?'La oleada comenzará tras la cuenta atrás.':'Los portales se abren al eliminar la oleada.'));}
    else if(a.combatAvailable){const enter=button('ENTRAR',async()=>{if(busy)return;busy=true;enter.disabled=true;try{await window.gg14GateEnter(selected);modal.close();}catch(e){status.textContent=e.message;}finally{busy=false;enter.disabled=false;}});body.append(enter);}
    else if(selected==='hades'&&window.gg14HadesAction){
     const room=window.gg14HadesState?.();const box=el('section');box.append(el('h3','Grupo Hades'),el('p','Se requieren de 4 a 8 pilotos con la puerta construida y la misma sección. El líder puede iniciar cuando todos estén listos.'));
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
window.gg13Open=open;
document.getElementById('gateMenu')?.addEventListener('click',()=>open('Portales'));
})();