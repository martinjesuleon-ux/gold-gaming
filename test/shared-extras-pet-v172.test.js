'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {configurations}=require('../equipment-v13');
const owned=new Map([['cpu',{category:'cpus',code:'SL-01'}],['robot',{category:'robots',code:'REP-S'}],['hst',{category:'launchers',code:'HST-2'}],['lf',{category:'lasers',code:'LF-4'}],['shield',{category:'shields',code:'SG3N-A01'}],['engine',{category:'engines',code:'G3N-1010'}]]);
test('one owned extra can be equipped in both configurations without duplicating effects',()=>{
 const extras=['cpu','robot','hst'],r=configurations('goliath',[[...extras,'lf','shield'],[...extras,'engine']],owned);
 for(const c of r){assert.equal(c.launcher,'HST-2');assert.equal(c.robot,'REP-S');assert.deepEqual(c.cpus,['SL-01']);assert.equal(c.extrasUsed,3);}
 assert.equal(r[0].lasers,1);assert.equal(r[1].lasers,0);
});
test('physical laser, shield, engine and same-configuration duplicate restrictions remain',()=>{
 for(const c of [[['cpu','cpu'],[]],[['lf'],['lf']],[['shield'],['shield']],[['engine'],['engine']],[['missing'],[]]])assert.throws(()=>configurations('goliath',c,owned));
});
test('PET holds in passive mode and catches up at a wider distance without moving when idle',()=>{
 const {travelGoal}=require('../pet-navigation-v187');const goal=(p,target)=>travelGoal(p,target,1000,{w:12000,h:8000});
 const p={x:5000,y:5000,petX:4400,petY:5000,angle:0,petMode:'passive'};
 assert.equal(goal(p,null).x,4400);p.x=5500;assert.notEqual(goal(p,null).x,4400);
 p.petMode='guard';p.petFollowing=false;p.x=5000;assert.notEqual(goal(p,null).x,4400);
 const box={x:6000,y:6000};assert.deepEqual(goal(p,box),{...box,kind:'pickup'});p.x=6500;assert.equal(goal(p,box).kind,'follow');
});
