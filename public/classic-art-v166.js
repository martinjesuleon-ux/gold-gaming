'use strict';
// Original material pass, applied only to classic sprites at cache creation. No external textures.
(function(root){
 function finish(c,kind,color,size){
  const half=size/2;
  c.save();c.globalCompositeOperation='source-atop';
  // Directional metallic shading across the existing hull silhouette.
  const metal=c.createLinearGradient(-half,-half,half,half);
  metal.addColorStop(0,'#e9f0ef70');metal.addColorStop(.32,'#d4e0e231');metal.addColorStop(.53,'#060a1430');metal.addColorStop(.72,'#0a080d60');metal.addColorStop(1,'#040508b0');
  c.fillStyle=metal;c.fillRect(-half,-half,size,size);
  // Deterministic brushed armor microtexture and panel lines, clipped to the opaque sprite.
  let seed=2166136261;for(const ch of kind+color){seed=Math.imul(seed^ch.charCodeAt(0),16777619)>>>0;}
  const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<Math.round(size*5);i++){const x=rand()*size-half,y=rand()*size-half,w=.5+rand()*2.2;c.fillStyle=i%3===0?'#f2e7d42b':'#00000026';c.fillRect(x,y,w,.65);}
  c.lineWidth=.55;c.strokeStyle='#080d1666';for(let x=-half+5;x<half;x+=9){c.beginPath();c.moveTo(x,-half);c.lineTo(x+size*.28,half);c.stroke();}
  c.globalCompositeOperation='source-atop';c.strokeStyle='#dbe3e32b';for(let x=-half+6;x<half;x+=9){c.beginPath();c.moveTo(x,-half);c.lineTo(x+size*.28,half);c.stroke();}
  c.restore();
 }
 // The supplied images are visual references, not imported or redistributed game assets.
 const sprites=new Map();
 function polygon(c,pts,fill,stroke,width=.7){c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}}
 function linear(c,x,y,X,Y,stops){const g=c.createLinearGradient(x,y,X,Y);for(const [p,col] of stops)g.addColorStop(p,col);return g;}
 function radial(c,x,y,r,stops){const g=c.createRadialGradient(x,y,0,x,y,r);for(const [p,col] of stops)g.addColorStop(p,col);return g;}
 function seeded(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
 function cacheArt(key,paint){if(sprites.has(key))return sprites.get(key);const canvas=root.document.createElement('canvas');canvas.width=canvas.height=128;const c=canvas.getContext('2d');c.translate(64,64);paint(c);sprites.set(key,canvas);return canvas;}
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
 }
 function alien(c,kind,color){
  const green=kind==='classic-lordakia',steel=linear(c,-25,-25,29,26,[[0,green?'#8ea991':'#9eacb9'],[.25,green?'#3b5b3b':'#35404d'],[.5,'#11191f'],[.75,green?'#25462a':'#25303e'],[1,'#0b1016']]);
  if(green){
   for(const s of [-1,1]){
    polygon(c,[[-25,s*9],[-12,s*17],[1,s*14],[12,s*7],[27,s*12],[19,s*21],[8,s*23],[-9,s*12],[-20,s*23],[-30,s*19]],steel,'#5d8265',.75);
    polygon(c,[[4,s*8],[18,s*7],[31,s*14],[23,s*15],[17,s*11]],'#254433','#6f9c77',.6);
    for(let i=0;i<3;i++){const x=17+i*3;polygon(c,[[x,s*13],[x+6,s*19],[x+3,s*20],[x-2,s*14]],'#a1b3a8','#303e3a',.45);}
   }
   polygon(c,[[-23,0],[-12,-10],[2,-13],[14,-7],[22,0],[14,8],[2,13],[-12,10]],steel,'#527d55',.8);
   polygon(c,[[-14,0],[-5,-9],[5,-5],[14,0],[5,5],[-5,9]],'#27893e','#a1d488',.8);
   c.fillStyle=radial(c,0,0,8,[[0,'#fff8c4'],[.28,'#efb94a'],[.55,'#937530'],[1,'#443e1600']]);c.fillRect(-8,-8,16,16);
  }else{
   for(const s of [-1,1]){
    polygon(c,[[-21,s*3],[-18,s*14],[-8,s*23],[7,s*20],[19,s*9],[34,s*6],[20,s*2],[5,s*8],[-5,s*10]],steel,'#596a7e',.65);
    polygon(c,[[-9,s*10],[3,s*18],[29,s*10],[36,s*3],[8,s*8]],'#344451','#9faeba',.55);
    for(let i=0;i<3;i++){const x=-17+i*6;polygon(c,[[x,s*13],[x+6,s*23],[x+10,s*25],[x+4,s*15]],'#18252e','#4b5c6e',.5);}
   }
   polygon(c,[[-29,0],[-20,-10],[-4,-13],[14,-6],[24,0],[14,5],[-4,11],[-20,9]],steel,'#697887',.75);
   polygon(c,[[-16,-2],[-7,-6],[9,-3],[17,0],[1,2],[-9,3]],'#17212b','#b2c1cb',.55);
  }
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
   const big=species==='kristallon',reach=big?43:35;
   for(const side of [-1,1]){
    const tips=big?[[30,0],[19,17],[-2,reach],[-13,27],[-31,31],[-24,9],[-13,0]]:[[29,0],[9,13],[-7,reach],[-17,23],[-30,16],[-20,5],[-13,0]];
    polygon(c,tips.map(([x,y])=>[x,y*side]),steel,seam,.8);
    polygon(c,[[23,4*side],[9,18*side],[-7,(reach-3)*side],[-13,20*side],[-21,12*side],[-5,5*side]],gem,color,.8);
    polygon(c,[[9,18*side],[-7,(reach-3)*side],[-2,12*side]],'#dbf4ffb0',color,.5);
    polygon(c,[[-2,12*side],[-13,20*side],[-21,12*side]],'#122c47',seam,.5);
    if(big){polygon(c,[[16,10*side],[30,19*side],[17,31*side],[5,23*side]],steel,color,.8);polygon(c,[[20,15*side],[26,19*side],[17,27*side]],gem,color,.6);}
    if(elite){polygon(c,[[-24,12*side],[-36,24*side],[-24,32*side],[-15,21*side]],steel,color,1);polygon(c,[[-31,24*side],[-24,29*side],[-20,22*side]],gem);}
   }
   polygon(c,[[36,0],[15,-12],[-4,-14],[-24,-8],[-31,0],[-24,8],[-4,14],[15,12]],steel,seam,1);
   polygon(c,[[25,0],[9,-9],[-8,-9],[-16,0],[-8,9],[9,9]],gem,color,.8);
   polygon(c,[[19,0],[5,-4],[-4,0],[5,4]],'#e9fbff',color,.5);
  }else if(species==='mordon'||species==='devolarium'){
   const heavy=species==='devolarium',w=heavy?34:27;
   for(const side of [-1,1]){
    const outline=heavy?[[32,8],[23,22],[7,w],[-15,w],[-35,20],[-29,8],[-8,5]]:[[26,8],[18,23],[-1,w],[-23,23],[-30,13],[-17,6],[-7,4]];
    polygon(c,outline.map(([x,y])=>[x,y*side]),armor,color,.85);
    for(let i=0;i<3;i++){const x=-20+i*13;polygon(c,[[x,11*side],[x+10,13*side],[x+8,(w-5)*side],[x-4,(w-7)*side]],steel,'#77807d',.65);polygon(c,[[x+1,15*side],[x+6,16*side],[x+4,20*side],[x-1,19*side]],'#1d2b30',color,.4);}
    polygon(c,[[-31,9*side],[-35,17*side],[-26,22*side],[-21,14*side]],steel,seam,.65);
    if(heavy||elite){polygon(c,[[18,9*side],[34,12*side],[39,19*side],[26,24*side],[14,17*side]],steel,color,.8);for(let i=0;i<3;i++){c.fillStyle=color;c.fillRect(26+i*3,side*17-1,1.6,2);}}
   }
   polygon(c,[[35,0],[21,-11],[2,-14],[-22,-10],[-34,-4],[-34,4],[-22,10],[2,14],[21,11]],steel,seam,1);
   polygon(c,[[25,0],[12,-7],[-10,-7],[-18,0],[-10,7],[12,7]],'#101d25',color,.8);
   for(let i=0;i<5;i++){c.fillStyle=i===2?color:'#62777d';c.fillRect(-11+i*5,-3,3,6);}
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
 function raider(c,kind,color){
  const id=kind.slice(8).replace(/-(boss|uber|emperor)$/,''),elite=kind!==('classic-'+id),[nose,wing,back,body,shape]=raiderProfiles[id]||raiderProfiles.vagrant;
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
 }
 function vant(c,kind,color){
  const id=kind.slice(6),sizes={flax:[9,5,0],iris:[11,8,1],apis:[12,10,2],zeus:[13,11,3]},[x,y,style]=sizes[id]||sizes.iris;
  const steel=linear(c,-x,-y,x,y,[[0,'#e3e6e3'],[.2,'#85949a'],[.45,'#27353f'],[.65,'#566570'],[1,'#0b1420']]);
  const coat=linear(c,-x,-y,x,y,[[0,color],[.35,'#384b55'],[.65,'#17232b'],[1,color]]);
  const pts=style===0?[[x,0],[3,-y],[-7,-y],[-x,0],[-7,y],[3,y]]:style===1?[[x,0],[4,-y],[-6,-y],[-x,-4],[-6,0],[-x,4],[-6,y],[4,y]]:style===2?[[x,0],[5,-y*.55],[0,-y],[-8,-y*.8],[-x,-3],[-7,0],[-x,3],[-8,y*.8],[0,y],[5,y*.55]]:[[x,0],[6,-y*.55],[1,-y],[-9,-y],[-x,-4],[-8,0],[-x,4],[-9,y],[1,y],[6,y*.55]];
  polygon(c,pts,steel,'#97a7ad',.7);
  for(const s of [-1,1]){polygon(c,[[5,2*s],[0,y*.8*s],[-7,y*.65*s],[-5,2*s]],coat,color,.55);polygon(c,[[-7,3*s],[-4,3*s],[-4,5*s],[-7,5*s]],'#a9b7b9','#18212a',.4);}
  polygon(c,[[x-2,0],[1,-3],[-4,0],[1,3]],coat,color,.65);polygon(c,[[x-4,0],[1,-1.4],[-1,0],[1,1.4]],color);
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
 function pilot(c,kind,color){
  const [ship,design]=kind.slice('classic-ship-'.length).split(':'),profile=pilotOutlines[ship]||pilotOutlines.phoenix,module=designModules[design];
  const steel=linear(c,-33,-32,36,32,[[0,'#ccd4d5'],[.14,'#7f9195'],[.34,'#3b494d'],[.53,'#111b23'],[.67,'#58696c'],[.85,'#263239'],[1,'#0a1018']]);
  const tinted=linear(c,-25,-30,30,30,[[0,color],[.22,'#89998c'],[.4,'#263735'],[.61,'#0d1b21'],[.79,color],[1,'#18292a']]);
  if(ship==='goliath')goliath(c,color);
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
 function beamColor(l){return l.kind==='rocket'?'#ffcf68':l.kind==='player'?(laserColors[l.ammo]||'#83ffb5'):l.kind==='boss'?'#79aaff':'#ff7766';}
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