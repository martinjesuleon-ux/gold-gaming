'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('purchase receipts reject different parameters without a second debit',async()=>{
 const src=read('inventory-v13.js'),a=src.indexOf(' async function purchase('),b=src.indexOf(' async function snapshot(',a);
 const prior={ok:true,quantity:4,request:{category:'fuel',code:'pet-fuel',quantity:4,targetLevel:null}};
 let calls=0;
 const purchase=vm.runInNewContext(src.slice(a,b)+';purchase',{transaction:async(id,fn)=>fn({query:async sql=>{calls++;assert.ok(sql.startsWith('SELECT response'));return {rows:[{response:prior}]};}},{}),fail:(message,status)=>Object.assign(Error(message),{status})});
 const req={category:'fuel',code:'pet-fuel',quantity:4,requestId:'00000000-0000-4000-8000-000000000001'};
 assert.equal(await purchase('p',req),prior);
 await assert.rejects(purchase('p',{...req,quantity:8}),{status:409});assert.equal(calls,2);
 const game=read('public/gold-v13.js'),same=vm.runInNewContext(game.slice(game.indexOf('function sameShopPurchase('),game.indexOf('function button('))+';sameShopPurchase');
 assert.equal(same(req,{...req}),true);assert.equal(same(req,{...req,quantity:8}),false);assert.equal(same(req,{...req,code:'other'}),false);assert.equal(same(req,{...req,targetLevel:2}),false);
});
