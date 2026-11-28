'use strict';
// Original material pass, applied only to classic sprites at cache creation. No external textures.
(function(root){
 function finish(c,kind,color,size){
  const half=size/2,crystal=/kristall|crystal/.test(kind),small=/^drone|^pet$/.test(kind),armored=/mordon|devolarium|sibelon|lordakium|cubikon|ship-/.test(kind);
  c.save();c.globalCompositeOperation='source-atop';
  // Directional highlights preserve the original colors and silhouette.
  const metal=c.createLinearGradient(-half,-half,half,half);
  metal.addColorStop(0,'#f2f7ff55');metal.addColorStop(.24,'#d3e4ef23');metal.addColorStop(.45,'#ffffff08');metal.addColorStop(.64,'#070c1538');metal.addColorStop(1,'#02050c92');
  c.fillStyle=metal;c.fillRect(-half,-half,size,size);
  const light=c.createRadialGradient(-size*.13,-size*.17,0,-size*.13,-size*.17,size*.44);
  light.addColorStop(0,crystal?'#e8faff72':'#f2f5e83a');light.addColorStop(.38,crystal?'#b6e6ff29':'#dce4df16');light.addColorStop(1,'#ffffff00');
  c.fillStyle=light;c.fillRect(-half,-half,size,size);
  let seed=2166136261;for(const ch of kind+color){seed=Math.imul(seed^ch.charCodeAt(0),16777619)>>>0;}
  const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const density=small?2:crystal?3:6;
  for(let i=0;i<Math.round(size*density);i++){const x=rand()*size-half,y=rand()*size-half,w=.35+rand()*(crystal?1.3:2.4);c.fillStyle=i%4===0?'#e9edf02e':'#02081022';c.fillRect(x,y,w,.45+rand()*.45);}
  if(!small&&!crystal){
   // Interrupted, paired seams and rivets rather than a single repeated stripe.
   for(let i=0;i<(armored?34:18);i++){
    const x=(rand()-.5)*size,y=(rand()-.5)*size,w=4+rand()*9,dy=(rand()-.5)*4;
    c.lineWidth=.65;c.strokeStyle='#070c146c';c.beginPath();c.moveTo(x,y);c.lineTo(x+w*.6,y+dy);c.lineTo(x+w,y+dy+2);c.stroke();
    c.lineWidth=.45;c.strokeStyle='#d2e2e34a';c.beginPath();c.moveTo(x,y-.7);c.lineTo(x+w*.6,y+dy-.7);c.stroke();
    if(armored){c.fillStyle='#b9c6c965';c.fillRect(x+w,y+dy+1,1,1);}
   }
  }
  if(crystal){for(let i=0;i<12;i++){const x=(rand()-.5)*size*.8,y=(rand()-.5)*size*.8;c.strokeStyle='#e0faff65';c.lineWidth=.55;c.beginPath();c.moveTo(x,y);c.lineTo(x+3+rand()*8,y-2-rand()*5);c.stroke();}}
  // Tier identification is a material accent, not a change to NPC size or shape.
  // Preserve the reference palette under a restrained edge highlight.
  const tier=kind.match(/-(boss|uber|emperor)$/)?.[1];
  if(tier&&/^classic-(?!ship-|drone|pet|portal|base|station)/.test(kind)){
   const tint=tier==='boss'?'#e99b62':tier==='uber'?'#b79cea':'#f4d17b';
   const sheen=c.createLinearGradient(-half,-half,half,half);
   sheen.addColorStop(0,tint+'66');sheen.addColorStop(.22,tint+'28');sheen.addColorStop(.5,tint+'00');sheen.addColorStop(.82,tint+'08');sheen.addColorStop(1,tint+'38');
   c.fillStyle=sheen;c.fillRect(-half,-half,size,size);
   for(let i=0;i<(tier==='boss'?12:22);i++){
    const x=(rand()-.5)*size*.86,y=(rand()-.5)*size*.86;
    c.fillStyle=tint+'a0';c.fillRect(x,y,1.2,.75);
   }
  }
  c.restore();
 }
 // The supplied images are visual references, not imported or redistributed game assets.
 const sprites=new Map();
 function polygon(c,pts,fill,stroke,width=.7){c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}}
 function linear(c,x,y,X,Y,stops){const g=c.createLinearGradient(x,y,X,Y);for(const [p,col] of stops)g.addColorStop(p,col);return g;}
 function radial(c,x,y,r,stops){const g=c.createRadialGradient(x,y,0,x,y,r);for(const [p,col] of stops)g.addColorStop(p,col);return g;}
 function seeded(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
 function cacheArt(key,paint){if(sprites.has(key)){const hit=sprites.get(key);sprites.delete(key);sprites.set(key,hit);return hit;}const canvas=root.document.createElement('canvas');canvas.width=canvas.height=128;const c=canvas.getContext('2d');c.translate(64,64);paint(c);if(sprites.size>=48)sprites.delete(sprites.keys().next().value);sprites.set(key,canvas);return canvas;}
 const palettes={bonus:['#fff9cd','#c9a754','#675025'],cargo:['#b8f6ff','#4b9eb5','#153648'],paladio:['#e1ffff','#7dccc7','#32696e'],pirate:['#e6ffdb','#68cb7d','#164c35']};
 function lootArt(c,key){const [light,mid,dark]=palettes[key],rand=seeded(287+key.length*53);const glow=radial(c,0,0,52,[[0,mid+'8f'],[.45,mid+'28'],[1,mid+'00']]);c.fillStyle=glow;c.fillRect(-54,-54,108,108);if(key==='pirate'){const steel=linear(c,-30,-30,30,30,[[0,light],[.24,mid],[.57,dark],[1,'#091c16']]);polygon(c,[[-35,-19],[-23,-30],[29,-28],[40,-13],[36,21],[22,30],[-27,28],[-39,14]],steel,light,1.5);polygon(c,[[-27,-15],[27,-15],[32,16],[-31,16]],dark,mid,2);for(const x of [-18,0,18]){c.fillStyle=mid;c.fillRect(x-3,-11,6,22);}polygon(c,[[-8,-9],[8,-9],[12,9],[-12,9]],light,dark);return;}
  const points=[];for(let i=0;i<32;i++){const a=i*Math.PI/16,rad=i%4===0?40+rand()*7:i%2===0?27+rand()*4:22+rand()*3;points.push([Math.cos(a)*rad,Math.sin(a)*rad]);}
  polygon(c,points,radial(c,-9,-11,52,[[0,light],[.38,mid],[.72,dark],[1,mid]]),light,1.3);
  for(let i=0;i<12;i++){const a=i*Math.PI/6+rand()*.2,r=18+rand()*14,x=Math.cos(a)*r,y=Math.sin(a)*r;polygon(c,[[x,y],[Math.cos(a-.2)*13,Math.sin(a-.2)*13],[Math.cos(a+.16)*5,Math.sin(a+.16)*5]],i%2?mid+'b0':light+'a0',dark,.55);}
  c.fillStyle=radial(c,-3,-5,23,[[0,light],[.15,'#faffff'],[.34,mid],[.65,dark],[1,mid+'00']]);c.beginPath();c.arc(0,0,23,0,Math.PI*2);c.fill();
  c.strokeStyle=light;c.lineWidth=1.2;for(let i=0;i<10;i++){const a=i*Math.PI/5;c.beginPath();c.moveTo(Math.cos(a)*3,Math.sin(a)*3);c.lineTo(Math.cos(a)*12,Math.sin(a)*12);c.lineTo(Math.cos(a+.15)*19,Math.sin(a+.15)*19);c.stroke();}
  for(let i=0;i<22;i++){c.fillStyle=i%2?light:mid;const a=rand()*Math.PI*2,r=rand()*33;c.fillRect(Math.cos(a)*r,Math.sin(a)*r,1+rand()*1.5,1);}
 }
 function loot(c,kind){const key=Object.hasOwn(palettes,kind)?kind:'bonus',sprite=cacheArt('loot-'+key,a=>lootArt(a,key)),size=key==='pirate'?40:32;c.drawImage(sprite,-size/2,-size/2,size,size);}
 function iceArt(c){const rand=seeded(51631),glow=radial(c,0,0,59,[[0,'#ffffffb5'],[.36,'#b7e6ff70'],[.78,'#356b9840'],[1,'#112b4500']]);c.fillStyle=glow;c.fillRect(-61,-61,122,122);for(let i=0;i<26;i++){const a=i*2.399963+rand()*.3,r=24+rand()*34,dx=Math.cos(a),dy=Math.sin(a),x=dx*r,y=dy*r,w=5+rand()*16,b=4+rand()*15;polygon(c,[[x,y],[-dy*w-dx*b,dx*w-dy*b],[dy*w-dx*b,-dx*w-dy*b]],i%3===0?'#effcffc9':i%3===1?'#a6dbf3a0':'#5b9ec573','#dcf7ffb0',.55);polygon(c,[[x,y],[dx*6,dy*6],[dy*w-dx*b,-dx*w-dy*b]],'#edfaff75');}
 for(let i=0;i<50;i++){const a=rand()*Math.PI*2,r=rand()*57;c.fillStyle=i%3?'#d4f2ff90':'#ffffff';c.fillRect(Math.cos(a)*r,Math.sin(a)*r,.8+rand()*1.8,.8+rand()*1.5);}
 }
 function ice(c,r){const s=cacheArt('ice',iceArt);c.drawImage(s,-r*1.22,-r*1.22,r*2.44,r*2.44);}
 function impact(c,f){if(f<0||f>=1)return;const s=cacheArt('ice',iceArt),r=12+20*f;c.save();c.globalAlpha=(1-f)*.85;c.drawImage(s,-r,-r,r*2,r*2);c.restore();}
 function streuner(c,color){
  const steel=linear(c,-24,-22,28,22,[[0,'#e2ded4'],[.2,'#666b67'],[.38,'#242829'],[.55,'#9d9d91'],[.73,'#3a3b37'],[1,'#101418']]),red=linear(c,-20,-22,24,24,[[0,'#d18e7d'],[.24,'#91443c'],[.45,'#321b1d'],[.64,'#bc5c4b'],[1,'#2b1518']]);
  polygon(c,[[-34,5],[-24,-5],[-9,-11],[9,-14],[30,-9],[35,-3],[26,3],[10,9],[5,18],[-18,18],[-31,12]],'#1b1719','#64524c',.85);
  for(const y of [-10,11]){polygon(c,[[-25,y-5],[-16,y-8],[4,y-7],[15,y-2],[11,y+6],[-19,y+8],[-27,y+4]],steel,'#8f8479',.75);for(let j=0;j<5;j++){const x=-21+j*5;c.fillStyle='#10171a';c.fillRect(x,y-4,2,9);c.fillStyle='#b4b0a3';c.fillRect(x+2,y-3,1.2,6);}}
  polygon(c,[[-30,3],[-19,-6],[-5,-9],[10,-7],[20,-3],[12,3],[-4,5],[-20,8]],red,'#c58a77',.9);
  polygon(c,[[-5,-13],[2,-20],[14,-21],[20,-14],[17,-8],[4,-9]],steel,'#aaa59c',.65);for(let j=0;j<4;j++){c.fillStyle='#e3dfd1';c.fillRect(-1+j*4,-17,2.2,2);}
  polygon(c,[[15,-15],[27,-12],[36,-6],[29,-1],[21,-5],[17,-8]],red,'#ab544a',.75);
  polygon(c,[[8,7],[17,13],[18,22],[6,18],[-1,12]],red,'#b87863',.65);
  polygon(c,[[-20,-1],[-10,-4],[6,-4],[10,-1],[2,2],[-13,2]],steel,'#594d46',.5);for(let j=0;j<6;j++){c.fillStyle='#f1e7d5';c.fillRect(-16+j*4,-1,1.7,1.6);}
  polygon(c,[[11,-8],[22,-7],[26,-5],[19,-3],[11,-4]],'#080d11','#8c5148',.6);c.fillStyle='#e57a66';c.fillRect(20,-6,5,1.2);
  for(const [x,y] of [[-27,4],[-11,9],[-3,14],[5,-12],[14,12]]){c.fillStyle='#e0b9a5';c.fillRect(x,y,1.7,1.4);}
 }
 // Heavy segmented fighter: original geometry inspired by the supplied green craft.
 function goliath(c,color){
  const steel=linear(c,-30,-26,28,30,[[0,'#697b76'],[.18,'#263935'],[.4,'#101a1c'],[.62,'#3c4946'],[.82,'#182321'],[1,'#090e13']]);
  const trim=linear(c,-20,-20,22,20,[[0,color],[.3,'#31493d'],[.6,'#101b19'],[1,color]]);
  for(const sign of [-1,1]){
   polygon(c,[[-32,sign*6],[-25,sign*18],[-12,sign*26],[4,sign*32],[16,sign*22],[22,sign*13],[34,sign*11],[29,sign*5],[8,sign*6],[-10,sign*8]],steel,'#667969',.75);
   polygon(c,[[-17,sign*11],[-10,sign*27],[5,sign*28],[16,sign*18],[5,sign*12]],'#182424','#52675d',.65);
   polygon(c,[[8,sign*6],[17,sign*8],[26,sign*7],[33,sign*11],[29,sign*15],[19,sign*17],[15,sign*13]],trim,'#7b9382',.65);
   polygon(c,[[-30,sign*7],[-20,sign*10],[-12,sign*8],[-13,sign*5],[-29,sign*4]],color,'#294a39',.45);
   for(let i=0;i<4;i++){const x=-8+i*4;polygon(c,[[x,sign*19],[x+2,sign*20],[x+6,sign*17],[x+4,sign*16]],'#82908a','#17241f',.35);}
   c.fillStyle=radial(c,5,sign*10,7,[[0,'#ffffcf'],[.3,color],[1,color+'00']]);c.fillRect(-2,sign*10-7,14,14);
  }
  polygon(c,[[-34,0],[-25,-6],[-11,-10],[6,-8],[15,-5],[30,-6],[36,0],[30,6],[15,5],[6,8],[-11,10],[-25,6]],steel,'#82968a',.8);
  polygon(c,[[-26,0],[-16,-4],[-4,-3],[3,0],[-4,3],[-16,4]],trim,color,.6);
  polygon(c,[[4,-5],[19,-4],[24,0],[19,4],[4,5],[10,0]],color,'#bdd3b9',.5);
  polygon(c,[[28,-3],[33,0],[28,3],[23,0]],'#a9b6a9','#293e31',.45);
  for(const y of [-6,6]){c.fillStyle='#a6b9a5';c.fillRect(-19,y-.5,7,1);}
  const armor=linear(c,-24,-24,20,24,[[0,'#aabbb6'],[.23,'#536b63'],[.5,'#1d302c'],[.78,'#758980'],[1,'#263a32']]);
  for(const s of [-1,1]){
   polygon(c,[[-17,13*s],[-8,25*s],[4,28*s],[10,22*s],[-5,17*s]],armor,'#8da198',.55);
   polygon(c,[[17,9*s],[29,9*s],[31,11*s],[23,13*s]],'#243a32','#98aca0',.5);
   for(let i=0;i<3;i++){c.fillStyle='#101b1b';c.fillRect(-9+i*4,21*s-1,2,2);c.fillStyle=color;c.fillRect(-9+i*4,21*s-1,2,.65);}
  }
  polygon(c,[[19,0],[14,-2.8],[8,-2.8],[5,0],[8,2.8],[14,2.8]],linear(c,5,-3,19,3,[[0,'#0e252e'],[.45,'#76b5c2'],[1,'#203e47']]),'#b2c5c0',.5);
 }
 // Original organic radial hulls, based on the shape language of the reference set.
 function radialAlien(c,large,elite,color){
  const radius=large?39:27,arms=large?9:8,rand=seeded(large?1743:3985);
  const light=large?'#fff0b9':'#a5e2ed',mid=large?'#c6a35c':'#447e8d',dark=large?'#60542f':'#153b47';
  const shell=radial(c,-8,-10,radius,[[0,light],[.25,mid],[.6,dark],[.83,mid],[1,dark]]);
  for(let i=0;i<arms;i++){
   const a=i*Math.PI*2/arms+(rand()-.5)*.28,r=radius*(.86+rand()*.18);
   c.save();c.rotate(a);c.beginPath();c.moveTo(radius*.42,-radius*.18);
   c.bezierCurveTo(radius*.65,-radius*.18,r*.84,-radius*.07,r,0);
   c.bezierCurveTo(r*1.08,radius*.15,r*.79,radius*.15,radius*.56,radius*.22);
   c.closePath();c.fillStyle=shell;c.fill();c.strokeStyle=light;c.lineWidth=1;c.stroke();c.restore();
  }
  const body=radius*.64;c.beginPath();c.arc(0,0,body,0,Math.PI*2);c.fillStyle=shell;c.fill();c.strokeStyle=light;c.lineWidth=1.1;c.stroke();
  for(let i=0;i<arms;i++){const a=i*Math.PI*2/arms;c.save();c.rotate(a);c.strokeStyle=light;c.lineWidth=.7;c.beginPath();c.ellipse(body*.54,0,body*.29,body*.11,0,0,Math.PI*2);c.stroke();c.restore();}
  for(let i=0;i<18;i++){const a=rand()*Math.PI*2,r=rand()*body*.82;c.fillStyle=i%3?mid:light;c.fillRect(Math.cos(a)*r,Math.sin(a)*r,1.3,1);}
  c.fillStyle=radial(c,-2,-2,body*.45,[[0,light],[.3,elite?color:mid],[1,dark+'00']]);c.fillRect(-body/2,-body/2,body,body);
 }
 function alien(c,kind,color){
  if(kind.includes('lordakia')){radialAlien(c,false,kind!=='classic-lordakia',color);return;}
  // Saimon: thin forward prongs above a dark hooked, ribbed underside.
  const steel=linear(c,-28,-22,35,21,[[0,'#afc0ce'],[.2,'#536575'],[.47,'#141e28'],[.69,'#536474'],[1,'#0c151d']]);
  polygon(c,[[-30,0],[-22,-13],[-8,-19],[3,-13],[9,-9],[30,-10],[39,-14],[27,-3],[4,4],[-9,8],[-19,19],[-32,12]],steel,'#768b9e',.8);
  polygon(c,[[-16,-13],[9,-23],[30,-32],[13,-15],[-2,-7],[-16,-5]],steel,'#a3b5c4',.7);
  polygon(c,[[-23,-2],[-11,-10],[12,-7],[35,-9],[18,-2],[-3,4]],'#263747','#7f94a8',.65);
  for(let i=0;i<4;i++){const x=-20+i*5;c.strokeStyle='#506371';c.lineWidth=2.4;c.beginPath();c.moveTo(x,5);c.quadraticCurveTo(x+9,13,x+2,24-i*3);c.stroke();}
  polygon(c,[[-13,-14],[-5,-15],[5,-10],[-6,-6]],'#192631','#9bafbd',.55);
 }
 function mineArt(c,armed){
  const accent=armed?'#fa573c':'#e7b368',glow=radial(c,0,8,51,[[0,accent+'90'],[.55,accent+'32'],[1,accent+'00']]);c.fillStyle=glow;c.fillRect(-60,-55,120,110);
  const metal=linear(c,-26,-35,25,35,[[0,'#d5c4b6'],[.25,'#776863'],[.55,'#27252a'],[1,'#796565']]);
  for(let i=0;i<6;i++){const a=i*Math.PI/3,dx=Math.cos(a),dy=Math.sin(a);polygon(c,[[dx*7-dy*5,dy*7+dx*5],[dx*38-dy*2,dy*38+dx*2+9],[dx*43,dy*43+9],[dx*14+dy*5,dy*14-dx*5]],metal,'#b19688',1);}
  polygon(c,[[-16,9],[-13,-25],[0,-38],[12,-26],[17,7],[4,19],[-8,17]],metal,'#d7b3a5',1.5);
  polygon(c,[[-8,5],[-8,-21],[0,-30],[7,-21],[9,5],[0,12]],'#382d2e','#9d7167',1);
  for(let y=-18;y<8;y+=7){polygon(c,[[-7,y],[0,y+6],[7,y]],'#7e5a54','#241e21',.7);}
  polygon(c,[[-8,-24],[0,-32],[8,-24],[4,-20],[-4,-20]],accent,'#ffdec6',1.2);
 }
 function mine(c,armed,t){const s=cacheArt('mine-'+String(armed),a=>mineArt(a,armed));c.save();c.globalAlpha=.9+.1*Math.sin(t/180);c.drawImage(s,-20,-20,40,40);c.restore();}
 function stationArt(c,color){
  const steel=linear(c,-45,-30,45,30,[[0,'#b1c6c5'],[.24,'#617e80'],[.47,'#253b42'],[.68,'#152830'],[1,'#455c60']]);
  polygon(c,[[-49,-8],[-35,-24],[-12,-25],[2,-13],[19,-25],[43,-17],[51,-4],[44,19],[18,28],[-9,19],[-31,27],[-48,13]],'#17272c','#648087',1);
  polygon(c,[[-40,-4],[-31,-15],[-22,-17],[-9,-6],[-13,11],[-28,18],[-42,11]],steel,'#879e9c',1);
  polygon(c,[[-18,-34],[2,-35],[8,-24],[9,24],[0,36],[-15,33],[-23,21],[-22,-24]],steel,'#91a4a0',1.5);
  for(let y=-25;y<25;y+=12){polygon(c,[[-15,y],[2,y],[5,y+7],[-14,y+7]],'#263d42','#8ca8a8',.85);for(let i=0;i<4;i++){c.fillStyle='#a5c1bd';c.fillRect(-12+i*3.7,y+2,2,2);}}
  polygon(c,[[17,-23],[38,-20],[48,-10],[43,14],[26,24],[14,10]],steel,'#8ea7a7',1);
  polygon(c,[[23,-9],[38,-8],[41,4],[34,13],[22,9]],'#23373c','#75908f',1);for(let i=0;i<4;i++){c.fillStyle='#91a9a6';c.fillRect(25,-5+i*4,12,1.3);}
  c.strokeStyle='#c1d0c7';c.lineWidth=1.6;for(const y of [-8,7]){c.beginPath();c.moveTo(7,y);c.bezierCurveTo(17,y-15,15,y+15,24,y);c.stroke();}
  for(const [x,y] of [[-7,-28],[-6,29],[31,-17],[35,17]]){c.fillStyle=color;c.fillRect(x-1.5,y-1,3,2);}
 }
 function station(c,color){const s=cacheArt('station-'+color,a=>stationArt(a,color));c.drawImage(s,-60,-60,120,120);}
 // Separate species geometry; elite variants retain their species silhouette and add armor.
 function largeAlien(c,kind,color){
  const [,species,tier='normal']=kind.split('-'),elite=tier!=='normal';
  const steel=linear(c,-36,-35,36,35,[[0,'#c0c9c8'],[.2,'#697e89'],[.42,'#202f3d'],[.6,'#526674'],[.8,'#1b2935'],[1,'#0b141f']]);
  const armor=linear(c,-30,-32,32,30,[[0,color],[.25,'#646b66'],[.48,'#1b262b'],[.75,'#38464b'],[1,'#10191f']]);
  const gem=linear(c,-24,-28,26,28,[[0,'#e6f8ff'],[.25,color],[.5,'#203c58'],[.75,color],[1,'#0e243c']]);
  const seam='#718b9b';
  if(species==='kristallin'||species==='kristallon'){
   // References IMG_5849 and IMG_5850: compact, irregular crystal clusters,
   // not winged craft. Independently drawn facets and deterministic silhouettes.
   const big=species==='kristallon',reach=big?46:38;
   const rand=seeded(big?19741:8429), count=big?15:10;
   const pale=elite?'#cceeff':'#e4faff', deep=elite?'#5086b3':'#739db4';
   const facets=[];
   for(let i=0;i<count;i++){
    const angle=i*Math.PI*2/count+(rand()-.5)*.38;
    const dx=Math.cos(angle),dy=Math.sin(angle),px=-dy,py=dx;
    const r=reach*(.68+rand()*.30), w=reach*(.12+rand()*.16), base=reach*(.11+rand()*.17);
    const cx=dx*base+(rand()-.5)*5,cy=dy*base+(rand()-.5)*5;
    const tip=[dx*r,dy*r],l=[cx+px*w,cy+py*w],right=[cx-px*w,cy-py*w];
    const heel=[-dx*reach*.22,-dy*reach*.22],ridge=[dx*r*.53+px*w*.14,dy*r*.53+py*w*.14];
    facets.push({tip,l,right,heel,ridge});
   }
   const aura=radial(c,0,0,reach*1.12,[[0,'#d9f4ff66'],[.66,'#a2cde321'],[1,'#a2cde300']]);
   c.fillStyle=aura;c.fillRect(-reach*1.12,-reach*1.12,reach*2.24,reach*2.24);
   for(const {tip,l,right,heel,ridge} of facets){
    polygon(c,[tip,l,heel,right],linear(c,...tip,...heel,[[0,'#f5fdff'],[.42,pale],[1,deep]]),'#e0f7ff91',.7);
    polygon(c,[tip,l,ridge],'#f7fdffe0');
    polygon(c,[tip,ridge,right],'#85b6d2c0');
    polygon(c,[l,heel,ridge],'#bce7f4a8');
    polygon(c,[right,ridge,heel],'#3f668d90');
    c.strokeStyle='#f7fdffb0';c.lineWidth=.5;c.beginPath();c.moveTo(...tip);c.lineTo(...ridge);c.lineTo(...heel);c.stroke();
   }
   const core=Array.from({length:big?11:8},(_,i)=>{const a=i*Math.PI*2/(big?11:8),r=reach*(.27+rand()*.17);return [Math.cos(a)*r,Math.sin(a)*r];});
   polygon(c,core,radial(c,-4,-6,reach*.45,[[0,'#ffffff'],[.4,'#e5faff'],[1,'#7eb1cc']]),'#eafaff',.65);
   for(let i=0;i<core.length;i++){const p=core[i],q=core[(i+1)%core.length];polygon(c,[p,q,[(rand()-.5)*10,(rand()-.5)*10]],i%3===0?'#ffffffb0':i%3===1?'#a8d9eac0':'#d4f2f9a0','#e7fbff70',.4);}
   for(let i=0;i<(big?22:12);i++){const a=rand()*Math.PI*2,r=reach*(.70+rand()*.31);c.fillStyle=i%3?'#c1e4f380':'#f1fcff';c.fillRect(Math.cos(a)*r,Math.sin(a)*r,.8+rand()*1.1,.8+rand()*1.1);}
  }else if(species==='mordon'||species==='devolarium'||species==='sibelon'){
   // Distinct original silhouettes: rust-colored tower with articulated legs,
   // and broad blue-gray machinery with separated armored modules.
   if(species==='mordon'){
    const bronze=linear(c,-32,-35,32,32,[[0,'#f3b29a'],[.22,'#a55742'],[.48,'#382527'],[.72,'#b16e51'],[1,'#352124']]);
    const tower=linear(c,-13,-39,14,13,[[0,'#b4a7a2'],[.28,'#53545b'],[.55,'#292a31'],[.82,'#a08276'],[1,'#392b2a']]);
    c.fillStyle=radial(c,0,12,47,[[0,'#ef754c65'],[.55,'#af492b38'],[1,'#af492b00']]);c.fillRect(-48,-32,96,88);
    for(const [x,y] of [[-37,22],[-15,38],[12,40],[37,21],[-34,5],[34,5]]){
     const hx=x*.5,hy=8+y*.22;
     polygon(c,[[-6,5],[hx-3,hy-3],[x,y],[hx+3,hy+4],[6,13]],bronze,'#bba094',.8);
     polygon(c,[[hx-2,hy],[x,y],[x*.85,y+5],[hx+2,hy+3]],steel,'#a58a7c',.65);
    }
    polygon(c,[[-17,-20],[-11,-35],[1,-42],[15,-29],[19,-10],[14,12],[0,20],[-15,10]],tower,'#bda49a',1);
    polygon(c,[[-10,-28],[0,-34],[10,-26],[8,7],[0,13],[-9,5]],'#272a31','#95786a',.75);
    for(let y=-25;y<5;y+=8){polygon(c,[[-8,y],[7,y+7],[7,y+9],[-8,y+2]],'#a88c80');polygon(c,[[7,y],[-8,y+7],[-8,y+9],[7,y+2]],'#796965');}
    polygon(c,[[-10,-34],[0,-41],[10,-33],[7,-27],[-7,-27]],bronze,'#f2b39a',.9);
    for(const side of [-1,1])polygon(c,[[side*11,-30],[side*17,-19],[side*15,10],[side*9,13],[side*12,-14]],bronze,'#bc9c8b',.6);
    if(elite){c.fillStyle=color;c.fillRect(-5,-36,10,3);}
   }else if(species==='devolarium'){
    const armorGreen=linear(c,-42,-26,42,28,[[0,'#738b44'],[.24,'#3b512c'],[.52,'#172921'],[.72,'#455c31'],[1,'#101d16']]);
    polygon(c,[[-45,-7],[-29,-20],[-9,-26],[15,-23],[37,-14],[45,-6],[37,7],[43,15],[24,24],[-5,28],[-26,20],[-39,12]],armorGreen,'#536d3c',.9);
    for(const side of [-1,1]){
     polygon(c,[[-39,5*side],[-20,16*side],[8,22*side],[30,16*side],[37,7*side],[12,8*side],[-5,4*side]],armorGreen,'#78924a',.65);
     polygon(c,[[-26,5*side],[-15,10*side],[8,9*side],[22,13*side],[30,9*side],[12,3*side],[-10,2*side]],'#233526','#5a8038',.6);
     for(let i=0;i<4;i++){c.fillStyle='#79974b';c.fillRect(-20+i*7,side*17-1,4,1);}
    }
    polygon(c,[[-32,0],[-15,-6],[13,-5],[36,-1],[25,4],[0,6],[-15,4]],'#23352a','#8fa857',.8);
    for(const [x,y,r] of [[-29,-2,4],[-8,0,6],[12,-3,5],[28,-2,3],[7,13,3]]){
     c.fillStyle=radial(c,x,y,r,[[0,'#e2ff8f'],[.3,'#91e323'],[1,'#68bb1200']]);c.fillRect(x-r,y-r,r*2,r*2);
    }
   }else{
    const hull=linear(c,-48,-29,44,29,[[0,'#c4dcda'],[.18,'#75969a'],[.42,'#37545d'],[.66,'#172a32'],[.83,'#59777d'],[1,'#24343c']]);
    const inset='#172c35',rim='#85a8ac';
    polygon(c,[[-46,0],[-39,-17],[-24,-25],[12,-21],[35,-15],[46,-4],[44,14],[28,24],[-25,25],[-42,14]],inset,'#54747e',.85);
    polygon(c,[[-18,-34],[2,-34],[9,-25],[11,23],[4,32],[-15,31],[-21,21],[-22,-23]],hull,rim,1);
    polygon(c,[[-15,-26],[3,-26],[5,-13],[-16,-13]],'#365661',rim,.7);
    polygon(c,[[-16,-8],[4,-8],[5,18],[-15,18]],inset,rim,.8);
    for(let y=-5;y<17;y+=5){c.fillStyle='#67898f';c.fillRect(-12,y,14,2);}
    polygon(c,[[15,-26],[31,-21],[43,-11],[47,9],[33,24],[16,21],[21,9],[18,-8]],hull,rim,.9);
    for(const [x,y] of [[17,-23],[27,-20],[36,-14]]){polygon(c,[[x,y],[x+6,y+1],[x+7,y+12],[x+1,y+13]],'#95b4b6','#3b5962',.5);}
    polygon(c,[[23,0],[38,3],[37,15],[25,17],[21,9]],inset,rim,.7);
    for(let i=0;i<3;i++){c.fillStyle='#6d8990';c.fillRect(25,5+i*3,10,1.5);}
    for(const side of [-1,1]){
     polygon(c,[[-43,3*side],[-37,15*side],[-25,20*side],[-25,9*side]],hull,rim,.7);
     c.strokeStyle='#77969d';c.lineWidth=1;c.beginPath();c.moveTo(-38,8*side);c.bezierCurveTo(-33,18*side,-24,2*side,-20,10*side);c.stroke();
     polygon(c,[[7,3*side],[14,5*side],[19,15*side],[10,17*side]],steel,'#5b7c84',.65);
    }
    if(elite){c.fillStyle=color;for(const x of [-16,-9,-2,31])c.fillRect(x,-22,3,2);}
   }
  }else{
   // Three-dimensional modular cube; three visible faces and separately recessed plates.
   const top=[[0,-42],[38,-22],[0,-2],[-38,-22]],left=[[-38,-22],[0,-2],[0,42],[-38,22]],right=[[0,-2],[38,-22],[38,22],[0,42]];
   polygon(c,top,steel,'#bcc9c9',1);polygon(c,left,'#364956',seam,1);polygon(c,right,'#182932',seam,1);
   for(const side of [-1,1])for(let row=0;row<2;row++)for(let col=0;col<2;col++){const x=side*(4+col*16),y=6+row*19-col*8;polygon(c,[[x,y],[x+side*13,y-6],[x+side*13,y+8],[x,y+14]],steel,seam,.65);polygon(c,[[x+side*3,y+2],[x+side*10,y-1],[x+side*10,y+5],[x+side*3,y+8]],'#0b1c28',color,.55);}
   polygon(c,[[0,-34],[24,-22],[0,-10],[-24,-22]],armor,color,1);polygon(c,[[0,-29],[13,-22],[0,-15],[-13,-22]],gem,color,.65);
   for(const side of [-1,1]){c.fillStyle=color;c.fillRect(side*28-1,14,2,3);}
  }
 }
 // Independent organic/mechanical profiles for the remaining common families and pirate ships.
 const raiderProfiles={
  sibelon:[39,34,31,16,3],sibelonit:[32,24,22,11,1],lordakium:[33,37,30,15,4],
  interceptor:[40,17,28,7,0],vagrant:[28,20,24,11,1],marauder:[34,28,30,13,2],
  barracuda:[43,19,30,9,0],saboteur:[30,32,21,10,4],annihilator:[35,34,34,17,3],'deadly-battleray':[42,36,35,18,2]
 };
 // Compact Sibelonit: original artwork informed by IMG_5846.
 function sibelonit(c,tier,color){
  const green=radial(c,-9,-10,38,[[0,'#85d887'],[.26,'#32984a'],[.52,'#176b37'],[.79,'#17412d'],[1,'#081c19']]);
  const steel=linear(c,-33,-21,34,25,[[0,'#b6c7c9'],[.21,'#74858a'],[.47,'#26363c'],[.72,'#52656b'],[1,'#111c23']]);
  // An asymmetrical cluster with two metallic forks and an offset upper core.
  polygon(c,[[-38,14],[-28,7],[-16,4],[-10,13],[-17,26],[-35,26],[-40,21]],steel,'#667b80',.85);
  polygon(c,[[17,-13],[30,-11],[42,1],[39,11],[27,8],[13,0]],steel,'#91a1a3',.7);
  for(let i=0;i<4;i++){
   polygon(c,[[-37+i*4,20],[-25+i*3,17],[-16+i*2,20],[-32+i*3,24]],i%2?'#75898e':'#3d5158','#17292c',.55);
   polygon(c,[[24+i*3,-8+i*2],[34+i*2,2+i*3],[38+i,5+i*3],[35+i,7+i*3]],i%2?'#b9c8c9':'#788e90','#24363d',.5);
  }
  polygon(c,[[-29,9],[-20,-5],[-19,-21],[-9,-28],[6,-23],[12,-14],[25,-17],[34,-11],[22,-4],[15,6],[4,20],[-13,20],[-24,16]],green,'#457c51',1);
  for(const pts of [[[-25,12],[-16,4],[-9,-8],[-5,-5],[-11,8],[-18,16]],[[1,-15],[12,-12],[29,-14],[21,-8],[7,-4]],[[0,0],[13,2],[10,12],[1,19],[-5,11]]]){
   polygon(c,pts,green,'#64af6b',.65);
  }
  const rand=seeded(5846);
  for(let i=0;i<24;i++){const x=(rand()-.5)*36,y=(rand()-.5)*31;if(x*x/324+y*y/240<1){c.fillStyle=i%3===0?'#8cce8c80':'#0d3e2690';c.fillRect(x,y,.9+rand()*1.2,.8);}}
  c.fillStyle=radial(c,-3,-14,13,[[0,'#fff8b7'],[.31,'#efce6f'],[.56,'#ab792c'],[.76,'#664719'],[1,'#d0a55300']]);c.fillRect(-16,-27,26,26);
  c.beginPath();c.arc(-3,-14,6.3,0,Math.PI*2);c.strokeStyle='#eac77b';c.lineWidth=.8;c.stroke();
  if(tier!=='normal'){c.strokeStyle=tier==='uber'?'#e9d6ff':color;c.lineWidth=1.2;c.beginPath();c.arc(-3,-14,8.5,0,Math.PI*2);c.stroke();}
 }
 function raider(c,kind,color){
  const id=kind.slice(8).replace(/-(boss|uber|emperor)$/,''),elite=kind!==('classic-'+id);
  if(id==='lordakium'){radialAlien(c,true,elite,color);return;}
  if(id==='sibelon'){largeAlien(c,kind,color);return;}
  if(id==='sibelonit'){sibelonit(c,elite?kind.split('-').at(-1):'normal',color);return;}
  const [nose,wing,back,body,shape]=raiderProfiles[id]||raiderProfiles.vagrant;
  const steel=linear(c,-back,-wing,nose,wing,[[0,'#c0c9c8'],[.18,'#6a7b82'],[.35,'#293a42'],[.55,'#0b1721'],[.75,'#4b5b60'],[1,'#13202a']]);
  const plating=linear(c,-20,-wing,25,wing,[[0,color],[.27,'#515e62'],[.49,'#141e26'],[.7,'#48575c'],[1,color]]);
  for(const s of [-1,1]){
   const tip=shape===0?nose*.5:shape===1?-back*.75:shape===2?body*.5:shape===3?-back*.35:nose*.15;
   const edge=shape===4?[[nose*.34,body*.6],[tip,wing],[-back*.5,wing*.75],[-back,wing*.42],[-body,body*.35]]:[[nose*.45,body*.65],[tip,wing],[-back,wing*.8],[-back*.8,body*.65],[-body,body*.35]];
   polygon(c,edge.map(([x,y])=>[x,y*s]),steel,'#80939d',.7);
   polygon(c,[[nose*.32,body*.7*s],[tip,wing*.8*s],[-back*.78,wing*.65*s],[-body,body*.7*s]],plating,color,.65);
   for(let i=0;i<3;i++){const x=-back*.75+i*back*.25;polygon(c,[[x,wing*.52*s],[x+3,wing*.57*s],[x+7,wing*.34*s],[x+4,wing*.3*s]],'#71838b','#17242b',.35);}
   polygon(c,[[-back,body*.5*s],[-back+6,body*.42*s],[-back+6,body*.78*s],[-back,body*.84*s]],'#0a141b','#a0aeb3',.5);
   c.fillStyle=color;c.fillRect(-back+1,body*.61*s-1,4,2);
   if(shape===4||elite){polygon(c,[[nose*.2,wing*.45*s],[nose*.48,wing*.72*s],[nose*.15,wing*.94*s],[-body*.3,wing*.7*s]],steel,color,.65);}
   if(shape===3){polygon(c,[[nose*.3,body*.8*s],[nose*.65,wing*.43*s],[nose*.23,wing*.65*s],[-back*.35,wing*.48*s]],steel,'#9babb0',.65);}
  }
  polygon(c,[[nose,0],[nose*.45,-body*.7],[-body,-body],[-back,-body*.48],[-back,body*.48],[-body,body],[nose*.45,body*.7]],steel,'#a0b0b6',.85);
  polygon(c,[[nose*.78,0],[nose*.25,-body*.44],[-body*.6,-body*.5],[-back*.6,0],[-body*.6,body*.5],[nose*.25,body*.44]],plating,color,.6);
  polygon(c,[[nose*.48,0],[nose*.1,-body*.27],[-body*.4,0],[nose*.1,body*.27]],'#17232a',color,.6);
  polygon(c,[[nose*.38,0],[nose*.08,-body*.14],[-body*.12,0],[nose*.08,body*.14]],color);
  for(const s of [-1,1]){
   polygon(c,[[nose*.25,body*.44*s],[-body*.6,body*.5*s],[-back*.48,body*.42*s],[-body*.4,body*.32*s]],steel,'#8ca0aa',.45);
   if(elite){c.fillStyle=color;c.fillRect(-body*.45,body*.48*s-.6,body*.7,1.2);}
  }
 }
 function vant(c,kind,color){
  const id=kind.slice(6),red=color==='#ff3838',blue=color==='#398dff',spartan=color==='#ff8a24';
  const special=red||blue||spartan,wing=red?'#a32228':blue?'#2055a4':spartan?'#315f91':'#a98d42';
  const light=blue?'#dbeaff':'#ffe478',span=id==='flax'?5:id==='apis'?10:id==='zeus'?11:8;
  const steel=linear(c,-12,-8,12,8,[[0,'#e0e8ee'],[.23,'#758b9b'],[.48,'#202d3a'],[.72,'#536575'],[1,'#101820']]);
  const paint=linear(c,-8,-span,8,span,[[0,'#d1dbe0'],[.16,wing],[.54,'#151f30'],[.82,wing],[1,'#080d16']]);
  for(const side of [-1,1]){
   const y=side*span;
   const hull=spartan?[[12,2*side],[8,y],[-9,y],[-13,5*side],[-6,2*side]]:[[8,2*side],[3,y],[-3,y*1.12],[-11,y*.75],[-8,3*side],[-2,2*side]];
   polygon(c,hull,paint,'#778995',.6);
   polygon(c,[[5,3*side],[1,y*.83],[-6,y*.78],[-3,3*side]],wing,'#b0bbc5',.35);
   polygon(c,[[-11,2*side],[-6,2*side],[-4,4*side],[-10,5*side]],steel,'#101821',.4);
   if(spartan||id==='zeus')polygon(c,[[-9,5*side],[-5,6*side],[-3,3*side],[-8,2*side]],'#b13237','#a5bac9',.4);
   if(id==='apis'||id==='zeus')polygon(c,[[0,y],[4,y*.8],[6,y*.45],[2,y*.52]],'#c3a05a','#69542d',.4);
  }
  polygon(c,[[12,0],[7,-4],[-5,-5],[-11,-3],[-11,3],[-5,5],[7,4]],steel,'#a3b4c2',.75);
  polygon(c,[[9,-2],[3,-4],[-4,-3],[-7,0],[-4,3],[3,4],[9,2]],'#172330','#9cacb9',.5);
  c.fillStyle=radial(c,5,0,5,[[0,'#ffffff'],[.26,light],[.68,special?wing:'#b98e36'],[1,'#121923']]);
  c.beginPath();c.arc(5,0,4.5,0,Math.PI*2);c.fill();c.strokeStyle='#b5c4ce';c.lineWidth=.6;c.stroke();
  for(const side of [-1,1]){c.fillStyle='#c4d3db';c.fillRect(-7,side*3,2,.65);}
 }
 // Hand-authored half-hull outlines, reflected around the centerline. Nose faces +X.
 const pilotOutlines={
  phoenix:[[29,0],[10,7],[-9,9],[-24,15],[-20,7],[-28,3],[-25,0]],
  yamato:[[31,0],[22,9],[4,13],[-5,22],[-22,20],[-26,8],[-21,0]],
  defcom:[[31,0],[15,6],[8,19],[-8,25],[-26,15],[-17,7],[-27,0]],
  liberator:[[34,0],[25,12],[11,15],[-4,25],[-23,24],[-28,11],[-25,0]],
  piranha:[[39,0],[18,6],[8,15],[-15,23],[-29,18],[-23,7],[-32,0]],
  nostromo:[[29,0],[23,11],[6,26],[-10,29],[-28,19],[-33,8],[-29,0]],
  bigboy:[[30,0],[28,17],[14,31],[-15,34],[-32,24],[-34,11],[-28,0]],
  leonov:[[34,0],[26,5],[18,21],[3,23],[-10,17],[-24,24],[-30,10],[-26,0]],
  vengeance:[[43,0],[20,5],[8,24],[-14,28],[-32,17],[-22,6],[-34,0]],
  goliath:[[36,0],[32,11],[22,15],[16,22],[4,32],[-12,26],[-25,18],[-32,6],[-34,0]],
  spearhead:[[46,0],[27,5],[18,12],[5,13],[-16,22],[-34,14],[-24,5],[-36,0]],
  aegis:[[32,0],[29,12],[17,28],[-6,34],[-26,26],[-33,11],[-29,0]],
  citadel:[[35,0],[34,18],[22,31],[-15,35],[-36,26],[-39,11],[-35,0]]
 };
 const designModules={Diminisher:'claws',Sentinel:'shield',Solace:'medic',Spectrum:'prism',Venom:'spines',Lightning:'thrust',Bastion:'shield',Enforcer:'cannons',Centaur:'armor',Exalted:'crest',Veteran:'stripes',Goal:'crest',Referee:'stripes',Kick:'thrust',Revenge:'cannons',Avenger:'spines',Saturn:'ring','aegis-veteran':'stripes','aegis-elite':'medic','citadel-veteran':'armor','citadel-elite':'cannons','spearhead-veteran':'stripes','spearhead-elite':'spines'};
 function mirrored(outline){return outline.concat(outline.slice(1,-1).reverse().map(([x,y])=>[x,-y]));}
 function pilot(c,kind,color,baseHull){
  const [ship,design]=kind.slice('classic-ship-'.length).split(':'),profile=pilotOutlines[ship]||pilotOutlines.phoenix,module=designModules[design];
  const steel=linear(c,-33,-32,36,32,[[0,'#ccd4d5'],[.14,'#7f9195'],[.34,'#3b494d'],[.53,'#111b23'],[.67,'#58696c'],[.85,'#263239'],[1,'#0a1018']]);
  const tinted=linear(c,-25,-30,30,30,[[0,color],[.22,'#89998c'],[.4,'#263735'],[.61,'#0d1b21'],[.79,color],[1,'#18292a']]);
  if(typeof baseHull==='function')baseHull(c,ship,color);
  else if(ship==='goliath')goliath(c,color);
  else{
   polygon(c,mirrored(profile),steel,'#879ba0',.8);
   const nose=profile[0][0],rear=Math.min(...profile.map(p=>p[0])),span=Math.max(...profile.map(p=>p[1]));
   for(const s of [-1,1]){
    polygon(c,[[nose*.42,5*s],[nose*.15,span*.62*s],[-5,span*.85*s],[rear*.8,span*.62*s],[rear*.5,7*s]],tinted,color,.65);
    polygon(c,[[nose*.26,8*s],[-5,span*.55*s],[rear*.7,span*.6*s],[rear*.55,10*s]],'#17262c','#60767a',.55);
    for(let i=0;i<4;i++){const x=rear*.68+i*5;polygon(c,[[x,span*.48*s],[x+3,span*.48*s],[x+6,span*.34*s],[x+3,span*.34*s]],'#91a0a2','#18262d',.35);}
    polygon(c,[[rear+3,4*s],[rear+9,5*s],[rear+9,10*s],[rear+3,8*s]],'#111b24','#84969b',.65);
    c.fillStyle=color;c.fillRect(rear+4,6*s-1.1,3,2.2);
   }
   polygon(c,[[nose-2,0],[nose*.38,-5],[-12,-7],[rear+6,0],[-12,7],[nose*.38,5]],steel,'#87989c',.65);
   polygon(c,[[nose*.42,0],[nose*.08,-4],[-6,0],[nose*.08,4]],color,'#cee5e0',.55);
   // Recessed cockpit, segmented armor and engine ports follow each hull's proportions.
   const canopy=linear(c,-8,-5,nose*.42,5,[[0,'#08131e'],[.35,'#39596b'],[.58,'#b0d9e6'],[1,'#18303e']]);
   polygon(c,[[nose*.40,0],[nose*.20,-3.5],[-4,-4],[-9,0],[-4,4],[nose*.20,3.5]],canopy,'#9bb6c3',.6);
   for(const s of [-1,1]){
    polygon(c,[[nose*.12,span*.64*s],[-5,span*.80*s],[rear*.62,span*.59*s],[-5,span*.69*s]],steel,'#80949d',.45);
    for(let j=0;j<3;j++){const x=rear*.55+j*4;c.fillStyle='#101c25';c.fillRect(x,span*.27*s-1.4,2.7,2.8);c.fillStyle='#a5b8c1';c.fillRect(x,span*.27*s-1.4,2.7,.6);}
    polygon(c,[[rear+4,5*s],[rear+10,5*s],[rear+10,9*s],[rear+4,8*s]],'#0c1822','#91a6b1',.55);
    polygon(c,[[rear+5,6*s],[rear+8,6*s],[rear+8,8*s],[rear+5,7*s]],color,'#d5e7ed',.35);
   }
   if(ship==='aegis')for(const s of [-1,1])polygon(c,[[-9,15*s],[2,15*s],[2,24*s],[-9,24*s]],'#b2d1cb',color,.7);
   if(ship==='citadel')for(const s of [-1,1])polygon(c,[[22,10*s],[31,15*s],[25,25*s],[15,22*s]],steel,'#92a5a7',.9);
  }
  if(!module)return;
  // The equipped design adds physical details instead of recoloring alone.
  for(const s of [-1,1]){
   if(module==='claws'||module==='spines'){polygon(c,[[9,12*s],[28,18*s],[40,12*s],[32,23*s],[13,29*s]],steel,color,.8);polygon(c,[[22,17*s],[36,13*s],[30,21*s]],color);}
   else if(module==='shield'||module==='armor'){polygon(c,[[-15,15*s],[10,14*s],[23,21*s],[11,33*s],[-18,28*s]],steel,color,.9);polygon(c,[[-8,18*s],[10,18*s],[16,23*s],[7,27*s],[-9,25*s]],tinted,color,.55);}
   else if(module==='prism'){polygon(c,[[3,12*s],[20,20*s],[8,33*s],[-9,24*s]],tinted,'#d0bce8',.9);polygon(c,[[8,15*s],[17,20*s],[8,25*s]],color);}
   else if(module==='cannons'){polygon(c,[[9,12*s],[32,13*s],[42,10*s],[42,15*s],[30,18*s],[9,18*s]],steel,'#b1bcbe',.7);c.fillStyle=color;c.fillRect(34,13*s-1,6,2);}
   else if(module==='thrust'){polygon(c,[[-28,10*s],[-40,18*s],[-40,23*s],[-25,24*s],[-16,15*s]],steel,color,.8);c.fillStyle=color;c.fillRect(-39,20*s-1,9,2);}
   else if(module==='medic'){polygon(c,[[-16,11*s],[1,11*s],[4,25*s],[-15,27*s]],'#526b69',color,.65);c.fillStyle=color;c.fillRect(-11,18*s-1,9,2);c.fillRect(-7,18*s-4,2,8);}
   else if(module==='ring'){polygon(c,[[-12,12*s],[7,11*s],[22,22*s],[13,32*s],[-12,28*s]],tinted,color,.65);c.strokeStyle=color;c.lineWidth=.9;c.beginPath();c.arc(0,19*s,5,0,Math.PI*2);c.stroke();}
   else {polygon(c,[[-14,12*s],[12,10*s],[23,17*s],[5,22*s],[-14,20*s]],tinted,color,.55);for(let i=0;i<3;i++){c.fillStyle=color;c.fillRect(-9+i*6,16*s-1,3,2);}}
  }
 }
 function pet(c,color){
  const metal=linear(c,-19,-17,20,17,[[0,'#c4d4dc'],[.3,'#526b7b'],[.57,'#172733'],[1,'#344853']]);
  for(const s of [-1,1]){polygon(c,[[-20,5*s],[-13,14*s],[2,17*s],[13,9*s],[19,5*s],[4,4*s]],metal,'#91adb8',.65);polygon(c,[[-14,8*s],[-5,13*s],[5,11*s],[0,7*s]],'#203b45',color,.6);c.fillStyle=color;c.fillRect(-9,10*s-1,5,2);}
  polygon(c,[[22,0],[11,-7],[-6,-8],[-19,-4],[-19,4],[-6,8],[11,7]],metal,'#b1c4cd',.8);polygon(c,[[13,0],[4,-4],[-6,0],[4,4]],color,'#d6fbff',.65);
  c.fillStyle='#0b1d29';c.fillRect(-16,-2,7,4);c.fillStyle=color;c.fillRect(-15,-1,3,2);
  const shell=linear(c,-17,-15,16,15,[[0,'#e0ebf0'],[.28,'#728e9e'],[.55,'#243946'],[1,'#111e2b']]);
  for(const s of [-1,1]){
   polygon(c,[[-13,8*s],[-6,14*s],[2,14*s],[8,9*s],[-3,10*s]],shell,'#a6bbc6',.5);
   polygon(c,[[-18,5*s],[-12,6*s],[-11,9*s],[-16,8*s]],'#14232e','#7696a6',.5);
   c.fillStyle=color;c.fillRect(-16,7*s-.7,3,1.4);
  }
  polygon(c,[[12,0],[5,-3],[-3,-2],[-5,0],[-3,2],[5,3]],linear(c,-5,-3,12,3,[[0,'#142c38'],[.45,'#c1edf4'],[1,color]]),'#d1e5ee',.45);
 }
 function portalArt(c,color){
  const metal=linear(c,-43,-42,43,42,[[0,'#c5d6dd'],[.18,'#627987'],[.4,'#202f3b'],[.65,'#526570'],[1,'#0c1620']]);
  for(let i=0;i<8;i++){c.save();c.rotate(i*Math.PI/4);polygon(c,[[28,-13],[38,-18],[49,-11],[55,0],[49,11],[38,18],[28,13],[33,0]],metal,'#879ba6',1);polygon(c,[[35,-8],[46,-8],[50,0],[46,8],[35,8]],'#12212b','#718895',.7);polygon(c,[[36,-3],[46,-3],[48,0],[46,3],[36,3]],color);c.restore();}
  c.strokeStyle='#b0c3cc';c.lineWidth=2;c.beginPath();c.arc(0,0,32,0,Math.PI*2);c.stroke();
 }
 function portal(c,color,t){const s=cacheArt('portal-'+color,a=>portalArt(a,color));c.save();c.rotate(t/11000);c.drawImage(s,-64,-64,128,128);c.restore();const g=radial(c,0,0,31,[[0,'#07101c'],[.45,color+'18'],[.76,color+'70'],[1,color+'00']]);c.fillStyle=g;c.fillRect(-31,-31,62,62);c.save();c.rotate(-t/1300);for(let i=0;i<4;i++){c.strokeStyle=i%2?color:'#d9f6ff';c.lineWidth=i%2?2.6:1.3;c.beginPath();c.arc(0,0,23-i*3,i*Math.PI/2,i*Math.PI/2+1.55);c.stroke();}c.restore();}
 function baseArt(c,color){
  const metal=linear(c,-48,-48,48,48,[[0,'#b9c7c9'],[.2,'#7d9197'],[.48,'#273943'],[.7,'#53666e'],[1,'#13212a']]);
  for(let i=0;i<6;i++){c.save();c.rotate(i*Math.PI/3);polygon(c,[[17,-11],[35,-17],[49,-10],[58,-5],[58,5],[49,10],[35,17],[17,11]],metal,'#879ba2',1);polygon(c,[[32,-7],[49,-6],[54,0],[49,6],[32,7]],'#192d37','#6a858c',.6);for(let j=0;j<4;j++){c.fillStyle=color;c.fillRect(34+j*4,-1,2,2);}c.restore();}
  for(const [r,fill,line] of [[33,metal,'#8da2aa'],[25,'#142631','#627b85'],[16,metal,'#a2b5bb'],[11,'#0b1720',color]]){c.fillStyle=fill;c.strokeStyle=line;c.lineWidth=1.2;c.beginPath();c.arc(0,0,r,0,Math.PI*2);c.fill();c.stroke();}
 }
 function base(c,color,t){const s=cacheArt('base-'+color,a=>baseArt(a,color));c.drawImage(s,-180,-180,360,360);c.fillStyle=radial(c,0,0,34,[[0,color+'b0'],[.55,color+'60'],[1,color+'00']]);c.beginPath();c.arc(0,0,34,0,Math.PI*2);c.fill();c.strokeStyle=color;c.lineWidth=2;c.beginPath();c.arc(0,0,39+Math.sin(t/500)*2,0,Math.PI*2);c.stroke();}
 const laserColors={'LCB-10':'#ef4643','MCB-25':'#70e67d','MCB-50':'#579dff','UCB-100':'#f2f7ff','RSB-75':'#ffc04f','SAB-50':'#73e8ee'};
 function beamColor(l){return l.kind==='rocket'?'#ffcf68':l.kind==='player'?(Object.hasOwn(laserColors,l.ammo)?laserColors[l.ammo]:'#83ffb5'):l.kind==='boss'?'#79aaff':'#ff7766';}
 function beam(c,a,b,l,f,glow){const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);if(!len||f<0||f>=1)return;const color=beamColor(l),u=dx/len,v=dy/len,head=Math.min(len,len*(.24+f*.98)),tail=Math.max(0,head-(l.kind==='rocket'?26:Math.min(85,len*.6)));c.save();c.globalAlpha=Math.min(1,(1-f)*2.5);c.strokeStyle=color;c.shadowColor=color;c.shadowBlur=12*glow;c.lineCap='round';for(const side of l.kind==='rocket'?[0]:[-1,1]){const offset=side*2;c.lineWidth=l.kind==='rocket'?4:2.8;c.beginPath();c.moveTo(a.x+u*tail-v*offset,a.y+v*tail+u*offset);c.lineTo(a.x+u*head-v*offset,a.y+v*head+u*offset);c.stroke();c.lineWidth=1;c.strokeStyle='#fff';c.stroke();c.strokeStyle=color;}c.restore();}
 function equipment(c,category,id,color){
  if(!['lasers','launchers','ammo','rockets','specialRockets','launcherAmmo','shields','engines'].includes(category))return false;
  const metal=linear(c,-40,-25,40,25,[[0,'#d2dde1'],[.18,'#7b909b'],[.43,'#283c48'],[.63,'#4b606a'],[1,'#101e29']]);
  if(category==='lasers'||category==='launchers'){const count=category==='launchers'?2:1;for(let i=0;i<count;i++){const y=(i-(count-1)/2)*21;polygon(c,[[-42,y-8],[-24,y-12],[14,y-9],[34,y-5],[44,y-3],[44,y+3],[34,y+5],[14,y+9],[-24,y+12],[-42,y+8]],metal,'#a2b3bd',1);polygon(c,[[-23,y-6],[13,y-6],[27,y-3],[27,y+3],[13,y+6],[-23,y+6]],'#14242c',color,.9);for(let j=0;j<5;j++){c.fillStyle=color;c.fillRect(-19+j*7,y-2,4,4);}c.fillStyle='#a3b3ba';c.fillRect(-39,y-4,8,8);}}
  else if(['ammo','rockets','specialRockets','launcherAmmo'].includes(category)){const count=category==='ammo'?3:category==='launcherAmmo'?2:1;for(let i=0;i<count;i++){const y=(i-(count-1)/2)*17;polygon(c,[[-37,y-6],[-26,y-8],[16,y-7],[40,y],[16,y+7],[-26,y+8],[-37,y+6]],metal,'#a0b4c0',.8);polygon(c,[[10,y-5],[27,y-3],[35,y],[27,y+3],[10,y+5]],color,'#e0edf5',.65);c.fillStyle=color;c.fillRect(-25,y-5,12,10);if(category!=='ammo'){polygon(c,[[-31,y],[-46,y-13],[-17,y-6]],metal,color,.7);polygon(c,[[-31,y],[-46,y+13],[-17,y+6]],metal,color,.7);}}}
  else if(category==='shields'){for(let i=0;i<3;i++){const radius=31-i*8,pts=Array.from({length:6},(_,j)=>[Math.cos(j*Math.PI/3)*radius,Math.sin(j*Math.PI/3)*radius]);polygon(c,pts,i===1?'#12232d':metal,color,1.2);}c.fillStyle=radial(c,0,0,15,[[0,'#ffffff'],[.35,color],[1,color+'00']]);c.fillRect(-15,-15,30,30);}
  else{polygon(c,[[-43,-16],[-23,-24],[23,-24],[38,-13],[38,13],[23,24],[-23,24],[-43,16]],metal,'#9dafb6',1);for(let i=0;i<6;i++){c.fillStyle='#0f1b24';c.fillRect(-26+i*9,-15,6,30);c.fillStyle=color;c.fillRect(-25+i*9,-10,4,20);}}
  c.fillStyle='#e1edf4';c.font='9px Arial';c.textAlign='center';c.fillText(id,0,42);return true;
 }
 root.ggClassicArt={finish,loot,ice,impact,streuner,goliath,alien,mine,station,largeAlien,raider,vant,pilot,pet,portal,base,beam,beamColor,equipment};
})(window);