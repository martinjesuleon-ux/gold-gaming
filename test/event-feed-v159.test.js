'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{upcomingEvents,createSnapshotCache}=require('../event-feed-v159');
test('public calendar excludes private data, expired jobs and unrecognized kinds',()=>{
 const now=Date.parse('2030-01-01T00:00:00Z'),at='2030-01-01T01:00:00Z';
 const rows=[{id:'private',kind:'ice',status:'pending',start_at:at,payload:{map:'4-5',secret:'hidden'}},{kind:'spaceball',status:'cancelled',start_at:at},{kind:'invasion',status:'pending',start_at:at,payload:{difficulty:'hard'}},{kind:'unknown',status:'pending',start_at:at},{kind:'hitac',status:'pending',start_at:'2029-01-01T00:00:00Z'}];
 const result=upcomingEvents(rows,{uridium:{mode:'scheduled',startAt:'2030-01-01T00:30:00Z',endAt:at},gateSpecial:{mode:'off'}},now);
 assert.deepEqual(result,[{kind:'uridium',startAt:'2030-01-01T00:30:00.000Z',endAt:at},{kind:'ice',startAt:'2030-01-01T01:00:00.000Z',map:'4-5'},{kind:'invasion',startAt:'2030-01-01T01:00:00.000Z',difficulty:'hard'}]);
});
test('concurrent requests share reads and failures can recover without stale results',async()=>{
 let now=0,calls=0,fail=false;const read=createSnapshotCache(async()=>{calls++;if(fail)throw Error('offline');return {calls};},{ttl:3000,clock:()=>now});
 const values=await Promise.all([read(),read(),read()]);assert.equal(calls,1);assert.deepEqual(values,[{calls:1},{calls:1},{calls:1}]);
 now=2999;assert.deepEqual(await read(),{calls:1});now=3000;fail=true;await assert.rejects(read(),/offline/);fail=false;assert.deepEqual(await read(),{calls:3});
});
test('calendar bounds public entries to twelve',()=>{
 const rows=Array.from({length:20},(_,i)=>({kind:'hitac',status:'pending',start_at:new Date(1000+i*1000).toISOString()}));
 assert.equal(upcomingEvents(rows,{},0).length,12);
});
