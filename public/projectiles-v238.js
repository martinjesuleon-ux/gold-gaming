'use strict';
(function(root){
 const LIFE=500,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const colors={'LCB-10':'#ef4643','MCB-25':'#ef4643','MCB-50':'#83e83f','UCB-100':'#fff0c1','RSB-75':'#ffc04f','SAB-50':'#73e8ee'};
 const geometry=new WeakMap();
 const rocketColors={'R-310':'#e5b46a','PLT-2026':'#f49c57','PLT-2021':'#ef6b47','PLT-3030':'#e7d0a4','PLD-8':'#cda8ff','DCR-250':'#71deba','R-IC3':'#a2d7ff','ECO-10':'#ffcf68','SAR-01':'#67d5ef','SAR-02':'#a3b7ff','HSTRM-01':'#ef925f','UBR-100':'#ffb34e','CBR':'#e99bff'};
 function countFor(shot){return shot.kind==='rocket'&&[3,5].includes(shot.count)?shot.count:1;}
 function salvoOffsets(count,progress){const n=[3,5].includes(count)?count:1;return Array.from({length:n},(_,i)=>(i-(n-1)/2)*12*Math.sin(Math.PI*clamp(progress,0,1)));}
 function playerColor(shot){return shot.allLF3===true&&['LCB-10','MCB-25'].includes(shot.ammo)?'#579dff':Object.hasOwn(colors,shot.ammo)?colors[shot.ammo]:'#83ffb5';}
 function prepare(shot){
  if(!shot||![shot.x,shot.y,shot.tx,shot.ty,shot.born].every(Number.isFinite))return null;
  const prev=geometry.get(shot);
  if(prev&&prev.x===shot.x&&prev.y===shot.y&&prev.tx===shot.tx&&prev.ty===shot.ty&&prev.kind===shot.kind&&prev.ammo===shot.ammo&&prev.count===countFor(shot)&&prev.enhanced===(shot.enhanced===true)&&prev.allLF3===(shot.allLF3===true))return prev;
  const dx=shot.tx-shot.x,dy=shot.ty-shot.y,len=Math.hypot(dx,dy),rocket=shot.kind==='rocket',alien=!rocket&&shot.kind!=='player',angle=Math.atan2(dy,dx);
  const g=Object.freeze({x:shot.x,y:shot.y,tx:shot.tx,ty:shot.ty,kind:shot.kind,ammo:shot.ammo,count:countFor(shot),enhanced:shot.enhanced===true,allLF3:shot.allLF3===true,len,rocket,alien,angle,ux:len?dx/len:0,uy:len?dy/len:0,sideX:-Math.sin(angle),sideY:Math.cos(angle),travel:clamp(len/(rocket?3.8:7),rocket?100:45,rocket?330:200),impact:rocket?150:100,trail:rocket?30:alien?Math.min(shot.kind==='boss'?30:22,len*.65):Math.min(85,len*.65),color:rocket?(rocketColors[shot.ammo]||'#ffcf68'):shot.kind==='boss'?'#79aaff':shot.kind==='player'?playerColor(shot):'#ff7766'});
  geometry.set(shot,g);return g;
 }
 function sample(shot,now){
  if(!Number.isFinite(now))return null;const g=prepare(shot);if(!g)return null;
  const age=now-shot.born;if(age<0||age>=g.travel+g.impact)return null;
  const progress=clamp(age/g.travel,0,1),head=g.len*progress,tail=Math.max(0,head-g.trail);
  return {rocket:g.rocket,alien:g.alien,kind:g.kind,ammo:g.ammo,count:g.count,enhanced:g.enhanced,progress,tailProgress:g.len?tail/g.len:0,angle:g.angle,sideX:g.sideX,sideY:g.sideY,head:{x:g.x+g.ux*head,y:g.y+g.uy*head},tail:{x:g.x+g.ux*tail,y:g.y+g.uy*tail},impact:age>=g.travel?clamp((age-g.travel)/g.impact,0,1):null,color:g.color};
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
  else if(s.rocket){
   const headOffsets=salvoOffsets(s.count,s.progress),tailOffsets=salvoOffsets(s.count,s.tailProgress);
   for(let i=0;i<headOffsets.length;i++){
    const x=h.x+s.sideX*headOffsets[i],y=h.y+s.sideY*headOffsets[i],tx=tail.x+s.sideX*tailOffsets[i],ty=tail.y+s.sideY*tailOffsets[i];
    ctx.strokeStyle=s.color;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(tx,ty);ctx.lineTo(x,y);ctx.stroke();
    ctx.save();ctx.translate(x,y);ctx.rotate(Math.atan2(y-ty,x-tx));ctx.shadowBlur=4*glow;ctx.fillStyle='#b9c8d4';ctx.beginPath();ctx.moveTo(6,0);ctx.lineTo(1,-2.8);ctx.lineTo(-7,-2.8);ctx.lineTo(-10,-4);ctx.lineTo(-9,0);ctx.lineTo(-10,4);ctx.lineTo(-7,2.8);ctx.lineTo(1,2.8);ctx.closePath();ctx.fill();ctx.fillStyle=s.color;ctx.fillRect(-7,-1.5,5,3);ctx.restore();
   }
  }
  else{
   const length=Math.hypot(h.x-tail.x,h.y-tail.y),wide=s.enhanced?3:1;
   ctx.translate(h.x,h.y);ctx.rotate(s.angle);
   if(s.ammo==='SAB-50'){
    ctx.lineWidth=1.8*wide;const rings=s.enhanced?2:1;for(let i=0;i<rings;i++){ctx.beginPath();ctx.ellipse(-6-i*13,0,4,11*wide,0,0,Math.PI*2);ctx.stroke();}
   }else if(length>.1){
    const w=(s.ammo==='RSB-75'?3.5:2)*wide;
    ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(-length*.16,-w);ctx.lineTo(-length*.72,-w*.65);ctx.lineTo(-length,0);ctx.lineTo(-length*.72,w*.65);ctx.lineTo(-length*.16,w);ctx.closePath();ctx.fill();
    ctx.shadowBlur=0;ctx.fillStyle='#fff7df';ctx.beginPath();ctx.moveTo(-length*.06,0);ctx.lineTo(-length*.22,-w*.38);ctx.lineTo(-length*.85,0);ctx.lineTo(-length*.22,w*.38);ctx.closePath();ctx.fill();
   }
  }ctx.restore();
 }
 const api={LIFE,prepare,sample,visible,draw,salvoOffsets,playerColor};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ggProjectiles238=api;
})(typeof globalThis!=='undefined'?globalThis:this);
