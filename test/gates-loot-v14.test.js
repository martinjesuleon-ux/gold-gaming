'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {bonusLoot,BONUS}=require('../loot-v14');
const {spinGate,DEFS,GATES,SHARED,KRONOS,WAVES,itemDraw}=require('../gates-v14');
test('bonus box distribution totals 100 and matches each category',()=>{
 const counts={};for(let i=0;i<100;i++){const r=bonusLoot(i,0);counts[r.code]=(counts[r.code]||0)+1;}
 for(const [code,weight,values] of BONUS){assert.equal(counts[code],weight);assert.equal(bonusLoot(BONUS.slice(0,BONUS.findIndex(x=>x[0]===code)).reduce((n,x)=>n+x[1],0),0).quantity,values[0]);}
});
const fresh=()=>Object.fromEntries(GATES.map(g=>[g,{pieces:[],multiplier:1,built:false}]));
test('Exact spin boundaries and multiplier rules',()=>{
 const state=fresh(),counts={};
 for(let roll=0;roll<100;roll++){const r=spinGate(state,'alpha',roll,()=>0);const code=r.reward.code;counts[code]=(counts[code]||0)+1;}
 assert.deepEqual(counts,{'LCB-10':67,piece:13,xenomit:12,'nanohull-percent':4,'repair-voucher':3,'log-disk':1});
 state.alpha.multiplier=6;
 assert.equal(spinGate(state,'alpha',0,()=>0,true).multiplier,6);
 const part=spinGate(state,'alpha',67,()=>0,true);assert.equal(part.pieces.length,6);assert.equal(part.multiplier,1);
 assert.equal(spinGate(state,'alpha',67,()=>0,false).multiplier,6);
});
test('Shared parts skip built or complete gates',()=>{
 const rows=fresh();rows.alpha.built=true;rows.beta.pieces=Array.from({length:48},(_,i)=>i+1);
 const r=spinGate(rows,'alpha',67,()=>0,true);assert.equal(r.target,'gamma');
 assert.throws(()=>spinGate(rows,'kronos',67,()=>0));
});
test('Gate metadata and classical waves follow source',()=>{
 assert.equal(GATES.length,10);assert.equal(DEFS.epsilon.waves,30);assert.equal(Object.values(KRONOS).reduce((a,b)=>a+b,0),21);
 assert.deepEqual(WAVES.alpha[7],[['Sibelonit',80]]);assert.deepEqual(WAVES.beta[2],[['Mordon',40,2]]);assert.deepEqual(WAVES.gamma[7],[['Sibelonit',40,3]]);
 assert.equal(itemDraw('epsilon',true,999),'LF-4');assert.equal(itemDraw('kappa',false,974),'SG3N-B03');assert.equal(itemDraw('kappa',false,975),null);
});
