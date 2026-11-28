'use strict';
(function(root){
 function offset(camera,par,w,h,span){const mod=v=>((v%span)+span)%span;return [mod(camera.x*par-w/2),mod(camera.y*par-h/2)];}
 function create(doc){
  let canvas,gl,program,buffer,shaders=[],textures=new Map(),failed=false;
  function dispose(){if(failed)return;failed=true;try{for(const tex of textures.values())gl.deleteTexture(tex);if(buffer)gl.deleteBuffer(buffer);if(program)gl.deleteProgram(program);for(const s of shaders)gl.deleteShader(s);gl?.getExtension('WEBGL_lose_context')?.loseContext();}catch{}textures.clear();}
  try{
   canvas=doc.createElement('canvas');gl=canvas.getContext('webgl',{alpha:true,premultipliedAlpha:true,antialias:false,depth:false,stencil:false,failIfMajorPerformanceCaveat:true});
   if(!gl)return null;
   canvas.addEventListener('webglcontextlost',()=>{dispose();});
   function shader(type,source){const s=gl.createShader(type);if(!s)throw Error('shader');shaders.push(s);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error('compile');return s;}
   program=gl.createProgram();if(!program)throw Error('program');
   gl.attachShader(program,shader(gl.VERTEX_SHADER,'attribute vec2 pos; varying vec2 uv; void main(){gl_Position=vec4(pos,0.0,1.0);uv=vec2((pos.x+1.0)*0.5,(1.0-pos.y)*0.5);}'));
   gl.attachShader(program,shader(gl.FRAGMENT_SHADER,'precision highp float; varying vec2 uv; uniform vec2 viewportSize; uniform vec2 tileOffset; uniform float tileSize; uniform sampler2D tile; void main(){gl_FragColor=texture2D(tile,fract((uv*viewportSize+tileOffset)/tileSize));}'));
   gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('link');gl.useProgram(program);
   buffer=gl.createBuffer();if(!buffer)throw Error('buffer');gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
   const pos=gl.getAttribLocation(program,'pos');if(pos<0)throw Error('attribute');gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);
   const view=gl.getUniformLocation(program,'viewportSize'),shift=gl.getUniformLocation(program,'tileOffset'),span=gl.getUniformLocation(program,'tileSize');
   gl.uniform1i(gl.getUniformLocation(program,'tile'),0);gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);
   const maxSize=Math.min(4096,gl.getParameter(gl.MAX_TEXTURE_SIZE),gl.getParameter(gl.MAX_RENDERBUFFER_SIZE));
   function render(ctx,camera,w,h,layers,getTile){
    if(failed||gl.isContextLost()||![w,h,camera?.x,camera?.y].every(Number.isFinite)||w<1||h<1||w>maxSize||h>maxSize)return false;
    try{
     const width=Math.ceil(w),height=Math.ceil(h);if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
     gl.viewport(0,0,width,height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.uniform2f(view,w,h);
     for(const [layer,par,size,cell] of layers){
      let tex=textures.get(layer);const tileSize=cell*6;
      if(!tex){const tile=getTile(layer,size,cell);if(!tile||tile.width!==tileSize||tile.height!==tileSize||tileSize>maxSize)throw Error('tile');tex=gl.createTexture();if(!tex)throw Error('texture');textures.set(layer,tex);gl.bindTexture(gl.TEXTURE_2D,tex);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,tile);}
      else gl.bindTexture(gl.TEXTURE_2D,tex);
      const [x,y]=offset(camera,par,w,h,tileSize);gl.uniform2f(shift,x,y);gl.uniform1f(span,tileSize);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
     }
     if(gl.isContextLost()||gl.getError()!==gl.NO_ERROR)throw Error('draw');
     ctx.drawImage(canvas,0,0,w,h);return true;
    }catch{dispose();return false;}
   }
   return {render,dispose};
  }catch{dispose();return null;}
 }
 const api={offset,create};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ggWebGLStars245=api;
})(typeof globalThis!=='undefined'?globalThis:this);
