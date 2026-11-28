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

test('Seprom changes successful laser damage by 60 percent, including the last enhanced shot',()=>{const {consume}=require('../upgrades-v18');const base=10000,ammo=4;let u=load({},'laser','seprom',1);for(let i=0;i<10;i++){const r=consume(u,['laser']);assert.equal(Math.round(base*ammo*r.factors.laser),64000);u=r.next;}assert.equal(Math.round(base*ammo*consume(u,['laser']).factors.laser),40000);});
test('Hitac and Ice use the atomic mineral-enhanced shot path',()=>{const src=require('node:fs').readFileSync(require.resolve('../server.js'),'utf8');for(const name of ['shootIce','shootHitac']){const start=src.indexOf('function '+name+'('),end=src.indexOf('\n const ',start),block=src.slice(start,end);assert.match(block,/accounts\.upgradedShot\(p.accountId,code,count,'laser'/);assert.match(block,/a\.multiplier\*\(p.boost\?\.damage\|\|1\)\*shot.factor/);assert.doesNotMatch(block,/ubaAuthorizeAmmo/);}});
