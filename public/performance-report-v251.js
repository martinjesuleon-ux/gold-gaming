'use strict';
(function(root){
 function build(stats,meta){
  if(!stats||!Number.isFinite(stats.fps)||stats.fps<=0||!Number.isFinite(stats.p95)||stats.count<30)return null;
  const round=(n,d=1)=>Number(n.toFixed(d));
  return {version:'2.0.0-rc.51',motor:'Canvas 2D',tema:meta.theme==='classic'?'Clásico':'GOLD',calidad:meta.quality,limiteFPS:meta.fpsLimit||0,ventanaSegundos:round(stats.count/stats.fps,2),intervalos:stats.count,fpsPromedio:round(stats.fps),p95Ms:round(stats.p95),fotogramasLentos:stats.slow,latenciaMs:Number.isFinite(meta.rtt)?meta.rtt:null,resolucion:{ancho:meta.w,alto:meta.h,dpr:meta.dpr},entidades:meta.entities};
 }
 const api={build};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ggPerformance251=api;
})(typeof globalThis!=='undefined'?globalThis:this);
