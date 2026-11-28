'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {offset,create}=require('../public/webgl-stars-v245');
test('WebGL parallax uses the same wrapped offset as Canvas tile origins',()=>{for(const camera of [{x:0,y:0},{x:6000,y:4000},{x:-100,y:-300}]){const [x,y]=offset(camera,.38,1920,1080,930);assert.ok(x>=0&&x<930&&y>=0&&y<930);assert.deepEqual(offset({x:camera.x+930/.38,y:camera.y},.38,1920,1080,930).map(Math.round),[x,y].map(Math.round));}});
test('unsupported context returns null and leaves Canvas fallback available',()=>{assert.equal(create({createElement:()=>({getContext:()=>null})}),null);assert.equal(create(null),null);});
test('shader failure disposes test graphics resources',()=>{let deleted=0,lost=0;const gl={createProgram:()=>({}),createShader:()=>({}),shaderSource(){},compileShader(){},getShaderParameter:()=>false,deleteProgram(){},deleteShader(){deleted++;},getExtension:()=>({loseContext(){lost++;}})};assert.equal(create({createElement:()=>({getContext:()=>gl,addEventListener(){}})}),null);assert.equal(deleted,1);assert.equal(lost,1);});
