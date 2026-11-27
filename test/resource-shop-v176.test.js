'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {quoteResource}=require('../resource-shop-v176');
test('resource shop honors exact pack quantities and requested uridium prices',()=>{
 assert.deepEqual(quoteResource('promerium',1),{id:'promerium',category:'resources',quantity:1000,packs:1,currency:'uridium',total:10000});
 assert.deepEqual(quoteResource('seprom',1),{id:'seprom',category:'resources',quantity:10000,packs:1,currency:'uridium',total:50000});
 assert.equal(quoteResource('seprom',3).quantity,30000);assert.equal(quoteResource('seprom',3).total,150000);
});
test('resource shop rejects unknown resources, fractions, negative or excessive packs',()=>{
 for(const q of [0,-1,0.5,101,Infinity,'1',null])assert.throws(()=>quoteResource('seprom',q));
 assert.throws(()=>quoteResource('prometium',1));assert.throws(()=>quoteResource('__proto__',1));
});
