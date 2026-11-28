'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {probe}=require('../public/webgl-probe-v243');
function mock(supported){const attempts=[],released=[];const doc={createElement(){return {getContext(name,opts){attempts.push(name);assert.equal(opts.failIfMajorPerformanceCaveat,true);if(!supported.includes(name))return null;return {MAX_TEXTURE_SIZE:1,MAX_TEXTURE_IMAGE_UNITS:2,isContextLost:()=>false,getParameter:k=>k===1?8192:16,getExtension:()=>({loseContext:()=>released.push(name)})};}};}};return {doc,attempts,released};}
test('WebGL2 is preferred and probe context released',()=>{const m=mock(['webgl2','webgl']);assert.deepEqual(probe(m.doc),{available:true,version:2,maxTextureSize:8192,maxUnits:16});assert.deepEqual(m.attempts,['webgl2']);assert.deepEqual(m.released,['webgl2']);});
test('WebGL1 fallback works when WebGL2 is unavailable',()=>{const m=mock(['webgl']);assert.equal(probe(m.doc).version,1);assert.deepEqual(m.attempts,['webgl2','webgl']);assert.deepEqual(m.released,['webgl']);});
test('unsupported or throwing graphics contexts fail safely',()=>{assert.equal(probe(mock([]).doc).available,false);assert.equal(probe({createElement(){throw Error('disabled');}}).available,false);assert.equal(probe(null).version,0);});
test('lost context is not advertised as usable',()=>{const doc={createElement:()=>({getContext:()=>({isContextLost:()=>true,getExtension:()=>null})})};assert.equal(probe(doc).available,false);});
