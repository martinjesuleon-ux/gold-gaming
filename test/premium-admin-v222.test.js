'use strict';
const test=require('node:test'),assert=require('node:assert/strict');const premium=require('../premium-admin-v222');

const {grantInput,grantExpiry,createPremiumAdmin}=premium;
const now=Date.parse('2026-11-27T00:00:00.000Z'),day=86400000,requestId='00000000-0000-4000-8000-000000000001',base={username:'Pilot',requestId,days:7};
const rejects=async fn=>{try{await fn();return false;}catch{return true;}};
function fixture(enabled=true){
 let row=null,writes=0,until=0;const calls=[];
 const c={release(){},async query(sql,args){calls.push(sql);if(sql.startsWith('SELECT request,response'))return {rows:row?[row]:[]};if(sql.startsWith('SELECT a.id'))return {rows:[{id:'pilot',username:'Pilot'}]};if(sql.startsWith('SELECT until_ms'))return {rows:until?[{until_ms:until}]:[]};if(sql.startsWith('INSERT INTO gg_booster_active')){until=args[1];writes++;}if(sql.startsWith('INSERT INTO gg_premium_admin'))row={request:JSON.parse(args[2]),response:JSON.parse(args[3])};return {rows:[]};}};
 return {service:createPremiumAdmin({connect:async()=>c},()=>enabled),calls,get writes(){return writes}};
}
const cases=[
 ['inactive account receives full purchased duration',async()=>grantExpiry(0,grantInput(base),now)===now+7*day],
 ['active account extends remaining time',async()=>grantExpiry(now+3*day,grantInput(base),now)===now+10*day],
 ['all supported durations accepted',async()=>[1,3,7,30].every(days=>grantInput({...base,days}).days===days)],
 ['invalid duration rejected',async()=>rejects(()=>grantInput({...base,days:365}))],
 ['ambiguous duration rejected',async()=>rejects(()=>grantInput({...base,until:'2026-12-01T00:00:00.000Z'}))],
 ['custom date accepted',async()=>grantExpiry(0,grantInput({...base,days:null,until:'2026-12-01T00:00:00.000Z'}),now)===now+4*day],
 ['cannot shorten active premium',async()=>rejects(()=>grantExpiry(now+10*day,grantInput({...base,days:null,until:'2026-12-01T00:00:00.000Z'}),now))],
 ['date in past rejected',async()=>rejects(()=>grantExpiry(0,grantInput({...base,days:null,until:'2026-11-01T00:00:00.000Z'}),now))],
 ['feature gate blocks writes',async()=>{const f=fixture(false);return await rejects(()=>f.service.grant(base))&&f.writes===0;}],
 ['same request extends time exactly once',async()=>{const f=fixture();const a=await f.service.grant(base),b=await f.service.grant(base);return a.until===b.until&&f.writes===1;}],
 ['changed duration with same request rejected',async()=>{const f=fixture();await f.service.grant(base);return await rejects(()=>f.service.grant({...base,days:30}))&&f.writes===1&&f.calls.includes('ROLLBACK');}],
 ['changed pilot with same request rejected',async()=>{const f=fixture();await f.service.grant(base);return await rejects(()=>f.service.grant({...base,username:'Other'}))&&f.writes===1;}]
];
for(const [name,fn] of cases)test(name,async()=>assert.ok(await fn()));
