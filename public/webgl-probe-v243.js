'use strict';
(function(root){
 function probe(doc){
  if(!doc?.createElement)return {available:false,version:0,reason:'Sin acceso a Canvas'};
  for(const [name,version] of [['webgl2',2],['webgl',1]]){
   let gl=null;
   try{
    const canvas=doc.createElement('canvas');canvas.width=canvas.height=16;
    gl=canvas.getContext(name,{alpha:false,antialias:false,depth:false,stencil:false,failIfMajorPerformanceCaveat:true});
    if(!gl||gl.isContextLost())continue;
    const maxTextureSize=gl.getParameter(gl.MAX_TEXTURE_SIZE);
    const maxUnits=gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS);
    if(!Number.isFinite(maxTextureSize)||maxTextureSize<1||!Number.isFinite(maxUnits)||maxUnits<1)continue;
    return {available:true,version,maxTextureSize,maxUnits};
   }catch{}finally{try{gl?.getExtension('WEBGL_lose_context')?.loseContext();}catch{}}
  }
  return {available:false,version:0,reason:'WebGL no disponible o aceleración limitada'};
 }
 const api={probe};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ggWebGL243=api;
})(typeof globalThis!=='undefined'?globalThis:this);
