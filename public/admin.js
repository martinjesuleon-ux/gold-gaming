'use strict';
const $=id=>document.getElementById(id);let password='',timer=null,active=false,busy=false;
const status=s=>$('adminStatus').textContent=s;
async function api(path,body){const res=await fetch('/api/admin/'+path,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+password,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});let data;try{data=await res.json();}catch{throw Error('Respuesta del servidor inválida');}if(!res.ok){if(res.status===401&&active)logout();throw Error(data.error||'Error HTTP '+res.status);}return data;}
function option(value,text){const o=document.createElement('option');o.value=value;o.textContent=text;return o;}
function render(data){$('summary').textContent=`${data.players.length} pilotos · ${data.npcs} enemigos · ${data.boxes} cajas`;$('players').replaceChildren();for(const p of data.players){const tr=document.createElement('tr');for(const v of [p.name,p.ship==='tank'?'AEGIS':'VIPER',p.credits.toLocaleString('es-CL'),`${Math.floor(p.hp)}/${p.maxHp}`,`${Math.round(p.x)}, ${Math.round(p.y)}`]){const td=document.createElement('td');td.textContent=v;tr.append(td);}$('players').append(tr);}if(!data.players.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=5;td.textContent='No hay pilotos conectados.';tr.append(td);$('players').append(tr);}for(const [id,placeholder] of [['creditPlayer','Selecciona jugador'],['bossPlayer','Centro del sector']]){const el=$(id),prev=el.value;el.replaceChildren(option('',placeholder),...data.players.map(p=>option(p.id,p.name)));if([...el.options].some(o=>o.value===prev))el.value=prev;}}
async function refresh(){if(busy||!active)return;busy=true;try{const data=await api('players');if(active){render(data);await refreshEvents();}}catch(e){status(e.message);}finally{busy=false;}}
function logout(){active=false;password='';eventState=null;clearInterval(timer);$('tools').hidden=true;$('loginCard').hidden=false;$('password').value='';status('Sesión cerrada');}
$('login').onsubmit=async e=>{e.preventDefault();password=$('password').value;try{const data=await api('players');active=true;$('password').value='';$('loginCard').hidden=true;$('tools').hidden=false;render(data);await refreshEvents();status('Acceso autorizado');clearInterval(timer);timer=setInterval(refresh,4000);}catch(e){password='';status(e.message);}};
$('logout').onclick=logout;$('refresh').onclick=refresh;
$('creditForm').onsubmit=async e=>{e.preventDefault();const btn=e.currentTarget.querySelector('button');btn.disabled=true;try{const data=await api('credits',{playerId:$('creditPlayer').value,amount:Number($('amount').value)});status('Créditos enviados. Saldo: '+data.credits.toLocaleString('es-CL'));await refresh();}catch(e){status(e.message);}finally{btn.disabled=false;}};
$('bossForm').onsubmit=async e=>{e.preventDefault();const btn=e.currentTarget.querySelector('button');btn.disabled=true;try{const data=await api('boss',{playerId:$('bossPlayer').value});status(`TITAN generado en ${Math.round(data.x)}, ${Math.round(data.y)}`);await refresh();}catch(e){status(e.message);}finally{btn.disabled=false;}};

let eventState=null,eventBusy=false;
const eventNames={hitac:'Convoy Hitac',ice:'Meteorito de Hielo',spaceball:'Spaceball',invasion:'Invasión','hitac-lottery':'Lotería Hitac',uba:'UBA'};
function renderEvents(d){
 eventState=d;const cards=$('eventCards');cards.replaceChildren();
 for(const kind of Object.keys(eventNames)){const data=d[kind==='hitac-lottery'?'lottery':kind],box=document.createElement('div');box.className='admin-card';const h=document.createElement('h3');h.textContent=eventNames[kind];const p=document.createElement('p');p.textContent=!data.enabled?'Deshabilitado':data.active?'Activo · '+data.active.map+' · '+(data.active.phase||'en juego'):kind==='invasion'?'Inscripciones: '+data.lobbies.length+' · Combates: '+data.runs.length:kind==='uba'?'Combates: '+data.matches:kind==='hitac-lottery'?'Habilitada · estado de bolsa no consultado':'Disponible';box.append(h,p);
 if(data.active){const a=data.active,detail=document.createElement('p');detail.className='muted';detail.textContent=kind==='hitac'?'Unidades: '+a.units:kind==='ice'?'Icy: '+a.icy+' · Cajas: '+a.boxes:'MMO '+a.scores[1]+' · EIC '+a.scores[2]+' · VRU '+a.scores[3]+' · Cajas: '+a.boxes;box.append(detail);}
 if(Object.hasOwn(data,'rewards')){const r=document.createElement('p');r.className='muted';r.textContent='Premios: '+(data.enabled&&data.rewards?'habilitados':'deshabilitados');box.append(r);}
 cards.append(box);}
 const m=$('eventMap'),prev=m.value;m.replaceChildren(...d.maps.map(v=>option(v,v)));if(d.maps.includes(prev))m.value=prev;else if(d.maps.includes('4-5'))m.value='4-5';
 updateEventForm();
}
async function refreshEvents(){try{const d=await api('events');if(active)renderEvents(d);}catch(e){eventState=null;updateEventForm();status(e.message);}}
function updateEventForm(){const kind=$('eventKind').value,d=eventState?.[kind==='hitac-lottery'?'lottery':kind],a=$('eventAction'),prev=a.value;
 $('eventMap').hidden=$('eventMapLabel').hidden=kind!=='ice';$('eventDifficulty').hidden=$('eventDifficultyLabel').hidden=kind!=='invasion';
 const choices=kind==='hitac-lottery'?[['open','Abrir bolsa'],['close','Cerrar bolsa']]:kind==='invasion'?[['start','Abrir inscripción']]:d?.active?[['stop','Finalizar evento']]:[['start','Iniciar evento']];
 a.replaceChildren(...choices.map(([v,t])=>option(v,t)));if(choices.some(([v])=>v===prev))a.value=prev;
 $('eventSubmit').disabled=!active||eventBusy||!d?.enabled;$('eventHint').textContent=!d?.enabled?'No disponible en la configuración actual.':kind==='hitac-lottery'?'Abrir una bolsa repone premios limitados. Verifica el estado antes de operar.':kind==='invasion'?'La inscripción dura 60 segundos.':'Las acciones afectan el evento global.';
}
$('eventKind').onchange=updateEventForm;
$('eventForm').onsubmit=async e=>{e.preventDefault();if(eventBusy||$('eventSubmit').disabled)return;const kind=$('eventKind').value,action=$('eventAction').value;
 if(!window.confirm(eventNames[kind]+': '+$('eventAction').selectedOptions[0].textContent+'?'))return;eventBusy=true;updateEventForm();
 try{await api(kind,{action,...(kind==='ice'?{map:$('eventMap').value}:{}),...(kind==='invasion'?{difficulty:$('eventDifficulty').value}:{})});status('Acción confirmada: '+eventNames[kind]);await refreshEvents();}catch(err){status(err.message);}finally{eventBusy=false;updateEventForm();}};
