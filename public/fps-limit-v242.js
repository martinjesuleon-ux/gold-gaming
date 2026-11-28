'use strict';
(function(root){
 const OPTIONS=Object.freeze([0,60,120,144,165,240]);
 function normalize(v){const n=Number(v);return OPTIONS.includes(n)?n:0;}
 function createLimiter(initial=0){
  let limit=normalize(initial),next=null;
  function reset(){next=null;}
  function set(v){const n=normalize(v);if(n!==limit){limit=n;reset();}return limit;}
  function allow(t){
   if(!Number.isFinite(t))return false;
   if(!limit)return true;
   const period=1000/limit;
   if(next===null||t>next+1000){next=t+period;return true;}
   if(t+.5<next)return false;
   next+=period;
   // Never render multiple frames to catch up after a stall.
   if(next<=t)next=t+period;
   return true;
  }
  return {allow,set,reset};
 }
 const api={OPTIONS,normalize,createLimiter};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ggFps242=api;
})(typeof globalThis!=='undefined'?globalThis:this);
