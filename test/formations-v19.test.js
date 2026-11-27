'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {FORMATIONS,stats,absorption,combatFactor,shieldDelta,rank,bonuses}=require('../formations-v19');
test('all 19 purchasable formations have unique identifiers and wiki prices',()=>{assert.equal(FORMATIONS.length,19);assert.equal(new Set(FORMATIONS.map(x=>x.id)).size,19);assert.equal(FORMATIONS.find(x=>x.id==='wave').price,4950000);});
test('ring and drill trade damage and movement for combat bonuses',()=>{const b={hp:1000,shield:1000,damage:1000,speed:400,absorption:.8};assert.deepEqual(stats(b,'ring'),{hp:1000,shield:1850,damage:750,speed:380,absorption:.8});assert.equal(stats(b,'drill').damage,1200);assert.equal(stats(b,'heart').hp,1200);});
test('formation regeneration, shield leakage and penetration are bounded',()=>{assert.equal(shieldDelta({formation:'diamond',maxShield:1000000},1),5000);assert.equal(shieldDelta({formation:'moth',maxShield:100000},1),-5000);assert.equal(Math.round(absorption({formation:'moth'},{absorption:.8})*100),60);assert.equal(absorption({formation:'pincer'},{absorption:1}),1);});
test('combat modifiers distinguish NPC and PvP',()=>{assert.equal(combatFactor({formation:'bat'},false),1.08);assert.equal(combatFactor({formation:'bat'},true),1);assert.equal(combatFactor({formation:'pincer'},true),1.03);assert.equal(bonuses('lance').mine,1.5);});
test('drone rank thresholds match wiki',()=>{assert.equal(rank(0),1);assert.equal(rank(299),2);assert.equal(rank(3100),6);});
