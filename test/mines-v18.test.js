'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {MINES,RULES,mineImpact}=require('../mines-v18');
const v={hp:100,maxHp:100,shield:100,maxShield:100,absorption:.5};
const m=id=>MINES.find(x=>x.id===id);
test('mine arm and cooldown match wiki',()=>{assert.equal(RULES.armMs,1000);assert.equal(RULES.cooldownMs,60000);});
test('area, hull and shield mines preserve nonlethal hull floor',()=>{
 assert.deepEqual(mineImpact(v,m('ACM-01'),0),{hp:80,shield:80});
 assert.deepEqual(mineImpact(v,m('DDM-01'),0),{hp:80,shield:100});
 assert.deepEqual(mineImpact(v,m('SABM-01'),0),{hp:100,shield:85});
 assert.equal(mineImpact({...v,hp:1,shield:0},m('ACM-01'),0).hp,1);
});
test('DIOS and protected gate bosses are immune to mines',()=>{
 assert.deepEqual(mineImpact({...v,godMode:true},m('ACM-01'),0),{hp:100,shield:100});
 assert.deepEqual(mineImpact({...v,gateShielded:true},m('DDM-01'),0),{hp:100,shield:100});
});
test('slow lasts five seconds and does not shorten an existing effect',()=>{
 assert.equal(mineImpact(v,m('SLM-01'),1000).mineSlowUntil,6000);
 assert.equal(mineImpact({...v,mineSlowUntil:10000},m('SLM-01'),1000).mineSlowUntil,10000);
});
