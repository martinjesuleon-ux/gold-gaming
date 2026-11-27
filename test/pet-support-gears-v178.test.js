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
test('self repair tiers use the wiki purchase prices and level gates',()=>{
 const {quoteGear}=require('../pet-gear-levels-v177');
 assert.equal(quoteGear('G-REP1',0,1,0).total,2500);
 assert.equal(quoteGear('G-REP1',1,2,4).total,6000);
 assert.equal(quoteGear('G-REP1',2,3,8).total,12500);
 assert.throws(()=>quoteGear('G-REP1',2,3,7));
});
test('repair tick validates mounted gear and persists hull only',async()=>{
 const {createPetProgression}=require('../pet-progression-v173');
 const {TEST_ACCOUNT}=require('../pet-test-kit-v175');
 let mounted=true,hp=10000,shield=123,updates=0;
 const c={async query(sql,args){
  if(sql.startsWith('SELECT uridium'))return {rows:[{uridium:0}]};
  if(sql.startsWith('SELECT 1 FROM gg_v13_inventory'))return {rowCount:1};
  if(sql.startsWith('SELECT experience,slots'))return {rows:[{experience:150000000,slots:{laser:12,generator:22,gear:6,protocol:12}}]};
  if(sql.startsWith('SELECT configs'))return {rows:[{configs:[[],[]]}]};
  if(sql.startsWith('SELECT instance_id'))return {rows:[{instanceId:'rep',code:'G-REP1',category:'petGear',level:3}]};
  if(sql.startsWith('SELECT equipment'))return {rows:[{equipment:{laser:[],generator:[],gear:mounted?['rep']:[]}}]};
  if(sql.startsWith('SELECT hp,shield'))return {rows:[{hp,shield}]};
  if(sql.startsWith('INSERT INTO gg_pet_vitals_v173')){updates++;hp=args[1];shield=args[2];}
  return {rows:[]};
 },release(){}};
 const service=createPetProgression({connect:async()=>c});
 const v=await service.repairPetHullTick(TEST_ACCOUNT);
 assert.equal(v.hp,22000);assert.equal(v.durationMs,30000);assert.equal(v.shield,0);assert.equal(updates,1);
 mounted=false;await assert.rejects(service.repairPetHullTick(TEST_ACCOUNT),/Equipa/);assert.equal(updates,1);
 mounted=true;hp=0;await assert.rejects(service.repairPetHullTick(TEST_ACCOUNT),/destruido/);assert.equal(updates,1);
});
