'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {groupByZone,nearestEligible}=require('../npc-targeting-v163');
test('NPC searches only same-map candidates, preserve strict range and insertion order',()=>{
 const a={id:'a',zone:'one',x:100,y:0},b={id:'b',zone:'one',x:0,y:100},c={id:'c',zone:'two',x:1,y:0},d={id:'d',zone:'one',x:310,y:0};
 const index=groupByZone([a,b,c,d],p=>p.zone),n={x:0,y:0};
 assert.deepEqual(index.get('one'),[a,b,d]);
 assert.equal(nearestEligible(n,index.get('one'),310,()=>true),a);
 assert.equal(nearestEligible(n,index.get('one'),100,()=>true),null);
 assert.equal(nearestEligible(n,index.get('one'),Infinity,p=>p===d),d);
 assert.equal(nearestEligible(n,[],Infinity,()=>true),null);
});
test('NPC eligibility is evaluated live and expensive checks are skipped outside search radius',()=>{
 const far={x:5000,y:0},near={x:30,y:0,dead:false},other={x:40,y:0,dead:false},n={x:0,y:0};
 let calls=0;const eligible=p=>{calls++;return !p.dead;};
 assert.equal(nearestEligible(n,[far,near,other],310,eligible),near);assert.equal(calls,1);
 near.dead=true;assert.equal(nearestEligible(n,[far,near,other],310,eligible),other);
 other.dead=true;assert.equal(nearestEligible(n,[far,near,other],310,eligible),null);
});
