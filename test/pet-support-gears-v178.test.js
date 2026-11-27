'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {supportSpec,repairHull,locateNearest}=require('../pet-support-gears-v178');
test('support module catalog respects source ranges, prices, repair rates and excluded enemy locator base sale',()=>{
 assert.equal(supportSpec('G-RL1',3).range,5000);
 assert.equal(supportSpec('G-AR1',3).range,3000);
 assert.equal(supportSpec('G-EL1',1).price,null);
 assert.equal(supportSpec('G-REP1',3).repairPerSecond,12000);
 assert.equal(supportSpec('CSR-02',3).fuel,750);
 assert.equal(supportSpec('G-TRA1',3).awayMs,30000);
 assert.equal(supportSpec('__proto__',1),null);
});
test('repair never exceeds max health or resurrects a destroyed PET',()=>{
 assert.equal(repairHull(40000,50000,12000,1000),50000);
 assert.equal(repairHull(10000,50000,2000,500),11000);
 assert.equal(repairHull(0,50000,12000,1000),0);
 assert.throws(()=>repairHull(100,50000,12000,-100));
});
test('locator filters by zone, range and target predicate',()=>{
 const p={x:0,y:0,zone:'1-2'},a={x:500,y:0,zone:'1-2',visible:true},b={x:100,y:0,zone:'1-3',visible:true},c={x:50,y:0,zone:'1-2',visible:false};
 assert.equal(locateNearest(p,[b,c,a],700,e=>e.visible),a);
 assert.equal(locateNearest(p,[a],300),null);
});