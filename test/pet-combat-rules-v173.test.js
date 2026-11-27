'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {xpPercent,eligibleForNpcXp,petXpFromReward,guardTarget}=require('../pet-combat-rules-v173');
const now=1000,base={hp:500,zone:'1-2',petMode:'guard',petUntil:2000,x:100,y:100,petX:200,petY:100,target:'npc',attack:true},npc={id:'npc',zone:'1-2',hp:500,x:300,y:100};
test('XP is disabled unless an explicit valid percentage is configured',()=>{
 for(const v of [undefined,'','0','101','1.5','-5','abc'])assert.equal(petXpFromReward(8000,true,v),0);
 assert.equal(xpPercent('25'),25);assert.equal(petXpFromReward(8000,true,'25'),2000);
 assert.equal(petXpFromReward(7,true,'25'),1);assert.equal(petXpFromReward(8000,false,'25'),0);
 assert.equal(petXpFromReward(Number.MAX_SAFE_INTEGER,true,'100'),Number.MAX_SAFE_INTEGER);
});
test('only active living PETs outside excluded game modes earn NPC XP',()=>{
 for(const petMode of ['guard','passive','loot'])assert.equal(eligibleForNpcXp({...base,petMode},now),true);
 for(const extra of [{petMode:'off'},{petUntil:now},{hp:0},{deadUntil:2000},{godMode:true},{oneShot:true},{gate:{}},{gatePending:true},{ubaReturn:{}},{invasionReturn:{}}])assert.equal(eligibleForNpcXp({...base,...extra},now),false);
});
test('guard can target only an engaged live nearby ordinary NPC',()=>{
 assert.equal(guardTarget(base,npc,now,600),true);
 for(const extra of [{petMode:'passive'},{petMode:'loot'},{attack:false},{target:'other'},{safe:true},{cloaked:true},{petX:1000},{zone:'1-3'}])assert.equal(guardTarget({...base,...extra},npc,now,600),false);
 for(const extra of [{hp:0},{accountId:'pilot'},{gateShielded:true},{godMode:true},{x:2000}])assert.equal(guardTarget(base,{...npc,...extra},now,600),false);
});
