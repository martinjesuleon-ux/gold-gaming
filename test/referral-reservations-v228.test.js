'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {MILESTONES,pendingRewards}=require('../referral-milestones-v222');
test('no reservation until milestone receipt exists',()=>assert.deepEqual(pendingRewards([]),[]));
test('only earned milestones create reservations',()=>assert.deepEqual(pendingRewards([{milestone:15,reward:MILESTONES[15]}]),[{milestone:15,kind:'sharedCombatHours',quantity:5,state:'reserved'}]));
test('reservation uses historical reward rather than current catalogue',()=>assert.equal(pendingRewards([{milestone:25,reward:{pending:{sharedCombatHours:8}}}])[0].quantity,8));
test('reservations ordered by milestone with no fabricated rewards',()=>assert.deepEqual(pendingRewards([100,5,50,25,15].map(milestone=>({milestone,reward:MILESTONES[milestone]}))).map(r=>[r.milestone,r.kind,r.quantity]),[[15,'sharedCombatHours',5],[25,'sharedCombatHours',10],[50,'specialPetDesign',1],[100,'specialShipDesign',1]]));
test('unknown milestone, unknown kind and invalid amounts rejected',()=>assert.deepEqual(pendingRewards([{milestone:99,reward:{pending:{specialPetDesign:1}}},{milestone:15,reward:{pending:{sharedCombatHours:-1,unknown:8,specialShipDesign:0}}},{milestone:25,reward:{pending:{sharedCombatHours:1.5}}},{milestone:50,reward:null}]),[]));
