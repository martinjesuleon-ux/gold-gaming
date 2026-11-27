'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {quote,stats,salvo}=require('../equipment-v13');
const cat=require('../data/catalog-v13.json');
test('Hellstorm prices and capacity match supplied wiki',()=>{
 assert.deepEqual(cat.launchers.map(x=>x.capacity),[3,5]);
 assert.equal(quote('launchers','HST-1',1).total,500000);
 assert.equal(quote('launchers','HST-2',1).total,15000);
 assert.equal(quote('launcherAmmo','UBR-100',5).total,150);
 assert.throws(()=>quote('launcherAmmo','CBR',1));
});
test('one equipped launcher occupies an extra, not a generator or laser',()=>{
 const item={instanceId:'h1',code:'HST-2',level:1};
 const s=stats('goliath',[item]);
 assert.equal(s.launcher,'HST-2');assert.equal(s.generators,0);assert.equal(s.lasers,0);
 assert.throws(()=>stats('goliath',[item,{...item,instanceId:'h2'}]));
 assert.throws(()=>stats('goliath',[],[item]));
});
test('special rockets use individual wiki cooldowns and durations',()=>{
 assert.deepEqual(cat.specialRockets.map(x=>[x.id,x.duration,x.cooldown]),[['PLD-8',5000,30000],['DCR-250',5000,60000],['R-IC3',2000,120000]]);
 assert.equal(quote('specialRockets','DCR-250',1).total,500);
});
test('PLD-8 reduces accuracy without changing successful shot damage',()=>{
 const p={damage:100,lasers:1,shield:0,maxShield:0},n={hp:1000,shield:0};
 assert.equal(salvo(p,n,'LCB-10',1,.3).damage,100);
 assert.equal(salvo({...p,accuracyFactor:.6},n,'LCB-10',1,.3).damage,0);
 assert.equal(salvo({...p,accuracyFactor:.6},n,'LCB-10',1,.9).damage,100);
});
