'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createMonitor}=require('../public/frame-pacing-v240');
test('stable sixty FPS has no slow frames',()=>{const m=createMonitor();for(let i=0;i<=120;i++)m.frame(i*1000/60);const s=m.stats();assert.ok(Math.abs(s.fps-60)<1e-8);assert.equal(s.slow,0);assert.ok(s.p95<17);});
test('frame spikes are reported instead of hidden by mean FPS',()=>{const m=createMonitor();let t=0;m.frame(t);for(let i=0;i<100;i++){t+=i%10===0?50:16;m.frame(t);}const s=m.stats();assert.equal(s.p95,50);assert.equal(s.slow,10);assert.equal(s.count,100);});
test('monitor holds only latest bounded window',()=>{const m=createMonitor(16);let t=0;m.frame(t);for(let i=0;i<100;i++){t+=i<50?60:8;m.frame(t);}assert.equal(m.stats().count,16);assert.equal(m.stats().slow,0);assert.equal(m.stats().fps,125);});
test('suspension and explicit reset discard stale frame timings',()=>{const m=createMonitor();m.frame(0);m.frame(16);m.frame(2000);assert.equal(m.stats(),null);m.frame(2016);assert.equal(m.stats().count,1);m.reset();assert.equal(m.stats(),null);});
