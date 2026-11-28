'use strict';
(function(root){
 const pack=root.ggClassicPack;if(!pack)return;
 const active=()=>root.ggVisualTheme?.current()==='classic',original={draw:pack.draw,shop:pack.shop,cover:pack.cover};let entries=new Map(),images=new Map(),generation=0,revision=0;
 function changed(){revision++;root.dispatchEvent?.(new root.Event('gg:localPack'));}
 const MAX=64*1024*1024;
 function validate(data){
  if(!data||data.version!==1||!Array.isArray(data.assets)||!data.assets.length||data.assets.length>500)throw Error('MOD inválido.');
  if(data.atlas!==undefined&&(typeof data.atlas!=='string'||data.atlas.length>12*1024*1024||!/^data:image\/(png|webp);base64,[A-Za-z0-9+/]+={0,2}$/i.test(data.atlas)))throw Error('Atlas incluido inválido.');
  const result=new Map();let total=data.atlas?.length||0;
  for(const e of data.assets){
   if(!e||typeof e.key!=='string'||!/^(shop|sprite|npc|map|portal|projectile|impact|mine|loot|base|ui):[a-zA-Z0-9_.:-]{1,110}$/.test(e.key)||result.has(e.key)||typeof e.source!=='string'||!e.source.trim()||typeof e.data!=='string'||!/^data:image\/(png|webp|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(e.data))throw Error('Recurso inválido.');
   total+=e.data.length;if(total>MAX||e.data.length>12*1024*1024)throw Error('MOD demasiado grande.');
   const {frames=1,columns=1,mode='static',heading=0,width=100,height=100,fps=12}=e;
   if(!Number.isInteger(frames)||frames<1||frames>120||!Number.isInteger(columns)||columns<1||columns>frames||!['static','directional','animated'].includes(mode)||(mode==='static'&&frames!==1)||![width,height].every(n=>Number.isFinite(n)&&n>=1&&n<=2048)||!Number.isFinite(heading)||Math.abs(heading)>360||!Number.isFinite(fps)||fps<1||fps>60)throw Error('Metadatos inválidos.');
   result.set(e.key,{data:e.data,frames,columns,mode,heading,width,height,fps});
  }return result;
 }
 async function load(file){if(!active())throw Error('Selecciona modo Clásico.');if(!file||file.size<1||file.size>MAX)throw Error('Selecciona un MOD de hasta 64 MB.');const token=++generation;const data=JSON.parse(await file.text()),next=validate(data);if(token!==generation)return false;if(data.atlas!==undefined){if(!root.ggLocalGoliath?.loadData)throw Error('No se puede cargar el atlas incluido.');if(!await root.ggLocalGoliath.loadData(data.atlas)||token!==generation)return false;}entries=next;images.clear();changed();return true;}
 function clear(){generation++;entries.clear();images.clear();root.ggLocalGoliath?.clear();changed();}
 // Correct blue/cyan loot pixels once per decoded sheet, preserving alpha, highlights and animation.
 function warmLootPixels(pixels,key){
  const tone=key==='loot:cargo'?.48:key==='loot:bonus'?.76:null;
  if(tone===null)return pixels;
  for(let i=0;i<pixels.length;i+=4){const r=pixels[i],g=pixels[i+1],b=pixels[i+2],lo=Math.min(r,g,b),hi=Math.max(r,g,b);
   if(pixels[i+3]&&hi-lo>=18&&b>r+12&&g>r+8){pixels[i]=hi;pixels[i+1]=Math.round(lo+(hi-lo)*tone);pixels[i+2]=lo;}
  }return pixels;
 }
 function warmLootImage(img,key){
  if(!['loot:cargo','loot:bonus'].includes(key))return img;
  const canvas=root.document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
  const c=canvas.getContext('2d',{willReadFrequently:true});if(!c)throw Error('Canvas unavailable');
  c.drawImage(img,0,0);const p=c.getImageData(0,0,canvas.width,canvas.height);warmLootPixels(p.data,key);c.putImageData(p,0,0);
  return canvas;
 }
 function get(key,callback){
  if(!active())return null;const e=entries.get(key);if(!e)return null;
  let i=images.get(key);if(!i){if(images.size>=48){const stale=[...images].find(([,v])=>v.state!=='loading');if(!stale)return null;images.delete(stale[0]);}
   const img=new root.Image();i={img,state:'loading',callbacks:[]};images.set(key,i);const rows=Math.ceil(e.frames/e.columns);img.onload=()=>{i.state=img.naturalWidth<=8192&&img.naturalHeight<=8192&&img.naturalWidth*img.naturalHeight<=16000000&&img.naturalWidth%e.columns===0&&img.naturalHeight%rows===0?'ready':'failed';if(i.state==='ready'){try{i.drawable=warmLootImage(img,key);}catch{ i.state='failed'; }}for(const cb of i.callbacks.splice(0))if(i.state==='ready')cb();};img.onerror=()=>{i.state='failed';i.callbacks.length=0;};img.src=e.data;}
  if(i.state==='loading'&&callback&&i.callbacks.length<64)i.callbacks.push(callback);return i.state==='ready'?{e,img:i.img,drawable:i.drawable||i.img}:null;
 }
 function draw(c,key,o={}){const item=get(key,o.callback);if(!item)return false;const {e,img,drawable}=item,a=Number.isFinite(o.angle)?o.angle:0,t=Number.isFinite(o.time)?o.time:0,wrap=n=>((n%e.frames)+e.frames)%e.frames,frame=e.mode==='directional'?wrap(Math.round((a+e.heading*Math.PI/180)*e.frames/(2*Math.PI))):e.mode==='animated'?wrap(Math.floor(t*e.fps/1000)):0,sw=img.naturalWidth/e.columns,sh=img.naturalHeight/Math.ceil(e.frames/e.columns),w=o.width??e.width,h=o.height??e.height;c.save();if(o.rotated&&e.mode==='directional')c.rotate(-a);c.drawImage(drawable,frame%e.columns*sw,Math.floor(frame/e.columns)*sh,sw,sh,-w/2,-h/2,w,h);c.restore();return true;}
 pack.draw=function(c,key,o={}){return draw(c,key,o)||original.draw.call(pack,c,key,o);};
 function paintArt(c,key,w,h){const paint=()=>{const i=get(key,paint);if(!i)return false;const cw=c.canvas?.width||w,ch=c.canvas?.height||h,scale=Math.min(cw/i.img.naturalWidth,ch/i.img.naturalHeight);c.save();c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,cw,ch);c.translate(cw/2,ch/2);draw(c,key,{width:i.img.naturalWidth*scale,height:i.img.naturalHeight*scale});c.restore();return true;};return paint();}
 pack.shop=function(c,category,id,w,h){return paintArt(c,'shop:'+category+':'+id,w,h)||original.shop.call(pack,c,category,id,w,h);};
 pack.cover=function(c,key,w,h){const i=get(key);if(!i||i.e.mode!=='static')return original.cover.call(pack,c,key,w,h);const scale=Math.max(w/i.img.naturalWidth,h/i.img.naturalHeight),dw=i.img.naturalWidth*scale,dh=i.img.naturalHeight*scale;c.drawImage(i.img,(w-dw)/2,(h-dh)/2,dw,dh);return true;};
 function controls(doc){const wrap=doc.createElement('section'),title=doc.createElement('strong'),hint=doc.createElement('small'),input=doc.createElement('input'),status=doc.createElement('small'),reset=doc.createElement('button');title.textContent='MOD Clásico completo · archivo único';hint.textContent='Importa el archivo .ggmod completo (incluye VANT y rangos). También admite los archivos anteriores. Solo gráficos locales, no se envía al servidor. Vuelve a abrir el hangar y la tienda después de cargar.';input.type='file';input.accept='.ggmod,application/json,image/png,image/webp';input.setAttribute('aria-label','MOD ampliado local');status.setAttribute('role','status');reset.type='button';reset.textContent='Restaurar gráficos del servidor';const sync=()=>{wrap.hidden=!active();status.textContent=(entries.size||root.ggLocalGoliath?.loaded())?entries.size+' recursos locales activos'+(root.ggLocalGoliath?.loaded()?' + atlas VANT y rangos':''):'Sin MOD local.';};input.onchange=async()=>{try{status.textContent='Leyendo MOD…';const file=input.files?.[0];if(!file)return;if(['image/png','image/webp'].includes(file.type)){generation++;await root.ggLocalGoliath.load(file);changed();}else await load(file);sync();}catch(e){status.textContent=e.message;}finally{input.value='';}};reset.onclick=()=>{clear();sync();};wrap.append(title,hint,input,status,reset);root.addEventListener?.('gg:visualTheme',sync);sync();return wrap;}
 root.ggLocalPack={validate,load,clear,controls,count:()=>entries.size,revision:()=>revision,has:key=>active()&&entries.has(key),paintArt,warmLootPixels};
})(window);
