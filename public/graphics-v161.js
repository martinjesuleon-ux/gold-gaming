'use strict';
// Original vector artwork, cached once per palette and device pixel ratio.
(function(root){
 const cache=new Map();
 function path(c,points,fill,stroke,width=1){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}}
 function gradient(c,y,stops){const g=c.createLinearGradient(0,-y,0,y);for(const [offset,color] of stops)g.addColorStop(offset,color);return g;}
 function engine(c,x,y,color){const g=c.createRadialGradient(x,y,0,x,y,15);g.addColorStop(0,'#ffffff');g.addColorStop(.18,color);g.addColorStop(.5,color+'66');g.addColorStop(1,color+'00');c.fillStyle=g;c.fillRect(x-15,y-15,30,30);}
 function vessel(c,kind,color){
  const armor=gradient(c,30,[[0,'#a8b5c8'],[.19,'#364453'],[.46,'#111926'],[.51,'#526474'],[.76,'#1e2936'],[1,'#080d17']]);
  const inset=gradient(c,20,[[0,color],[.4,'#172737'],[.68,'#0b111a'],[1,color]]);
  if(kind==='scout'){
   for(const side of [-1,1]){path(c,[[20,5*side],[-4,10*side],[-21,30*side],[-27,24*side],[-13,8*side],[-24,5*side]],armor,'#6e8193');path(c,[[11,7*side],[-8,12*side],[-22,26*side],[-18,16*side],[-9,5*side]],inset,color,.65);path(c,[[-19,12*side],[-27,18*side],[-31,14*side],[-26,9*side]],'#26333c','#91a1ae');engine(c,-28,13*side,color);}
   path(c,[[36,0],[13,-7],[-8,-10],[-22,-5],[-26,0],[-22,5],[-8,10],[13,7]],armor,'#a1b1bc');path(c,[[30,0],[9,-4],[-8,-5],[-3,0],[-8,5],[9,4]],inset,color,.8);path(c,[[14,0],[1,-3],[-4,0],[1,3]],'#d8fff6',color,.6);
  }else if(kind==='tank'){
   for(const side of [-1,1]){path(c,[[26,7*side],[16,19*side],[-5,28*side],[-24,20*side],[-25,10*side],[-8,8*side]],armor,'#8293a4');path(c,[[20,10*side],[9,19*side],[-9,23*side],[-15,15*side],[0,10*side]],inset,color,.7);engine(c,-24,16*side,color);}
   path(c,[[33,0],[19,-10],[-12,-13],[-26,-7],[-27,0],[-26,7],[-12,13],[19,10]],armor,'#a3b0b9');path(c,[[23,0],[7,-6],[-12,-5],[-7,0],[-12,5],[7,6]],inset,color);path(c,[[13,0],[2,-3],[-3,0],[2,3]],'#e6faff');
  }else{
   for(const side of [-1,1]){path(c,[[22,5*side],[10,17*side],[-3,29*side],[-19,25*side],[-25,16*side],[-12,5*side]],armor,color);path(c,[[11,12*side],[-3,23*side],[-17,20*side],[-12,12*side]],inset,color,.8);path(c,[[1,19*side],[-10,30*side],[-21,24*side]],'#101b2d',color,.8);engine(c,-22,19*side,color);}
   path(c,[[29,0],[17,-10],[-6,-13],[-20,-8],[-15,0],[-20,8],[-6,13],[17,10]],armor,color);path(c,[[22,0],[4,-8],[-9,0],[4,8]],inset,color);path(c,[[12,0],[2,-4],[-3,0],[2,4]],'#e7f5ff',color,.6);
  }
 }
 function drone(c,color){engine(c,-7,0,color);path(c,[[10,0],[2,-6],[-7,-7],[-10,-2],[-6,0],[-10,2],[-7,7],[2,6]],gradient(c,7,[[0,'#a9b1c0'],[.25,'#394454'],[.5,'#101724'],[1,'#536070']]),color,.9);path(c,[[6,0],[0,-3],[-5,0],[0,3]],color,'#f2e5e5',.4);}
 function pet(c,color){engine(c,-10,0,color);for(const side of [-1,1])path(c,[[12,4*side],[-2,12*side],[-13,8*side],[-7,3*side]],'#213c54',color);path(c,[[18,0],[4,-6],[-10,-4],[-13,0],[-10,4],[4,6]],gradient(c,8,[[0,'#9db5cc'],[.5,'#19364b'],[1,'#344e62']]),color);path(c,[[9,0],[1,-3],[-4,0],[1,3]],'#f7ce70');}
 function npcStyle(name,type){
  const raw=String(name||'').toLowerCase().trim(),tier=/^uber[- ]/.test(raw)?'uber':/^emperor[- ]/.test(raw)?'emperor':/^boss\b/.test(raw)||type==='boss'?'boss':'normal';
  const n=raw.replace(/^(boss|uber|emperor)[- ]+/,'');
  let family='alien',color='#ff795f';
  if(n.startsWith('kristall')){family='crystal';color='#46a7ff';}
  else if(n.startsWith('streuner')||n.startsWith('interceptor')){family='scout-npc';color='#dbaa72';}
  else if(n.startsWith('lordakia')||n.startsWith('lordakium')){family='claw';color='#b898e8';}
  else if(n.startsWith('saimon')||n.startsWith('sibelonit')){family='wing';color='#e19b58';}
  else if(n.startsWith('mordon')||n.startsWith('devolarium')||n.startsWith('sibelon')){family='armor';color='#79b694';}
  else if(n.startsWith('cubikon')){family='cube';color='#e8c36e';}
  else if(/^(vagrant|marauder|barracuda|saboteur|annihilator|deadly battleray)/.test(n)){family='pirate';color='#d88956';}
  if(tier==='uber')color='#b77bff';else if(tier==='emperor')color='#ffd077';else if(tier==='boss'&&family!=='crystal')color='#70a7ff';
  return {kind:family,color,tier};
 }
 function npcHull(c,kind,color){
  const armor=gradient(c,28,[[0,'#acb8c7'],[.26,'#344758'],[.5,'#0c1521'],[.7,'#536678'],[1,'#172233']]);
  const energy=gradient(c,25,[[0,color],[.3,'#193347'],[.55,'#08131f'],[1,color]]);
  const shapes={
   crystal:[[32,0],[15,-11],[8,-29],[-2,-20],[-17,-31],[-23,-17],[-13,0],[-23,17],[-17,31],[-2,20],[8,29],[15,11]],
   'scout-npc':[[32,0],[10,-6],[-12,-22],[-22,-18],[-11,-5],[-28,0],[-11,5],[-22,18],[-12,22],[10,6]],
   claw:[[28,0],[18,-12],[24,-28],[7,-23],[-7,-11],[-25,-19],[-18,0],[-25,19],[-7,11],[7,23],[24,28],[18,12]],
   wing:[[28,0],[5,-8],[-10,-29],[-29,-23],[-20,-6],[-15,0],[-20,6],[-29,23],[-10,29],[5,8]],
   armor:[[27,0],[18,-19],[-3,-28],[-23,-20],[-29,-9],[-29,9],[-23,20],[-3,28],[18,19]],
   cube:[[25,-25],[31,-16],[31,16],[25,25],[-25,25],[-31,16],[-31,-16],[-25,-25]],
   pirate:[[31,0],[13,-14],[-3,-18],[-14,-28],[-25,-19],[-17,-6],[-30,0],[-17,6],[-25,19],[-14,28],[-3,18],[13,14]]
  };
  engine(c,-23,0,color);path(c,shapes[kind],armor,color,1.2);
  for(const side of [-1,1]){
   if(kind==='crystal'){path(c,[[12,8*side],[8,27*side],[-3,16*side],[-16,29*side],[-19,15*side],[-6,4*side]],energy,color,.9);path(c,[[8,24*side],[-2,15*side],[-6,9*side]],'#a8dfff',color,.5);}
   else if(kind==='cube'){path(c,[[23,5*side],[23,21*side],[-23,21*side],[-23,5*side]],energy,color,.7);for(const x of [-15,0,15])path(c,[[x-4,10*side],[x+4,10*side],[x+4,15*side],[x-4,15*side]],color);}
   else{path(c,[[13,6*side],[-2,15*side],[-15,20*side],[-18,10*side],[-8,4*side]],energy,color,.75);path(c,[[2,10*side],[-7,14*side],[-11,9*side]],color);}
  }
  path(c,[[23,0],[7,-8],[-10,-7],[-15,0],[-10,7],[7,8]],'#111c2a',color,1);path(c,[[15,0],[2,-4],[-6,0],[2,4]],color,'#e0f5ff',.65);
 }
 function sprite(kind,color){const dpr=Math.min(2,Math.max(1,root.devicePixelRatio||1)),key=kind+':'+color+':'+dpr;if(cache.has(key))return cache.get(key);const size=kind==='drone'?42:kind==='pet'?62:112,canvas=root.document.createElement('canvas');canvas.width=canvas.height=size*dpr;const c=canvas.getContext('2d');c.scale(dpr,dpr);c.translate(size/2,size/2);if(kind==='drone')drone(c,color);else if(kind==='pet')pet(c,color);else if(['crystal','scout-npc','claw','wing','armor','cube','pirate'].includes(kind))npcHull(c,kind,color);else vessel(c,kind,color);const value={canvas,size};if(cache.size>=64)cache.clear();cache.set(key,value);return value;}
 function draw(c,kind,color){const s=sprite(kind,color);c.drawImage(s.canvas,-s.size/2,-s.size/2,s.size,s.size);}
 function portal(c,color,t){
  const center=c.createRadialGradient(0,0,3,0,0,46);center.addColorStop(0,'#03060d');center.addColorStop(.45,'#0b1625');center.addColorStop(.78,color+'24');center.addColorStop(1,color+'00');c.fillStyle=center;c.beginPath();c.arc(0,0,46,0,Math.PI*2);c.fill();
  c.save();c.rotate(t/6000);for(let i=0;i<8;i++){c.save();c.rotate(i*Math.PI/4);path(c,[[37,-10],[46,-7],[49,0],[46,7],[37,10],[34,5],[34,-5]],gradient(c,10,[[0,'#8494a6'],[.5,'#17232f'],[1,'#384857']]),'#657b90',.7);path(c,[[39,-3],[44,-3],[46,0],[44,3],[39,3]],color);c.restore();}c.restore();
  c.strokeStyle=color;c.lineWidth=2.5;c.beginPath();c.arc(0,0,33,0,Math.PI*2);c.stroke();c.save();c.rotate(-t/1700);for(let i=0;i<3;i++){c.strokeStyle=color;c.lineWidth=3;c.beginPath();c.arc(0,0,27,i*2.094,i*2.094+1.15);c.stroke();}c.restore();
 }
 const droneColors=Object.freeze({Havoc:'#ff3838',Hercules:'#398dff',Spartan:'#ff8a24'});
 function droneColor(design){return Object.hasOwn(droneColors,design)?droneColors[design]:'#aab4bd';}
 root.ggGraphics161={draw,portal,droneColor,npcStyle};
})(window);
