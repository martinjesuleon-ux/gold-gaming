'use strict';
(function(root){
 const specs=Object.freeze({
 'HULM-1':['Casco','hull','M8 19L19 6H45L56 19V45L45 58H19L8 45Z','M17 23L24 15H40L47 23V41L40 49H24L17 41Z'],
 'DEFM-1':['Deflector','shield','M32 4L55 14V34L46 49L32 59L18 49L9 34V14Z','M32 14L45 20V33L39 43L32 48L25 43L19 33V20Z'],
 'REPM-1':['Reparación','repair','M15 8H49L56 15V49L49 56H15L8 49V15Z','M27 16H37V27H48V37H37V48H27V37H16V27H27Z'],
 'HONM-1':['Honor','honor','M32 5L55 23L48 53H16L9 23Z','M32 15L37 27L50 28L40 36L43 48L32 41L21 48L24 36L14 28L27 27Z'],
 'XPM-1':['Experiencia','xp','M32 4L57 19V45L32 60L7 45V19Z','M14 35L32 16L50 35H39V49H25V35Z'],
 'DMGM-1':['Daño','damage','M10 10H54V54H10Z','M37 11L18 35H30L25 53L47 27H34Z'],
 'LTM-LR':['Láser LR','laser-a','M10 24L18 16H42L54 22V42L42 48H18L10 40Z','M18 24H47V29H18ZM18 35H47V40H18Z'],
 'LTM-MR':['Láser medio','laser-b','M8 15H46L56 24V40L46 49H8Z','M15 22H50V27H15ZM15 30H50V35H15ZM15 38H50V43H15Z'],
 'LTM-HR':['Láser largo alcance','laser-c','M7 22H20V12H40V22H58V42H40V52H20V42H7Z','M12 29H54V35H12ZM26 18H34V46H26Z'],
 'RAM-LA':['Misiles LA','rocket-a','M9 12H45L57 23V41L45 52H9Z','M17 19H39L48 25L39 30H17ZM17 34H39L48 40L39 45H17Z'],
 'RAM-MA':['Misiles MA','rocket-b','M9 10H43L58 21V43L43 54H9Z','M16 17H40L48 22L40 27H16ZM16 30H40L48 35L40 40H16ZM16 43H40V48H16Z']
 });
 const positions=['core','deflector','n','ne','e','se','s','sw','w','nw'];
 const allows=(code,slot,catalog)=>Object.hasOwn(catalog||{},code)&&Number.isInteger(slot)&&slot>=0&&slot<10&&(slot<2?catalog[code].slot===slot:catalog[code].slot===undefined);
 function place(slots,inventory,id,slot,catalog){
  const item=inventory.find(x=>x.instanceId===id);
  if(!item||!allows(item.code,slot,catalog))return null;
  const prior=slots.indexOf(id),next=slots.slice(),old=next[slot];
  if(prior===slot)return next;
  if(prior>=0)next[prior]=null;
  if(old&&prior>=0){const other=inventory.find(x=>x.instanceId===old);if(other&&allows(other.code,prior,catalog))next[prior]=old;}
  next[slot]=id;
  if(!catalog[item.code].range&&next.some((v,i)=>i!==slot&&inventory.find(x=>x.instanceId===v)?.code===item.code))return null;
  return next;
 }
 function complete(slots,inventory,catalog){
  return slots.length===10&&new Set(slots).size===10&&slots.every((id,i)=>{const x=inventory.find(y=>y.instanceId===id);return x&&allows(x.code,i,catalog);})&&slots.every((id,i)=>{const x=inventory.find(y=>y.instanceId===id);return catalog[x.code].range||!slots.slice(0,i).some(v=>inventory.find(y=>y.instanceId===v)?.code===x.code);});
 }
 const el=(tag,cls,label)=>{const n=root.document.createElement(tag);if(cls)n.className=cls;if(label!==undefined)n.textContent=label;return n;};
 function art(code){
  const s=specs[code]||['Módulo','unknown','M8 8H56V56H8Z','M20 20H44V44H20Z'],ns='http://www.w3.org/2000/svg',svg=root.document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 64 64');svg.setAttribute('class','gg-cbs-art gg-cbs-'+s[1]);svg.setAttribute('aria-hidden','true');
  for(const [d,cls] of [[s[2],'gg-cbs-shell'],[s[3],'gg-cbs-detail']]){const p=root.document.createElementNS(ns,'path');p.setAttribute('d',d);p.setAttribute('class',cls);svg.append(p);}
  return svg;
 }
 function layout(){const board=el('div','gg-cbs-board');board.append(el('div','gg-cbs-ring'));return board;}
 function slotLabel(i){return i===0?'Casco':i===1?'Deflector':'Exterior '+(i-1);}
 function tile(item){const n=el('span','gg-cbs-unit');n.append(art(item.code),el('b',null,item.code),el('small',null,'Nv. '+item.level));return n;}
 function slotNode(i){const n=el('button','gg-cbs-slot gg-cbs-pos-'+positions[i]);n.type='button';return n;}
 function installed(modules){
  const board=layout(),info=el('p','gg-cbs-hint','Selecciona un módulo para ver su estado.');
  for(let i=0;i<10;i++){const m=modules.find(x=>x.slot===i),b=slotNode(i);b.append(m?tile(m):el('span',null,slotLabel(i)));if(m){b.dataset.destroyed=String(m.hp<=0);b.setAttribute('aria-label',m.code+' · '+slotLabel(i));b.onclick=()=>{info.textContent=m.code+' · Nivel '+m.level+' · PV '+Number(m.hp).toLocaleString('es-CL')+' · Escudo '+Number(m.shield).toLocaleString('es-CL');};}else b.disabled=true;board.append(b);}
  const panel=el('div','gg-cbs-panel');panel.append(board,info);return panel;
 }
 function builder({inventory,catalog,enabled,onBuild}){
  let slots=Array(10).fill(null),selected=null;const panel=el('div','gg-cbs-panel'),stock=el('div','gg-cbs-stock'),board=layout(),hint=el('p','gg-cbs-hint'),counter=el('p','gg-cbs-count'),minutes=el('input');minutes.type='number';minutes.min='5';minutes.max='60';minutes.step='1';minutes.value='5';minutes.setAttribute('aria-label','Minutos de construcción');
  const build=el('button','gg-cbs-build','CONSTRUIR ESTACIÓN');build.type='button';
  const reset=el('button',null,'Vaciar configuración');reset.type='button';reset.onclick=()=>{slots=Array(10).fill(null);selected=null;paint();};
  function assign(id,i){const next=place(slots,inventory,id,i,catalog);if(!next){hint.textContent='Módulo incompatible o único duplicado.';return;}slots=next;selected=null;paint();}
  function paint(){
   stock.replaceChildren();for(const item of inventory){if(slots.includes(item.instanceId))continue;const b=el('button','gg-cbs-stock-item');b.type='button';b.append(tile(item));b.title=specs[item.code]?.[0]||item.code;b.draggable=true;b.setAttribute('aria-pressed',String(selected===item.instanceId));b.onclick=()=>{selected=selected===item.instanceId?null:item.instanceId;paint();};b.ondragstart=e=>{selected=item.instanceId;e.dataTransfer.setData('text/plain',item.instanceId);e.dataTransfer.effectAllowed='move';for(const n of board.querySelectorAll('button'))n.dataset.valid=String(allows(item.code,Number(n.dataset.slot),catalog));};stock.append(b);}
   if(!stock.children.length)stock.append(el('p',null,'No quedan módulos disponibles.'));
   board.querySelectorAll('button').forEach(n=>n.remove());const selectedItem=inventory.find(x=>x.instanceId===selected);
   for(let i=0;i<10;i++){const b=slotNode(i),item=inventory.find(x=>x.instanceId===slots[i]);b.dataset.slot=String(i);b.dataset.valid=String(!!selectedItem&&allows(selectedItem.code,i,catalog));b.setAttribute('aria-label',slotLabel(i)+(item?' · '+item.code+' · pulsar para retirar o mover':' · vacía'));b.append(item?tile(item):el('span','gg-cbs-empty',slotLabel(i)));b.onclick=()=>{if(selected){assign(selected,i);}else if(item){slots[i]=null;paint();}};b.ondragover=e=>{if(selected&&allows(inventory.find(x=>x.instanceId===selected)?.code,i,catalog))e.preventDefault();};b.ondrop=e=>{e.preventDefault();assign(e.dataTransfer.getData('text/plain'),i);};if(item){b.draggable=true;b.ondragstart=e=>{selected=item.instanceId;e.dataTransfer.setData('text/plain',item.instanceId);e.dataTransfer.effectAllowed='move';for(const n of board.querySelectorAll('button'))n.dataset.valid=String(allows(item.code,Number(n.dataset.slot),catalog));};}board.append(b);}
   counter.textContent=slots.filter(Boolean).length+' / 10 módulos instalados';hint.textContent=selectedItem?'Selecciona o arrastra a una ranura compatible.':'Arrastra un módulo o selecciónalo y pulsa una ranura. Pulsa un módulo instalado para retirarlo.';build.disabled=!enabled||!complete(slots,inventory,catalog)||!minutes.checkValidity();
  }
  stock.ondragover=e=>{if(selected)e.preventDefault();};stock.ondrop=e=>{e.preventDefault();const i=slots.indexOf(e.dataTransfer.getData('text/plain'));if(i>=0)slots[i]=null;selected=null;paint();};
  panel.ondragend=()=>{selected=null;paint();};minutes.oninput=()=>{build.disabled=!enabled||!complete(slots,inventory,catalog)||!minutes.checkValidity();};build.onclick=()=>{if(enabled&&complete(slots,inventory,catalog)&&minutes.checkValidity())onBuild({moduleIds:slots.slice(),minutes:Number(minutes.value)});};
  const controls=el('div','gg-cbs-controls');controls.append(el('label',null,'Minutos (5–60)'),minutes,reset,build);panel.append(el('h3',null,'Inventario de módulos'),stock,el('h3',null,'Plano de estación'),board,counter,hint,controls);paint();return panel;
 }
 const palette={hull:'#c5ccd4',shield:'#60a9ef',repair:'#60db9e',honor:'#e6c069',xp:'#ab89e9',damage:'#f18061','laser-a':'#f46b66','laser-b':'#f0a84c','laser-c':'#81d5f4','rocket-a':'#d7be98','rocket-b':'#bcdf83'};
 const sprites=new Map();
 function sprite(code){
  if(sprites.has(code))return sprites.get(code);const spec=specs[code];if(!spec||!root.Path2D||!root.document)return null;
  const canvas=root.document.createElement('canvas');canvas.width=canvas.height=64;const c=canvas.getContext('2d');if(!c)return null;
  c.fillStyle='#263747';c.strokeStyle='#a4b4c5';c.lineWidth=2.5;c.lineJoin='round';const shell=new root.Path2D(spec[2]);c.fill(shell);c.stroke(shell);c.fillStyle=palette[spec[1]];c.strokeStyle='#0c1520';c.lineWidth=1;const detail=new root.Path2D(spec[3]);c.fill(detail);c.stroke(detail);sprites.set(code,canvas);return canvas;
 }
 function drawStation(ctx,modules,color){
  ctx.save();ctx.fillStyle='#182531';ctx.strokeStyle='#7f93a4';ctx.lineWidth=4;ctx.beginPath();ctx.arc(0,0,54,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.lineWidth=2;ctx.strokeStyle=color;ctx.beginPath();ctx.arc(0,0,43,0,Math.PI*2);ctx.stroke();
  for(let slot=0;slot<10;slot++){const m=modules.find(x=>x.slot===slot),angle=(slot-2)*Math.PI/4-Math.PI/2,x=slot<2?(slot===0?-17:17):Math.cos(angle)*62,y=slot<2?0:Math.sin(angle)*62,size=slot<2?34:28;ctx.save();ctx.translate(x,y);if(m?.hp<=0)ctx.globalAlpha=.35;ctx.fillStyle='#17212d';ctx.strokeStyle='#77899a';ctx.lineWidth=2;ctx.fillRect(-size/2,-size/2,size,size);ctx.strokeRect(-size/2,-size/2,size,size);const img=m&&sprite(m.code);if(img)ctx.drawImage(img,-size/2,-size/2,size,size);ctx.restore();}
  ctx.restore();
 }
 const api={specs,allows,place,complete,art,builder,installed,drawStation};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ggCBSVisual=api;
})(typeof globalThis!=='undefined'?globalThis:this);
