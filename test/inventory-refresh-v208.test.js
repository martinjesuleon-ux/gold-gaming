'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
test('inventory refresh serializes reads, coalesces bursts and recovers after errors',async()=>{
 const src=fs.readFileSync(path.join(__dirname,'../public/gold-v13.js'),'utf8'),a=src.indexOf('function createRefreshQueue('),b=src.indexOf('const refresh=createRefreshQueue(',a);
 assert.ok(a>=0&&b>a);
 const make=vm.runInNewContext(src.slice(a,b)+';createRefreshQueue');
 const reads=[],published=[],request=make(()=>new Promise((resolve,reject)=>reads.push({resolve,reject})),x=>published.push(x));
 const flush=()=>new Promise(resolve=>setImmediate(resolve));
 const p1=request(),p2=request(),p3=request();assert.notEqual(p1,p2);assert.equal(p2,p3);
 await flush();assert.equal(reads.length,1);reads[0].resolve(1);assert.equal(await p1,1);
 await flush();assert.equal(reads.length,2);const p4=request();assert.notEqual(p4,p2);
 reads[1].resolve(2);assert.equal(await p2,2);await flush();assert.equal(reads.length,3);
 reads[2].reject(Error('failed'));await assert.rejects(p4,/failed/);
 const p5=request();await flush();reads[3].resolve(3);assert.equal(await p5,3);assert.deepEqual(published,[1,2,3]);
});
