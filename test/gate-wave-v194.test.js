'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {waveStep,missingKillKeys}=require('../gate-wave-v194');
test('only advances when active group is gone and resumes without duplicate NPCs',()=>{
 const boss={hp:100,gateShielded:true},mob={hp:20,gateShielded:false},queue=[[['one',1],0],[['two',2],1]];
 let calls=0;const spawn=()=>++calls===1?0:2;
 assert.equal(waveStep([boss,mob],queue,spawn),'combat');assert.equal(calls,0);assert.equal(queue.length,2);
 mob.hp=0;assert.equal(waveStep([boss,mob],queue,spawn),'spawned');assert.equal(calls,2);assert.equal(queue.length,0);assert.equal(boss.gateShielded,true);
 assert.equal(waveStep([boss],queue,spawn),'unshielded');assert.equal(boss.gateShielded,false);
 assert.equal(waveStep([boss],queue,spawn),'combat');boss.hp=0;assert.equal(waveStep([boss],queue,spawn),'clear');
 assert.deepEqual(missingKillKeys(1,5,['1:0','0:2'],['1:3']),[{i:1,key:'1:1'},{i:2,key:'1:2'},{i:4,key:'1:4'}]);
 assert.deepEqual(missingKillKeys(0,2,['0:0','0:1'],[]),[]);
});
