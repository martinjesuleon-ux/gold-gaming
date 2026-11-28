'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {vertices,benchmark}=require('../public/webgl-benchmark-v244');
test('prototype star geometry is deterministic and bounded',()=>{const a=vertices(512);assert.equal(a.length,1024);assert.deepEqual(a,vertices(512));assert.ok(a.every(v=>v>=-1&&v<=1));assert.equal(vertices(100000).length,4096);});
test('unavailable graphics contexts fail without touching active game canvas',()=>{let created=0;const doc={createElement(){created++;return {getContext:()=>null};}};assert.equal(benchmark(doc).ok,false);assert.equal(created,2);assert.equal(benchmark(null).ok,false);});
test('failed shader compilation releases allocated shader and test context',()=>{let deleted=0,lost=0,created=0;const gl={createProgram:()=>({}),createShader:()=>({}),shaderSource(){},compileShader(){},getShaderParameter:()=>false,deleteProgram(){},deleteShader(){deleted++;},getExtension:()=>({loseContext(){lost++;}})};const doc={createElement(){created++;return {getContext:()=>created===1?{}:gl};}};assert.equal(benchmark(doc).ok,false);assert.equal(deleted,1);assert.equal(lost,1);});
