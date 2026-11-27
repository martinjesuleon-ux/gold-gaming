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
 root.ggClassicArt={finish,loot,ice,impact,streuner};
})(window);