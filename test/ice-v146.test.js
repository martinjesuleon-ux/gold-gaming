'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {RULES,REWARD,createEvent,advance,hit,shares,view}=require('../ice-v146');
test('Ice event countdown, timed spawns, cap and expiry',()=>{
 const e=createEvent('4-5',0);assert.equal(e.phase,'countdown');assert.throws(()=>createEvent('fake',0));
 assert.equal(e.boss.hp,4000000);assert.equal(e.boss.shield,4000000);assert.equal(e.boss.damage,75000);
 advance(e,59999);assert.equal(e.phase,'countdown');advance(e,60000);assert.equal(e.phase,'active');
 advance(e,65999);assert.equal(e.icy.size,0);advance(e,66000);assert.equal(e.icy.size,1);
 advance(e,240000);assert.equal(e.icy.size,25);advance(e,3660000);assert.equal(e.phase,'expired');assert.equal(e.icy.size,0);
});
test('Icy death heals the boss and boss defeat shares the exact reward pool',()=>{
 const e=createEvent('4-5',0),p={zone:e.map,accountId:'a',x:e.boss.x,y:e.boss.y},q={...p,accountId:'b'};
 assert.throws(()=>hit(e,p,e.boss.id,100,0));
 advance(e,66000);const icy=[...e.icy.values()][0];
 hit(e,p,e.boss.id,1000000,66000);const hp=e.boss.hp;
 const r=hit(e,p,icy.id,1000000,66000);assert.equal(r.boss,false);assert.equal(e.boss.hp,hp+70000);
 const done=hit(e,q,e.boss.id,20000000,66000);assert.equal(done.boss,true);assert.equal(e.phase,'defeated');assert.equal(done.shares.length,2);
 for(const [k,v] of Object.entries(REWARD))assert.equal(done.shares.reduce((n,x)=>n+x[k],0),v);
 assert.equal(e.boxes.size,15);for(const b of e.boxes.values())assert.equal(b.uridium,2000);
 assert.ok(view(e).boxes.every(b=>!Object.hasOwn(b,'uridium')));advance(e,366000);assert.equal(e.boxes.size,0);
});
test('Ice shared reward rounding is deterministic and excludes zero contributors',()=>{
 const result=shares(new Map([['a',1],['b',1],['c',1],['d',0]]));assert.equal(result.length,3);
 for(const [k,v] of Object.entries(REWARD))assert.equal(result.reduce((n,x)=>n+x[k],0),v);
 assert.ok(result[0].credits>=result[1].credits);
});
