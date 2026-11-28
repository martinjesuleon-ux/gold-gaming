'use strict';
(function(root){
 const SIZE=80,STEPS=16,MAX=128;
 function create(doc){
  const cache=new Map();
  function draw(ctx,s,x,y,glow,dpr=1){
   if(!s||s.impact===null||!Number.isFinite(s.impact)||!Number.isFinite(x)||!Number.isFinite(y))return false;
   const frame=Math.min(STEPS-1,Math.max(0,Math.round(s.impact*(STEPS-1)))),scale=dpr>1.5?2:1,light=glow>=.75?1:glow>=.25?.5:0;
   const key=[s.color,s.rocket?1:0,frame,light,scale].join(':');let tile=cache.get(key);
   try{
    if(tile){cache.delete(key);cache.set(key,tile);}else{
     tile=doc.createElement('canvas');tile.width=tile.height=SIZE*scale;const c=tile.getContext('2d');if(!c)return false;
     c.scale(scale,scale);const f=frame/(STEPS-1);c.strokeStyle=s.color;c.shadowColor=s.color;c.shadowBlur=9*light*scale;c.globalAlpha=(1-f)*.85;c.lineWidth=2;c.beginPath();c.arc(SIZE/2,SIZE/2,2+f*(s.rocket?24:13),0,Math.PI*2);c.stroke();
     if(cache.size>=MAX)cache.delete(cache.keys().next().value);cache.set(key,tile);
    }
    ctx.drawImage(tile,x-SIZE/2,y-SIZE/2,SIZE,SIZE);return true;
   }catch{return false;}
  }
  return {draw,clear:()=>cache.clear(),size:()=>cache.size};
 }
 const api={create,MAX};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ggImpact246=api;
})(typeof globalThis!=='undefined'?globalThis:this);
