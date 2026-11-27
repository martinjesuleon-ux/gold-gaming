'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {BoxIndex,petEligible}=require('../box-index-v163');
const {nearestEligible}=require('../npc-targeting-v163');
test('box index preserves zone order and removes collected boxes immediately',()=>{
 const boxes=new BoxIndex(),a={id:'a',zone:'1',x:20,y:0},b={id:'b',zone:'2',x:1,y:0},c={id:'c',zone:'1',x:30,y:0};
 for(const item of [a,b,c])boxes.set(item.id,item);
 assert.deepEqual([...boxes.inZone('1')],[a,c]);assert.equal(boxes.size,3);
 const live=boxes.inZone('1');assert.equal(live.next().value,a);boxes.delete('c');assert.equal(live.next().done,true);
 assert.equal(boxes.delete('c'),false);assert.deepEqual([...boxes.inZone('1')],[a]);
 const d={id:'d',zone:'1',x:10,y:0};boxes.set('d',d);assert.deepEqual([...boxes.inZone('1')],[a,d]);
 boxes.clear();assert.equal(boxes.size,0);assert.deepEqual([...boxes.inZone('1')],[]);
});
test('PET cannot select pending, pirate or foreign cargo and honors 700 range',()=>{
 const pilot={accountId:'owner',x:0,y:0},boxes=new BoxIndex();
 for(const b of [{id:'pirate',x:1,kind:'pirate'},{id:'foreign',x:2,kind:'cargo',owner:'other'},{id:'pending',x:3,pending:true},{id:'own',x:4,kind:'cargo',owner:'owner'},{id:'bonus',x:5},{id:'edge',x:700}])boxes.set(b.id,{...b,zone:'1',y:0});
 const choose=()=>nearestEligible(pilot,boxes.inZone('1'),700,b=>petEligible(pilot,b));
 assert.equal(choose().id,'own');boxes.delete('own');assert.equal(choose().id,'bonus');boxes.get('bonus').pending=true;assert.equal(choose(),null);
});
