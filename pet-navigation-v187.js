'use strict';
// Navigation tuning is independent of damage, fuel and equipment.
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function followGoal(p,world){
 const a=Number.isFinite(p.angle)?p.angle:0;
 return {x:clamp(p.x-170*Math.cos(a)-105*Math.sin(a),25,world.w-25),y:clamp(p.y-170*Math.sin(a)+105*Math.cos(a),25,world.h-25)};
}
function travelGoal(p,target,now,world){
 const d=Math.hypot(p.petX-p.x,p.petY-p.y),passive=p.petMode==='passive';
 if(d>(passive?900:480))p.petFollowing=true;
 if(d<(passive?480:260))p.petFollowing=false;
 // Return to the owner before pursuing a remote pickup or hostile target.
 if(d>900)return { ...followGoal(p,world),kind:'follow'};
 if(target&&Number.isFinite(target.x)&&Number.isFinite(target.y)){
  if(target.kind==='combat'){
   const x=p.petX-target.x,y=p.petY-target.y,r=Math.hypot(x,y);
   if(r<=420)return {x:p.petX,y:p.petY,kind:'combat'};
   const a=r?Math.atan2(y,x):0;
   return {x:clamp(target.x+360*Math.cos(a),25,world.w-25),y:clamp(target.y+360*Math.sin(a),25,world.h-25),kind:'combat'};
  }
  return {x:clamp(target.x,25,world.w-25),y:clamp(target.y,25,world.h-25),kind:'pickup'};
 }
 if(p.petFollowing||p.dest)return {...followGoal(p,world),kind:'follow'};
 if(passive||p.petMode==='repair')return {x:p.petX,y:p.petY,kind:'hold'};
 const phase=now/6500+(p.petPatrolPhase||0);
 return {x:clamp(p.x+310*Math.cos(phase),25,world.w-25),y:clamp(p.y+310*Math.sin(phase),25,world.h-25),kind:'patrol'};
}
function advance(p,goal,dt){
 const dx=goal.x-p.petX,dy=goal.y-p.petY,len=Math.hypot(dx,dy),deadzone=goal.kind==='pickup'?1:22;
 if(len<=deadzone){p.petSpeed=0;return;}
 const max=Math.max(550,(Number(p.speed)||0)+100),desired=goal.kind==='pickup'?max:Math.min(max,Math.max(85,len*3,p.dest?Number(p.speed)||0:0));
 const speed=p.petSpeed=Math.min(desired,(p.petSpeed||0)+900*dt),step=Math.min(len,speed*dt);
 p.petX+=dx/len*step;p.petY+=dy/len*step;p.petAngle=Math.atan2(dy,dx);
}
module.exports={followGoal,travelGoal,advance};
