'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const bank=require('../bank-v222');

const {normalizeCode,normalizeReward,eligibility,createBank}=bank;
const requestId='00000000-0000-4000-8000-000000000001',id='pilot';
const row={enabled:true,expired:false,max_uses:'2',used:'0',once_per_account:true,reward:{uridium:1000,xp:2000,stacks:{'UCB-100':50},items:[{category:'lasers',code:'LF-4',quantity:1}],premiumDays:3}};
const throws=async f=>{try{await f();return false;}catch{return true;}};
function fixture(options={}){
 const calls=[];
 const client={query:async(sql,args)=>{calls.push({sql,args});if(options.fail&&sql.startsWith(options.fail))throw Error('simulated failure');if(sql.startsWith('SELECT account_id'))return {rows:[{account_id:id}]};if(sql.startsWith('SELECT code,reward'))return {rows:options.prior?[options.prior]:[]};if(sql.startsWith('SELECT *,expires'))return {rows:[options.row||row]};if(sql.startsWith('SELECT 1 FROM'))return {rows:options.previous?[{}]:[]};return {rows:[]};},release:()=>calls.push({sql:'release'})};
 return {bank:createBank({connect:async()=>client}),calls};
}
const cases=[
 ['normalize code',async()=>normalizeCode(' gold-21 ')==='GOLD-21'],
 ['invalid code rejected',async()=>throws(()=>normalizeCode('ABC!'))],
 ['unknown reward rejected',async()=>throws(()=>normalizeReward({money:1}))],
 ['negative quantity rejected',async()=>throws(()=>normalizeReward({uridium:-1}))],
 ['invalid inventory category rejected',async()=>throws(()=>normalizeReward({items:[{category:'shields',code:'LF-4',quantity:1}]}))],
 ['empty reward rejected',async()=>throws(()=>normalizeReward({stacks:{}}))],
 ['expiration enforced',async()=>throws(()=>eligibility({...row,expired:true},false))],
 ['global redemption limit enforced',async()=>throws(()=>eligibility({...row,used:'2'},false))],
 ['per account limit enforced',async()=>throws(()=>eligibility(row,true))],
 ['reward credited in one transaction',async()=>{const x=fixture();const r=await x.bank.redeem(id,{code:'GOLD-21',requestId});return !r.replayed&&x.calls.some(c=>c.sql.startsWith('UPDATE player_progress'))&&x.calls.some(c=>c.sql.includes('INSERT INTO gg_v13_inventory'))&&x.calls.some(c=>c.sql.includes('INSERT INTO gg_v16_entitlements'))&&x.calls.at(-2).sql==='COMMIT';}],
 ['same request replay never grants twice',async()=>{const x=fixture({prior:{code:'GOLD-21',reward:row.reward}});const r=await x.bank.redeem(id,{code:'GOLD-21',requestId});return r.replayed&&!x.calls.some(c=>c.sql.startsWith('UPDATE'));}],
 ['request reused with different code rejected',async()=>{const x=fixture({prior:{code:'OTHER',reward:row.reward}});return await throws(()=>x.bank.redeem(id,{code:'GOLD-21',requestId}))&&x.calls.at(-2).sql==='ROLLBACK';}],
 ['failed item grant rolls back entire redemption',async()=>{const x=fixture({fail:'INSERT INTO gg_v13_inventory'});return await throws(()=>x.bank.redeem(id,{code:'GOLD-21',requestId}))&&x.calls.at(-2).sql==='ROLLBACK'&&!x.calls.some(c=>c.sql.startsWith('UPDATE gg_bank_codes'));}]
];
for(const [name,fn] of cases)test(name,async()=>assert.ok(await fn()));
