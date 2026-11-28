'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {normalize,createLimiter}=require('../public/fps-limit-v242');
test('default does not limit the browser animation cadence',()=>{const l=createLimiter();for(let i=0;i<240;i++)assert.equal(l.allow(i*1000/240),true);assert.equal(l.allow(NaN),false);});
test('optional FPS caps respect long term target on a high refresh display',()=>{for(const hz of [60,120,144,165,240]){const l=createLimiter(hz);let n=0;for(let i=0;i<480;i++)if(l.allow(i*1000/240))n++;assert.ok(Math.abs(n-hz*2)<=2,'cap '+hz+' rendered '+n);}});
test('limiter does not invent frames on lower refresh displays',()=>{const l=createLimiter(240);for(let i=0;i<120;i++)assert.equal(l.allow(i*1000/60),true);});
test('changing rate or resuming resets schedule without catch-up bursts',()=>{const l=createLimiter(60);assert.equal(l.allow(0),true);assert.equal(l.allow(1),false);assert.equal(l.set(120),120);assert.equal(l.allow(2),true);assert.equal(l.allow(2000),true);assert.equal(l.allow(2001),false);l.reset();assert.equal(l.allow(2002),true);assert.equal(l.set(0),0);assert.equal(l.allow(2003),true);});
test('invalid choices fall back to native refresh',()=>{for(const v of [30,999,-1,NaN,'bad',undefined])assert.equal(normalize(v),0);assert.equal(normalize('144'),144);});
