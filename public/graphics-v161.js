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
 const droneHulls=Object.freeze({
 flax:[[9,0],[3,-5],[-6,-5],[-10,0],[-6,5],[3,5]],
 iris:[[11,0],[3,-7],[-7,-8],[-10,-3],[-5,0],[-10,3],[-7,8],[3,7]],
 apis:[[12,0],[4,-5],[0,-10],[-9,-8],[-12,-3],[-6,0],[-12,3],[-9,8],[0,10],[4,5]],
 zeus:[[13,0],[7,-6],[-2,-11],[-10,-10],[-13,-5],[-8,0],[-13,5],[-10,10],[-2,11],[7,6]]
 });
 function droneKind(code){return Object.hasOwn(droneHulls,code)?'drone-'+code:'drone';}
 function drone(c,color,kind){
  const code=kind.slice(6),hull=droneHulls[code]||droneHulls.iris;
  const metal=gradient(c,11,[[0,'#c1ccd5'],[.25,'#506477'],[.55,'#18232f'],[1,'#627282']]);
  const core=gradient(c,5,[[0,color],[.5,'#243745'],[1,color]]);
  engine(c,-8,0,color);path(c,hull,metal,color,.8);
  for(const side of [-1,1]){
   const y=(code==='zeus'||code==='apis'?8:5)*side;
   path(c,[[3,2*side],[-2,y],[-7,y*.8],[-5,2*side]],'#263846',color,.6);
   if(code==='zeus'||code==='apis')path(c,[[-1,y],[-6,y],[-5,y*.65]],color);
  }
  path(c,[[7,0],[0,-3],[-5,0],[0,3]],core,color,.6);
  path(c,[[5,0],[0,-1.5],[-2,0],[0,1.5]],color);
 }
 function pet(c,color){
  const metal=gradient(c,13,[[0,'#a8c0d1'],[.28,'#486579'],[.56,'#122232'],[1,'#627b8e']]);
  for(const side of [-1,1]){
   engine(c,-10,7*side,color);
   path(c,[[13,4*side],[2,13*side],[-9,13*side],[-17,7*side],[-7,3*side]],metal,'#82a2b4',.8);
   path(c,[[8,6*side],[1,10*side],[-9,10*side],[-12,7*side]],'#1a384a',color,.65);
   path(c,[[-10,5*side],[-6,5*side],[-6,9*side],[-10,9*side]],color);
  }
  path(c,[[21,0],[8,-7],[-8,-6],[-15,-3],[-15,3],[-8,6],[8,7]],metal,'#b3cad9',.9);
  path(c,[[15,0],[4,-4],[-5,-3],[-9,0],[-5,3],[4,4]],'#16374d',color,.7);
  path(c,[[9,0],[2,-2.5],[-3,0],[2,2.5]],'#f7ce70','#fff2ba',.5);
 }
 function npcStyle(name,type){
  const raw=String(name||'').toLowerCase().trim(),tier=/^uber[- ]/.test(raw)?'uber':/^emperor[- ]/.test(raw)?'emperor':/^boss\b/.test(raw)||type==='boss'?'boss':'normal';
  const n=raw.replace(/^(boss|uber|emperor)[- ]+/,'');
  // StreuneR (capital final R) is a separate NPC in the catalog; leave it and all elites unchanged.
  if(String(name||'').trim()==='Streuner'&&tier==='normal')return {kind:'streuner-original',color:'#b94c3e',tier};
  if(root.ggVisualTheme?.current()==='classic'&&root.ggClassicArt?.alien&&tier==='normal'){
   if(n==='lordakia')return {kind:'classic-lordakia',color:'#4c9d45',tier};
   if(n==='saimon')return {kind:'classic-saimon',color:'#77899d',tier};
  }
  const classicSpecies=Object.hasOwn({kristallin:1,kristallon:1,mordon:1,devolarium:1,cubikon:1},n);
  if(root.ggVisualTheme?.current()==='classic'&&root.ggClassicArt?.largeAlien&&classicSpecies){
   const palette={kristallin:'#62b9e7',kristallon:'#5c98df',mordon:'#b3a78a',devolarium:'#a47551',cubikon:'#d7b96a'};
   return {kind:'classic-'+n+(tier==='normal'?'':'-'+tier),color:tier==='uber'?'#b77bff':tier==='emperor'?'#ffd077':tier==='boss'?'#70a7ff':palette[n],tier};
  }
  const classicRaiders={sibelon:'#be9b75',sibelonit:'#ac8758',lordakium:'#9e83b4',interceptor:'#8fb5ba',vagrant:'#8e776c',marauder:'#b87b56',barracuda:'#71949d',saboteur:'#a198c7',annihilator:'#b85c52','deadly battleray':'#d9a86b'};
  if(root.ggVisualTheme?.current()==='classic'&&root.ggClassicArt?.raider&&Object.hasOwn(classicRaiders,n)){
   return {kind:'classic-'+n.replaceAll(' ','-')+(tier==='normal'?'':'-'+tier),color:tier==='uber'?'#b77bff':tier==='emperor'?'#ffd077':tier==='boss'?'#70a7ff':classicRaiders[n],tier};
  }
  let family='alien',color='#ff795f';
  if(n.startsWith('kristall')){family='crystal';color='#46a7ff';}
  else if(n.startsWith('streuner')||n.startsWith('interceptor')){family='scout-npc';color='#dbaa72';}
  else if(n.startsWith('lordakia')||n.startsWith('lordakium')){family='claw';color='#b898e8';}
  else if(n.startsWith('saimon')||n.startsWith('sibelonit')){family='wing';color='#e19b58';}
  else if(n.startsWith('mordon')||n.startsWith('devolarium')||n.startsWith('sibelon')){family='armor';color='#79b694';}
  else if(n.startsWith('cubikon')){family='cube';color='#e8c36e';}
  else if(/^(vagrant|marauder|barracuda|saboteur|annihilator|deadly battleray)/.test(n)){family='pirate';color='#d88956';}
  if(tier==='uber')color='#b77bff';else if(tier==='emperor')color='#ffd077';else if(tier==='boss'&&family!=='crystal')color='#70a7ff';
  return {kind:family==='crystal'&&tier!=='normal'?'crystal-elite':family,color,tier};
 }
 // Original layered mechanical raider, drawn at the existing Streuner sprite scale.
 function streunerHull(c,color){
  const steel=gradient(c,25,[[0,'#c1c5ba'],[.18,'#777d78'],[.36,'#30383b'],[.53,'#141b20'],[.72,'#777a71'],[1,'#24282a']]);
  const red=gradient(c,24,[[0,'#e99b80'],[.20,'#a94837'],[.43,'#67251e'],[.55,'#291718'],[.78,'#a63d32'],[1,'#481a1c']]);
  const dark=gradient(c,21,[[0,'#68716d'],[.22,'#222b2f'],[.65,'#0a1116'],[1,'#3b4241']]);
  // Rear engine assembly and asymmetric-looking tiered silhouette (nose points right).
  for(const side of [-1,1]){
   const y=side*14;
   path(c,[[-28,y-5],[-20,y-7],[-7,y-6],[7,y-3],[11,y+2],[2,y+7],[-21,y+8],[-28,y+4]],dark,'#6b625e',.7);
   for(let i=0;i<4;i++){const x=-26+i*5;path(c,[[x,y-4],[x+2.5,y-4],[x+3,y+4],[x,y+4]],steel,'#11191c',.4);}
   path(c,[[-27,side*12],[-16,side*12],[-16,side*9],[-27,side*9]],'#151a1d','#87655b',.5);
   path(c,[[-18,side*17],[-7,side*24],[3,side*23],[13,side*14],[2,side*10]],red,'#c16c56',.6);
   path(c,[[-7,side*24],[-1,side*20],[6,side*16],[3,side*23]],'#bd7a60','#5c322c',.4);
  }
  path(c,[[-31,2],[-23,-7],[-11,-11],[5,-11],[14,-9],[23,-5],[33,-2],[28,3],[15,7],[7,12],[-17,12],[-27,7]],dark,'#756b61',.85);
  // Upper armor decks and offset sensor bridge.
  path(c,[[-24,-3],[-16,-12],[0,-15],[10,-13],[16,-8],[31,-5],[33,-1],[19,2],[8,-3],[-9,-3]],red,'#d17860',.8);
  path(c,[[-17,-13],[-9,-18],[7,-18],[14,-15],[17,-10],[3,-10],[-8,-12]],steel,'#827f72',.7);
  path(c,[[-5,-19],[5,-22],[15,-21],[17,-17],[13,-14],[-6,-14]],dark,'#89867b',.7);
  path(c,[[1,-20],[10,-21],[13,-19],[13,-16],[2,-16]],steel,'#9e9c8f',.45);
  path(c,[[15,-17],[22,-14],[31,-8],[24,-7],[16,-10]],red,'#c56550',.55);
  path(c,[[10,-10],[20,-9],[32,-5],[28,-4],[19,-6]],'#642622','#d06d55',.5);
  // Main layered armor, silver ribs and inset black intake.
  path(c,[[-26,2],[-16,-5],[1,-6],[16,0],[10,6],[-2,8],[-20,8]],red,'#c1856b',.8);
  path(c,[[-21,1],[-12,-2],[2,-2],[11,1],[4,4],[-13,4]],steel,'#1b2325',.6);
  path(c,[[-21,6],[-11,4],[1,5],[8,9],[-7,13],[-20,12]],dark,'#a08b79',.55);
  path(c,[[7,7],[17,7],[22,3],[29,3],[19,10],[9,12]],red,'#945347',.6);
  for(const y of [-16,-12,6,10])for(let i=0;i<4;i++){const x=-8+i*4;path(c,[[x,y],[x+2.4,y-.3],[x+2.4,y+1.6],[x,y+2]],'#aeb3a6','#383f3d',.35);}
  for(let i=0;i<5;i++){const x=-22+i*4;path(c,[[x,8],[x+1.8,8],[x+2,10],[x,10]],'#5a625f','#13191b',.35);}
  path(c,[[10,-4],[20,-3],[25,-1],[17,0],[10,-1]],'#11181b','#93766a',.45);
  path(c,[[12,-3],[20,-2.5],[23,-1.5],[16,-1]],'#e4b8a2');
  path(c,[[-30,1],[-27,0],[-27,3],[-30,4]],'#b86b50');
  for(const [x,y] of [[-15,-7],[-5,-10],[7,-13],[12,12],[-19,5]]){c.fillStyle='#e2c5a4';c.fillRect(x,y,1.5,1.1);}
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
  if(kind==='cube'){
   // Isometric armored cube: distinct from the aircraft silhouettes.
   const top=[[0,-32],[30,-16],[0,0],[-30,-16]],left=[[-30,-16],[0,0],[0,32],[-30,16]],right=[[0,0],[30,-16],[30,16],[0,32]];
   path(c,top,'#617587','#9baebf',1);path(c,left,'#293849','#899daf',1);path(c,right,'#14212f','#899daf',1);
   for(const side of [-1,1]){path(c,[[side*4,5],[side*25,-7],[side*25,13],[side*4,25]],'#384c60',color,.8);path(c,[[side*8,8],[side*21,1],[side*21,10],[side*8,17]],'#101c29',color,.6);}
   path(c,[[0,-26],[19,-16],[0,-6],[-19,-16]],energy,color,1);path(c,[[0,-23],[12,-16],[0,-9],[-12,-16]],color,'#e6eef7',.7);
   return;
  }
  const elite=kind==='crystal-elite';if(elite)kind='crystal';
  engine(c,-23,0,color);path(c,shapes[kind],armor,color,1.2);
  if(elite)for(const side of [-1,1]){
   path(c,[[19,9*side],[14,34*side],[3,41*side],[-2,24*side],[-16,37*side],[-28,28*side],[-22,13*side]],armor,color,1);
   path(c,[[14,31*side],[3,39*side],[3,23*side]],energy,color,.8);
   path(c,[[-16,34*side],[-26,27*side],[-19,18*side]],color,'#c1e5ff',.5);
  }
  for(const side of [-1,1]){
   if(kind==='crystal'){path(c,[[12,8*side],[8,27*side],[-3,16*side],[-16,29*side],[-19,15*side],[-6,4*side]],energy,color,.9);path(c,[[8,24*side],[-2,15*side],[-6,9*side]],'#a8dfff',color,.5);}
   else if(kind==='armor'){path(c,[[16,9*side],[5,22*side],[-14,23*side],[-23,13*side],[-11,7*side]],armor,color,.8);for(const x of [-14,-6,2])path(c,[[x,14*side],[x+3,14*side],[x+3,18*side],[x,18*side]],color);}
   else{path(c,[[13,6*side],[-2,15*side],[-15,20*side],[-18,10*side],[-8,4*side]],energy,color,.75);path(c,[[2,10*side],[-7,14*side],[-11,9*side]],color);}
  }
  path(c,[[23,0],[7,-8],[-10,-7],[-15,0],[-10,7],[7,8]],'#111c2a',color,1);path(c,[[15,0],[2,-4],[-6,0],[2,4]],color,'#e0f5ff',.65);
 }
 // Original player hull profiles, independent of equipment and combat parameters.
 const shipProfiles=Object.freeze({
 phoenix:[30,13,18,9,0],yamato:[31,19,20,12,1],defcom:[29,20,23,10,2],
 liberator:[32,23,18,13,1],piranha:[34,18,25,8,2],nostromo:[29,24,21,15,3],
 bigboy:[28,30,24,19,3],leonov:[33,20,17,10,4],vengeance:[37,23,28,8,2],
 goliath:[33,30,25,15,4],spearhead:[40,17,24,7,0],aegis:[29,27,25,17,1],citadel:[30,32,28,22,3]
 });
 const designColors=Object.freeze({Diminisher:'#e36c45',Sentinel:'#5a93e7',Solace:'#69d8c1',Spectrum:'#aa83ee',Venom:'#87e363',Lightning:'#f5c349',Bastion:'#4798ec',Enforcer:'#f05b51',Centaur:'#eab671',Exalted:'#e2d5b2',Veteran:'#7ab9c4',Goal:'#73d58c',Referee:'#e5e7ec',Kick:'#e4954f',Revenge:'#ef7056',Avenger:'#71c0ff',Saturn:'#d6b2ee','aegis-veteran':'#72b4c9','aegis-elite':'#e9bd67','citadel-veteran':'#72b4c9','citadel-elite':'#e9bd67','spearhead-veteran':'#72b4c9','spearhead-elite':'#e9bd67'});
 function playerStyle(ship,design,isMe){const id=String(ship||'').toLowerCase();return {kind:Object.hasOwn(shipProfiles,id)?'ship-'+id:id==='tank'?'tank':'scout',color:Object.hasOwn(designColors,design)?designColors[design]:isMe?'#76f5bd':'#77c6ff'};}
 function playerHull(c,id,color){
  const [nose,wing,back,body,style]=shipProfiles[id],armor=gradient(c,wing,[[0,'#bdc9d4'],[.16,'#657587'],[.38,'#243442'],[.5,'#101a24'],[.68,'#53687b'],[1,'#15222e']]),accent=gradient(c,wing,[[0,color],[.4,'#15343b'],[.6,'#101d28'],[1,color]]);
  for(const side of [-1,1]){
   const tip=style===0?-back:style===1?-back*.45:style===2?-back*.85:style===3?body*.45:nose*.25;
   const shoulder=style===3?nose*.65:nose*.32;
   path(c,[[shoulder,body*.55*side],[tip,wing*side],[-back,wing*.82*side],[-back+5,body*.6*side],[-body,body*.35*side]],armor,'#9baab8',.85);
   path(c,[[shoulder-3,body*.65*side],[tip,wing*.86*side],[-back+5,wing*.72*side],[-body,body*.55*side]],accent,color,.8);
   path(c,[[-back+2,wing*.64*side],[-back+2,wing*.82*side],[-back+7,wing*.77*side],[-back+7,wing*.58*side]],'#c1d0dd',color,.5);
   engine(c,-back+2,wing*.48*side,color);
   if(style===3||style===4){path(c,[[nose*.48,body*.62*side],[nose*.25,wing*.58*side],[-back*.5,wing*.55*side],[-back*.65,body*.58*side]],armor,color,.75);}
  }
  path(c,[[nose,0],[nose*.5,-body*.65],[-body,-body],[-back,-body*.5],[-back,body*.5],[-body,body],[nose*.5,body*.65]],armor,'#abbcc8',1);
  path(c,[[nose-5,0],[nose*.34,-body*.52],[-body,-body*.45],[-back+5,0],[-body,body*.45],[nose*.34,body*.52]],accent,color,.8);
  // Fine panel seams and metallic bevels are painted into the cached sprite, not each frame.
  for(const side of [-1,1]){
   const y=body*.63*side;
   path(c,[[nose*.37,y],[-body*.58,body*.85*side],[-back+4,body*.42*side],[-body*.35,body*.52*side]],'#253443','#8595a4',.55);
   path(c,[[nose*.26,body*.59*side],[-body*.52,body*.74*side],[-body*.65,body*.61*side]],'#a6bac9');
   for(let i=0;i<3;i++){const x=-back+5+i*3;path(c,[[x,body*.28*side],[x+1.5,body*.28*side],[x+2.5,body*.46*side],[x+1,body*.46*side]],'#070d15','#60788b',.35);}
   // Thrust nozzles sit on top of the bloom.
   path(c,[[-back+1,wing*.40*side],[-back+5,wing*.35*side],[-back+6,wing*.55*side],[-back+1,wing*.60*side]],'#101a24','#8a9baa',.6);
   path(c,[[-back+1,wing*.44*side],[-back+3,wing*.43*side],[-back+3,wing*.53*side],[-back+1,wing*.55*side]],color);
   if(style===3||style===4){path(c,[[nose*.16,wing*.46*side],[-back*.25,wing*.57*side],[-back*.44,wing*.48*side],[-back*.12,wing*.39*side]],'#627484','#9babb7',.45);}
  }
  const glass=gradient(c,body*.32,[[0,'#ddf7ff'],[.25,color],[.6,'#193644'],[1,'#051522']]);
  path(c,[[nose*.5,0],[nose*.12,-body*.31],[-body*.15,0],[nose*.12,body*.31]],glass,'#bce1e7',.65);
  path(c,[[nose*.4,0],[nose*.15,-body*.17],[nose*.02,0]],'#e7faff');
  if(style===3)for(const side of [-1,1])path(c,[[nose*.65,body*.4*side],[nose*.4,body*.78*side],[nose*.12,body*.64*side],[nose*.35,body*.3*side]],color);
 }
 function sprite(kind,color){const dpr=Math.min(2,Math.max(1,root.devicePixelRatio||1)),theme=root.ggVisualTheme?.current()||'gold',key=theme+':'+kind+':'+color+':'+dpr;if(cache.has(key)){const hit=cache.get(key);cache.delete(key);cache.set(key,hit);return hit;}const size=kind.startsWith('drone')?52:kind==='pet'?62:112,canvas=root.document.createElement('canvas');canvas.width=canvas.height=size*dpr;const c=canvas.getContext('2d');c.scale(dpr,dpr);c.translate(size/2,size/2);if(theme==='classic'&&kind==='streuner-original'&&root.ggClassicArt?.streuner)root.ggClassicArt.streuner(c,color);else if(theme==='classic'&&kind==='ship-goliath'&&root.ggClassicArt?.goliath)root.ggClassicArt.goliath(c,color);else if(theme==='classic'&&['classic-lordakia','classic-saimon'].includes(kind)&&root.ggClassicArt?.alien)root.ggClassicArt.alien(c,kind,color);else if(theme==='classic'&&/^classic-(kristallin|kristallon|mordon|devolarium|cubikon)(-|$)/.test(kind)&&root.ggClassicArt?.largeAlien)root.ggClassicArt.largeAlien(c,kind,color);else if(theme==='classic'&&/^classic-(sibelonit|sibelon|lordakium|interceptor|vagrant|marauder|barracuda|saboteur|annihilator|deadly-battleray)(-|$)/.test(kind)&&root.ggClassicArt?.raider)root.ggClassicArt.raider(c,kind,color);else if(theme==='classic'&&kind.startsWith('drone')&&root.ggClassicArt?.vant)root.ggClassicArt.vant(c,kind,color);else if(kind.startsWith('drone'))drone(c,color,kind);else if(kind==='pet')pet(c,color);else if(kind==='streuner-original')streunerHull(c,color);else if(['crystal','crystal-elite','scout-npc','claw','wing','armor','cube','pirate'].includes(kind))npcHull(c,kind,color);else if(kind.startsWith('ship-')&&Object.hasOwn(shipProfiles,kind.slice(5)))playerHull(c,kind.slice(5),color);else vessel(c,kind,color);if(theme==='classic')root.ggClassicArt?.finish(c,kind,color,size);const value={canvas,size};if(cache.size>=128)cache.delete(cache.keys().next().value);cache.set(key,value);return value;}
 function draw(c,kind,color){const s=sprite(kind,color);c.drawImage(s.canvas,-s.size/2,-s.size/2,s.size,s.size);}
 function portal(c,color,t){
  const center=c.createRadialGradient(0,0,3,0,0,46);center.addColorStop(0,'#03060d');center.addColorStop(.45,'#0b1625');center.addColorStop(.78,color+'24');center.addColorStop(1,color+'00');c.fillStyle=center;c.beginPath();c.arc(0,0,46,0,Math.PI*2);c.fill();
  c.save();c.rotate(t/6000);for(let i=0;i<8;i++){c.save();c.rotate(i*Math.PI/4);path(c,[[37,-10],[46,-7],[49,0],[46,7],[37,10],[34,5],[34,-5]],gradient(c,10,[[0,'#8494a6'],[.5,'#17232f'],[1,'#384857']]),'#657b90',.7);path(c,[[39,-3],[44,-3],[46,0],[44,3],[39,3]],color);c.restore();}c.restore();
  c.strokeStyle=color;c.lineWidth=2.5;c.beginPath();c.arc(0,0,33,0,Math.PI*2);c.stroke();c.save();c.rotate(-t/1700);for(let i=0;i<3;i++){c.strokeStyle=color;c.lineWidth=3;c.beginPath();c.arc(0,0,27,i*2.094,i*2.094+1.15);c.stroke();}c.restore();
 }
 const droneColors=Object.freeze({Havoc:'#ff3838',Hercules:'#398dff',Spartan:'#ff8a24'});
 function droneColor(design){return Object.hasOwn(droneColors,design)?droneColors[design]:'#aab4bd';}
 let skyCache=null;
 function sky(c,w,h){
  if(!Number.isFinite(w)||!Number.isFinite(h)||w<=0||h<=0)return;
  const theme=root.ggVisualTheme?.current()||'gold';if(!skyCache||skyCache.w!==w||skyCache.h!==h||skyCache.theme!==theme){
   const canvas=root.document.createElement('canvas');canvas.width=Math.min(1920,Math.ceil(w));canvas.height=Math.min(1080,Math.ceil(h));
   const a=canvas.getContext('2d'),cw=canvas.width,ch=canvas.height;
   a.fillStyle=theme==='classic'?'#010204':'#020408';a.fillRect(0,0,cw,ch);
   for(const [x,y,r,color] of (theme==='classic'?[[.72,.28,.65,'#080f19'],[.12,.78,.42,'#060b10']]:[[.72,.28,.65,'#102037'],[.12,.78,.42,'#0b1927'],[.9,.9,.34,'#151325']])){
    const g=a.createRadialGradient(cw*x,ch*y,0,cw*x,ch*y,Math.max(cw,ch)*r);g.addColorStop(0,color);g.addColorStop(1,'#02040800');a.fillStyle=g;a.fillRect(0,0,cw,ch);
   }
   skyCache={w,h,canvas,theme};
  }
  c.drawImage(skyCache.canvas,0,0,w,h);
 }
 function formationOffsets(count,formation){
  const n=Math.min(10,Math.max(0,Math.floor(Number(count)||0))),f=formation||'normal',out=[];
  for(let i=0;i<n;i++){
   const a=2*Math.PI*i/n,side=i%2?1:-1,k=Math.floor(i/2),radius=68;
   let x=Math.cos(a)*radius,y=Math.sin(a)*radius*.78;
   if(['arrow','double-arrow','chevron','drill'].includes(f)){x=44-k*24;y=side*(25+k*11);}
   else if(f==='ring'||f==='dome'){x=Math.cos(a)*84;y=Math.sin(a)*84;}
   else if(f==='heart'){x=56*Math.sin(a)**3;y=-3.6*(13*Math.cos(a)-5*Math.cos(2*a)-2*Math.cos(3*a)-Math.cos(4*a));}
   else if(f==='wave'){x=(i-(n-1)/2)*18;y=62+Math.sin(i*.8)*18;}
   else if(['bat','moth','star'].includes(f)){x=Math.cos(a)*(i%2?45:87);y=Math.sin(a)*(i%2?45:87);}
   else if(f==='diamond'){const r=radius/(Math.abs(Math.cos(a))+Math.abs(Math.sin(a)));x=Math.cos(a)*r;y=Math.sin(a)*r;}
   out.push({x,y});
  }
  return out;
 }
 function labelLayout(o,visual,npc,scale=1,angle=0,offsets=[]){
  const kind=visual.kind,base=kind==='crystal-elite'?44:/^classic-(sibelon|lordakium|deadly-battleray|annihilator)/.test(kind)?46:kind.startsWith('classic-kristallon')?47:kind.startsWith('classic-kristallin')?40:kind.startsWith('classic-devolarium')?45:kind.startsWith('classic-mordon')?40:kind.startsWith('classic-cubikon')?47:kind==='cube'?35:kind.startsWith('ship-')?42:36;
  let above=base*scale,below=above;
  const sin=Math.sin(angle),cos=Math.cos(angle);
  if(!npc)for(const {x,y} of offsets){const v=(x*sin+y*cos)*scale;above=Math.max(above,-v+15*scale);below=Math.max(below,v+19*scale);}
  return {top:Math.ceil(above+14),name:Math.ceil(below+15),width:o.type==='boss'?90:58,ring:Math.ceil(base*scale+4)};
 }
 function safeRatio(value,max){return Number.isFinite(value)&&Number.isFinite(max)&&max>0?Math.max(0,Math.min(1,value/max)):0;}
 root.ggGraphics161={draw,portal,droneColor,droneKind,npcStyle,playerStyle,formationOffsets,labelLayout,safeRatio,sky};
})(window);
