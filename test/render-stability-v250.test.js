'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../public/game.js'),'utf8');
function extract(a,b){const start=source.indexOf(a),end=source.indexOf(b,start+a.length);assert.ok(start>=0&&end>start);return source.slice(start,end);}
test('canvas resize avoids redundant backing-store allocations',()=>{
 let width=0,height=0,allocations=0,transforms=0;
 const canvas={get width(){return width;},set width(v){width=v;allocations++;},get height(){return height;},set height(v){height=v;allocations++;}};
 const sandbox={canvas,ctx:{setTransform(){transforms++;}},innerWidth:800,innerHeight:600,devicePixelRatio:2,W:0,H:0,DPR:1,quality:'high',qualityProfiles:{high:{dpr:2},low:{dpr:1}}};
 const resize=vm.runInNewContext(extract('function resize(','addEventListener(\'resize\'')+';resize',sandbox);
 resize();resize();assert.equal(allocations,2);assert.equal(transforms,2);
 sandbox.innerWidth=1024;resize();assert.equal(allocations,3);assert.equal(width,2048);
 sandbox.quality='low';resize();assert.equal(allocations,5);assert.equal(width,1024);assert.equal(height,600);
});
test('performance timing counts intervals and starts fresh after a pause',()=>{
 const values={},panel={hidden:false,querySelector:k=>k};
 const sandbox={document:{hidden:false,getElementById:()=>panel},joined:true,frameMonitor:null,perfStart:0,perfFrames:0,perfFps:0,quality:'high',setHudText:(k,v)=>{values[k]=v;},perfRtt:0,perfNextPing:Infinity,socket:{connected:false}};
 const body=extract('function performanceFrame(t){','const stat=frameMonitor?.stats()');
 const run=vm.runInNewContext(body+'}};performanceFrame',sandbox);
 run(100);for(let i=1;i<=60;i++)run(100+i*1000/60);
 assert.equal(values['[data-fps]'],'60 FPS');
 run(5000);assert.equal(sandbox.perfStart,5000);assert.equal(sandbox.perfFrames,0);
 for(let i=1;i<=60;i++)run(5000+i*1000/60);
 assert.equal(values['[data-fps]'],'60 FPS');
});
