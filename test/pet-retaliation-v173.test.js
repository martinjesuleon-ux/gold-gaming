'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {npcRetaliatesAgainstPet}=require('../pet-combat-rules-v173');
const now=4000,n={id:'npc',target:'pilot',lastShot:now,zone:'1-2',hp:100,x:300,y:100},p={id:'pilot',hp:500,zone:'1-2',petMode:'guard',petUntil:5000,x:100,y:100,petX:200,petY:100,target:n.id,attack:true,petVitals:{enabled:true,destroyed:false},petLastHitNpc:n.id,petLastAttackAt:3000};
test('retaliation requires a recent hit from a living guard PET in range',()=>{
 assert.equal(npcRetaliatesAgainstPet(p,n,now),true);
 for(const extra of [{petLastAttackAt:999},{petLastAttackAt:4001},{petLastHitNpc:'other'},{petDamagePending:true},{petMode:'off'},{petMode:'passive'},{petVitals:{enabled:false}},{petVitals:{enabled:true,destroyed:true}},{petX:900},{petUntil:now}])assert.equal(npcRetaliatesAgainstPet({...p,...extra},n,now),false);
 assert.equal(npcRetaliatesAgainstPet(p,{...n,gateShielded:true},now),false);
 assert.equal(npcRetaliatesAgainstPet({...p,attack:false,target:'other'},n,now),true);
 assert.equal(npcRetaliatesAgainstPet(p,{...n,target:'other'},now),false);
});
