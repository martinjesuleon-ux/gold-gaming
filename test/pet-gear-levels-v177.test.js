'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {spec,quoteGear}=require('../pet-gear-levels-v177');
test('wiki gear tiers retain exact loot ranges and kamikaze statistics',()=>{
 assert.deepEqual([1,2,3].map(n=>spec('G-AL1',n).range),[700,1500,2500]);
 assert.deepEqual([1,2,3].map(n=>spec('G-KK1',n)),[{price:7500,damage:25000,radius:250,cooldown:120000},{price:17500,damage:45000,radius:350,cooldown:60000},{price:65000,damage:75000,radius:450,cooldown:30000}]);
});
test('gear quotes enforce sequential purchase and PET levels 4 and 8',()=>{
 assert.equal(quoteGear('G-AL1',0,1,0).total,7500);
 assert.equal(quoteGear('G-AL1',1,2,4).total,17500);
 assert.equal(quoteGear('G-AL1',2,3,8).total,50000);
 assert.equal(quoteGear('G-KK1',2,3,20).total,65000);
 for(const args of [['G-AL1',1,2,3],['G-AL1',2,3,7],['G-KK1',0,3,20],['G-KK1',3,4,20],['G-KK1',1,1,20],['__proto__',0,1,20]])assert.throws(()=>quoteGear(...args));
});
