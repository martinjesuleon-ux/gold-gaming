'use strict';
(function(root){
 function formation(previous,target,dt){
  if(!Array.isArray(target))return [];
  const count=Math.min(target.length,10);if(previous?.length===count&&target.slice(0,count).every((p,i)=>previous[i]?.x===p.x&&previous[i]?.y===p.y))return previous;
  const alpha=1-Math.exp(-Math.max(0,Math.min(.1,Number(dt)||0))*12);
  return target.slice(0,10).map((p,i)=>{
   const a=previous?.[i];if(!a||![a.x,a.y,p.x,p.y].every(Number.isFinite))return {x:p.x,y:p.y};
   const dx=p.x-a.x,dy=p.y-a.y;
   return {x:Math.abs(dx)<.05?p.x:a.x+dx*alpha,y:Math.abs(dy)<.05?p.y:a.y+dy*alpha};
  });
 }
 function recordPet(motion,history,pet,time,received){
  if(!pet||![pet.x,pet.y].every(Number.isFinite))return null;
  return motion?.record(history,{x:pet.x,y:pet.y,angle:Number.isFinite(pet.angle)?pet.angle:0},time,received)||null;
 }
 const api={formation,recordPet};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ggCompanions237=api;
})(typeof globalThis!=='undefined'?globalThis:this);
