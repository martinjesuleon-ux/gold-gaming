'use strict';
(function(root){
 // A ring need not be drawn if its entire circumference is off screen.
 // For filled blasts, a fully covered viewport still receives the original tint.
 function classify(x,y,r,w,h,pad=0){
  if(![x,y,r,w,h,pad].every(Number.isFinite)||r<0||w<=0||h<=0||pad<0)return 'outside';
  const nearX=Math.max(0,-x,x-w),nearY=Math.max(0,-y,y-h);
  if(Math.hypot(nearX,nearY)>r+pad)return 'outside';
  const farX=Math.max(Math.abs(x),Math.abs(x-w)),farY=Math.max(Math.abs(y),Math.abs(y-h));
  if(Math.hypot(farX,farY)<r-pad)return 'covered';
  return 'edge';
 }
 const api={classify};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ggBlasts247=api;
})(typeof globalThis!=='undefined'?globalThis:this);
