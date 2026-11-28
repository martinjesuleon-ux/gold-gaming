'use strict';
(function(root){
 const KEY='sprite:classic-ship-goliath';
 const formats=Object.freeze([{cols:8,rows:4,w:208,h:168,frames:32,offset:0},{cols:12,rows:10,w:252,h:200,frames:120,offset:60}]);
 let format=formats[1];
 let atlas=null,generation=0,hasIris=false,hasRanks=false,hasDrones=false,revision=0;
 const active=()=>root.ggVisualTheme?.current()==='classic';
 // Original Goliath faces +X in frame 0; Iris faces the opposite way. Both sheets advance clockwise.
 function headingFrame(angle,n,offset=0){const a=Number.isFinite(angle)?angle:0;return ((Math.round(a*n/(Math.PI*2))+offset)%n+n)%n;}
 function frame(angle){return headingFrame(angle,format.frames,format.offset);}
 function rect(angle){const n=frame(angle);return {x:n%format.cols*format.w,y:Math.floor(n/format.cols)*format.h,w:format.w,h:format.h};}
 function draw(c,angle=0,rotated=false,width=100){
  if(!atlas||!active())return false;
  const a=Number.isFinite(angle)?angle:0,r=rect(a),height=width*format.h/format.w;
  c.save();if(rotated)c.rotate(-a);c.drawImage(atlas,r.x,r.y,r.w,r.h,-width/2,-height/2,width,height);c.restore();return true;
 }
 async function load(file){
  if(!active())throw Error('Selecciona el modo Clásico.');
  if(!file||!['image/png','image/webp'].includes(file.type)||file.size<1||file.size>8*1024*1024)throw Error('Selecciona un atlas PNG o WebP de hasta 8 MB.');
  const token=++generation;
  const url=await new Promise((resolve,reject)=>{const reader=new root.FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('No se pudo leer el archivo local.'));reader.onabort=()=>reject(Error('Lectura cancelada.'));reader.readAsDataURL(file);});
  if(typeof url!=='string'||!/^data:image\/(png|webp);base64,/i.test(url))throw Error('Formato de imagen local inválido.');
  if(token!==generation)return false;
  const img=new root.Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('No se pudo decodificar el atlas PNG o WebP.'));img.src=url;});
   const expanded=img.naturalWidth===1664&&img.naturalHeight===6464,ranked=expanded||(img.naturalWidth===1664&&img.naturalHeight===1184),combined=ranked||(img.naturalWidth===1664&&img.naturalHeight===1152);const selected=combined?formats[0]:formats.find(f=>img.naturalWidth===f.cols*f.w&&img.naturalHeight===f.rows*f.h);if(!selected)throw Error('Atlas inválido: utiliza el paquete Goliath + Iris (1664 × 1152) o un atlas Goliath compatible.');
   if(token!==generation)return false;format=selected;hasIris=combined;hasRanks=ranked;hasDrones=expanded;atlas=img;revision++;return true;
 }
 function clear(){generation++;atlas=null;hasIris=false;hasRanks=false;hasDrones=false;revision++;}
 function rank(c,n,width=48){n=Number(n);if(!active()||!atlas||!hasRanks||!Number.isInteger(n)||n<1||n>21)return false;c.save();c.imageSmoothingEnabled=false;c.drawImage(atlas,n*16,1152,16,16,-width/2,-width/2,width,width);c.restore();return true;}
 function iris(c,rank,angle=0,rotated=false,width=100*60/208){if(!atlas||!hasIris||!active()||!c)return false;const r=Math.max(0,Math.min(5,Math.floor(Number(rank)||1)-1)),a=Number.isFinite(angle)?angle:0,n=headingFrame(a,32,16);const x=(r%3)*480+(n%8)*60,y=672+Math.floor(r/3)*240+Math.floor(n/8)*60;c.save();if(rotated)c.rotate(-a);c.drawImage(atlas,x,y,60,60,-width/2,-width/2,width,width);c.restore();return true;}
 const models=['iris','flax','apis','zeus'],designs=['base','havoc','hercules'];
 function drone(c,code,rank,design,angle=0,rotated=false,width=100*60/208){
  const model=String(code||'').toLowerCase(),style=String(design||'base').toLowerCase(),m=models.indexOf(model),d=designs.indexOf(style);
  if(m===0&&d===0)return iris(c,rank,angle,rotated,width);
  if(!active()||!atlas||!hasDrones||m<0||d<0||!c)return false;
  const r=Math.max(0,Math.min(5,Math.floor(Number(rank)||1)-1)),a=Number.isFinite(angle)?angle:0,n=headingFrame(a,32,16),group=(m*3+d)*6+r-6;
  const x=(group%3)*480+(n%8)*60,y=1184+Math.floor(group/3)*240+Math.floor(n/8)*60;
  c.save();if(rotated)c.rotate(-a);c.drawImage(atlas,x,y,60,60,-width/2,-width/2,width,width);c.restore();return true;
 }
 const pack=root.ggClassicPack;
 if(pack){const originalDraw=pack.draw,originalShop=pack.shop;
  pack.draw=function(c,key,options={}){return (key===KEY&&draw(c,options.angle,options.rotated))||originalDraw.call(pack,c,key,options);};
  pack.shop=function(c,category,id,w,h){if(atlas&&active()&&category==='ships'&&String(id).toLowerCase()==='goliath'){
   const cw=c.canvas?.width||w,ch=c.canvas?.height||h;c.save();c.setTransform(1,0,0,1,0,0);c.fillStyle='#101a24';c.fillRect(0,0,cw,ch);c.translate(cw/2,ch/2);draw(c,Math.PI/5,false,Math.min(cw,ch*format.w/format.h));c.restore();return true;
  }if(hasIris&&active()&&category==='drones'&&(String(id).toLowerCase()==='iris'||(hasDrones&&models.includes(String(id).toLowerCase())))){const cw=c.canvas?.width||w,ch=c.canvas?.height||h;c.save();c.setTransform(1,0,0,1,0,0);c.fillStyle='#101a24';c.fillRect(0,0,cw,ch);c.translate(cw/2,ch/2);drone(c,id,6,null,0,false,Math.min(cw,ch));c.restore();return true;}return originalShop.call(pack,c,category,id,w,h);};
 }
 function controls(doc){
  const wrap=doc.createElement('section'),title=doc.createElement('strong'),hint=doc.createElement('small'),input=doc.createElement('input'),status=doc.createElement('small'),reset=doc.createElement('button');
  title.textContent='MOD local · Goliath, VANT y rangos';hint.textContent='Carga el atlas autorizado VANT RC72 (1664 × 6464) o Goliath + Iris + rangos (1664 × 1184), Goliath + Iris (1664 × 1152) o uno de Goliath (1664 × 672 / 3024 × 2000). Solo se usa en este navegador hasta recargar; no se envía al servidor.';
  input.type='file';input.accept='image/png,image/webp';input.setAttribute('aria-label','Atlas local Goliath e Iris');status.setAttribute('role','status');reset.type='button';reset.textContent='Restaurar gráficos del servidor';
  const sync=()=>{wrap.hidden=!active();status.textContent=atlas?'Atlas activo · Goliath '+format.frames+' perspectivas'+(hasIris?' + Iris rangos 1–6':'')+(hasRanks?' + 21 emblemas clásicos':'')+(hasDrones?' + Flax, Apis, Zeus, Havoc y Hércules':'')+'. Cierra y vuelve a abrir la tienda si estaba abierta.':'Sin atlas local.';};
  input.onchange=async()=>{const file=input.files?.[0];if(!file)return;try{status.textContent='Cargando atlas…';if(await load(file))sync();}catch(e){status.textContent=e.message;}finally{input.value='';}};
  reset.onclick=()=>{clear();sync();};wrap.append(title,hint,input,status,reset);root.addEventListener?.('gg:visualTheme',sync);sync();return wrap;
 }
 root.ggLocalGoliath={frame,rect,draw,iris,drone,rank,revision:()=>revision,load,clear,controls,loaded:()=>!!atlas};
})(window);
