'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {LIFE,prepare,sample,visible}=require('../public/projectiles-v238');
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

test('only current projectile trail or impact is rendered in the viewport',()=>{
 const camera={x:350,y:20},w=100,h=100;
 assert.equal(visible(sample(shot,1000),camera,w,h),false);
 assert.equal(visible(sample(shot,1050),camera,w,h),true);
 assert.equal(visible(sample(shot,1100),camera,w,h),false);
 assert.equal(visible(sample(shot,1100),{x:710,y:20},w,h),true);
 assert.equal(visible(null,camera,w,h),false);
});

test('geometry is reused between frames and invalidated on visual input change',()=>{
 const s={...shot},first=prepare(s);assert.ok(Object.isFrozen(first));assert.equal(prepare(s),first);
 const a=sample(s,1050);assert.equal(a.head.x,360);assert.equal(Math.abs(a.sideX),0);assert.equal(a.sideY,1);
 s.ammo='RSB-75';assert.notEqual(prepare(s),first);assert.equal(sample(s,1050).color,'#ffc04f');
 s.tx=1410;assert.notEqual(prepare(s).len,first.len);s.x=NaN;assert.equal(prepare(s),null);
});

test('NPC projectiles use short distinct pulses without modifying travel time',()=>{
 const npc={...shot,kind:'normal'},boss={...shot,kind:'boss'};
 const p=prepare(shot),n=prepare(npc),b=prepare(boss);
 assert.equal(p.alien,false);assert.equal(n.alien,true);assert.equal(b.alien,true);
 assert.equal(n.travel,p.travel);assert.equal(b.travel,p.travel);
 assert.equal(n.trail,22);assert.equal(b.trail,30);assert.equal(p.trail,85);
 assert.equal(sample(npc,1050).head.x,sample(shot,1050).head.x);
 assert.equal(sample(npc,1050).head.x-sample(npc,1050).tail.x,22);
 assert.equal(prepare({...shot,kind:'rocket'}).alien,false);
});
test('alien pulses use filled geometry rather than player beam strokes in both themes',()=>{
 const {draw}=require('../public/projectiles-v238');
 for(const classic of [false,true]){
  const calls=[],ctx=new Proxy({},{get:(o,k)=>o[k]||((...a)=>calls.push([k,...a])),set:(o,k,v)=>(o[k]=v,true)});
  draw(ctx,sample({...shot,kind:'normal'},1050),(x,y)=>({x,y}),1,classic);
  assert.equal(calls.filter(c=>c[0]==='fill').length,2);
  assert.equal(calls.filter(c=>c[0]==='stroke').length,0);
 }
});
