'use strict';
(function(root){
 function vertices(count=512){const n=Math.max(1,Math.min(2048,Math.floor(Number(count)||512))),a=new Float32Array(n*2);let seed=243;for(let i=0;i<a.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;a[i]=seed/4294967296*2-1;}return a;}
 function benchmark(doc,clock=()=>performance.now()){
  let gl=null,program=null,buffer=null,shaders=[];
  try{
   const canvas=doc.createElement('canvas'),other=doc.createElement('canvas');canvas.width=canvas.height=other.width=other.height=256;
   const ctx=canvas.getContext('2d');gl=other.getContext('webgl',{alpha:false,antialias:false,failIfMajorPerformanceCaveat:true});
   if(!ctx||!gl)return {ok:false,reason:'Canvas 2D o WebGL no disponible'};
   function shader(type,source){const s=gl.createShader(type);if(!s)throw Error('shader');shaders.push(s);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error('compile');return s;}
   program=gl.createProgram();if(!program)throw Error('program');
   gl.attachShader(program,shader(gl.VERTEX_SHADER,'attribute vec2 pos; void main(){gl_Position=vec4(pos,0.0,1.0);gl_PointSize=2.0;}'));
   gl.attachShader(program,shader(gl.FRAGMENT_SHADER,'precision mediump float; void main(){gl_FragColor=vec4(0.75,0.85,1.0,1.0);}'));
   gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('link');gl.useProgram(program);
   const points=vertices(),n=points.length/2,rounds=12;
   buffer=gl.createBuffer();if(!buffer)throw Error('buffer');gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,points,gl.STATIC_DRAW);const loc=gl.getAttribLocation(program,'pos');if(loc<0)throw Error('attribute');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);gl.viewport(0,0,256,256);gl.clearColor(0,0,0,1);
   function canvasFrame(){ctx.fillStyle='#000';ctx.fillRect(0,0,256,256);ctx.fillStyle='#bfd9ff';for(let i=0;i<points.length;i+=2)ctx.fillRect((points[i]+1)*128,(1-points[i+1])*128,2,2);}
   function glFrame(){gl.clear(gl.COLOR_BUFFER_BIT);gl.drawArrays(gl.POINTS,0,n);}
   canvasFrame();glFrame();gl.finish();
   const t=clock();for(let i=0;i<rounds;i++)canvasFrame();const canvasMs=(clock()-t)/rounds;
   const u=clock();for(let i=0;i<rounds;i++)glFrame();gl.finish();const webglMs=(clock()-u)/rounds;
   if(gl.isContextLost()||![canvasMs,webglMs].every(v=>Number.isFinite(v)&&v>=0))return {ok:false,reason:'Medición inválida'};
   return {ok:true,points:n,rounds,canvasMs,webglMs};
  }catch{return {ok:false,reason:'No se pudo ejecutar el prototipo gráfico'};}
  finally{if(gl){try{if(buffer)gl.deleteBuffer(buffer);if(program)gl.deleteProgram(program);for(const s of shaders)gl.deleteShader(s);gl.getExtension('WEBGL_lose_context')?.loseContext();}catch{}}}
 }
 const api={vertices,benchmark};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ggWebGL244=api;
})(typeof globalThis!=='undefined'?globalThis:this);
