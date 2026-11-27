'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createJoinReservations}=require('../join-reservations-v203');

const cases=[
 ['40 concurrent reservations accepted, 41st rejected',()=>{const r=createJoinReservations(),a=new Map();for(let i=0;i<40;i++)if(!r.acquire('p'+i,'s'+i,a).ok)return false;return r.size()===40&&r.acquire('p40','s40',a).code==='SERVER_FULL';}],
 ['duplicate pending account rejected',()=>{const r=createJoinReservations(),a=new Map();r.acquire('p','s1',a);return r.acquire('p','s2',a).code==='ACCOUNT_BUSY';}],
 ['connected account rejected',()=>createJoinReservations().acquire('p','s',new Map([['p',{}]])).code==='ACCOUNT_BUSY'],
 ['stale lease cannot release new lease',()=>{const r=createJoinReservations(),a=new Map(),l=r.acquire('p','s1',a).lease;r.release(l);const next=r.acquire('p','s2',a).lease;return !r.release(l)&&r.size()===1&&r.release(next)&&r.size()===0;}],
 ['active plus pending capacity enforced',()=>{const r=createJoinReservations({capacity:2}),a=new Map([['p1',{}]]);return r.acquire('p2','s2',a).ok&&r.acquire('p3','s3',a).code==='SERVER_FULL';}],
 ['slot reusable after release',()=>{const r=createJoinReservations({capacity:1}),a=new Map(),l=r.acquire('p','s',a).lease;return r.release(l)&&r.acquire('other','other',a).ok;}]
];
for(const [name,fn] of cases)test(name,()=>assert.ok(fn()));
