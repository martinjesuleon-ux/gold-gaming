'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {bonusLoot,BONUS}=require('../loot-v14');
const {spinAlpha,ALPHA}=require('../gates-v14');
test('bonus box distribution totals 100 and matches each category',()=>{
 const counts={};for(let i=0;i<100;i++){const r=bonusLoot(i,0);counts[r.code]=(counts[r.code]||0)+1;}
 for(const [code,weight,values] of BONUS){assert.equal(counts[code],weight);assert.equal(bonusLoot(BONUS.slice(0,BONUS.findIndex(x=>x[0]===code)).reduce((n,x)=>n+x[1],0),0).quantity,values[0]);}
});
test('Alpha creates unique pieces and caps multiplier',()=>{
 const initial={pieces:[],multiplier:1};const first=spinAlpha(initial,0,1);
 assert.deepEqual(first.pieces,[1]);assert.deepEqual(initial.pieces,[]);
 let next=first;for(let i=0;i<10;i++)next=spinAlpha(next,0,1);
 assert.equal(next.multiplier,6);
 const used=spinAlpha(next,0,1,true);assert.equal(used.pieces.length,7);assert.equal(used.multiplier,1);
});
test('Alpha cannot award more than the number of missing pieces',()=>{
 const pieces=Array.from({length:ALPHA.pieces-1},(_,i)=>i+1);
 const next=spinAlpha({pieces,multiplier:6},0,1,true);
 assert.equal(next.pieces.length,ALPHA.pieces);
 assert.equal(next.reward.quantity,1);
 assert.throws(()=>spinAlpha(next,0,1));
});
test('Non-piece result awards ammo and consumes selected multiplier',()=>{
 const result=spinAlpha({pieces:[],multiplier:3},99,1,true);
 assert.deepEqual(result.reward,{code:'LCB-10',quantity:300});
 assert.equal(result.multiplier,1);
});
