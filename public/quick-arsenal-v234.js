'use strict';
(function(root){
 const groups=[
 ['laser','Láseres','✴',[['fire','Activar / detener láser'],...['LCB-10','MCB-25','MCB-50','UCB-100','SAB-50','RSB-75'].map(x=>[x,x,'ammo'])]],
 ['rocket','Misiles','➤',['R-310','PLT-2026','PLT-2021','PLT-3030','PLD-8','DCR-250','R-IC3'].map(x=>[x,x,['PLD-8','DCR-250','R-IC3'].includes(x)?'specialRockets':'rockets'])],
 ['launcher','Lanzamisiles','⇶',['ECO-10','SAR-01','SAR-02','HSTRM-01','UBR-100','CBR'].map(x=>[x,x,'launcherAmmo'])],
 ['special','Objetos especiales','◎',[['EMP','EMP-01','consumables','gg110Emp'],['ISH-01','Escudo instantáneo','cpus','gg18Cpu'],['SMB-01','Bomba inteligente','cpus','gg18Cpu']]],
 ['mines','Minas','✺',['ACM-01','DDM-01','SABM-01','SLM-01','EMPM-01'].map(x=>[x,x,'mines','gg18Mine'])],
 ['cpu','CPU y reparación','▣',[['repair','Reparación','robots','gg18Cpu'],['CLO4K-CPU','Camuflaje','cpus','gg18Cpu'],['CLO4K-XL-CPU','Camuflaje XL','cpus','gg18Cpu'],['menu:Chip','Ver CPU equipadas',null,'menu']]],
 ['buy','Comprar ahora','⊞',[['menu:Tienda','Abrir tienda',null,'menu']]],
 ['tech','Tecnología','⚗',[['menu:Ensamblaje','Objetos tecnológicos',null,'menu']]],
 ['ability','Habilidades de nave','⬡',[['menu:Habilidades','Habilidades disponibles',null,'menu']]],
 ['formation','Formaciones de VANT','⠿',[...['normal','turtle','arrow','lance','star','pincer','double-arrow','diamond','chevron','moth','crab','heart','barrage','bat','ring','drill','veteran','dome','wheel','wave'].map((x,i)=>['formation:'+x,['Normal','Tortuga','Flecha','Lanza','Estrella','Pinza','Flecha doble','Diamante','Galón','Polilla','Cangrejo','Corazón','Andanada','Murciélago','Anillo','Taladro','Veterano','Cúpula','Rueda','Ola'][i],null,'gg19Formation'])]],
 ['other','Otros accesos','◉',[['menu:Boosters','Potenciadores',null,'menu'],['menu:Refinación','Refinación',null,'menu'],['menu:Portales','Portales',null,'menu']]]
 ];
 const items=new Map(groups.flatMap(g=>g[3]).map(x=>[x[0],x]));
 const defaults=['fire','LCB-10','MCB-25','MCB-50','UCB-100','SAB-50','RSB-75','R-310','PLT-2026','PLT-2021','PLT-3030','PLD-8','DCR-250','R-IC3','ECO-10','SAR-01','SAR-02','HSTRM-01','UBR-100','CBR'];
 function validate(value){return Array.isArray(value)&&value.length===20&&value.every(x=>x===null||items.has(x))?[...value]:[...defaults];}
 function assign(value,index,id,from=null){const next=validate(value);if(!Number.isInteger(index)||index<0||index>=20||!(id===null||items.has(id)))return next;if(from!==null){if(!Number.isInteger(from)||from<0||from>=20||next[from]!==id)return next;next[from]=next[index];}next[index]=id;return next;}
 function key(account){return 'gg.quick.arsenal.v234:'+account;}
 function load(storage,account){try{return account?validate(JSON.parse(storage.getItem(key(account)))):[...defaults];}catch{return [...defaults];}}
 function save(storage,account,slots){if(!account)return false;try{storage.setItem(key(account),JSON.stringify(validate(slots)));return true;}catch{return false;}}
 root.ggQuickArsenalRules={groups,defaults,validate,assign,load,save};
 if(!root.document)return;
 const d=root.document;
 function init(){
  const panel=d.querySelector('#hud .arsenal'),source=panel?.querySelector('.gg-slots');if(!source||panel.dataset.quickArsenal)return;
  panel.dataset.quickArsenal='true';source.className='gg-arsenal-source';source.hidden=true;
  const original=[...source.querySelectorAll('button')],sourceById=new Map(defaults.map((id,i)=>[id,original[i]]));
  const mk=(tag,cls,text)=>{const n=d.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;};
  const btn=(cls,label)=>{const b=mk('button',cls);b.type='button';b.title=label;b.setAttribute('aria-label',label);return b;};
  const wrap=mk('section','gg-quick-wrap'),expanded=mk('section','gg-quick-expanded'),tray=mk('div','gg-quick-tray'),categories=mk('div','gg-quick-categories'),bar=mk('div','gg-quick-bar gg-slots'),toggle=btn('gg-quick-toggle','Desplegar arsenal'),hint=mk('small','gg-quick-hint','Arrastra un objeto a una ranura. Clic: usar · Shift+clic: asignar.'),notice=mk('div','gg-quick-status');
  notice.setAttribute('role','status');toggle.textContent='▸';toggle.setAttribute('aria-expanded','false');expanded.hidden=true;expanded.append(tray,categories,hint);wrap.append(expanded,bar,toggle,notice);panel.insertBefore(wrap,source);
  let account=null,slots=[...defaults],group=0,drag=null,chosen=null,inventory={},open=false;
  const buttons=[],categoryButtons=[],trayButtons=new Map();
  const say=t=>{notice.textContent=t;};
  function persist(){if(account&&!save(root.localStorage,account,slots))say('No se pudo guardar la configuración en este navegador');}
  function icon(b,id){
   const item=items.get(id),theme=root.ggVisualTheme?.current()||'gold',stamp=id+':'+theme;
   if(b.dataset.iconStamp===stamp)return;b.dataset.iconStamp=stamp;b.replaceChildren();
   if(!item){b.append(mk('span','gg-quick-icon','+'));return;}
   const category=item[2],code=id.split(':').at(-1);let art;
   if(id.startsWith('formation:')&&root.ggGraphics161){art=mk('canvas');art.width=64;art.height=44;const c=art.getContext('2d');if(c){c.translate(32,22);c.scale(.24,.24);c.fillStyle='#67c8f3';c.fillRect(-9,-9,18,18);c.fillStyle='#f8d57a';for(const q of root.ggGraphics161.formationOffsets(10,code))c.fillRect(q.x-6,q.y-6,12,12);}}
   else if(category&&root.ggShopVisual){art=root.ggShopVisual.art(category,{id:code});}
   if(art){art.setAttribute('aria-hidden','true');art.removeAttribute('role');art.removeAttribute('aria-label');b.append(art);}else b.append(mk('span','gg-quick-icon',id==='fire'?'✴':id.startsWith('menu:')?'◈':'⬡'));
   b.append(mk('span','gg-quick-code',item[1]),mk('span','gg-quick-count'));
  }
  function paint(b,id){
   icon(b,id);const item=items.get(id),src=sourceById.get(id),pilot=root.gg15Pilot?.(),qty=src?.querySelector('.gg-ammo-count')?.textContent??(inventory[id]===undefined?'':String(inventory[id]));
   const count=b.querySelector('.gg-quick-count');if(count&&count.textContent!==qty)count.textContent=qty;
   const active=!!src?.classList.contains('active')||(id?.startsWith('formation:')&&pilot?.formation===id.slice(10))||(id==='repair'&&!!pilot?.repairOn);
   b.classList.toggle('active',!!active);b.classList.toggle('gg-quick-chosen',chosen===id&&!!id);
   const label=item?(src?.title||item[1]):'Ranura vacía';if(b.title!==label)b.title=label;b.setAttribute('aria-label',label);
  }
  function refresh(){for(let i=0;i<20;i++)paint(buttons[i],slots[i]);for(const [id,b] of trayButtons)paint(b,id);}
  function change(index,id,from=null){slots=assign(slots,index,id,from);chosen=null;persist();refresh();say('Ranura '+(index+1)+' configurada');}
  async function use(id){if(!id||!root.ggArsenalCanUse?.())return;const src=sourceById.get(id);if(src){src.click();refresh();return;}const item=items.get(id);if(!item)return;try{if(item[3]==='menu'){root.gg13Open?.(id.slice(5));return;}const fn=root[item[3]];if(typeof fn!=='function')throw Error('Acción no disponible');await fn(id.startsWith('formation:')?id.slice(10):id);if(root.gg13RefreshInventory)await root.gg13RefreshInventory();say(item[1]+' confirmado');}catch(e){say(e.message||'Acción no disponible');}}
  function start(e,id,from=null){if(!id)return;drag={id,from};chosen=null;e.dataTransfer?.setData('text/plain',id);if(e.dataTransfer)e.dataTransfer.effectAllowed=from===null?'copy':'move';}
  function end(){drag=null;for(const b of buttons)b.classList.remove('gg-quick-drop');}
  function buildTray(){tray.replaceChildren();trayButtons.clear();for(const [id] of groups[group][3]){const b=btn('gg-quick-item',items.get(id)[1]);b.draggable=true;b.ondragstart=e=>start(e,id);b.ondragend=end;b.onclick=e=>{if(e.shiftKey){chosen=chosen===id?null:id;refresh();say(chosen?'Seleccionado: '+items.get(id)[1]+' · pulsa una ranura':'Selección cancelada');}else{chosen=null;use(id);}};trayButtons.set(id,b);tray.append(b);}categoryButtons.forEach((b,i)=>b.setAttribute('aria-pressed',String(i===group)));refresh();}
  for(let i=0;i<20;i++){const b=btn('gg-quick-slot','Ranura '+(i+1));b.dataset.slot=String(i+1);b.draggable=true;b.onclick=()=>{if(chosen)change(i,chosen);else use(slots[i]);};b.ondragstart=e=>{if(!slots[i]){e.preventDefault();return;}start(e,slots[i],i);};b.ondragend=end;b.ondragover=e=>{if(drag){e.preventDefault();b.classList.add('gg-quick-drop');}};b.ondragleave=()=>b.classList.remove('gg-quick-drop');b.ondrop=e=>{e.preventDefault();if(drag)change(i,drag.id,drag.from);end();};b.oncontextmenu=e=>{e.preventDefault();if(open)change(i,null);};buttons.push(b);bar.append(b);}
  groups.forEach((g,i)=>{const b=btn('gg-quick-category',g[1]);b.textContent=g[2];b.onclick=()=>{group=i;chosen=null;buildTray();};categoryButtons.push(b);categories.append(b);});
  const reset=btn('gg-quick-reset','Restaurar ranuras originales');reset.textContent='Restaurar';reset.onclick=()=>{slots=[...defaults];chosen=null;persist();refresh();say('Ranuras restauradas');};hint.append(' · Clic derecho para vaciar. ',reset);
  toggle.onclick=()=>{open=!open;expanded.hidden=!open;toggle.textContent=open?'▾':'▸';toggle.setAttribute('aria-expanded',String(open));if(!open){chosen=null;end();refresh();}else buildTray();};
  root.ggQuickArsenal={refresh,nameAt:i=>items.get(slots[i])?.[1]||'Ranura vacía',useSlot:i=>use(slots[i])};
  root.addEventListener('gg13:inventory',e=>{const id=e.detail?.accountId;if(id!==account){account=id||null;slots=load(root.localStorage,account);chosen=null;end();}inventory=Object.fromEntries((e.detail?.ammo||[]).map(a=>[a.code,a.quantity]));refresh();});
  root.addEventListener('gg:visualTheme',refresh);root.addEventListener('gg18:abilityState',refresh);
  refresh();root.ggArsenalKeys?.decorate();
 }
 if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',init);else init();
})(typeof window==='undefined'?globalThis:window);
