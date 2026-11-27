'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {SKILLS,diskCost,skillCost,resetCost,bonus}=require('../pilot-v19');
test('reference disk costs preserved and strictly increase to point 50',()=>{for(const [n,c] of [[1,30],[5,44],[10,71],[15,114],[20,167],[30,476],[40,1234],[50,3202]])assert.equal(diskCost(n),c);for(let n=2;n<=50;n++)assert.equal(diskCost(n)>diskCost(n-1),true);assert.throws(()=>diskCost(51));});
test('pilot reset doubles and caps',()=>{assert.equal(resetCost(0),1000);assert.equal(resetCost(1),2000);assert.equal(resetCost(30),524288000);});
test('maximum skill bonuses match the supplied wiki',()=>{const b=bonus(Object.fromEntries(SKILLS.map(s=>[s.id,s.max])));for(const [k,v] of Object.entries({hp:60000,shield:1.25,absorption:.12,repair:1.4,evasion:.12,pvp:1.12,npc:1.12,accuracy:.25,rocket:1.15,rocketAccuracy:.1,mine:1.5,mineRadius:1.25,xp:1.12,credits:1.25,honor:1.25,luck:1.12,cargo:1.06,box:1.2,capacity:1.25}))assert.equal(Math.round(b[k]*100000),Math.round(v*100000));});
test('unassigned skills produce neutral modifiers and deep skills cost more',()=>{assert.equal(bonus().shield,1);assert.equal(bonus().hp,0);assert.equal(bonus().evasion,0);assert.equal(skillCost(SKILLS.find(s=>s.id==='hull2'),1).credits>skillCost(SKILLS.find(s=>s.id==='hull1'),1).credits,true);});
