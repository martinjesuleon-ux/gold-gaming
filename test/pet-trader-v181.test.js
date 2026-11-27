'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {tradeQuote}=require('../pet-trader-v181'),{saleValue}=require('../minerals-v17');
test('cargo trader sells only priced minerals, preserving palladium and xenomit',()=>{
 const cargo={prometium:100,promerium:10,paladio:500,xenomit:50};
 const expected={prometium:100,promerium:10};
 for(const [level,credits,away] of [[1,2625,300000],[2,2875,120000],[3,3250,30000]]){
  const r=tradeQuote(level,cargo,0,saleValue,1000);
  assert.deepEqual(r.sold,expected);assert.equal(r.base,2500);assert.equal(r.credits,credits);assert.equal(r.until,1000+away);
 }
 assert.throws(()=>tradeQuote(3,{promerium:-1},0,saleValue,1000));
 assert.equal(tradeQuote(3,{paladio:500},0,saleValue,1000).credits,0);
});