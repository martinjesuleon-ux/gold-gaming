'use strict';
// Effects are cosmetic. Coordinates are snapshots from the authoritative server.
(function(root){
 const palettes={player:'#83ffb5',boss:'#79aaff',rocket:'#ffcf68',npc:'#ff7766', 'laser-cbs':'#e5b975'};
 function styleFor(kind,ammo){if(kind==='rocket')return {color:palettes.rocket,rocket:true};return {color:({LCB10:'#75ed93','LCB-10':'#75ed93','MCB-25':'#63b8ff','MCB-50':'#e9a85b','UCB-100':'#ff555c','RSB-75':'#ffce72','SAB-50':'#b6d7ff'})[ammo]||palettes[kind]||palettes.npc,rocket:false};}
 function shotGeometry(a,b,age,rocket=false){
  const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);if(!Number.isFinite(len)||len<.1||!Number.isFinite(age)||age<0||age>=260)return null;
  const travel=rocket?145:90,progress=Math.min(1,age/travel),head=len*progress,tail=Math.max(0,head-(rocket?55:Math.min(100,len*.6))),unitX=dx/len,unitY=dy/len;
  return {x:a.x+unitX*head,y:a.y+unitY*head,tx:a.x+unitX*tail,ty:a.y+unitY*tail,angle:Math.atan2(dy,dx),alpha:Math.max(0,1-Math.max(0,age-travel)/(260-travel)),impact:age>=travel,impactAge:Math.max(0,age-travel)};
 }
 function line(c,x,y,tx,ty,color,width){c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(x,y);c.lineTo(tx,ty);c.stroke();}
 function draw(c,a,b,l,age,low=false){const style=styleFor(l.kind,l.ammo),g=shotGeometry(a,b,age,style.rocket);if(!g)return;c.save();c.globalAlpha=g.alpha;c.lineCap='round';
  if(!low){c.globalAlpha=g.alpha*.2;line(c,g.x,g.y,g.tx,g.ty,style.color,style.rocket?12:8);c.globalAlpha=g.alpha;}
  line(c,g.x,g.y,g.tx,g.ty,style.color,style.rocket?4:3);line(c,g.x,g.y,g.tx,g.ty,'#f5ffff',1);
  if(style.rocket&&!g.impact){c.save();c.translate(g.x,g.y);c.rotate(g.angle);c.fillStyle='#e6e9ed';c.fillRect(-9,-2,10,4);c.fillStyle=style.color;c.fillRect(-12,-2,3,4);c.restore();}
  if(g.impact){const f=g.impactAge/(style.rocket?115:170),r=(style.rocket?9:4)+f*(style.rocket?22:12);c.globalAlpha=g.alpha*.75;c.strokeStyle=style.color;c.lineWidth=1.5;c.beginPath();c.arc(b.x,b.y,r,0,Math.PI*2);c.stroke();if(!low)for(let i=0;i<5;i++){const angle=i*Math.PI*2/5+g.angle;c.globalAlpha=g.alpha*.6;line(c,b.x+Math.cos(angle)*r*.55,b.y+Math.sin(angle)*r*.55,b.x+Math.cos(angle)*r,b.y+Math.sin(angle)*r,style.color,1);}}
  c.restore();
 }
 root.ggCombat162={draw,shotGeometry,styleFor};
})(typeof window==='undefined'?globalThis:window);
