'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createGroups}=require('../groups-v15'),{damageFactor,penalty,eligible,rewardFor}=require('../pvp-v15');
test('groups require invitation and never exceed eight pilots',()=>{
 const g=createGroups();g.create('a');assert.throws(()=>g.accept('b','a'));
 for(let i=1;i<=7;i++){g.invite('a','b'+i,100);g.accept('b'+i,'a',101);}
 assert.equal(g.status('a').members.length,8);assert.throws(()=>g.invite('a','z'));
 assert.equal(g.leave('a').leader,'b1');
});
test('expired invitations are rejected and loot is conserved',()=>{
 const g=createGroups();g.create('a');g.invite('a','b',100);assert.throws(()=>g.accept('b','a',60100));
 assert.deepEqual(g.split(101,['a','b','c'],'a'),{a:35,b:33,c:33});
});
test('honor thresholds and escalation',()=>{
 assert.equal(damageFactor(-200),1);assert.equal(damageFactor(-201),.9);assert.equal(damageFactor(-10001),.1);
 assert.equal(penalty(6,20,0,100).amount,100);
 assert.equal(penalty(7,3,100,100).amount,800);
 assert.equal(penalty(7,3,100,86400100).amount,400);
 assert.equal(penalty(7,24,100,100).amount,100000000);
 const a={company:1,level:7},b={company:1,ship:'goliath',honor:-500};assert.equal(rewardFor(a,b,0,0,100).honor,512);
});
test('group members and safe-map pilots cannot attack each other',()=>{
 const a={id:'a',zone:'1-3',group:'g'},b={id:'b',zone:'1-3',group:'g'};
 assert.equal(eligible(a,b,100),false);assert.equal(eligible(a,{...b,group:null},100),true);
 assert.equal(eligible({...a,zone:'1-1'},{...b,zone:'1-1',group:null},100),false);
});
