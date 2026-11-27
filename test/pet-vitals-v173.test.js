'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {vitals,damageVitals,repairVitals}=require('../pet-vitals-v173');
const stats={maxHp:50000,shield:10000,absorption:.7};
test('new PET starts with own hull and equipped shield; saved destruction survives reload',()=>{
 assert.deepEqual(vitals(stats,null),{hp:50000,maxHp:50000,shield:10000,maxShield:10000,destroyed:false});
 assert.deepEqual(vitals(stats,{hp:0,shield:9000}),{hp:0,maxHp:50000,shield:0,maxShield:10000,destroyed:true});
 assert.equal(vitals({...stats,shield:2000},{hp:49000,shield:9000}).shield,2000);
});
test('damage absorbs shield then hull and cannot damage destroyed unit further',()=>{
 const first=damageVitals(stats,null,10000);
 assert.equal(first.hp,47000);assert.equal(first.shield,3000);
 const dead=damageVitals(stats,first,60000);assert.equal(dead.destroyed,true);assert.equal(dead.shield,0);
 assert.deepEqual(damageVitals(stats,dead,100),dead);
 for(const n of [-1,NaN,1.5])assert.throws(()=>damageVitals(stats,null,n));
});
test('repair requires destruction and sufficient balance, restores hull only',()=>{
 assert.throws(()=>repairVitals(stats,null,100,1000),/no está destruido/);
 assert.throws(()=>repairVitals(stats,{hp:0,shield:0},100,99),/insuficiente/);
 const r=repairVitals(stats,{hp:0,shield:0},100,1000);
 assert.equal(r.uridium,900);assert.equal(r.vitals.hp,50000);assert.equal(r.vitals.shield,0);
 assert.equal(repairVitals(stats,{hp:0,shield:0},0,0).uridium,0);
});
