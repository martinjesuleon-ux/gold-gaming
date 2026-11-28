'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {configurations}=require('../equipment-v13');
const owned=new Map([['cpu',{category:'cpus',code:'SL-01'}],['robot',{category:'robots',code:'REP-S'}],['hst',{category:'launchers',code:'HST-2'}],['lf',{category:'lasers',code:'LF-4'}],['shield',{category:'shields',code:'SG3N-A01'}],['engine',{category:'engines',code:'G3N-1010'}]]);
test('owned CPUs, robot and dedicated Hellstorm can be equipped in both configurations without duplicating effects',()=>{
 const extras=['cpu','robot','hst'],r=configurations('goliath',[[...extras,'lf','shield'],[...extras,'engine']],owned);
 for(const c of r){assert.equal(c.launcher,'HST-2');assert.equal(c.robot,'REP-S');assert.deepEqual(c.cpus,['SL-01']);assert.equal(c.extrasUsed,2);}
 assert.equal(r[0].lasers,1);assert.equal(r[1].lasers,0);
});
test('owned laser, shield and engine can be reused across independent configurations',()=>{
 const loadout=['lf','shield','engine'];const r=configurations('goliath',[loadout,[...loadout]],owned);
 assert.deepEqual(r[0],r[1]);assert.equal(r[0].lasers,1);assert.ok(r[0].shield>0);
});
test('same-configuration duplicate and unowned equipment restrictions remain',()=>{
 for(const id of ['cpu','lf','shield','engine','robot','hst'])assert.throws(()=>configurations('goliath',[[id,id],[]],owned),/duplicado/);
 assert.throws(()=>configurations('goliath',[['missing'],[]],owned),/no disponible/);
});
test('PET holds in passive mode and catches up at a wider distance without moving when idle',()=>{
 const {travelGoal}=require('../pet-navigation-v187');const goal=(p,target)=>travelGoal(p,target,1000,{w:12000,h:8000});
 const p={x:5000,y:5000,petX:4400,petY:5000,angle:0,petMode:'passive'};
 assert.equal(goal(p,null).x,4400);p.x=5500;assert.notEqual(goal(p,null).x,4400);
 p.petMode='guard';p.petFollowing=false;p.x=5000;assert.notEqual(goal(p,null).x,4400);
 const box={x:6000,y:6000};assert.deepEqual(goal(p,box),{...box,kind:'pickup'});p.x=6500;assert.equal(goal(p,box).kind,'follow');
});

test('Hellstorm can be equipped with all ordinary extra slots occupied in both configurations',()=>{const ship=require('../data/catalog-v13.json').ships.find(s=>s.id==='phoenix');const inventory=new Map([['hst',{category:'launchers',code:'HST-2'}]]);const ids=['hst'];const cpuCodes=require('../cpus-v18').CPUS.filter(c=>!c.slots).map(c=>c.id);assert.ok(ship.extras<=cpuCodes.length);for(let i=0;i<ship.extras;i++){const id='cpu'+i;ids.push(id);inventory.set(id,{category:'cpus',code:cpuCodes[i]});}const results=configurations(ship.id,[ids,[...ids]],inventory);for(const c of results){assert.equal(c.launcher,'HST-2');assert.equal(c.extrasUsed||0,ship.extras);}});
