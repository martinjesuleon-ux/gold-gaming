'use strict';
(function(root){
 const base='classic-pack/',keyPattern=/^[a-zA-Z0-9_.:-]{1,120}$/,filePattern=/^(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.(png|webp|jpg|jpeg)$/i;
 let entries=new Map(),images=new Map(),started=false,state='idle';
 const active=()=>root.ggVisualTheme?.current()==='classic';
 function validate(data){
  if(!data||data.version!==1||!Array.isArray(data.assets)||data.assets.length>5000)throw Error('Invalid classic pack');
  const result=new Map();
  for(const e of data.assets){
   if(!e||!keyPattern.test(e.key)||typeof e.key!=='string'||typeof e.file!=='string'||!filePattern.test(e.file)||result.has(e.key)||typeof e.source!=='string'||!e.source.trim()||typeof e.permission!=='string'||!e.permission.trim())throw Error('Invalid asset metadata');
   const frames=e.frames??1,columns=e.columns??frames;
   if(!Number.isInteger(frames)||frames<1||frames>120||!Number.isInteger(columns)||columns<1||columns>frames)throw Error('Invalid atlas dimensions');
   const width=e.width??112,height=e.height??width,heading=e.heading??0;
   if(!Number.isFinite(width)||width<1||width>2048||!Number.isFinite(height)||height<1||height>2048||!Number.isFinite(heading)||Math.abs(heading)>360)throw Error('Invalid display dimensions');
   const mode=e.mode??'static';
   if(!['static','directional','animated'].includes(mode)||(mode==='static'&&frames!==1))throw Error('Invalid atlas mode');
   const fps=e.fps??12;
   if(!Number.isFinite(fps)||fps<1||fps>60)throw Error('Invalid animation speed');
   result.set(e.key,Object.freeze({key:e.key,file:e.file,frames,columns,width,height,heading,mode,fps}));
  }
  return result;
 }
 function init(){
  if(!active()||started||!root.fetch||!root.Image)return;
  started=true;state='loading';
  root.fetch(base+'manifest.json',{credentials:'same-origin'}).then(r=>{if(!r.ok)throw Error('Pack unavailable');return r.json();}).then(data=>{entries=validate(data);state='ready';root.dispatchEvent?.(new Event('gg:classicPack'));}).catch(()=>{state='unavailable';});
 }
 function image(e,callback){
  let item=images.get(e.file);
  if(!item){if(images.size>=256){const stale=[...images].find(([,v])=>v.status!=='loading');if(stale)images.delete(stale[0]);else return null;}const img=new root.Image();item={img,status:'loading',listeners:[]};images.set(e.file,item);img.onload=()=>{item.status='ready';for(const fn of item.listeners.splice(0))fn();};img.onerror=()=>{item.status='failed';item.listeners.length=0;};img.src=base+e.file;}
  if(item.status==='loading'&&callback&&item.listeners.length<128)item.listeners.push(callback);
  return item.status==='ready'?item.img:null;
 }
 function resolve(key){if(!active())return null;init();return entries.get(key)||null;}
 function draw(c,key,{angle=0,time=0,width,height,rotated=false,callback}={}){
  const e=resolve(key);if(!e)return false;
  const img=image(e,callback);if(!img)return false;
  const rows=Math.ceil(e.frames/e.columns),sw=img.naturalWidth/e.columns,sh=img.naturalHeight/rows;
  if(!Number.isInteger(sw)||!Number.isInteger(sh)||sw<1||sh<1||img.naturalWidth>8192||img.naturalHeight>8192)return false;
  const a=Number.isFinite(angle)?angle:0,t=Number.isFinite(time)?time:0;
  const wrap=(n,m)=>((n%m)+m)%m;
  const frame=e.mode==='directional'?wrap(Math.round((a+e.heading*Math.PI/180)*e.frames/(2*Math.PI)),e.frames):e.mode==='animated'?wrap(Math.floor(t*e.fps/1000),e.frames):0;
  const w=width??e.width,h=height??e.height;
  c.save();if(rotated&&e.mode==='directional')c.rotate(-a);
  c.drawImage(img,(frame%e.columns)*sw,Math.floor(frame/e.columns)*sh,sw,sh,-w/2,-h/2,w,h);c.restore();return true;
 }
 function cover(c,key,w,h){const e=resolve(key);if(!e||e.mode!=='static')return false;const img=image(e);if(!img||!img.naturalWidth||!img.naturalHeight||img.naturalWidth>8192||img.naturalHeight>8192)return false;const scale=Math.max(w/img.naturalWidth,h/img.naturalHeight),dw=img.naturalWidth*scale,dh=img.naturalHeight*scale;c.drawImage(img,(w-dw)/2,(h-dh)/2,dw,dh);return true;}
 function shop(c,category,id,w,h){if(!active())return false;const key='shop:'+category+':'+id;
  const paint=()=>{if(!active())return false;const e=resolve(key);if(!e)return false;const img=image(e,paint);if(!img)return false;const cw=c.canvas?.width||w,ch=c.canvas?.height||h;c.save();c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,cw,ch);c.translate(cw/2,ch/2);const done=draw(c,key,{width:cw,height:ch});c.restore();return done;};
  if(state==='loading'){root.addEventListener?.('gg:classicPack',paint,{once:true});return false;}return paint();
 }
 root.ggClassicPack={init,draw,cover,shop,validate,status:()=>({state,count:entries.size})};
 root.addEventListener?.('gg:visualTheme',init);init();
})(window);
