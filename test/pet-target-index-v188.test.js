'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createTickCandidates}=require('../pet-target-index-v188');
test('PET index is lazy, shared, and only returns attackers of the owner',()=>{
 let scans=0;
 const a={id:'a'},b={id:'b'},dead={id:'dead',target:'a',hp:0},n1={id:'n1',target:'a',hp:100},n2={id:'n2',target:'b',hp:10};
 const source={values(){scans++;return [dead,n1,n2,{id:'idle',hp:100}];}};
 const pilots=new Map([['a',a],['b',b]]);
 const c=createTickCandidates(source,pilots);
 assert.equal(scans,0);assert.deepEqual(c.npcFor(a),[n1]);assert.deepEqual(c.npcFor(b),[n2]);assert.deepEqual(c.npcFor({id:'c'}),[]);assert.equal(scans,1);
 n1.hp=0;assert.equal(c.npcFor(a)[0].hp,0);
 assert.deepEqual(createTickCandidates(source,pilots).npcFor(a),[]);assert.equal(scans,2);
 a.petAggressors=new Map([['b',9900],['gone',9999],['expired',4999],['future',10001]]);
 assert.deepEqual(c.pilotsFor(a,10000),[b]);assert.equal(a.petAggressors.size,1);
 assert.deepEqual(c.pilotsFor({id:'c'},10000),[]);
});
