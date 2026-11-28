'use strict';
(function(root){
 const KEY='sprite:classic-ship-goliath',COLS=12,ROWS=10,CELL_W=252,CELL_H=200,FRAMES=120;
 let atlas=null,generation=0;
 const active=()=>root.ggVisualTheme?.current()==='classic';
 function frame(angle){const a=Number.isFinite(angle)?angle:0;return (((Math.round(a*FRAMES/(Math.PI*2))+60)%FRAMES)+FRAMES)%FRAMES;}
 function rect(angle){const n=frame(angle);return {x:n%COLS*CELL_W,y:Math.floor(n/COLS)*CELL_H,w:CELL_W,h:CELL_H};}
 function draw(c,angle=0,rotated=false,width=100){
  if(!atlas||!active())return false;
  const a=Number.isFinite(angle)?angle:0,r=rect(a),height=width*CELL_H/CELL_W;
  c.save();if(rotated)c.rotate(-a);c.drawImage(atlas,r.x,r.y,r.w,r.h,-width/2,-height/2,width,height);c.restore();return true;
 }
 async function load(file){
  if(!active())throw Error('Selecciona el modo Clásico.');
  if(!file||!['image/png','image/webp'].includes(file.type)||file.size<1||file.size>8*1024*1024)throw Error('Selecciona un atlas PNG o WebP de hasta 8 MB.');
  const token=++generation,url=root.URL.createObjectURL(file);
  try{const img=new root.Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('No se pudo abrir el atlas.'));img.src=url;});
   if(img.naturalWidth!==COLS*CELL_W||img.naturalHeight!==ROWS*CELL_H)throw Error('El atlas debe medir 3024 × 2000 px (120 perspectivas).');
   if(token!==generation)return false;atlas=img;return true;
  }finally{root.URL.revokeObjectURL(url);}
 }
 function clear(){generation++;atlas=null;}
 const pack=root.ggClassicPack;
 if(pack){const originalDraw=pack.draw,originalShop=pack.shop;
  pack.draw=function(c,key,options={}){return (key===KEY&&draw(c,options.angle,options.rotated))||originalDraw.call(pack,c,key,options);};
  pack.shop=function(c,category,id,w,h){if(atlas&&active()&&category==='ships'&&String(id).toLowerCase()==='goliath'){
   const cw=c.canvas?.width||w,ch=c.canvas?.height||h;c.save();c.setTransform(1,0,0,1,0,0);c.fillStyle='#101a24';c.fillRect(0,0,cw,ch);c.translate(cw/2,ch/2);draw(c,Math.PI/5,false,Math.min(cw,ch*CELL_W/CELL_H));c.restore();return true;
  }return originalShop.call(pack,c,category,id,w,h);};
 }
 function controls(doc){
  const wrap=doc.createElement('section'),title=doc.createElement('strong'),hint=doc.createElement('small'),input=doc.createElement('input'),status=doc.createElement('small'),reset=doc.createElement('button');
  title.textContent='Prueba gráfica local · Goliath';hint.textContent='Carga un atlas autorizado de 120 perspectivas (3024 × 2000). Solo se usa en este navegador hasta recargar; no se envía al servidor.';
  input.type='file';input.accept='image/png,image/webp';input.setAttribute('aria-label','Atlas local Goliath');status.setAttribute('role','status');reset.type='button';reset.textContent='Restaurar Goliath del servidor';
  const sync=()=>{wrap.hidden=!active();status.textContent=atlas?'Atlas activo. Cierra y vuelve a abrir la tienda si estaba abierta.':'Sin atlas local.';};
  input.onchange=async()=>{const file=input.files?.[0];if(!file)return;try{status.textContent='Cargando atlas…';if(await load(file))sync();}catch(e){status.textContent=e.message;}finally{input.value='';}};
  reset.onclick=()=>{clear();sync();};wrap.append(title,hint,input,status,reset);root.addEventListener?.('gg:visualTheme',sync);sync();return wrap;
 }
 root.ggLocalGoliath={frame,rect,draw,load,clear,controls,loaded:()=>!!atlas};
})(window);
