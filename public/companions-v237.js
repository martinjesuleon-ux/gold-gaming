'use strict';
(function(root){
 function formation(previous,target,dt){
  if(!Array.isArray(target))return [];
  const count=Math.min(target.length,10);if(previous?.length===count){let settled=true;for(let i=0;i<count;i++){if(previous[i]?.x!==target[i].x||previous[i]?.y!==target[i].y){settled=false;break;}}if(settled)return previous;}
  const alpha=1-Math.exp(-Math.max(0,Math.min(.1,Number(dt)||0))*12);
  return target.slice(0,10).map((p,i)=>{
   const a=previous?.[i];if(!a||![a.x,a.y,p.x,p.y].every(Number.isFinite))return {x:p.x,y:p.y};
   const dx=p.x-a.x,dy=p.y-a.y;
   if(Math.abs(dx)<.05&&Math.abs(dy)<.05)return {x:p.x,y:p.y};
   // For moves between established outer positions, follow an arc instead
   // of cutting through the pilot's hull. Preserve the original linear
   // easing for initial/near-center positions and same-side short moves.
   const from=Math.hypot(a.x,a.y),to=Math.hypot(p.x,p.y);
   if(from>=40&&to>=40){
    const start=Math.atan2(a.y,a.x),end=Math.atan2(p.y,p.x),delta=Math.atan2(Math.sin(end-start),Math.cos(end-start));
    const angle=start+delta*alpha,radius=from+(to-from)*alpha;
    return {x:Math.cos(angle)*radius,y:Math.sin(angle)*radius};
   }
   return {x:Math.abs(dx)<.05?p.x:a.x+dx*alpha,y:Math.abs(dy)<.05?p.y:a.y+dy*alpha};
  });
 }
 function recordPet(motion,history,pet,time,received){
  if(!pet||![pet.x,pet.y].every(Number.isFinite))return null;
  return motion?.record(history,{x:pet.x,y:pet.y,angle:Number.isFinite(pet.angle)?pet.angle:0},time,received)||null;
 }
 const api={formation,recordPet};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ggCompanions237=api;
})(typeof globalThis!=='undefined'?globalThis:this);
