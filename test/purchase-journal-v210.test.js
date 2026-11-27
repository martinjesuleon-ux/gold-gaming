'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('purchase journal survives reload and isolates accounts before debit',async()=>{
 const game=read('public/gold-v13.js'),a=game.indexOf('function createPurchaseJournal('),b=game.indexOf('const purchaseJournal=',a);
 const make=vm.runInNewContext(game.slice(a,b)+';createPurchaseJournal');
 const map=new Map(),storage={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
 const req={expectedAccountId:'a',requestId:'00000000-0000-4000-8000-000000000001',category:'fuel',code:'pet-fuel',quantity:4};
 let j=make(storage);j.save('a',req);assert.equal(j.load('a').requestId,req.requestId);
 j=make(storage);assert.equal(j.load('a').quantity,4);assert.equal(j.load('b'),null);
 j.save('b',req);assert.equal(j.load('b'),null);j.save('a',null);assert.equal(j.load('a'),null);
 map.set('gg.shop.pending.v210:a','{broken');assert.equal(j.load('a'),null);
 const src=read('inventory-v13.js'),i=src.indexOf(' async function purchase('),end=src.indexOf(' async function snapshot(',i);let transactions=0;
 const purchase=vm.runInNewContext(src.slice(i,end)+';purchase',{transaction:async()=>{transactions++;throw Error('unexpected debit')},fail:(msg,status)=>Object.assign(Error(msg),{status})});
 await assert.rejects(purchase('b',req),{status:409});assert.equal(transactions,0);
});
