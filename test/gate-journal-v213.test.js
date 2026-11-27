'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('gate operations survive reload and cannot replay on another account',async()=>{
 const game=read('public/gold-v13.js'),a=game.indexOf('function createGateJournal('),b=game.indexOf('const gateJournal=',a);
 assert.ok(a>=0&&b>a);
 const make=vm.runInNewContext(game.slice(a,b)+';createGateJournal');
 const map=new Map(),storage={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
 const req={expectedAccountId:'a',requestId:'00000000-0000-4000-8000-000000000001',kind:'spin',gate:'alpha',count:100,useMultiplier:true,allowUridium:false};
 let j=make(storage);j.save('a',req);assert.equal(j.load('a').count,100);
 j=make(storage);assert.equal(j.load('a').requestId,req.requestId);assert.equal(j.load('b'),null);
 j.save('b',req);assert.equal(j.load('b'),null);j.save('a',null);assert.equal(j.load('a'),null);
 map.set('gg.gate.pending.v213:a','{broken');assert.equal(j.load('a'),null);
 const src=read('inventory-v13.js'),i=src.indexOf(' async function gateAction('),end=src.indexOf(' const gateSpin=',i);let transactions=0;
 const action=vm.runInNewContext(src.slice(i,end)+';gateAction',{transaction:async()=>{transactions++;throw Error('unexpected debit')},fail:(msg,status)=>Object.assign(Error(msg),{status})});
 await assert.rejects(action('b',req,'spin'),{status:409});assert.equal(transactions,0);
});
