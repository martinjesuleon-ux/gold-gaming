'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {initial,tick,supply,demand,capacity,cargoUsed,saleValue}=require('../minerals-v17');
test('solar, consumption and warehouse match wiki anchors',()=>{
 assert.deepEqual([1,5,10,15,20].map(supply),[170,450,1250,2550,4350]);
 assert.deepEqual([1,5,10,15,20].map(demand),[16,40,115,240,415]);
 assert.equal(capacity(10,'prometium'),5938324);assert.equal(capacity(20,'seprom'),9079);
});
test('production is persisted across intervals and respects storage',()=>{
 const lab=initial(0);tick(lab,3600000);assert.equal(lab.stock.prometium,2200);
 tick(lab,7200000);assert.equal(lab.stock.prometium,4400);
 tick(lab,100*3600000);assert.equal(lab.stock.prometium,105600);
 lab.enabled.prometium=false;lab.stock.prometium=0;tick(lab,101*3600000);assert.equal(lab.stock.prometium,0);
});
test('refineries consume feedstock and cannot create mineral from nothing',()=>{
 const lab=initial(0);for(const k of Object.keys(lab.enabled))lab.enabled[k]=false;lab.enabled.prometid=true;tick(lab,3600000);assert.equal(lab.stock.prometid||0,0);
 lab.stock.prometium=200;lab.stock.endurium=100;tick(lab,7200000);assert.equal(lab.stock.prometid,10);assert.equal(lab.stock.prometium,0);assert.equal(lab.stock.endurium,0);
});
test('honor sale cap and zero-weight Xenomit',()=>{
 assert.equal(saleValue('seprom',1,500000),600);assert.equal(saleValue('seprom',1,1000000),600);
 assert.equal(cargoUsed({prometium:5,xenomit:1000,paladio:25}),30);
});
