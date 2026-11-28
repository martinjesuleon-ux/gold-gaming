'use strict';
(function(root){
 function createMonitor(capacity=240){
  const size=Math.max(16,Math.min(600,Math.floor(capacity)||240)),samples=new Float64Array(size);
  let count=0,index=0,last=null;
  function reset(){count=0;index=0;last=null;}
  function frame(t){
   if(!Number.isFinite(t))return;
   if(last===null){last=t;return;}
   const dt=t-last;last=t;if(dt<=0||dt>1000){reset();last=t;return;}
   samples[index]=dt;index=(index+1)%size;count=Math.min(size,count+1);
  }
  function stats(){
   if(!count)return null;const ordered=Array.from(samples.subarray(0,count)).sort((a,b)=>a-b);
   const mean=ordered.reduce((a,b)=>a+b,0)/count,p95=ordered[Math.ceil(count*.95)-1];
   return {count,fps:1000/mean,p95,slow:ordered.filter(v=>v>33.4).length};
  }
  return {reset,frame,stats};
 }
 const api={createMonitor};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ggFramePacing240=api;
})(typeof globalThis!=='undefined'?globalThis:this);
