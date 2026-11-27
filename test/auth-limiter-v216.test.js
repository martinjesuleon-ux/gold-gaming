'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
test('authentication concurrency slots are released after actual handler completion, even on rejection',async()=>{
 const s=fs.readFileSync(path.join(__dirname,'../accounts.js'),'utf8'),a=s.indexOf('const attempts=new Map();let globalWindow'),b=s.indexOf(' const cookie=',a);
 assert.ok(a>=0&&b>a);const m=vm.runInNewContext(s.slice(a,b)+';({limit,active:()=>activeAuth})');
 let release;const hold=new Promise(r=>release=r),req={body:{username:'test'}},res={status(n){this.code=n;return this},json(){return this}};
 const jobs=Array.from({length:4},()=>m.limit(()=>hold)(req,res));assert.equal(m.active(),4);
 await m.limit(()=>{throw Error('unexpected')})(req,res);assert.equal(res.code,429);
 release();await Promise.all(jobs);assert.equal(m.active(),0);
 await assert.rejects(m.limit(async()=>{throw Error('handler')})(req,res),/handler/);assert.equal(m.active(),0);
 await m.limit(async()=>{})({body:{username:{toString:null}}},res);assert.equal(m.active(),0);
});
