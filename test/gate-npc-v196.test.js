'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {npcPilotEligible}=require('../gate-npc-v196');
test('NPCs respect combat phases, cloaking and instance membership',()=>{
 const n={zone:'gate:a',gateNPC:true};
 const p={zone:n.zone,hp:100,gate:{wave:0,launchedWave:0}};
 const ctx={now:100,sameZone:(a,b)=>a.zone===b.zone,safeZone:p=>!!p.safe,cloaked:p=>!!p.ultimateCloak};
 assert.equal(npcPilotEligible(n,p,ctx),true);
 for(const key of ['countdownPending','closed','completed','transition'])assert.equal(npcPilotEligible(n,{...p,gate:{...p.gate,[key]:true}},ctx),false);
 for(const key of ['gatePending','gateWaiting','deadUntil','cloaked','safe','ultimateCloak'])assert.equal(npcPilotEligible(n,{...p,[key]:true},ctx),false);
 assert.equal(npcPilotEligible(n,{...p,hp:0},ctx),false);
 assert.equal(npcPilotEligible(n,{...p,zone:'gate:b'},ctx),false);
 assert.equal(npcPilotEligible(n,{...p,gate:{wave:1,launchedWave:0}},ctx),false);
 assert.equal(npcPilotEligible(n,{...p,gate:null},ctx),false);
 assert.equal(npcPilotEligible({zone:'1-2'},{zone:'1-2',hp:100},ctx),true);
 assert.equal(npcPilotEligible(n,null,ctx),false);
});