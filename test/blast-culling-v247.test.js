'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {classify}=require('../public/blast-culling-v247');
test('offscreen blast and diagonal corner are culled',()=>{assert.equal(classify(-100,-100,100,800,600,4),'outside');assert.equal(classify(1000,300,100,800,600,4),'outside');});
test('huge kamikaze covers viewport while outline remains outside',()=>{assert.equal(classify(400,300,5000,800,600,80),'covered');assert.equal(classify(-1000,300,5000,800,600,80),'covered');});
test('intersecting outline and padded glow remain visible',()=>{assert.equal(classify(400,300,500,800,600,4),'edge');assert.equal(classify(400,300,510,800,600,80),'edge');assert.equal(classify(-105,300,100,800,600,10),'edge');});
test('invalid geometry fails safely',()=>{assert.equal(classify(NaN,0,1,800,600,4),'outside');assert.equal(classify(0,0,-1,800,600,4),'outside');});
