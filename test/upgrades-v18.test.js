'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {load,consume,factor,BONUS}=require('../upgrades-v18');
const {quote}=require('../equipment-v13');
test('one Seprom gives ten boosted laser salvos then expires',()=>{
 let u=load({},'laser','seprom',1);
 for(let i=0;i<10;i++){const r=consume(u,['laser']);assert.equal(r.factors.laser,1.6);u=r.next;}
 assert.equal(factor(u,'laser'),1);assert.equal(u.laser.rounds,0);
});
test('rockets and lasers consume independent mineral charges',()=>{
 let u=load(load({},'laser','prometid',2),'rocket','promerium',1);
 const r=consume(u,['rocket']);assert.equal(r.factors.rocket,1.3);assert.equal(r.next.laser.rounds,20);assert.equal(r.next.rocket.rounds,9);
});
test('valid mineral slots and generator effects',()=>{
 assert.throws(()=>load({},'speed','seprom',1));assert.equal(factor(load({},'shield','seprom',1),'shield'),1.4);
 assert.equal(factor(load({},'speed','promerium',1),'speed'),1.2);
 assert.throws(()=>load(load({},'laser','seprom',1),'laser','prometid',1));
});
test('rocket purchase pricing uses correct currency and amount',()=>{
 assert.deepEqual(quote('rockets','PLT-2021',100),{id:'PLT-2021',category:'rockets',quantity:100,currency:'uridium',total:500});
 assert.equal(quote('rockets','R-310',20).total,2000);
});
