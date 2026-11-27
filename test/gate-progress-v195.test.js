'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {waveProgress}=require('../gate-progress-v195');
test('counts future groups and protected bosses, deduplicates confirmed and observed kills',()=>{
 const groups=[['NPC',3],['Boss',1,1,true],['NPC2',2]];
 assert.deepEqual(waveProgress(groups),{total:6,eliminated:0,remaining:6});
 assert.deepEqual(waveProgress(groups,['0:0','0:1'],new Set(['0:1','0:2','9:9'])),{total:6,eliminated:3,remaining:3});
 assert.deepEqual(waveProgress(groups,['0:0','0:1','0:2','1:0','2:0','2:1','2:1']),{total:6,eliminated:6,remaining:0});
 assert.deepEqual(waveProgress([['Boss',1]],['0:0']),{total:1,eliminated:1,remaining:0});
 assert.equal(waveProgress(undefined),null);
 assert.equal(waveProgress([]),null);
});