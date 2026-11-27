'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {premiumPrice,premiumRead}=require('../boosters-v112');

const cases=[
 ['nonpremium unchanged',async()=>premiumPrice(25000,false)===25000],
 ['gate spin 95 uridium',async()=>premiumPrice(100,true)===95],
 ['gate life 23750 uridium',async()=>premiumPrice(25000,true)===23750],
 ['rounds upward rather than free purchase',async()=>premiumPrice(1,true)===1&&premiumPrice(21,true)===20],
 ['large integer precise',async()=>premiumPrice(Number.MAX_SAFE_INTEGER,true)===Number((BigInt(Number.MAX_SAFE_INTEGER)*95n+99n)/100n)],
 ['zero price remains zero',async()=>premiumPrice(0,true)===0],
 ['expired premium inactive',async()=>!(await premiumRead({query:async()=>({rows:[{until_ms:1000}]})},'pilot',1000))],
 ['active premium checks account and clock',async()=>{let args;const result=await premiumRead({query:async(sql,a)=>{args=a;return {rows:[{until_ms:'1001'}]};}},'pilot',1000);return result&&args.join('|')==='pilot|1000';}],
 ['missing premium inactive',async()=>!(await premiumRead({query:async()=>({rows:[]})},'pilot',1000))]
];
for(const [name,fn] of cases)test(name,async()=>assert.ok(await fn()));
