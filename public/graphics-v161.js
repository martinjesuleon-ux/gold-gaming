'use strict';
// Original vector artwork, cached once per palette and device pixel ratio.
(function(root){
 const cache=new Map(),formationCache=new Map();
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
 function droneKind(code,rank=6){const kind=Object.hasOwn(droneHulls,code)?'drone-'+code:'drone';return root.ggVisualTheme?.current()==='classic'?kind+':'+Math.max(1,Math.min(6,Math.floor(Number(rank)||1))):kind;}
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
  if(root.ggVisualTheme?.current()==='classic'&&root.ggClassicArt?.alien&&(n==='lordakia'||n==='saimon')){
   const suffix=tier==='normal'?'':'-'+tier;
   const color=tier==='uber'?'#b77bff':tier==='emperor'?'#ffd077':tier==='boss'?'#70a7ff':n==='lordakia'?'#447e8d':'#77899d';
   return {kind:'classic-'+n+suffix,color,tier};
  }
  const classicSpecies=Object.hasOwn({kristallin:1,kristallon:1,mordon:1,devolarium:1,cubikon:1},n);
  if(root.ggVisualTheme?.current()==='classic'&&root.ggClassicArt?.largeAlien&&classicSpecies){
   const palette={kristallin:'#62b9e7',kristallon:'#5c98df',mordon:'#a55742',devolarium:'#536d3c',cubikon:'#d7b96a'};
   return {kind:'classic-'+n+(tier==='normal'?'':'-'+tier),color:tier==='uber'?'#b77bff':tier==='emperor'?'#ffd077':tier==='boss'?'#70a7ff':palette[n],tier};
  }
  const classicRaiders={sibelon:'#75969a',sibelonit:'#32984a',lordakium:'#c6a35c',interceptor:'#8fb5ba',vagrant:'#8e776c',marauder:'#b87b56',barracuda:'#71949d',saboteur:'#a198c7',annihilator:'#b85c52','deadly battleray':'#d9a86b'};
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
 phoenix:[27,11,18,7,0],yamato:[33,22,19,10,5],defcom:[28,25,23,10,2],
 liberator:[33,25,18,13,1],piranha:[36,17,27,7,6],nostromo:[29,24,21,15,3],
 bigboy:[25,32,26,20,7],leonov:[34,21,17,10,4],vengeance:[38,24,29,8,8],
 goliath:[34,31,25,15,4],spearhead:[44,14,25,6,9],aegis:[27,29,25,17,10],citadel:[30,35,30,23,11]
 });
 const shipColors=Object.freeze({phoenix:'#aa4c40',yamato:'#5999e6',defcom:'#e56b52',liberator:'#66bfae',piranha:'#d6d94d',nostromo:'#55c9e0',bigboy:'#cc8f62',leonov:'#9baeb5',vengeance:'#4aaec6',goliath:'#79c985',spearhead:'#5dbfa5',aegis:'#5f9ee9',citadel:'#77a95d'});
 const designColors=Object.freeze({"Champion":"#d5b26b","Champion-albania":"#da233a","Champion-austria":"#e52a40","Champion-belgium":"#202128","Champion-croatia":"#e43c44","Champion-czechia":"#edf4f9","Champion-england":"#edf4f9","Champion-france":"#2456b0","Champion-germany":"#1c1e25","Champion-hungary":"#d93949","Champion-iceland":"#2355a4","Champion-ireland":"#238a5b","Champion-italy":"#23885f","Champion-northern-ireland":"#edf4f9","Champion-poland":"#edf4f9","Champion-portugal":"#23834e","Champion-romania":"#254dad","Champion-russia":"#edf4f9","Champion-slovakia":"#edf4f9","Champion-spain":"#d83a43","Champion-sweden":"#245aa2","Champion-switzerland":"#d53343","Champion-turkey":"#d52e40","Champion-ukraine":"#2865b5","Champion-usa":"#24478b","Champion-wales":"#edf4f9","Champion-chile":"#224b9b","Champion-argentina":"#62addc","Champion-brazil":"#249653","Champion-mexico":"#238458",Diminisher:'#e36c45',Sentinel:'#5a93e7',Solace:'#69d8c1',Spectrum:'#aa83ee',Venom:'#87e363',Lightning:'#f5c349',Bastion:'#4798ec',Enforcer:'#f05b51',Centaur:'#eab671',Exalted:'#e2d5b2',Veteran:'#7ab9c4',Goal:'#73d58c',Referee:'#e5e7ec',Kick:'#e4954f',Revenge:'#ef7056',Avenger:'#71c0ff',Saturn:'#d6b2ee','aegis-veteran':'#72b4c9','aegis-elite':'#e9bd67','citadel-veteran':'#72b4c9','citadel-elite':'#e9bd67','spearhead-veteran':'#72b4c9','spearhead-elite':'#e9bd67'});
 function playerStyle(ship,design,isMe){const id=String(ship||'').toLowerCase();const known=Object.hasOwn(shipProfiles,id),equipped=Object.hasOwn(designColors,design),classic=root.ggVisualTheme?.current()==='classic'&&root.ggClassicArt?.pilot;return {kind:known?(classic?'classic-ship-'+id+(equipped?':'+design:''):'ship-'+id):id==='tank'?'tank':'scout',color:equipped?designColors[design]:classic&&id==='goliath'?'#aab4bd':known?shipColors[id]:isMe?'#76f5bd':'#77c6ff'};}
 function playerHull(c,id,color){
  const [nose,wing,back,body,style]=shipProfiles[id],armor=gradient(c,wing,[[0,'#bdc9d4'],[.16,'#657587'],[.38,'#243442'],[.5,'#101a24'],[.68,'#53687b'],[1,'#15222e']]),accent=gradient(c,wing,[[0,color],[.4,'#15343b'],[.6,'#101d28'],[1,color]]);
  for(const side of [-1,1]){
   const tip=style===0?-back:style===1?-back*.45:style===2?-back*.85:style===3?body*.45:style===5?0:style===6?-back*.95:style===7?-back*.35:style===8?-back:style===9?-back*.65:style===10?nose*.1:style===11?body*.4:nose*.25;
   const shoulder=style===3||style===7||style===11?nose*.65:style===6||style===8||style===9?nose*.13:nose*.32;
   path(c,[[shoulder,body*.55*side],[tip,wing*side],[-back,wing*.82*side],[-back+5,body*.6*side],[-body,body*.35*side]],armor,'#9baab8',.85);
   path(c,[[shoulder-3,body*.65*side],[tip,wing*.86*side],[-back+5,wing*.72*side],[-body,body*.55*side]],accent,color,.8);
   path(c,[[-back+2,wing*.64*side],[-back+2,wing*.82*side],[-back+7,wing*.77*side],[-back+7,wing*.58*side]],'#c1d0dd',color,.5);
   engine(c,-back+2,wing*.48*side,color);
   if(style===5||style===6||style===8||style===9){const start=style===5?nose*.54:style===9?nose*.12:nose*.32;path(c,[[start,wing*.29*side],[tip,wing*side],[-back,wing*.93*side],[-back*.55,wing*.48*side]],color,'#a6c3d0',.85);}
   if(style===7||style===10||style===11){const y=wing*.66*side;path(c,[[nose*.44,y-body*.2*side],[-back*.62,y-body*.27*side],[-back*.86,y],[-back*.62,y+body*.22*side],[nose*.32,y+body*.2*side]],armor,color,1);path(c,[[nose*.22,y],[-back*.5,y-body*.09*side],[-back*.5,y+body*.09*side]],color);}
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
 // GOLD identity: original graphite armor, champagne-gold hardware and functional energy colors.
 // Rendered into the existing sprite cache, never in the per-frame drawing loop.
 function goldShipFinish(c,id,color){
  const [nose,wing,back,body,style]=shipProfiles[id];
  const metal=c.createLinearGradient(-back,-wing,nose,wing);
  for(const [p,v] of [[0,'#f5dfab'],[.22,'#a4854a'],[.48,'#493a28'],[.7,'#d2b877'],[1,'#725935']])metal.addColorStop(p,v);
  c.save();c.globalCompositeOperation='source-atop';
  for(const side of [-1,1]){
   // Thin, fitted armor rails, rather than replacing the equipped design color.
   path(c,[[nose*.47,body*.6*side],[nose*.12,body*.82*side],[-body*.52,body*.92*side],[-body*.41,body*.72*side],[nose*.12,body*.7*side]],metal,'#ead09b',.42);
   const x=-back+8,y=wing*.58*side;
   for(let i=0;i<3;i++){path(c,[[x+i*2.7,y-1.1],[x+i*2.7+1.4,y-1.1],[x+i*2.7+1.4,y+1.1],[x+i*2.7,y+1.1]],'#171e26','#a48955',.38);}
   path(c,[[nose*.2,body*.4*side],[nose*.07,body*.55*side],[-body*.2,body*.55*side]],'#e1c995');
   // Color-coded running lights keep allied and equipped-design cues visible.
   c.fillStyle=color;c.fillRect(-back+5,y-side*2,2.1,1.3);
   if(style===3||style===4){path(c,[[nose*.1,wing*.49*side],[-back*.2,wing*.54*side],[-back*.32,wing*.49*side]],metal,'#bda46d',.35);}
  }
  c.fillStyle='#f0d69a';c.fillRect(nose*.64-1,-.55,2,1.1);
  c.restore();
 }
 // Individual industrial fleet: separate chassis, nacelles, armor and role-specific hardware.
 // All detail is baked into the existing sprite cache; flight and hitboxes are untouched.
 const fleetArt=Object.freeze({
  phoenix:{metal:['#c9b6aa','#70534f','#39272a'],body:[[25,0],[23,6],[18,10],[9,12],[-4,12],[-15,9],[-21,4],[-22,0]],wing:[[4,8],[-4,16],[-18,18],[-16,13],[-22,10],[-8,7]],plate:[[-4,10],[-7,14],[-15,15],[-13,11]],jets:[[-19,5]],cockpit:[7,15,6],role:'capsule'},
  yamato:{metal:['#b9c6d7','#4b6077','#202c42'],body:[[32,0],[21,8],[3,11],[-23,9],[-28,0]],wing:[[18,7],[6,13],[-4,23],[-25,21],[-29,13],[-12,10]],plate:[[4,13],[-4,21],[-21,19],[-24,14],[-9,13]],jets:[[-25,15],[-24,5]],cockpit:[13,8,4],role:'pods'},
  defcom:{metal:['#b6aaa3','#6a514b','#302827'],body:[[32,0],[15,7],[-6,10],[-27,6],[-29,0]],wing:[[18,5],[13,17],[5,24],[-15,27],[-27,18],[-20,12],[-8,8]],plate:[[9,17],[3,23],[-13,24],[-20,18],[-8,13]],jets:[[-25,16]],cockpit:[13,7,3],role:'guns'},
  liberator:{metal:['#bdc7bc','#536861','#263d39'],body:[[33,0],[25,9],[10,13],[-21,11],[-28,0]],wing:[[21,8],[10,18],[-3,26],[-23,27],[-30,16],[-25,9]],plate:[[8,17],[-4,24],[-21,24],[-24,17],[-6,14]],jets:[[-25,19],[-25,7]],cockpit:[16,8,4],role:'rails'},
  piranha:{metal:['#a9b19a','#626c48','#242c23'],body:[[39,0],[20,4],[5,8],[-20,7],[-31,0]],wing:[[20,5],[9,14],[-4,18],[-15,26],[-30,19],[-23,9],[-6,7]],plate:[[5,13],[-9,20],[-18,23],[-25,17],[-15,12]],jets:[[-28,16]],cockpit:[20,9,2.8],role:'blade'},
  nostromo:{metal:['#a9bfc8','#536572','#23333d'],body:[[36,0],[26,5],[14,8],[-7,13],[-24,11],[-31,0]],wing:[[6,9],[-4,16],[-9,27],[-25,28],[-34,19],[-30,10],[-15,8]],plate:[[-5,16],[-11,24],[-25,25],[-30,19],[-22,13]],jets:[[-29,20],[-28,7]],cockpit:[19,13,3.6],role:'twin'},
  bigboy:{metal:['#c0b29b','#74614c','#3b3025'],body:[[28,0],[26,15],[12,19],[-26,17],[-35,0]],wing:[[24,13],[13,31],[-15,34],[-33,25],[-36,14],[-20,10]],plate:[[12,21],[8,29],[-14,31],[-29,24],[-30,17],[-8,18]],jets:[[-32,22],[-33,9]],cockpit:[12,10,5],role:'cargo'},
  leonov:{metal:['#c5cbd0','#67717b','#263138'],body:[[40,0],[28,4],[14,8],[-6,13],[-26,12],[-33,0]],wing:[[35,4],[20,13],[5,22],[-19,25],[-32,15],[-30,8],[-9,8],[16,6]],plate:[[22,11],[5,19],[-18,22],[-28,14],[-10,12]],jets:[[-27,15],[-28,6]],cockpit:[16,14,4],role:'twinblade'},
  vengeance:{metal:['#9aa8ae','#495761','#222d35'],body:[[34,0],[25,7],[9,12],[-13,12],[-25,9],[-32,0]],wing:[[17,9],[12,19],[2,25],[-16,29],[-30,23],[-36,14],[-24,9]],plate:[[8,15],[2,23],[-18,26],[-29,21],[-26,13]],jets:[[-31,20],[-29,8]],cockpit:[17,10,4],role:'turbine'},
  goliath:{metal:['#b9c4bd','#52665b','#273a31'],body:[[25,0],[17,5],[7,7],[-9,13],[-23,11],[-31,0]],wing:[[-20,6],[-15,16],[-7,25],[7,32],[23,34],[38,27],[42,18],[36,21],[27,23],[17,22],[5,17],[-2,9]],plate:[[-12,13],[-4,23],[8,29],[23,31],[35,26],[23,25],[9,23],[-2,16]],jets:[[-25,7]],cockpit:[11,9,3.5],role:'crescent'},
  spearhead:{metal:['#a7bcb7','#4c6660','#233a35'],body:[[46,0],[32,3],[11,6],[-12,7],[-27,5],[-32,0]],wing:[[12,5],[-2,9],[-11,20],[-23,32],[-27,33],[-24,21],[-20,10],[-30,6]],plate:[[-5,9],[-13,18],[-22,27],[-21,18],[-17,10]],jets:[[-29,4]],cockpit:[24,10,2.4],role:'needle'},
  aegis:{metal:['#a5b8d2','#536985','#263747'],body:[[37,0],[26,6],[9,9],[-13,12],[-26,10],[-33,0]],wing:[[1,8],[-3,17],[-13,28],[-28,29],[-35,17],[-29,9]],plate:[[-5,14],[-14,25],[-27,26],[-31,18],[-20,13]],jets:[[-30,21],[-29,6]],cockpit:[17,13,4],role:'support'},
  citadel:{metal:['#a8b7bc','#4d616a','#25363c'],body:[[37,0],[35,9],[23,19],[8,21],[-22,18],[-37,10],[-40,0]],wing:[[29,15],[23,31],[7,35],[-16,35],[-34,28],[-41,16],[-26,10]],plate:[[20,19],[15,29],[1,32],[-20,32],[-32,25],[-33,18],[-8,17]],jets:[[-36,25],[-35,12]],cockpit:[19,10,5],role:'fortress'},
 });
 function industrialHull(c,id,color){
  const a=fleetArt[id];if(!a)return;
  const [light,mid,dark]=a.metal;
  const metal=(x,y,u,v)=>{const g=c.createLinearGradient(x,y,u,v);[[0,light],[.19,mid],[.46,dark],[.64,mid],[.82,dark],[1,'#101820']].forEach(([p,k])=>g.addColorStop(p,k));return g;};
  const half=(p,s)=>p.map(([x,y])=>[x,y*s]);
  const mirror=p=>p.concat(p.slice(1,-1).reverse().map(([x,y])=>[x,-y]));
  const inset=(p,f)=>{const x=p.reduce((n,v)=>n+v[0],0)/p.length,y=p.reduce((n,v)=>n+v[1],0)/p.length;return p.map(([u,v])=>[x+(u-x)*f,y+(v-y)*f]);};
  const plate=(p,s)=>{const q=half(p,s);path(c,q,metal(-20,-30*s,24,30*s),'#121b23',1.25);path(c,inset(q,.87),metal(-12,-18*s,12,18*s),light,.42);};
  const line=(p,col,w=.7)=>{c.beginPath();p.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.strokeStyle=col;c.lineWidth=w;c.stroke();};
  const rect=(x,y,w,h,fill)=>{c.fillStyle=fill;c.fillRect(x,y,w,h);};
  const pod=(x,y,l,w)=>{path(c,[[x-l/2,y-w],[x+l/2-3,y-w],[x+l/2,y],[x+l/2-3,y+w],[x-l/2,y+w]],metal(x-l/2,y-w,x+l/2,y+w),'#0a1018',1);rect(x-l/2+1,y-w+1,3,w*2-2,dark);rect(x+l/2-5,y-.6,3,1.2,color);};
  const disc=(x,y,rx,ry,fill,stroke,w=.8)=>{c.save();c.translate(x,y);c.scale(rx,ry);c.beginPath();c.arc(0,0,1,0,Math.PI*2);c.restore();c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=w;c.stroke();}};
  c.save();
  for(const s of [-1,1])for(const [x,y] of a.jets){engine(c,x-1,y*s,color);}
  for(const s of [-1,1]){
   path(c,half(a.wing,s),metal(-30,-32*s,30,32*s),'#080e14',1.5);
   plate(a.plate,s);
   const p=a.plate,edge=p[1],end=p[2];line(half([edge,end],s),light,1.1);
   const inner=inset(p,.55);line(half([inner[0],inner[1],inner[2]],s),color,1.4);
   for(const [x,y] of a.jets){pod(x+4,y*s,11,3.4);rect(x-1,y*s-1.1,3,2.2,color);rect(x-1,y*s-.4,2,.8,'#e6f5ff');}
   const y=(id==='phoenix'?8:id==='spearhead'?11:id==='citadel'?24:id==='bigboy'?23:id==='aegis'?23:16)*s;
   if(a.role==='crescent'){
    // Open forward arc: preserve the negative space between the two claws.
    line(half([[-10,17],[0,25],[13,29],[27,29],[36,24]],s),color,1.7);
    line(half([[6,27],[15,31],[26,30]],s),light,1.2);
    for(const [x,v] of [[-6,19],[3,24],[14,28],[25,28]]){line([[x-2,(v-3)*s],[x+1,(v+2)*s]],'#131c22',1.2);}
   }else if(a.role==='turbine'){
    for(const [x,v,rx,ry] of [[-16,19,11,8],[-1,18,7,7]]){
     disc(x,v*s,rx,ry,metal(x-rx,v*s-ry,x+rx,v*s+ry),'#0c151c',1.1);
     disc(x,v*s,rx*.64,ry*.65,'#141f29',light,.7);disc(x-1,v*s,rx*.26,ry*.28,color,'#17222c',.6);
    }
   }else if(a.role==='twin'||a.role==='support'){
    pod(-14,18*s,25,a.role==='support'?5:6);
    disc(-25,19*s,6,6,metal(-31,19*s-6,-19,19*s+6),'#14202a',1);
    disc(-25,19*s,3.2,3.2,color,'#0a161e',.8);
    if(a.role==='support'){rect(-9,18*s-.9,8,1.8,color);rect(-6,18*s-3.6,2,7.2,color);}
   }else if(a.role==='twinblade'){
    line(half([[30,7],[13,15],[-8,18],[-24,16]],s),light,1.5);
    line(half([[24,10],[9,16],[-8,20]],s),color,1.15);
   }else if(a.role==='needle'){
    line(half([[-6,11],[-15,21],[-24,30]],s),color,1.3);
    pod(-18,7*s,15,2.2);
   }else if(a.role==='capsule'){
    line(half([[-4,12],[-14,15],[-17,14]],s),color,1.6);
   }else if(a.role==='guns'||a.role==='fortress'){pod(13,y,21,a.role==='fortress'?4.8:3.6);rect(17,y-1,10,2,light);rect(25,y-1.4,3,2.8,'#101820');}
   else if(a.role==='cargo'){for(let j=0;j<3;j++){pod(-19+j*8,y,7,4);rect(-21+j*8,y-.5,4,1,color);}}
   else if(a.role==='medic'){pod(-5,y,17,5);rect(-10,y-.8,10,1.6,color);rect(-6,y-3.5,2,7,color);}
   else if(a.role==='pods'||a.role==='rails'){pod(-4,y,23,2.8);rect(-10,y-1,12,1,color);}
   else if(a.role==='fork'||a.role==='blade'||a.role==='stealth'){line([[1,y*.78],[12,y*.52],[24,y*.29]],light,.7);line([[-17,y*.9],[-6,y*.83]],color,1.5);}
   else {pod(-8,y,10,2.2);}
   for(let j=0;j<3;j++){const x=-12+j*3.1;rect(x,y*.67-1.1,2,2.2,'#0b141c');rect(x,y*.67-1.1,2,.5,light);}
  }
  if(a.role==='capsule'){
   disc(0,0,24,12,metal(-23,-12,23,12),'#15151d',1.3);
   disc(2,0,20,9,metal(-20,-10,20,10),light,.7);
   line([[-12,-10],[-18,-5],[-18,5],[-12,10]],color,2);
  }else{
   path(c,mirror(a.body),metal(-35,-17,35,17),'#080e14',1.35);
   path(c,inset(mirror(a.body),.86),metal(-24,-12,24,12),light,.48);
  }
  const [x,l,w]=a.cockpit;
  path(c,[[x+l/2+2,0],[x+l/2-2,-w-1.5],[x-l/2,-w-1.5],[x-l/2-3,0],[x-l/2,w+1.5],[x+l/2-2,w+1.5]],'#131f2b',light,.65);
  const glass=c.createLinearGradient(x,-w,x,w);[[0,'#142333'],[.28,'#83b5ca'],[.48,'#d5e3df'],[.58,'#315766'],[1,'#0b1520']].forEach(([p,k])=>glass.addColorStop(p,k));
  path(c,[[x+l/2,0],[x+l/2-2,-w],[x-l/2,-w],[x-l/2-1,0],[x-l/2,w],[x+l/2-2,w]],glass,'#101c25',.6);
  const rear=a.body[a.body.length-1][0];
  for(const s of [-1,1]){
   line([[rear+7,3*s],[-12,5*s],[x-l/2-5,4*s]],'#121b22',1.1);
   line([[rear+8,2*s],[-12,3.7*s]],light,.5);
   for(let j=0;j<4;j++){rect(rear+9+j*3,1.7*s-.65,1.6,1.3,'#101820');rect(rear+9+j*3,1.7*s-.65,1.6,.45,mid);}
   rect(x-l/2-4,3.8*s-.55,2.4,1.1,color);
  }
  if(a.role==='fortress'){pod(-6,-9,20,4);pod(-6,9,20,4);}
  if(a.role==='medic'){rect(-15,-1,10,2,color);rect(-11,-4,2,8,color);}
  if(a.role==='stealth'){line([[rear+6,0],[-10,0],[x-l/2-4,0]],color,.9);}
  c.restore();
 }
 // Original beveled hard-surface fleet. Model each wing and armor plate as
 // raised metal, with a consistent key light, occluded seams and recessed machinery.
 // Rendered once per cached sprite, not per animation frame.
 function industrialRemaster(c,id,color){
  const a=fleetArt[id];if(!a)return industrialHull(c,id,color);
  const [light,mid,dark]=a.metal;
  const rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
  const mix=(x,y,t)=>'#'+rgb(x).map((v,i)=>Math.round(v+(rgb(y)[i]-v)*t).toString(16).padStart(2,'0')).join('');
  const tone=(h,n)=>mix(h,n>=0?'#dce4e6':'#070a0e',Math.abs(n));
  const accent=mix(color,'#26343a',.42),paint=mix(color,'#303a3c',.27);
  const half=(p,s)=>p.map(([x,y])=>[x,y*s]),mirror=p=>p.concat(p.slice(1,-1).reverse().map(([x,y])=>[x,-y]));
  const bevel=(pts,base,depth=.8,inset=.84)=>{
   const center=pts.reduce((v,p)=>[v[0]+p[0]/pts.length,v[1]+p[1]/pts.length],[0,0]);
   const inner=pts.map(([x,y])=>[center[0]+(x-center[0])*inset,center[1]+(y-center[1])*inset]);
   path(c,pts.map(([x,y])=>[x-.6,y+depth]),'#080d12','#10161c',1.1);
   for(let i=0;i<pts.length;i++){const j=(i+1)%pts.length,p=pts[i],q=pts[j],dx=q[0]-p[0],dy=q[1]-p[1],length=Math.hypot(dx,dy)||1;
    const key=(dy*.48-dx*.86)/length;
    path(c,[p,q,inner[j],inner[i]],tone(base,key*.42-.12),'#101820',.35);
   }
   const g=c.createLinearGradient(center[0]-12,center[1]-12,center[0]+12,center[1]+12);[[0,tone(base,.4)],[.28,base],[.62,tone(base,-.22)],[1,tone(base,-.45)]].forEach(([p,k])=>g.addColorStop(p,k));path(c,inner,g,tone(base,-.2),.35);
   return inner;
  };
  const seam=(pts,col='#11191e',w=.65)=>{c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.strokeStyle=col;c.lineWidth=w;c.stroke();};
  const rect=(x,y,w,h,fill)=>{c.fillStyle=fill;c.fillRect(x,y,w,h);};
  const pod=(x,y,l,w,base=mid)=>{bevel([[x-l/2,y-w],[x+l/2-2,y-w],[x+l/2,y],[x+l/2-2,y+w],[x-l/2,y+w]],base,1,.78);rect(x-l/2+1,y-w+1,2,w*2-2,'#080c11');rect(x+l/2-4,y-.65,2,1.3,accent);};
  c.save();
  for(const side of [-1,1]){
   for(const [x,y] of a.jets){const r=7,g=c.createRadialGradient(x-3,y*side,0,x-3,y*side,r);g.addColorStop(0,'#edfaff');g.addColorStop(.22,color);g.addColorStop(.55,color+'44');g.addColorStop(1,color+'00');c.fillStyle=g;c.fillRect(x-3-r,y*side-r,2*r,2*r);}
   bevel(half(a.wing,side),dark,1.6,.87);
   const panel=bevel(half(a.plate,side),paint,1.15,.80);
   // Structural joints and wear follow the individual armor surface.
   const [px,py]=panel[0];for(let j=0;j<3;j++){const p=panel[(j+1)%panel.length];seam([[px,py],[p[0],p[1]]],tone(paint,-.55),.50);}
   for(const [x,y] of a.jets){pod(x+3,y*side,13,3.5);rect(x-3,y*side-1.7,3,3.4,'#111b24');rect(x-2,y*side-.7,2,1.4,color);}
   const wingCenter=a.plate.reduce((v,p)=>[v[0]+p[0]/a.plate.length,v[1]+p[1]/a.plate.length],[0,0]);
   const [wx,wy]=wingCenter;const y=wy*side;
   if(a.role==='fortress'||a.role==='guns'){pod(wx+5,y,19,3.2,mid);pod(wx-5,y*.7,14,2.4,dark);}
   else if(a.role==='twin'||a.role==='support'){pod(wx-3,y,19,4.2,mid);pod(wx+6,y*.76,12,2.1,dark);}
   else if(a.role==='turbine'){for(const dx of [-5,5]){const x=wx+dx;bevel([[x-5,y-4],[x+3,y-5],[x+6,y],[x+3,y+5],[x-5,y+4]],mid,.7,.72);rect(x-2,y-2,5,4,'#0c161c');rect(x-1,y-.5,3,1,accent);}}
   else if(a.role==='cargo'){for(let j=0;j<3;j++)pod(wx-8+j*7,y,6,3,dark);}
   else if(a.role==='crescent'){seam(half([[-9,20],[8,30],[23,32],[35,26]],side),paint,1.2);for(let j=0;j<4;j++){const x=wx-6+j*4;rect(x,y-.7,2,1.4,'#162027');rect(x,y-.7,1.5,.35,light);}}
   else{pod(wx,y,11,2.2,mid);seam([[wx-6,y*1.04],[wx+7,y*.90]],paint,.9);}
  }
  bevel(mirror(a.body),mid,1.8,.86);
  const [x,l,w]=a.cockpit;
  bevel([[x+l/2+2,0],[x+l/2-2,-w-1.5],[x-l/2,-w-1.5],[x-l/2-3,0],[x-l/2,w+1.5],[x+l/2-2,w+1.5]],dark,1,.78);
  const glass=c.createLinearGradient(x,-w,x,w);[[0,'#0a1b26'],[.27,'#426675'],[.44,'#a6c9cd'],[.49,'#314e58'],[1,'#09121a']].forEach(([p,k])=>glass.addColorStop(p,k));
  path(c,[[x+l/2,0],[x+l/2-2,-w],[x-l/2,-w],[x-l/2-1,0],[x-l/2,w],[x+l/2-2,w]],glass,'#101820',.55);
  const rear=a.body.at(-1)[0];
  for(const side of [-1,1]){
   seam([[rear+7,3*side],[-12,5*side],[x-l/2-5,4*side]],'#11191e',.9);
   seam([[rear+8,2*side],[-12,3.7*side]],tone(mid,.32),.45);
   for(let j=0;j<4;j++){rect(rear+9+j*3,1.7*side-.7,1.8,1.4,'#0c1218');rect(rear+9+j*3,1.7*side-.7,1.5,.45,light);}
   rect(x-l/2-4,3.8*side-.55,2.4,1.1,color);
  }
  c.restore();
 }
 function sprite(kind,color,angle=0){const dpr=Math.min(2,Math.max(1,root.devicePixelRatio||1)),theme=root.ggVisualTheme?.current()||'gold',directional=theme==='classic'&&kind==='classic-ship-goliath'&&!!root.ggClassicArt?.directionalGoliath,view=directional?(Math.round((Number.isFinite(angle)?angle:0)*32/(2*Math.PI))%32+32)%32:0,key=theme+':'+kind+':'+color+':'+dpr+(directional?':view'+view:'');if(cache.has(key)){const hit=cache.get(key);cache.delete(key);cache.set(key,hit);return hit;}const size=kind.startsWith('drone')?52:kind==='pet'?62:112,canvas=root.document.createElement('canvas');canvas.width=canvas.height=size*dpr;const c=canvas.getContext('2d');c.scale(dpr,dpr);c.translate(size/2,size/2);if(directional)root.ggClassicArt.directionalGoliath(c,color,view*2*Math.PI/32);else if(theme==='classic'&&kind.startsWith('classic-ship-')&&root.ggClassicArt?.pilot)root.ggClassicArt.pilot(c,kind,color,industrialRemaster);else if(theme==='classic'&&kind==='streuner-original'&&root.ggClassicArt?.streuner)root.ggClassicArt.streuner(c,color);else if(theme==='classic'&&kind==='ship-goliath'&&root.ggClassicArt?.goliath)root.ggClassicArt.goliath(c,color);else if(theme==='classic'&&/^classic-(lordakia|saimon)(-|$)/.test(kind)&&root.ggClassicArt?.alien)root.ggClassicArt.alien(c,kind,color);else if(theme==='classic'&&/^classic-(kristallin|kristallon|mordon|devolarium|cubikon)(-|$)/.test(kind)&&root.ggClassicArt?.largeAlien)root.ggClassicArt.largeAlien(c,kind,color);else if(theme==='classic'&&/^classic-(sibelonit|sibelon|lordakium|interceptor|vagrant|marauder|barracuda|saboteur|annihilator|deadly-battleray)(-|$)/.test(kind)&&root.ggClassicArt?.raider)root.ggClassicArt.raider(c,kind,color);else if(theme==='classic'&&kind.startsWith('drone')&&root.ggClassicArt?.vant)root.ggClassicArt.vant(c,kind,color);else if(kind.startsWith('drone'))drone(c,color,kind);else if(theme==='classic'&&kind==='pet'&&root.ggClassicArt?.pet)root.ggClassicArt.pet(c,color);else if(kind==='pet')pet(c,color);else if(kind==='streuner-original')streunerHull(c,color);else if(['crystal','crystal-elite','scout-npc','claw','wing','armor','cube','pirate'].includes(kind))npcHull(c,kind,color);else if(kind.startsWith('ship-')&&Object.hasOwn(shipProfiles,kind.slice(5))){const id=kind.slice(5);industrialHull(c,id,color);}else vessel(c,kind,color);if(theme==='classic'&&!directional)root.ggClassicArt?.finish(c,kind,color,size);const value={canvas,size};if(cache.size>=128)cache.delete(cache.keys().next().value);cache.set(key,value);return value;}
 function draw(c,kind,color,angle=0,assetKey){if(root.ggClassicPack?.draw(c,assetKey||'sprite:'+kind,{angle,rotated:true})||(assetKey&&root.ggClassicPack?.draw(c,'sprite:'+kind,{angle,rotated:true})))return;const s=sprite(kind,color,angle),undo=kind==='classic-ship-goliath'&&root.ggVisualTheme?.current()==='classic'&&!!root.ggClassicArt?.directionalGoliath&&Number.isFinite(angle)&&angle!==0;if(undo){c.save();c.rotate(-angle);}c.drawImage(s.canvas,-s.size/2,-s.size/2,s.size,s.size);if(undo)c.restore();}
 function portal(c,color,t,kind){
  if((kind&&root.ggClassicPack?.draw(c,'portal:'+kind,{time:t}))||root.ggClassicPack?.draw(c,'portal:default',{time:t}))return;
  if(root.ggVisualTheme?.current()==='classic'&&root.ggClassicArt?.portal){root.ggClassicArt.portal(c,color,t);return;}
  const center=c.createRadialGradient(0,0,3,0,0,46);center.addColorStop(0,'#03060d');center.addColorStop(.45,'#0b1625');center.addColorStop(.78,color+'24');center.addColorStop(1,color+'00');c.fillStyle=center;c.beginPath();c.arc(0,0,46,0,Math.PI*2);c.fill();
  c.save();c.rotate(t/6000);for(let i=0;i<8;i++){c.save();c.rotate(i*Math.PI/4);path(c,[[37,-10],[46,-7],[49,0],[46,7],[37,10],[34,5],[34,-5]],gradient(c,10,[[0,'#8494a6'],[.5,'#17232f'],[1,'#384857']]),'#657b90',.7);path(c,[[39,-3],[44,-3],[46,0],[44,3],[39,3]],color);c.restore();}c.restore();
  c.strokeStyle=color;c.lineWidth=2.5;c.beginPath();c.arc(0,0,33,0,Math.PI*2);c.stroke();c.save();c.rotate(-t/1700);for(let i=0;i<3;i++){c.strokeStyle=color;c.lineWidth=3;c.beginPath();c.arc(0,0,27,i*2.094,i*2.094+1.15);c.stroke();}c.restore();
 }
 const droneColors=Object.freeze({Havoc:'#ff3838',Hercules:'#398dff',Spartan:'#ff8a24'});
 function droneColor(design){return Object.hasOwn(droneColors,design)?droneColors[design]:'#aab4bd';}
 let skyCache=null;
 function sky(c,w,h,mapId){
  if(!Number.isFinite(w)||!Number.isFinite(h)||w<=0||h<=0)return;
  if((mapId&&root.ggClassicPack?.cover(c,'map:'+mapId,w,h))||root.ggClassicPack?.cover(c,'map:default',w,h))return;
  const theme=root.ggVisualTheme?.current()||'gold';if(!skyCache||skyCache.w!==w||skyCache.h!==h||skyCache.theme!==theme){
   const canvas=root.document.createElement('canvas');canvas.width=Math.min(1920,Math.ceil(w));canvas.height=Math.min(1080,Math.ceil(h));
   const a=canvas.getContext('2d'),cw=canvas.width,ch=canvas.height;
   a.fillStyle=theme==='classic'?'#010204':'#020408';a.fillRect(0,0,cw,ch);
   for(const [x,y,r,color] of (theme==='classic'?[[.72,.28,.65,'#080e15'],[.12,.78,.42,'#080c11'],[.38,.56,.26,'#0d1319']]:[[.72,.28,.65,'#102037'],[.12,.78,.42,'#0b1927'],[.9,.9,.34,'#151325']])){
    const g=a.createRadialGradient(cw*x,ch*y,0,cw*x,ch*y,Math.max(cw,ch)*r);g.addColorStop(0,color);g.addColorStop(1,'#02040800');a.fillStyle=g;a.fillRect(0,0,cw,ch);
   }
   if(theme==='classic'){
    // Static, faint dust clouds: no per-frame texture synthesis.
    let seed=71461;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    for(let i=0;i<36;i++){
     const x=cw*(.10+rnd()*.82),y=ch*(.20+.48*(x/cw)+(rnd()-.5)*.27),r=Math.max(cw,ch)*(.035+rnd()*.095);
     const g=a.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,i%3===0?'#68798809':'#3753670b');g.addColorStop(1,'#00000000');a.fillStyle=g;a.fillRect(x-r,y-r,r*2,r*2);
    }
   }
   skyCache={w,h,canvas,theme};
  }
  c.drawImage(skyCache.canvas,0,0,w,h);
 }
 // Reference diagrams use an upward-facing ship. Convert to local coordinates
 // where the ship's nose points along +X. These templates are visual only.
 const formationShapes={
  turtle:[[-2,-4],[2,-4],[-4,-2],[4,-2],[-5.5,0],[5.5,0],[-4,3],[4,3],[-2,4.5],[2,4.5]],
  arrow:[[0,-7],[-2,-5],[2,-5],[-4,-3],[4,-3],[-6,-1],[6,-1],[-2,2],[2,2],[0,4]],
  lance:[[-1.7,-7],[1.7,-7],[-1.7,-4],[1.7,-4],[-2.6,-1],[2.6,-1],[-2.6,2],[2.6,2],[-1.7,5],[1.7,5]],
  star:[[0,-7],[-2,-2],[2,-2],[-6,-2],[6,-2],[-3.5,1],[3.5,1],[-4,5],[4,5],[0,2.8]],
  pincer:[[-5,-6],[5,-6],[-6,-3],[6,-3],[-5.5,0],[5.5,0],[-4,2.5],[4,2.5],[-2,4],[2,4]],
  'double-arrow':[[-3,-7],[3,-7],[-5,-4.5],[5,-4.5],[-1,-4.5],[1,-4.5],[-6,-1.5],[6,-1.5],[-2,2],[2,2]],
  diamond:[[0,-7],[-2.3,-4.2],[2.3,-4.2],[-4.6,-1.4],[4.6,-1.4],[-4.6,1.4],[4.6,1.4],[-2.3,4.2],[2.3,4.2],[0,7]],
  chevron:[[-1.2,-6],[1.2,-6],[-2.4,-3.5],[2.4,-3.5],[-3.6,-1],[3.6,-1],[-4.8,1.5],[4.8,1.5],[-6,4],[6,4]],
  moth:[[-4,-5],[4,-5],[-6,-3],[6,-3],[-3,-1],[3,-1],[-5,2.5],[5,2.5],[-2,4],[2,4]],
  crab:[[-3,-6],[3,-6],[-5,-5],[5,-5],[-6,-2],[6,-2],[-4,1],[4,1],[-2,3],[2,3]],
  heart:[[-2.5,-4],[2.5,-4],[-4.8,-4.5],[4.8,-4.5],[-6,-1.5],[6,-1.5],[-4,2],[4,2],[-1.5,5],[1.5,5]],
  barrage:[[-1.2,-5],[1.2,-5],[-3.6,-5],[3.6,-5],[-6,-5],[6,-5],[-2.4,-1],[2.4,-1],[-4.8,-1],[4.8,-1]],
  bat:[[-3,-6],[3,-6],[-6,-4],[6,-4],[-7,0],[7,0],[-4,3],[4,3],[-1.8,2],[1.8,2]],
  ring:[[0,-6],...Array.from({length:4},(_,i)=>{const a=(i+1)*Math.PI/5;return [[-6*Math.sin(a),-6*Math.cos(a)],[6*Math.sin(a),-6*Math.cos(a)]];}).flat(),[0,6]],
  drill:[[0,-9],[-3,-6],[3,-6],[0,-6],[-6,-3],[6,-3],[-4,0],[4,0],[-7.5,3.5],[7.5,3.5]],
  veteran:[[-2,-6],[2,-6],[-4,-3.5],[4,-3.5],[-2.8,0],[2.8,0],[-4,2.5],[4,2.5],[-6,5],[6,5]],
  dome:[[-1.1,-6],[1.1,-6],[-3.5,-4.8],[3.5,-4.8],[-5.2,-2.6],[5.2,-2.6],[-6,0],[6,0],[-5.6,2.7],[5.6,2.7]],
  wheel:[[-3,0],[3,0],[-5,0],[5,0],[-7,0],[7,0],[-5,-2.2],[5,-2.2],[-5,2.2],[5,2.2]],
  x:[[-5,-5],[5,-5],[-3,-3],[3,-3],[-1.8,-1.8],[1.8,1.8],[-3,3],[3,3],[-5,5],[5,5]],
  wave:[[-6,-3],[6,3],[-4.5,-4.5],[4.5,4.5],[-3,-3],[3,3],[-2.4,0],[2.4,0],[-3,3],[3,-3]]
 };
 function formationOffsets(count,formation){
  const n=Math.min(10,Math.max(0,Math.floor(Number(count)||0))),f=Object.hasOwn(formationShapes,formation)?formation:'normal';
  const key=f+':'+n;if(formationCache.has(key))return formationCache.get(key);
  const shape=formationShapes[f];const offsets=!n?[]:shape?shape.slice(0,n).map(([x,y])=>({x:-y*19,y:x*19})):Array.from({length:n},(_,i)=>{const a=2*Math.PI*i/n;return {x:Math.cos(a)*68,y:Math.sin(a)*53};});
  const frozen=Object.freeze(offsets.map(Object.freeze));formationCache.set(key,frozen);return frozen;
 }
 function labelLayout(o,visual,npc,scale=1,angle=0,offsets=[]){
  const kind=visual.kind,base=kind==='crystal-elite'?44:/^classic-(sibelon|lordakium|deadly-battleray|annihilator)/.test(kind)?46:kind.startsWith('classic-kristallon')?47:kind.startsWith('classic-kristallin')?40:kind.startsWith('classic-devolarium')?45:kind.startsWith('classic-mordon')?40:kind.startsWith('classic-cubikon')?47:kind==='cube'?35:(kind.startsWith('ship-')||kind.startsWith('classic-ship-'))?46:36;
  let above=base*scale,below=above;
  // Use the full rotational envelope, not the current angle, for stable labels.
  if(!npc)for(const {x,y} of offsets){const r=Math.hypot(x,y)*scale;above=Math.max(above,r+15*scale);below=Math.max(below,r+19*scale);}
  return {top:Math.ceil(above+14),name:Math.ceil(below+15),width:o.type==='boss'?90:58,ring:Math.ceil(base*scale+4)};
 }
 function nameWidth(ctx,cache,name){const font=ctx.font;if(cache.name!==name||cache.font!==font||!Number.isFinite(cache.width)){cache.name=name;cache.font=font;cache.width=ctx.measureText(name).width;}return cache.width;}
 function safeRatio(value,max){return Number.isFinite(value)&&Number.isFinite(max)&&max>0?Math.max(0,Math.min(1,value/max)):0;}
 root.ggGraphics161={draw,portal,droneColor,droneKind,npcStyle,playerStyle,formationOffsets,labelLayout,nameWidth,safeRatio,sky};
})(window);
