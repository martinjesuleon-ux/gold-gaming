'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {hullUpgradeQuote,purchaseHull}=require('../pet-hull-upgrade-v173');
test('hull upgrades require unlocked sequential tiers and table prices',()=>{
 assert.equal(hullUpgradeQuote(0,0),null);
 assert.deepEqual(hullUpgradeQuote(1,0),{tier:1,price:5000,maxHp:60000,addedHp:10000});
 assert.deepEqual(hullUpgradeQuote(20,19),{tier:20,price:50000,maxHp:250000,addedHp:10000});
 assert.equal(hullUpgradeQuote(20,20),null);
 for(const args of [[0,1],[21,0],[2,-1],[1,0.5]])assert.throws(()=>hullUpgradeQuote(...args));
 assert.throws(()=>purchaseHull(1,0,4999),/insuficiente/);
 assert.throws(()=>purchaseHull(1,1,50000),/Sube de nivel/);
 assert.equal(purchaseHull(1,0,5000).uridium,0);
});
