'use strict';
(function(root){
 const LIFE=500,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const colors={'LCB-10':'#ef4643','MCB-25':'#70e67d','MCB-50':'#579dff','UCB-100':'#f2f7ff','RSB-75':'#ffc04f','SAB-50':'#73e8ee'};
 const geometry=new WeakMap(),single=Object.freeze([0]),double=Object.freeze([-2,2]);
 function prepare(shot){
  if(!shot||![shot.x,shot.y,shot.tx,shot.ty,shot.born].every(Number.isFinite))return null;
  const prev=geometry.get(shot);
  if(prev&&prev.x===shot.x&&prev.y===shot.y&&prev.tx===shot.tx&&prev.ty===shot.ty&&prev.kind===shot.kind&&prev.ammo===shot.ammo)return prev;
  const dx=shot.tx-shot.x,dy=shot.ty-shot.y,len=Math.hypot(dx,dy),rocket=shot.kind==='rocket',alien=!rocket&&shot.kind!=='player',angle=Math.atan2(dy,dx);
  const g=Object.freeze({x:shot.x,y:shot.y,tx:shot.tx,ty:shot.ty,kind:shot.kind,ammo:shot.ammo,len,rocket,alien,angle,ux:len?dx/len:0,uy:len?dy/len:0,sideX:-Math.sin(angle),sideY:Math.cos(angle),travel:clamp(len/(rocket?3.8:7),rocket?100:45,rocket?330:200),impact:rocket?150:100,trail:rocket?30:alien?Math.min(shot.kind==='boss'?30:22,len*.65):Math.min(85,len*.65),color:rocket?'#ffcf68':shot.kind==='boss'?'#79aaff':shot.kind==='player'?(Object.hasOwn(colors,shot.ammo)?colors[shot.ammo]:'#83ffb5'):'#ff7766'});
  geometry.set(shot,g);return g;
 }
 function sample(shot,now){
  if(!Number.isFinite(now))return null;const g=prepare(shot);if(!g)return null;
  const age=now-shot.born;if(age<0||age>=g.travel+g.impact)return null;
  const progress=clamp(age/g.travel,0,1),head=g.len*progress,tail=Math.max(0,head-g.trail);
  return {rocket:g.rocket,alien:g.alien,kind:g.kind,angle:g.angle,sideX:g.sideX,sideY:g.sideY,head:{x:g.x+g.ux*head,y:g.y+g.uy*head},tail:{x:g.x+g.ux*tail,y:g.y+g.uy*tail},impact:age>=g.travel?clamp((age-g.travel)/g.impact,0,1):null,color:g.color};
 }
 // Cull the currently rendered trail, not the entire original shot path.
 function visible(s,camera,w,h,padding=45){
  if(!s||![camera?.x,camera?.y,w,h,padding].every(Number.isFinite))return false;
  const left=camera.x-w/2-padding,right=camera.x+w/2+padding,top=camera.y-h/2-padding,bottom=camera.y+h/2+padding;
  const a=s.head,b=s.impact!==null?a:s.tail;
  return Math.max(a.x,b.x)>=left&&Math.min(a.x,b.x)<=right&&Math.max(a.y,b.y)>=top&&Math.min(a.y,b.y)<=bottom;
 }
 function draw(ctx,s,screen,glow=1,classic=false){
  if(!s)return;const h=screen(s.head.x,s.head.y),tail=screen(s.tail.x,s.tail.y);
  ctx.save();ctx.strokeStyle=s.color;ctx.fillStyle=s.color;ctx.shadowColor=s.color;ctx.shadowBlur=9*glow;ctx.lineCap='round';
  if(s.impact!==null){const f=s.impact;ctx.globalAlpha=(1-f)*.85;ctx.lineWidth=2;ctx.beginPath();ctx.arc(h.x,h.y,2+f*(s.rocket?24:13),0,Math.PI*2);ctx.stroke();}
  else if(s.alien){
   // A compact, single faceted energy pulse, visually distinct from player beams.
   const length=Math.hypot(h.x-tail.x,h.y-tail.y),width=s.kind==='boss'?5:3.5;
   if(length>.1){
    ctx.translate(h.x,h.y);ctx.rotate(s.angle);
    ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(-length*.30,-width);ctx.lineTo(-length*.72,-width*.72);ctx.lineTo(-length,0);ctx.lineTo(-length*.72,width*.72);ctx.lineTo(-length*.30,width);ctx.closePath();ctx.fill();
    ctx.shadowBlur=0;ctx.fillStyle=s.kind==='boss'?'#d7eeff':'#ffd2b0';ctx.beginPath();ctx.moveTo(-length*.12,0);ctx.lineTo(-length*.39,-width*.43);ctx.lineTo(-length*.67,0);ctx.lineTo(-length*.39,width*.43);ctx.closePath();ctx.fill();
   }
  }
  else{
   const offsets=classic&&!s.rocket?double:single,ux=s.sideX??-Math.sin(s.angle),uy=s.sideY??Math.cos(s.angle);
   for(const side of offsets){ctx.lineWidth=s.rocket?4:2.7;ctx.strokeStyle=s.color;ctx.beginPath();ctx.moveTo(tail.x+ux*side,tail.y+uy*side);ctx.lineTo(h.x+ux*side,h.y+uy*side);ctx.stroke();ctx.strokeStyle='#fff';ctx.lineWidth=1;ctx.stroke();}
   if(s.rocket){ctx.translate(h.x,h.y);ctx.rotate(s.angle);ctx.fillStyle='#fff3d1';ctx.beginPath();ctx.moveTo(5,0);ctx.lineTo(-5,-2.8);ctx.lineTo(-5,2.8);ctx.closePath();ctx.fill();}
  }ctx.restore();
 }
 const api={LIFE,prepare,sample,visible,draw};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ggProjectiles238=api;
})(typeof globalThis!=='undefined'?globalThis:this);
