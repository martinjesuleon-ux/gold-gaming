'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const bank=require('../bank-v222');

const {normalizeCreate,createBank}=bank;
const base={code:'gold-22',reward:{uridium:1000}};
const now=Date.parse('2026-01-01T00:00:00.000Z');
const reject=async fn=>{try{await fn();return false;}catch{return true;}};
const cases=[
['defaults restrict one redemption per account',async()=>{const d=normalizeCreate(base,now);return d.code==='GOLD-22'&&d.oncePerAccount&&d.maxUses===null&&d.expiresAt===null;}],
['explicit limit and expiry',async()=>{const d=normalizeCreate({...base,maxUses:100,oncePerAccount:false,expiresAt:'2026-02-01T00:00:00.000Z'},now);return d.maxUses===100&&!d.oncePerAccount&&d.expiresAt==='2026-02-01T00:00:00.000Z';}],
['invalid limit rejected',async()=>reject(()=>normalizeCreate({...base,maxUses:0},now))],
['nonboolean restriction rejected',async()=>reject(()=>normalizeCreate({...base,oncePerAccount:'false'},now))],
['past expiry rejected',async()=>reject(()=>normalizeCreate({...base,expiresAt:'2025-12-31T00:00:00.000Z'},now))],
['nonexistent date rejected',async()=>reject(()=>normalizeCreate({...base,expiresAt:'2026-02-30T00:00:00.000Z'},now))],
['creation uses parameterized SQL and preserves existing codes',async()=>{let call;const b=createBank({query:async(sql,args)=>{call={sql,args};return {rows:[{code:'GOLD-22'}]};}});const r=await b.createCode(base);return r.code==='GOLD-22'&&call.sql.includes('ON CONFLICT(code) DO NOTHING')&&call.args[0]==='GOLD-22';}],
['duplicate code rejected',async()=>reject(()=>createBank({query:async()=>({rows:[]})}).createCode(base))],
['disable only changes enabled flag',async()=>{let call;const b=createBank({query:async(sql,args)=>{call={sql,args};return {rows:[{enabled:false}]};}});const r=await b.setEnabled({code:'gold-22',enabled:false});return r.enabled===false&&call.sql.includes('SET enabled=$2 WHERE code=$1')&&call.args[1]===false;}],
['unknown code cannot be enabled',async()=>reject(()=>createBank({query:async()=>({rows:[]})}).setEnabled({code:'GOLD-22',enabled:true}))],
['list uses bounded query',async()=>{const b=createBank({query:async sql=>({rows:sql.includes('LIMIT 200')?[{code:'GOLD-22'}]:[]})});return (await b.listCodes()).entries.length===1;}]
];
for(const [name,fn] of cases)test(name,async()=>assert.ok(await fn()));
