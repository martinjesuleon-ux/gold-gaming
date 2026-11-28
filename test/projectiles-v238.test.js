'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {LIFE,sample}=require('../public/projectiles-v238');
const shot={x:10,y:20,tx:710,ty:20,kind:'player',ammo:'MCB-50',born:1000};
test('laser advances continuously from fixed origin to fixed destination',()=>{
 const a=sample(shot,1000),b=sample(shot,1050),c=sample(shot,1100);
 assert.equal(a.head.x,10);assert.equal(b.head.x,360);assert.equal(c.head.x,710);
 assert.equal(c.impact,0);assert.equal(b.color,'#579dff');assert.ok(b.tail.x<b.head.x);
 assert.equal(sample(shot,1200),null);
});
test('rockets have slower travel and a bounded impact phase',()=>{
 const r={...shot,kind:'rocket'},a=sample(r,1050);
 assert.ok(a.head.x<360);assert.equal(a.rocket,true);assert.equal(a.impact,null);
 const b=sample(r,1250);assert.equal(b.head.x,710);assert.ok(b.impact>0&&b.impact<1);
 assert.equal(sample(r,1000+LIFE),null);
});
test('invalid times and coordinates never produce visual projectiles',()=>{
 assert.equal(sample({...shot,x:NaN},1100),null);assert.equal(sample(shot,999),null);
 assert.equal(sample(shot,NaN),null);
});
test('zero distance and long shots remain finite and expire',()=>{
 const z=sample({...shot,tx:10},1020);assert.equal(z.head.x,10);assert.equal(z.head.y,20);
 const r={...shot,tx:20000,kind:'rocket'};assert.equal(sample(r,1480),null);
 assert.equal(sample(shot,1100).head.x,shot.tx);
});
