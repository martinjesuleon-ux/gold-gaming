'use strict';
(function(root){
 const SVG='http://www.w3.org/2000/svg';
 const $=id=>document.getElementById(id);
 const coordinates=Object.freeze({
  '3-1':[92,64],'3-2':[165,105],'3-3':[165,190],'3-4':[247,147],
  '2-1':[43,310],'2-2':[116,310],'2-3':[190,350],'2-4':[190,268],
  '1-1':[92,555],'1-2':[165,510],'1-3':[165,425],'1-4':[247,470],
  '4-3':[350,178],'4-2':[305,310],'4-1':[350,442],
  '4-5':[515,70],'5-1':[515,190],'5-2':[515,310],'5-3':[515,430],'4-4':[515,552],
  '3-5':[716,125],'3-6':[814,65],'3-7':[814,185],'3-8':[912,125],
  '2-5':[716,310],'2-6':[814,250],'2-7':[814,370],'2-8':[912,310],
  '1-5':[716,495],'1-6':[814,435],'1-7':[814,555],'1-8':[912,495]
 });
 const names={1:'MMO',2:'EIC',3:'VRU',0:'Sector neutral'};
 function radius(id){return ['4-4','4-5','5-1','5-3'].includes(id)?39:30;}
 function svg(tag,attrs={},label){const n=document.createElementNS(SVG,tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,String(v));if(label!==undefined)n.textContent=label;return n;}
 function hex(x,y,r){return Array.from({length:6},(_,i)=>{const a=i*Math.PI/3;return (x+Math.cos(a)*r)+','+(y+Math.sin(a)*r);}).join(' ');}
 function nodePositions(maps){return new Map(maps.map((m,i)=>[m.id,coordinates[m.id]||[80+(i%10)*84,600+Math.floor(i/10)*70]]));}
 function directRoute(data,id){return data.links.find(r=>r.from===data.current&&r.to===id)||null;}
 const dialog=$('gg171-star-dialog'),chart=$('gg171-chart'),status=$('gg171-status'),info=$('gg171-selection'),travel=$('gg171-travel'),current=$('gg171-current'),open=$('gg171-open');
 if(!dialog||!chart||!open)return;
 let data=null,selected=null,generation=0;
 function select(id){
  selected=id;
  for(const n of chart.querySelectorAll('[data-sector]')){const active=n.dataset.sector===id;n.classList.toggle('selected',active);n.setAttribute('aria-pressed',String(active));}
  const m=data?.maps.find(x=>x.id===id),route=data&&directRoute(data,id);
  travel.disabled=true;
  if(!m){info.textContent='Selecciona un sector';return;}
  const name=names[m.company]||names[0],type=m.base?' · Base':m.pvp?' · PvP':'';
  if(data.current===id){info.textContent=id+' · '+name+type+' · Sector actual';return;}
  if(data.insideGate||!data.current){info.textContent=id+' · '+name+type+' · Sal del evento para navegar';return;}
  if(!route){info.textContent=id+' · '+name+type+' · Sin portal directo desde '+data.current;return;}
  info.textContent=id+' · '+name+type+' · Nivel requerido '+route.level+(data.level<route.level?' · Bloqueado':' · Portal disponible');
  travel.disabled=data.level<route.level;
 }
 function render(){
  chart.replaceChildren();
  const pos=nodePositions(data.maps),ids=new Set(data.maps.map(m=>m.id));
  const defs=svg('defs');
  for(const [company,color] of [[0,'#526d8a'],[1,'#ad4c42'],[2,'#377fbc'],[3,'#428a63']]){
   const g=svg('radialGradient',{id:'gg171-fill-'+company,cx:'.35',cy:'.25',r:'.85'});
   g.append(svg('stop',{offset:'0%', 'stop-color':color}),svg('stop',{offset:'58%','stop-color':'#162531'}),svg('stop',{offset:'100%','stop-color':'#060b14'}));defs.append(g);
  }
  const arrow=svg('marker',{id:'gg171-arrow',viewBox:'0 0 10 10',refX:8,refY:5,markerWidth:5,markerHeight:5,orient:'auto-start-reverse'});arrow.append(svg('path',{d:'M 0 0 L 10 5 L 0 10 z',fill:'context-stroke'}));defs.append(arrow);chart.append(defs);
  const links=svg('g',{'aria-hidden':'true',class:'gg171-links'});
  const seen=new Set();
  for(const r of data.links){
   if(!ids.has(r.from)||!ids.has(r.to))continue;
   const key=[r.from,r.to].sort().join('|');if(seen.has(key))continue;seen.add(key);
   const [x1,y1]=pos.get(r.from),[x2,y2]=pos.get(r.to),len=Math.hypot(x2-x1,y2-y1);if(len<1)continue;
   const ux=(x2-x1)/len,uy=(y2-y1)/len,reverse=data.links.some(a=>a.from===r.to&&a.to===r.from);
   const outgoing=r.from===data.current||reverse&&r.to===data.current;
   const line=svg('line',{x1:x1+ux*(radius(r.from)+2),y1:y1+uy*(radius(r.from)+2),x2:x2-ux*(radius(r.to)+2),y2:y2-uy*(radius(r.to)+2),class:outgoing?'route-active':'route','marker-end':'url(#gg171-arrow)'});
   if(reverse)line.setAttribute('marker-start','url(#gg171-arrow)');links.append(line);
  }
  chart.append(links);
  for(const m of data.maps){
   const [x,y]=pos.get(m.id),r=radius(m.id),route=directRoute(data,m.id);
   const node=svg('g',{class:'gg171-sector'+(m.id===data.current?' current':'')+(route&&data.level<route.level?' locked':''),tabindex:0,role:'button','aria-label':'Sector '+m.id+' '+(names[m.company]||names[0]),'aria-pressed':'false','data-sector':m.id});
   node.append(svg('title',{},'Sector '+m.id+(route?' · Nivel '+route.level:'')),svg('polygon',{points:hex(x,y,r+5),class:'gg171-outline'}),svg('polygon',{points:hex(x,y,r),fill:'url(#gg171-fill-'+(m.company||0)+')',class:'gg171-hex'}));
   for(let i=0;i<6;i++){const a=i*2.399+x*.03,rr=r*(.22+(i%3)*.16);node.append(svg('circle',{cx:x+Math.cos(a)*rr,cy:y+Math.sin(a)*rr,r:i%2?.65:1.1,fill:'#deebff',opacity:'.44','pointer-events':'none'}));}
   node.append(svg('text',{x,y:y+4,class:'gg171-id','pointer-events':'none'},m.id));
   node.addEventListener('click',()=>select(m.id));node.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();select(m.id);}});chart.append(node);
  }
  current.textContent='Sector actual: '+(data.current||'Evento')+' · Nivel '+data.level;
  select(data.maps.some(m=>m.id===selected)?selected:data.current);
 }
 async function refresh(){
  const token=++generation;travel.disabled=true;status.textContent='Consultando rutas del servidor…';
  try{const response=await root.gg171StarMap();if(token!==generation||!dialog.open)return;data=response;render();status.textContent='Selecciona un sector. Las flechas indican los sentidos de tránsito.';}
  catch(e){if(token!==generation||!dialog.open)return;data=null;chart.replaceChildren();current.textContent='Sector actual: —';info.textContent='Sin datos';status.textContent=e.message;}
 }
 open.addEventListener('click',()=>{dialog.dataset.theme=root.ggVisualTheme?.current()||'gold';if(!dialog.open){dialog.showModal();selected=null;data=null;chart.replaceChildren();current.textContent='Sector actual: —';info.textContent='Selecciona un sector';}refresh();});
 $('gg171-close').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('close',()=>{generation++;open.focus();});
 dialog.addEventListener('keydown',e=>e.stopPropagation());
 travel.addEventListener('click',()=>{if(!data||travel.disabled)return;try{status.textContent=root.gg171TravelSector(selected);dialog.close();}catch(e){status.textContent=e.message;refresh();}});
 root.addEventListener('gg171:sectorChanged',()=>{if(dialog.open)refresh();});
})(window);
