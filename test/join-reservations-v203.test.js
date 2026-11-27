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
