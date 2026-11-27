'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {trackPending,drainPending}=require('../stability-v160');
test('shutdown waits for loading sessions and newly queued work, including failures',async()=>{
 const pending=new Set();let release,releaseChild,finished=false;
 const gate=new Promise(r=>release=r),child=new Promise(r=>releaseChild=r);
 const job=trackPending(pending,async()=>{await gate;trackPending(pending,()=>child);return 'done'});
 assert.equal(pending.size,1);
 const drain=drainPending(pending).then(()=>finished=true);await Promise.resolve();assert.equal(finished,false);
 release();assert.equal(await job,'done');assert.equal(finished,false);assert.equal(pending.size,1);
 releaseChild();await drain;assert.equal(finished,true);assert.equal(pending.size,0);
 const rejected=trackPending(pending,()=>{throw Error('failure')});await drainPending(pending);
 await assert.rejects(rejected,/failure/);assert.equal(pending.size,0);
});
