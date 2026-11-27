'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const boosters=require('../boosters-v112');

const {CATALOG,rewardFactor,rewardFactorRead,scaleReward,factors}=boosters;
const now=1000,active={'NBX-B01':2000,'QR-01':2000,PREMIUM:2000};
const rejects=fn=>{try{fn();return false;}catch{return true;}};
const cases=[
 ['special packs last seven days and cannot be bought in game',async()=>['NBX-B01','QR-01'].every(k=>CATALOG[k].seconds===604800&&!CATALOG[k].price)],
 ['NBX doubles bonus boxes only',async()=>rewardFactor({'NBX-B01':2000},'bonus-box',now)===2&&rewardFactor({'NBX-B01':2000},'mission',now)===1],
 ['QR doubles mission claims only',async()=>rewardFactor({'QR-01':2000},'mission',now)===2&&rewardFactor({'QR-01':2000},'bonus-box',now)===1],
 ['expiry boundary disables pack',async()=>rewardFactor({'QR-01':now},'mission',now)===1],
 ['no multiplier for kills or pirate boxes',async()=>['alien','pilot','pirate','gate','daily'].every(k=>rewardFactor(active,k,now)===1)],
 ['premium alone does not double rewards',async()=>rewardFactor({PREMIUM:2000},'mission',now)===1&&rewardFactor({PREMIUM:2000},'bonus-box',now)===1],
 ['packs do not modify combat factors',async()=>Object.values(factors(active,[],now)).every(n=>n===1)],
 ['all mission reward fields doubled',async()=>{const r=scaleReward({credits:20,uridium:10,experience:30,honor:5,'UCB-100':50},2);return r.credits===40&&r.uridium===20&&r.experience===60&&r.honor===10&&r['UCB-100']===100;}],
 ['scale does not mutate base reward',async()=>{const r={credits:10};scaleReward(r,2);return r.credits===10;}],
 ['overflow rejected',async()=>rejects(()=>scaleReward({credits:Number.MAX_SAFE_INTEGER},2))],
 ['unknown factor rejected',async()=>rejects(()=>scaleReward({credits:10},3))],
 ['factor reads exact account and pack',async()=>{let args;const c={query:async(sql,a)=>{args=a;return {rows:[{until_ms:'2000'}]};}};return await rewardFactorRead(c,'pilot','mission',now)===2&&args.join('|')==='pilot|QR-01|1000';}],
 ['absent pack defaults to normal',async()=>await rewardFactorRead({query:async()=>({rows:[]})},'pilot','bonus-box',now)===1]
];
for(const [name,fn] of cases)test(name,async()=>assert.ok(await fn()));
