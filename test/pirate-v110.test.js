'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {PIRATE,pirateLoot,bonusLoot}=require('../loot-v14');
test('pirate table covers all 100 outcomes and exact weights',()=>{
 const counts={};for(let r=0;r<100;r++){const loot=pirateLoot(r);counts[loot.code]=(counts[loot.code]||0)+1;assert.ok(loot.quantity>0);assert.equal(loot.weight,undefined);}
 assert.deepEqual(counts,{'UCB-100':45,uridium:25,credits:15,'log-disk':10,'LF-3':4,'LF-4':1});
 assert.equal(PIRATE.reduce((n,x)=>n+x.weight,0),100);
 assert.equal(pirateLoot(99).category,'lasers');
});
test('invalid rolls rejected; ordinary bonus unchanged',()=>{
 for(const roll of [-1,100,0.5,NaN,Infinity,'1'])assert.throws(()=>pirateLoot(roll));
 assert.deepEqual(bonusLoot(0,0),{code:'LCB-10',quantity:10});
});
