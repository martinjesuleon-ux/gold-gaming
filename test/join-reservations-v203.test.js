'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createJoinReservations}=require('../join-reservations-v203');
test('join reservations block duplicate loads and respect active accounts and capacity',()=>{
 const r=createJoinReservations({capacity:2}),active=new Map([['a',{}]]);
 assert.equal(r.acquire('a','s0',active).code,'ACCOUNT_BUSY');
 const b=r.acquire('b','s1',active);assert.equal(b.ok,true);
 assert.equal(r.acquire('b','s2',active).code,'ACCOUNT_BUSY');
 assert.equal(r.acquire('c','s3',active).code,'SERVER_FULL');
 assert.equal(r.release({...b.lease}),false);
 assert.equal(r.size(),1);assert.equal(r.release(b.lease),true);
 const c=r.acquire('c','s3',active);assert.equal(c.ok,true);
 active.set('c',{});assert.equal(r.release(c.lease),true);
 assert.equal(r.acquire('c','s4',active).code,'ACCOUNT_BUSY');
 assert.equal(r.acquire('d','s5',active).code,'SERVER_FULL');
 active.delete('c');const d=r.acquire('d','s5',active);
 assert.equal(d.ok,true);assert.equal(r.release(c.lease),false);
 assert.equal(r.size(),1);assert.equal(r.release(d.lease),true);assert.equal(r.size(),0);
});
test('disconnected saving accounts retain their account lock but release their live slot',()=>{
 const r=createJoinReservations({capacity:2}),active=new Map([['connected',{}],['saving',{}]]);
 assert.equal(r.acquire('saving','retry',active,1).code,'ACCOUNT_BUSY');
 const replacement=r.acquire('replacement','new',active,1);assert.equal(replacement.ok,true);
 assert.equal(r.acquire('overflow','other',active,1).code,'SERVER_FULL');
 active.set('replacement',{});assert.equal(r.release(replacement.lease),true);
 assert.equal(r.acquire('overflow','other',active,2).code,'SERVER_FULL');
 active.delete('saving');assert.equal(r.acquire('saving','retry',active,2).code,'SERVER_FULL');
});
