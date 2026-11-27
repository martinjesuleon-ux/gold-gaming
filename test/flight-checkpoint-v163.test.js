'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createAchievements}=require('../achievements-v125');
test('flight checkpoints use one atomic insert and counter update with duplicate protection',async()=>{
 const calls=[],a=createAchievements({async query(sql,args){calls.push({sql,args});return {rows:[]};}});
 const id='12345678-1234-1234-1234-123456789abc',req='aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
 await a.checkpointFlight(id,150,req);await a.checkpointFlight(id,150,req);
 assert.equal(calls.length,2);assert.deepEqual(calls[0],calls[1]);assert.match(calls[0].sql,/ON CONFLICT\(account_id,request_id\) DO NOTHING RETURNING/);assert.match(calls[0].sql,/FROM recorded ON CONFLICT/);assert.deepEqual(calls[0].args,[id,req,150]);await assert.rejects(a.checkpointFlight(id,-1,req));await assert.rejects(a.checkpointFlight(id,150,'bad'));
});
test('failed acknowledgement retries same checkpoint without reserving distance twice',async()=>{
 const server=fs.readFileSync(path.join(__dirname,'../server.js'),'utf8'),calls=[],pending=new Set(),c={accounts:{async flightCheckpoint(id,n,req){calls.push([id,n,req]);if(calls.length===1)throw Error('lost acknowledgement');}},crypto:{randomUUID:()=> 'stable'},pending,console};
 vm.runInNewContext(server.slice(server.indexOf('function flushFlight('),server.indexOf('function move('))+';this.flush=flushFlight;this.final=flushFlightFinal;',c);
 const pilot={accountId:'a',flightDistance:150.7,writes:Promise.resolve()};const first=c.flush(pilot);assert.equal(c.flush(pilot),first);await first;assert.deepEqual(calls,[['a',150,'stable'],['a',150,'stable']]);assert.ok(pilot.flightDistance<1);assert.equal(pilot.flightCheckpoint,null);assert.equal(pending.size,0);
});

test('final flush waits for an in-flight checkpoint then saves remaining distance',async()=>{
 const server=fs.readFileSync(path.join(__dirname,'../server.js'),'utf8'),calls=[],pending=new Set();let release,seq=0;
 const c={accounts:{flightCheckpoint(id,n,req){calls.push([id,n,req]);return calls.length===1?new Promise(resolve=>{release=resolve;}):Promise.resolve();}},crypto:{randomUUID:()=>String(++seq)},pending,console};
 vm.runInNewContext(server.slice(server.indexOf('function flushFlight('),server.indexOf('function move('))+';this.flush=flushFlight;this.final=flushFlightFinal;',c);
 const p={accountId:'a',flightDistance:100.5,writes:Promise.resolve()};const first=c.flush(p);await new Promise(setImmediate);p.flightDistance+=47;const final=c.final(p);release();await first;await final;
 assert.deepEqual(calls,[['a',100,'1'],['a',47,'2']]);assert.equal(p.flightDistance,.5);assert.equal(pending.size,0);
});
