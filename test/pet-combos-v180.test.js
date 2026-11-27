'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {repairQuote,comboGuardFuel,deflectedDamage}=require('../pet-combos-v180');
test('combo repair authorizes exact fuel, five-second duration and tier cooldown',()=>{
 const r=repairQuote(3,1000,0,1000);
 assert.equal(r.stock,250);assert.equal(r.until,6000);assert.equal(r.readyAt,16000);assert.equal(r.repairPerSecond,25000);
 assert.throws(()=>repairQuote(3,1000,1001,1000),/recarga/);
 assert.throws(()=>repairQuote(3,1000,0,749),/Combustible/);
 assert.equal(repairQuote(1,1000,0,200).readyAt,46000);
 assert.equal(repairQuote(2,1000,0,400).readyAt,31000);
});
test('combo guard costs 35 percent extra fuel and caps protected PET damage',()=>{
 for(const level of [1,2,3])assert.equal(comboGuardFuel(10,level),14);
 assert.equal(comboGuardFuel(100,2),135);
 assert.deepEqual([1,2,3].map(l=>deflectedDamage(10000,'CGM-02',l)),[3500,2500,1500]);
 assert.equal(deflectedDamage(10000,'CSR-02',3),1500);
 assert.throws(()=>deflectedDamage(-1,'CGM-02',1));
});