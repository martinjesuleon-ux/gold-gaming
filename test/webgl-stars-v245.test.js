'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {offset,create}=require('../public/webgl-stars-v245');
test('WebGL parallax uses the same wrapped offset as Canvas tile origins',()=>{for(const camera of [{x:0,y:0},{x:6000,y:4000},{x:-100,y:-300}]){const [x,y]=offset(camera,.38,1920,1080,930);assert.ok(x>=0&&x<930&&y>=0&&y<930);assert.deepEqual(offset({x:camera.x+930/.38,y:camera.y},.38,1920,1080,930).map(Math.round),[x,y].map(Math.round));}});
test('unsupported context returns null and leaves Canvas fallback available',()=>{assert.equal(create({createElement:()=>({getContext:()=>null})}),null);assert.equal(create(null),null);});
test('shader failure disposes test graphics resources',()=>{let deleted=0,lost=0;const gl={createProgram:()=>({}),createShader:()=>({}),shaderSource(){},compileShader(){},getShaderParameter:()=>false,deleteProgram(){},deleteShader(){deleted++;},getExtension:()=>({loseContext(){lost++;}})};assert.equal(create({createElement:()=>({getContext:()=>gl,addEventListener(){}})}),null);assert.equal(deleted,1);assert.equal(lost,1);});

test('successful star renderer reuses textures, draws all layers, resizes and releases resources',()=>{
 let uploads=0,draws=0,composites=0,deletedTextures=0,deletedBuffers=0,deletedPrograms=0,deletedShaders=0,lost=0,listener;
 const noop=()=>{},gl={MAX_TEXTURE_SIZE:1,MAX_RENDERBUFFER_SIZE:2,NO_ERROR:0,createProgram:()=>({}),createShader:()=>({}),shaderSource:noop,compileShader:noop,getShaderParameter:()=>true,attachShader:noop,linkProgram:noop,getProgramParameter:()=>true,useProgram:noop,createBuffer:()=>({}),bindBuffer:noop,bufferData:noop,getAttribLocation:()=>0,enableVertexAttribArray:noop,vertexAttribPointer:noop,getUniformLocation:()=>({}),uniform1i:noop,enable:noop,blendFunc:noop,pixelStorei:noop,getParameter:()=>4096,isContextLost:()=>false,viewport:noop,clearColor:noop,clear:noop,uniform2f:noop,uniform1f:noop,createTexture:()=>({}),bindTexture:noop,texParameteri:noop,texImage2D(){uploads++;},drawArrays(){draws++;},getError:()=>0,deleteTexture(){deletedTextures++;},deleteBuffer(){deletedBuffers++;},deleteProgram(){deletedPrograms++;},deleteShader(){deletedShaders++;},getExtension:()=>({loseContext(){lost++;}})};
 const canvas={width:0,height:0,getContext:()=>gl,addEventListener(type,fn){listener=fn;}};
 const renderer=create({createElement:()=>canvas}),ctx={drawImage(){composites++;}},camera={x:6000,y:4000},layers=[[1,.12,.7,110],[2,.38,1,155]],tile=(layer,size,cell)=>({width:cell*6,height:cell*6});
 assert.ok(renderer);assert.equal(renderer.render(ctx,camera,800,600,layers,tile),true);
 assert.equal(renderer.render(ctx,camera,1024,768,layers,tile),true);assert.equal(canvas.width,1024);assert.equal(canvas.height,768);
 assert.deepEqual([uploads,draws,composites],[2,4,2]);assert.equal(renderer.render(ctx,camera,5000,768,layers,tile),false);
 listener();assert.equal(renderer.render(ctx,camera,800,600,layers,tile),false);renderer.dispose();
 assert.deepEqual([deletedTextures,deletedBuffers,deletedPrograms,deletedShaders,lost],[2,1,1,2,1]);
});
