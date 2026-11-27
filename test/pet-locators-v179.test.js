'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {locatorMarker}=require('../pet-support-gears-v178');
const {quoteGear}=require('../pet-gear-levels-v177');
test('locator prices and levels match project catalog; enemy locator level one cannot be purchased',()=>{
 assert.equal(quoteGear('G-RL1',0,1,0).total,2500);
 assert.equal(quoteGear('G-RL1',1,2,4).total,6000);
 assert.equal(quoteGear('G-RL1',2,3,8).total,25000);
 assert.throws(()=>quoteGear('G-EL1',0,1,20));
 assert.equal(quoteGear('G-EL1',1,2,4).total,12500);
 assert.equal(quoteGear('G-EL1',2,3,8).total,50000);
});
test('locator marker excludes foreign cargo, expired boxes, other maps and out-of-range targets',()=>{
 const p={x:0,y:0,zone:'5-3',accountId:'pilot'},b={x:100,y:0,zone:'5-3',kind:'cargo',owner:'pilot',contents:{promerium:1},expires:2000};
 const m=locatorMarker(p,[{...b,x:10,owner:'other'},{...b,x:20,expires:999},{...b,x:30,zone:'5-2'},b],2000,'locate-resource',1000);
 assert.deepEqual(m,{x:100,y:0,map:'5-3',name:'Carga propia',distance:100,range:2000,mode:'locate-resource'});
 assert.equal(locatorMarker(p,[b],99,'locate-resource',1000),null);
});
test('enemy locator chooses only live nearby NPCs, never player positions',()=>{
 const p={x:0,y:0,zone:'1-2'},n={x:150,y:0,zone:'1-2',hp:100,name:'Streuner'};
 assert.equal(locatorMarker(p,[{...n,x:1,accountId:'other'},{...n,x:2,hp:0},{...n,x:3,gateShielded:true},n],2000,'locate-enemy',1000).name,'Streuner');
 assert.equal(locatorMarker(p,[n],100,'locate-enemy',1000),null);
});