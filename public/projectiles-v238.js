'use strict';
(function(root){
 const LIFE=500,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const colors={'LCB-10':'#ef4643','MCB-25':'#70e67d','MCB-50':'#579dff','UCB-100':'#f2f7ff','RSB-75':'#ffc04f','SAB-50':'#73e8ee'};
 function sample(shot,now){
  if(!shot||![shot.x,shot.y,shot.tx,shot.ty,shot.born,now].every(Number.isFinite))return null;
  const dx=shot.tx-shot.x,dy=shot.ty-shot.y,len=Math.hypot(dx,dy),rocket=shot.kind==='rocket',age=now-shot.born;
  const travel=clamp(len/(rocket?3.8:7),rocket?100:45,rocket?330:200),impact=rocket?150:100;
  if(age<0||age>=travel+impact)return null;
  const progress=clamp(age/travel,0,1),head=len*progress,tail=Math.max(0,head-(rocket?30:Math.min(85,len*.65))),ux=len?dx/len:0,uy=len?dy/len:0;
  return {rocket,angle:Math.atan2(dy,dx),head:{x:shot.x+ux*head,y:shot.y+uy*head},tail:{x:shot.x+ux*tail,y:shot.y+uy*tail},impact:age>=travel?clamp((age-travel)/impact,0,1):null,color:rocket?'#ffcf68':shot.kind==='boss'?'#79aaff':shot.kind==='player'?(Object.hasOwn(colors,shot.ammo)?colors[shot.ammo]:'#83ffb5'):'#ff7766'};
 }
 function draw(ctx,s,screen,glow=1,classic=false){
  if(!s)return;const h=screen(s.head.x,s.head.y),tail=screen(s.tail.x,s.tail.y);
  ctx.save();ctx.strokeStyle=s.color;ctx.fillStyle=s.color;ctx.shadowColor=s.color;ctx.shadowBlur=9*glow;ctx.lineCap='round';
  if(s.impact!==null){const f=s.impact;ctx.globalAlpha=(1-f)*.85;ctx.lineWidth=2;ctx.beginPath();ctx.arc(h.x,h.y,2+f*(s.rocket?24:13),0,Math.PI*2);ctx.stroke();}
  else{
   const offsets=classic&&!s.rocket?[-2,2]:[0],ux=-Math.sin(s.angle),uy=Math.cos(s.angle);
   for(const side of offsets){ctx.lineWidth=s.rocket?4:2.7;ctx.strokeStyle=s.color;ctx.beginPath();ctx.moveTo(tail.x+ux*side,tail.y+uy*side);ctx.lineTo(h.x+ux*side,h.y+uy*side);ctx.stroke();ctx.strokeStyle='#fff';ctx.lineWidth=1;ctx.stroke();}
   if(s.rocket){ctx.translate(h.x,h.y);ctx.rotate(s.angle);ctx.fillStyle='#fff3d1';ctx.beginPath();ctx.moveTo(5,0);ctx.lineTo(-5,-2.8);ctx.lineTo(-5,2.8);ctx.closePath();ctx.fill();}
  }ctx.restore();
 }
 const api={LIFE,sample,draw};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ggProjectiles238=api;
})(typeof globalThis!=='undefined'?globalThis:this);
