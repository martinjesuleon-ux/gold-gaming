'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createSnapshotCache}=require('../event-feed-v159'),{normalizeAction}=require('../uridium-event-v157');
test('admin changes invalidate cache even while a previous event snapshot is loading',async()=>{
 const calls=[],read=createSnapshotCache(()=>new Promise(resolve=>calls.push(resolve)));
 const p=read();await Promise.resolve();read.invalidate();const q=read();await Promise.resolve();
 assert.equal(calls.length,2);calls[1]('new');assert.equal(await q,'new');calls[0]('old');assert.equal(await p,'old');assert.equal(await read(),'new');
});
test('event scheduling rejects nonexistent dates and accepts canonical UTC forms',()=>{
 for(const startAt of ['2030-02-30T12:00:00Z','2030-01-01T24:00:00Z'])assert.throws(()=>normalizeAction({action:'schedule',startAt,endAt:'2030-03-01T12:00:00Z'},0),{status:400});
 assert.equal(normalizeAction({action:'schedule',startAt:'2030-02-28T12:00:00Z',endAt:'2030-03-01T12:00:00.000Z'},0).startAt,'2030-02-28T12:00:00.000Z');
});
