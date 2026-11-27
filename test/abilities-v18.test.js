'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {ABILITIES,active,activate,heal,speedFactor,incoming,breakCloak}=require('../abilities-v18');
test('all eleven hull skills have specified durations and cooldowns',()=>{
 assert.equal(Object.values(ABILITIES).flat().length,11);
 const p={ship:'aegis'};assert.deepEqual(activate(p,'repair-hp',1000),{until:8000,readyAt:91000});assert.throws(()=>activate(p,'repair-hp',8000));
 assert.throws(()=>activate(p,'travel',1000));
});
test('Citadel movement and incoming damage modifiers expire',()=>{
 const p={ship:'citadel'};activate(p,'travel',0);assert.equal(speedFactor(p,2000),1.5);assert.equal(speedFactor(p,5000),1);
 activate(p,'fortify',5000);assert.equal(speedFactor(p,6000),0);assert.equal(incoming(p,6000),.5);assert.equal(incoming(p,15000),1);
});
test('JAM-X blocks new abilities and cloak can be broken by firing',()=>{
 const p={ship:'spearhead',jamUntil:8000};assert.throws(()=>activate(p,'recon',5000));activate(p,'ultimate-cloak',8000);
 assert.equal(active(p,'ultimate-cloak',9000),true);breakCloak(p);assert.equal(active(p,'ultimate-cloak',9000),false);assert.throws(()=>activate(p,'ultimate-cloak',9000));
});
test('repair cannot exceed maximum hull or shield',()=>{
 const p={hp:50,maxHp:100,shield:20,maxShield:60};heal(p,'hp',20000);heal(p,'shield',15000);assert.equal(p.hp,100);assert.equal(p.shield,60);
});
