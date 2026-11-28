'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {vertices,benchmark}=require('../public/webgl-benchmark-v244');
test('prototype star geometry is deterministic and bounded',()=>{const a=vertices(512);assert.equal(a.length,1024);assert.deepEqual(a,vertices(512));assert.ok(a.every(v=>v>=-1&&v<=1));assert.equal(vertices(100000).length,4096);});
test('unavailable graphics contexts fail without touching active game canvas',()=>{let created=0;const doc={createElement(){created++;return {getContext:()=>null};}};assert.equal(benchmark(doc).ok,false);assert.equal(created,2);assert.equal(benchmark(null).ok,false);});
test('failed shader compilation releases allocated shader and test context',()=>{let deleted=0,lost=0,created=0;const gl={createProgram:()=>({}),createShader:()=>({}),shaderSource(){},compileShader(){},getShaderParameter:()=>false,deleteProgram(){},deleteShader(){deleted++;},getExtension:()=>({loseContext(){lost++;}})};const doc={createElement(){created++;return {getContext:()=>created===1?{}:gl};}};assert.equal(benchmark(doc).ok,false);assert.equal(deleted,1);assert.equal(lost,1);});

test('successful benchmark uses matched readback batches and frees every GPU object',()=>{
 let created=0,canvasReads=0,glReads=0,draws=0,deletedShaders=0,deletedBuffers=0,deletedPrograms=0,lost=0,t=0;
 const ctx={fillRect(){},getImageData(x,y,w,h){assert.equal(w*h,65536);canvasReads++;return {};}};
 const gl={createProgram:()=>({}),createShader:()=>({}),shaderSource(){},compileShader(){},getShaderParameter:()=>true,attachShader(){},linkProgram(){},getProgramParameter:()=>true,useProgram(){},createBuffer:()=>({}),bindBuffer(){},bufferData(){},getAttribLocation:()=>0,enableVertexAttribArray(){},vertexAttribPointer(){},viewport(){},clearColor(){},clear(){},drawArrays(mode,start,n){assert.equal(n,512);draws++;},readPixels(x,y,w,h,format,type,pixels){assert.equal(pixels.length,w*h*4);glReads++;},isContextLost:()=>false,deleteBuffer(){deletedBuffers++;},deleteProgram(){deletedPrograms++;},deleteShader(){deletedShaders++;},getExtension:()=>({loseContext(){lost++;}})};
 const doc={createElement(){const n=++created;return {getContext:()=>n===1?ctx:gl};}};
 const result=benchmark(doc,()=>++t);
 assert.equal(result.ok,true);assert.equal(result.method,'draw-and-readback');assert.equal(result.rounds,12);assert.equal(result.canvasMs,result.webglMs);
 assert.equal(canvasReads,5);assert.equal(glReads,5);assert.equal(draws,13);assert.deepEqual([deletedShaders,deletedBuffers,deletedPrograms,lost],[2,1,1,1]);
});
