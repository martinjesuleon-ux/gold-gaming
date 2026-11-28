'use strict';
(function(root){
 const groups=[
 ['laser','Láseres','✴',[['fire','Activar / detener láser'],...['LCB-10','MCB-25','MCB-50','UCB-100','SAB-50','RSB-75'].map(x=>[x,x,'ammo'])]],
 ['rocket','Misiles','➤',['R-310','PLT-2026','PLT-2021','PLT-3030','PLD-8','DCR-250','R-IC3'].map(x=>[x,x,['PLD-8','DCR-250','R-IC3'].includes(x)?'specialRockets':'rockets'])],
 ['launcher','Lanzamisiles','⇶',['ECO-10','SAR-01','SAR-02','HSTRM-01','UBR-100','CBR'].map(x=>[x,x,'launcherAmmo'])],
 ['special','Objetos especiales','◎',[['EMP','EMP-01','consumables','gg110Emp'],['ISH-01','Escudo instantáneo','cpus','gg18Cpu'],['SMB-01','Bomba inteligente','cpus','gg18Cpu']]],
 ['mines','Minas','✺',['ACM-01','DDM-01','SABM-01','SLM-01','EMPM-01'].map(x=>[x,x,'mines','gg18Mine'])],
 ['cpu','CPU y reparación','▣',[
 ['repair','Robot de reparación','robots','gg18Cpu'],
 ['AROL-X','Cohetes automáticos','cpus','toggle'],['RL-LB1','Lanzamisiles automático','cpus','toggle'],['NC-AWB','Refinación automática','cpus','toggle'],['AIM-02','Asistente de puntería','cpus','toggle'],['NC-RRB','Reparación automática','cpus','toggle'],['R0K-T01','Recarga de cohetes','cpus','toggle'],['MIN-T02','Recarga de minas','cpus','toggle'],
 ['CLO4K-CPU','Camuflaje','cpus','gg18Cpu'],['CLO4K-XL-CPU','Camuflaje XL','cpus','gg18Cpu'],
 ...['SL-01','SL-02','SL-03','SL-04'].map(x=>[x,x+' · espacios extra','cpus','passive']),
 ['GEMINEX-XI','Bodega ampliada','cpus','passive'],['AJP-01','Salto avanzado','cpus','chip'],
 ['HST-1','Lanzamisiles HST-1','launchers','launcher'],['HST-2','Lanzamisiles HST-2','launchers','launcher']]],
 ['buy','Comprar ahora','⊞',[['menu:Tienda','Abrir tienda',null,'menu']]],
 ['tech','Tecnología','⚗',[['menu:Ensamblaje','Objetos tecnológicos',null,'menu']]],
 ['ability','Habilidades de nave','⬡',[['menu:Habilidades','Habilidades disponibles',null,'menu']]],
 ['formation','Formaciones de VANT','⠿',[...['normal','turtle','arrow','lance','star','pincer','double-arrow','diamond','chevron','moth','crab','heart','barrage','bat','ring','drill','veteran','dome','wheel','wave'].map((x,i)=>['formation:'+x,['Normal','Tortuga','Flecha','Lanza','Estrella','Pinza','Flecha doble','Diamante','Galón','Polilla','Cangrejo','Corazón','Andanada','Murciélago','Anillo','Taladro','Veterano','Cúpula','Rueda','Ola'][i],null,'gg19Formation'])]],
 ['other','Otros accesos','◉',[['menu:Boosters','Potenciadores',null,'menu'],['menu:Refinación','Refinación',null,'menu'],['menu:Portales','Portales',null,'menu']]]
 ];
 const items=new Map(groups.flatMap(g=>g[3]).map(x=>[x[0],x]));
 function equippedExtras(p){return new Set([...(p?.cpus||[]),...(p?.robot?['repair']:[]),...(p?.launcher?[p.launcher]:[])]);}
 function visibleItems(group,p){return group[0]==='cpu'?group[3].filter(x=>equippedExtras(p).has(x[0])).concat(group[3].length?[...['ISH-01','SMB-01'].filter(x=>equippedExtras(p).has(x)).map(x=>items.get(x))]:[]):group[3];}
 function cooldown(id,p,now){let until=0;if(['R-310','PLT-2026','PLT-2021','PLT-3030'].includes(id))until=p?.rocketUntil;else if(['PLD-8','DCR-250','R-IC3'].includes(id))until=p?.ordnanceUntil?.[id];else if(['ECO-10','SAR-01','SAR-02','HSTRM-01','UBR-100','CBR','RL-LB1','HST-1','HST-2'].includes(id))until=p?.ordnanceUntil?.hellstorm;else if(id==='EMP')until=p?.empUntil;else if(['ACM-01','DDM-01','SABM-01','SLM-01','EMPM-01','ISH-01','SMB-01'].includes(id))until=p?.mineUntil;else if(id==='AROL-X')until=p?.rocketUntil;else if(id?.startsWith('formation:'))until=p?.formationReadyAt;return Math.max(0,(Number(until)||0)-now);}
 const defaults=['fire','LCB-10','MCB-25','MCB-50','UCB-100','SAB-50','RSB-75','R-310','PLT-2026','PLT-2021','PLT-3030','PLD-8','DCR-250','R-IC3','ECO-10','SAR-01','SAR-02','HSTRM-01','UBR-100','CBR'];
 function validate(value){return Array.isArray(value)&&value.length===20&&value.every(x=>x===null||items.has(x))?[...value]:[...defaults];}
 function assign(value,index,id,from=null){const next=validate(value);if(!Number.isInteger(index)||index<0||index>=20||!(id===null||items.has(id)))return next;if(from!==null){if(!Number.isInteger(from)||from<0||from>=20||next[from]!==id)return next;next[from]=next[index];}next[index]=id;return next;}
 function key(account){return 'gg.quick.arsenal.v234:'+account;}
 function load(storage,account){try{return account?validate(JSON.parse(storage.getItem(key(account)))):[...defaults];}catch{return [...defaults];}}
 function save(storage,account,slots){if(!account)return false;try{storage.setItem(key(account),JSON.stringify(validate(slots)));return true;}catch{return false;}}
 root.ggQuickArsenalRules={groups,defaults,validate,assign,load,save,equippedExtras,visibleItems,cooldown};
 if(!root.document)return;
 const d=root.document;
 function init(){
  const panel=d.querySelector('#hud .arsenal'),source=panel?.querySelector('.gg-slots');if(!source||panel.dataset.quickArsenal)return;
  const premium=d.getElementById('gg-premium-slots');if(!premium)return;premium.replaceChildren();premium.setAttribute('aria-label','Diez ranuras Premium independientes');panel.dataset.quickArsenal='true';source.className='gg-arsenal-source';source.hidden=true;
  const original=[...source.querySelectorAll('button')],sourceById=new Map(defaults.map((id,i)=>[id,original[i]]));
  const mk=(tag,cls,text)=>{const n=d.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;};
  const btn=(cls,label)=>{const b=mk('button',cls);b.type='button';b.title=label;b.setAttribute('aria-label',label);return b;};
  const wrap=mk('section','gg-quick-wrap'),expanded=mk('section','gg-quick-expanded'),tray=mk('div','gg-quick-tray'),categories=mk('div','gg-quick-categories'),bar=mk('div','gg-quick-bar gg-slots'),toggle=btn('gg-quick-toggle','Desplegar arsenal'),hint=mk('small','gg-quick-hint','Arrastra un objeto a una ranura. Clic: usar · Shift+clic: asignar.'),notice=mk('div','gg-quick-status');
  notice.setAttribute('role','status');toggle.textContent='▴';toggle.setAttribute('aria-expanded','false');expanded.hidden=true;expanded.append(tray,categories,hint);wrap.append(expanded,bar,premium,toggle,notice);panel.insertBefore(wrap,source);
  let account=null,slots=[...defaults],group=0,drag=null,chosen=null,inventory={},open=false,extraStamp='';const toggling=new Set();
  const buttons=[],categoryButtons=[],trayButtons=new Map();
  let noticeTimer;const say=t=>{notice.textContent=t;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>notice.textContent='',3500);};
  function persist(){if(account&&!save(root.localStorage,account,slots))say('No se pudo guardar la configuración en este navegador');}
  function combatArt(category,code){
   if(!['ammo','rockets','specialRockets','launcherAmmo','cpus','robots','launchers','mines','consumables'].includes(category))return null;
   const art=mk('canvas');art.width=96;art.height=64;const c=art.getContext('2d');if(!c)return null;c.translate(48,32);
   const colors={'LCB-10':'#e6e9ef','MCB-25':'#7be4ab','MCB-50':'#7ec9ff','UCB-100':'#dceaff','SAB-50':'#47e6ed','RSB-75':'#ffb855','AROL-X':'#fa9b5c','RL-LB1':'#f8cb63','NC-RRB':'#7edb9d','AIM-02':'#9fd5ff','NC-AWB':'#b98df7'};
   const color=colors[code]||root.ggShopVisual?.itemColor(category,{id:code})||'#9bd8ff';
   function metal(x,y,w,h){const g=c.createLinearGradient(0,y,0,y+h);g.addColorStop(0,'#edf6ff');g.addColorStop(.35,'#a1b3c4');g.addColorStop(.65,'#344557');g.addColorStop(1,'#72869b');c.fillStyle=g;c.fillRect(x,y,w,h);c.strokeStyle='#111e2c';c.strokeRect(x+.5,y+.5,w-1,h-1);}
   function poly(points,fill){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=fill;c.fill();c.strokeStyle='#132131';c.stroke();}
   if(category==='ammo'){for(let i=0;i<3;i++){const x=-25+i*19,y=-17+Math.abs(i-1)*5;metal(x,y,16,32);metal(x-2,y+24,20,6);c.fillStyle=color;c.fillRect(x+3,y+7,10,13);c.fillStyle='#fff9';c.fillRect(x+3,y+8,3,11);}const mult={'LCB-10':'1','MCB-25':'2','MCB-50':'3','UCB-100':'4','RSB-75':'6','SAB-50':'S'}[code];c.font='bold 15px Arial';c.textAlign='right';c.fillStyle='#fff';c.fillText(mult?'×'+mult:'',43,-18);}
   else if(['rockets','specialRockets','launcherAmmo'].includes(category)){c.rotate(-.65);for(let i=0;i<(category==='launcherAmmo'?2:1);i++){const y=category==='launcherAmmo'?(i-0.5)*16:0;poly([[-32,y-7],[15,y-7],[35,y],[15,y+7],[-32,y+7]],'#d7e4ec');poly([[-26,y-7],[-39,y-15],[-35,y],[-39,y+15],[-26,y+7]],'#6d8193');c.fillStyle=color;c.fillRect(-7,y-5,19,10);c.fillStyle='#f8fbff';c.fillRect(-8,y-5,18,2);}}
   else if(category==='cpus'){metal(-21,-21,42,42);c.fillStyle='#172d3f';c.fillRect(-15,-15,30,30);for(let i=-15;i<=15;i+=10){metal(i-2,-25,5,6);metal(i-2,19,5,6);metal(-25,i-2,6,5);metal(19,i-2,6,5);}c.strokeStyle=color;c.lineWidth=3;c.strokeRect(-10,-10,20,20);c.beginPath();if(code==='AROL-X'||code==='RL-LB1'){c.moveTo(-9,9);c.lineTo(9,-9);c.moveTo(1,-9);c.lineTo(9,-9);c.lineTo(9,-1);}else if(code==='NC-RRB'){c.moveTo(-8,0);c.lineTo(8,0);c.moveTo(0,-8);c.lineTo(0,8);}else{c.moveTo(-6,-6);c.lineTo(6,6);c.moveTo(-6,6);c.lineTo(6,-6);}c.stroke();}
   else if(category==='launchers'){metal(-26,-16,52,32);for(let i=0;i<4;i++){c.fillStyle='#101d2a';c.beginPath();c.arc(-18+i*12,0,5,0,Math.PI*2);c.fill();c.strokeStyle=color;c.stroke();}}
   else if(category==='robots'){metal(-18,-12,36,24);metal(-28,-8,10,16);metal(18,-8,10,16);c.fillStyle=color;c.fillRect(-9,-3,18,6);c.fillRect(-3,-9,6,18);}
   else {c.fillStyle=color;c.beginPath();c.arc(0,0,17,0,Math.PI*2);c.fill();c.strokeStyle='#dbeaf2';c.lineWidth=3;c.stroke();c.strokeStyle='#203549';for(let i=0;i<8;i++){c.rotate(Math.PI/4);c.beginPath();c.moveTo(12,0);c.lineTo(24,0);c.stroke();}c.fillStyle='#142534';c.beginPath();c.arc(0,0,6,0,Math.PI*2);c.fill();}
   return art;
  }
  function icon(b,id){
   const item=items.get(id),theme=root.ggVisualTheme?.current()||'gold',stamp=id+':'+theme+':'+(id==='repair'?root.gg15Pilot?.()?.robot||'':'');
   if(b.dataset.iconStamp===stamp)return;b.dataset.iconStamp=stamp;b.replaceChildren();
   if(!item){b.append(mk('span','gg-quick-icon','+'));return;}
   const category=item[2],code=id==='repair'?(root.gg15Pilot?.()?.robot||'REP-1'):id.split(':').at(-1);let art;
   if(id.startsWith('formation:')&&root.ggGraphics161){art=mk('canvas');art.width=64;art.height=44;const c=art.getContext('2d');if(c){if(code==='drill'){c.translate(32,29);c.scale(.145,.145);c.fillStyle='#67c8f3';c.beginPath();c.moveTo(0,-30);c.lineTo(22,18);c.lineTo(0,9);c.lineTo(-22,18);c.closePath();c.fill();c.fillStyle='#f8d57a';for(const q of root.ggGraphics161.formationOffsets(10,code))c.fillRect(q.y-10,-q.x-10,20,20);}else{const pts=root.ggGraphics161.formationOffsets(10,code),left=Math.min(-28,...pts.map(q=>q.y)),right=Math.max(28,...pts.map(q=>q.y)),top=Math.min(-30,...pts.map(q=>-q.x)),bottom=Math.max(22,...pts.map(q=>-q.x)),scale=Math.min(52/(right-left),35/(bottom-top));c.translate(32-(left+right)*scale/2,22-(top+bottom)*scale/2);c.scale(scale,scale);c.fillStyle='#67c8f3';c.beginPath();c.moveTo(0,-30);c.lineTo(22,18);c.lineTo(0,9);c.lineTo(-22,18);c.closePath();c.fill();c.fillStyle='#f8d57a';for(const q of pts)c.fillRect(q.y-8,-q.x-8,16,16);}}}
   else if(category){art=root.ggShopVisual?.art(category,{id:code})||combatArt(category,code);}
   if(art&&root.ggVisualTheme?.current()==='classic'){root.ggClassicPack?.icon(art.getContext('2d'),'ui:quick:'+id,art.width,art.height);}if(art){art.setAttribute('aria-hidden','true');art.removeAttribute('role');art.removeAttribute('aria-label');b.append(art);}else b.append(mk('span','gg-quick-icon',id==='fire'?'✴':id.startsWith('menu:')?'◈':'⬡'));
   b.append(mk('span','gg-quick-code',item[1]),mk('span','gg-quick-count'),mk('span','gg-quick-cool'),mk('span','gg-quick-state'));
  }
  function paint(b,id){
   icon(b,id);const item=items.get(id),src=sourceById.get(id),pilot=root.gg15Pilot?.(),stock=root.gg235AmmoStock?.(id)??inventory[id],qty=src?.querySelector('.gg-ammo-count')?.textContent??(stock===undefined?'':String(stock));
   const count=b.querySelector('.gg-quick-count');if(count&&count.textContent!==qty)count.textContent=qty;
   const toggle=item?.[3]==='toggle',passive=item?.[3]==='passive',equipped=equippedExtras(pilot).has(id),cpuItem=groups.find(g=>g[0]==='cpu')[3].some(x=>x[0]===id)||['ISH-01','SMB-01'].includes(id),active=!!(toggle&&pilot?.cpuStates?.[id])||(passive&&equipped)||(id?.startsWith('CLO4K-')&&equipped&&pilot?.cloaked)||(id==='ISH-01'&&equipped&&pilot?.ishUntil>Date.now())||!!src?.classList.contains('active')||(id?.startsWith('formation:')&&pilot?.formation===id.slice(10))||(id==='repair'&&!!pilot?.repairOn);
   b.classList.toggle('active',!!active);b.classList.toggle('gg-quick-unavailable',!!cpuItem&&!equipped);const status=b.querySelector('.gg-quick-state'),stateText=cpuItem?(!equipped?'NO EQUIP.':passive?'PASIVO':toggle?(active?'ON':'OFF'):id==='repair'?(active?'ON':'OFF'):''):'';if(status&&status.textContent!==stateText)status.textContent=stateText;const cd=cooldown(id,pilot,Date.now()),cdNode=b.querySelector('.gg-quick-cool');if(cdNode){const seconds=cd>0?String(Math.ceil(cd/1000)):'';if(cdNode.textContent!==seconds)cdNode.textContent=seconds;b.classList.toggle('gg-quick-recharging',cd>0);}b.classList.toggle('gg-quick-chosen',chosen===id&&!!id);
   const label=item?(id==='repair'&&pilot?.robot?pilot.robot+' · '+item[1]:src?.title||item[1])+(stateText?' · '+stateText:'')+(cd>0?' · Recarga '+Math.ceil(cd/1000)+' s':''):'Ranura vacía';if(b.title!==label)b.title=label;b.setAttribute('aria-label',label);
  }
  function refresh(){const stamp=[...equippedExtras(root.gg15Pilot?.())].sort().join('|');if(open&&groups[group][0]==='cpu'&&stamp!==extraStamp){extraStamp=stamp;buildTray();return;}for(let i=0;i<20;i++)paint(buttons[i],slots[i]);for(const [id,b] of trayButtons)paint(b,id);}
  function slotLabel(i){return i<10?'Ranura '+(i+1):'Ranura Premium '+(i-9);}function useSlot(i){if(!Number.isInteger(i)||i<0||i>=20||i>=10&&premium.hidden)return;return use(slots[i],true);}function change(index,id,from=null){if(index>=10&&premium.hidden||from!==null&&from>=10&&premium.hidden)return;slots=assign(slots,index,id,from);chosen=null;persist();refresh();say(slotLabel(index)+' configurada');}
  async function use(id,quick=false){if(!id||!root.ggArsenalCanUse?.())return;if(quick&&items.get(id)?.[2]==='ammo'&&typeof root.ggQuickFireAmmo==='function'){root.ggQuickFireAmmo(id);refresh();return;}const src=sourceById.get(id);if(src){src.click();refresh();return;}const item=items.get(id);if(!item)return;try{const p=root.gg15Pilot?.();if(item[3]==='toggle'){if(toggling.has(id))return;toggling.add(id);try{if(!equippedExtras(p).has(id))throw Error('CPU no equipado');const r=await root.gg235CpuToggle(id,!p.cpuStates?.[id]);say(item[1]+' '+(r.cpuStates[id]?'activado':'desactivado'));}finally{toggling.delete(id);refresh();}return;}if(item[3]==='passive'){say(item[1]+' · efecto pasivo mientras está equipado');return;}if(item[3]==='chip'){root.gg13Open?.('Chip');return;}if(item[3]==='launcher'){group=2;if(!open){open=true;expanded.hidden=false;toggle.textContent='▾';toggle.setAttribute('aria-expanded','true');}buildTray();return;}if(item[3]==='menu'){root.gg13Open?.(id.slice(5));return;}const fn=root[item[3]];if(typeof fn!=='function')throw Error('Acción no disponible');await fn(id.startsWith('formation:')?id.slice(10):id);if(root.gg13RefreshInventory)await root.gg13RefreshInventory();say(item[1]+' confirmado');}catch(e){say(e.message||'Acción no disponible');}}
  function start(e,id,from=null){if(!id)return;drag={id,from};chosen=null;e.dataTransfer?.setData('text/plain',id);if(e.dataTransfer)e.dataTransfer.effectAllowed=from===null?'copy':'move';}
  function end(){drag=null;for(const b of buttons)b.classList.remove('gg-quick-drop');}
  function buildTray(){tray.replaceChildren();trayButtons.clear();for(const [id] of visibleItems(groups[group],root.gg15Pilot?.())){const b=btn('gg-quick-item',items.get(id)[1]);b.draggable=true;b.ondragstart=e=>start(e,id);b.ondragend=end;b.onclick=e=>{if(e.shiftKey){chosen=chosen===id?null:id;refresh();say(chosen?'Seleccionado: '+items.get(id)[1]+' · pulsa una ranura':'Selección cancelada');}else{chosen=null;use(id);}};trayButtons.set(id,b);tray.append(b);}categoryButtons.forEach((b,i)=>b.setAttribute('aria-pressed',String(i===group)));extraStamp=[...equippedExtras(root.gg15Pilot?.())].sort().join('|');refresh();}
  for(let i=0;i<20;i++){const b=btn('gg-quick-slot',slotLabel(i));if(i<10)b.dataset.slot=String(i+1);else b.dataset.premiumSlot=String(i-9);b.draggable=true;b.onclick=()=>{if(chosen)change(i,chosen);else useSlot(i);};b.ondragstart=e=>{if(!slots[i]){e.preventDefault();return;}start(e,slots[i],i);};b.ondragend=end;b.ondragover=e=>{if(drag){e.preventDefault();b.classList.add('gg-quick-drop');}};b.ondragleave=()=>b.classList.remove('gg-quick-drop');b.ondrop=e=>{e.preventDefault();if(drag)change(i,drag.id,drag.from);end();};b.oncontextmenu=e=>{e.preventDefault();if(open)change(i,null);};buttons.push(b);(i<10?bar:premium).append(b);}
  groups.forEach((g,i)=>{const b=btn('gg-quick-category',g[1]);b.textContent=g[2];b.onclick=()=>{group=i;chosen=null;buildTray();};categoryButtons.push(b);categories.append(b);});
  const reset=btn('gg-quick-reset','Restaurar ranuras originales');reset.textContent='Restaurar';reset.onclick=()=>{slots=[...defaults];chosen=null;persist();refresh();say('Ranuras restauradas');};hint.replaceChildren(reset);reset.title='Restaurar ranuras originales · Arrastrar para asignar · Clic derecho para vaciar';
  toggle.onclick=()=>{open=!open;expanded.hidden=!open;toggle.textContent=open?'▾':'▴';toggle.setAttribute('aria-expanded',String(open));if(!open){chosen=null;end();refresh();}else buildTray();};
  root.ggQuickArsenal={refresh,nameAt:i=>items.get(slots[i])?.[1]||'Ranura vacía',useSlot};
  root.addEventListener('gg13:inventory',e=>{const id=e.detail?.accountId;if(id!==account){account=id||null;slots=load(root.localStorage,account);chosen=null;end();}inventory=Object.fromEntries((e.detail?.ammo||[]).map(a=>[a.code,a.quantity]));refresh();});
  root.addEventListener('gg:visualTheme',refresh);root.addEventListener('gg18:abilityState',refresh);
  refresh();root.ggArsenalKeys?.decorate();
 }
 if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',init);else init();
})(typeof window==='undefined'?globalThis:window);
