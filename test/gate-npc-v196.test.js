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
test('normal map limits pursuit per pilot, releases slots and does not cap gate waves',()=>{
 const {createNpcPursuitSlots,NORMAL_PURSUIT_LIMIT}=require('../gate-npc-v196');
 assert.equal(NORMAL_PURSUIT_LIMIT,4);
 const a={id:'a',x:0,zone:'1-2',hp:100},b={id:'b',x:10,zone:'1-2',hp:100},g={id:'g',x:0,zone:'gate:g',hp:100,gate:{wave:0,launchedWave:0}};
 const players=new Map([[a.id,a],[b.id,b],[g.id,g]]);
 const ctx={now:100,sameZone:(n,p)=>n.zone===p.zone,safeZone:()=>false,cloaked:()=>false};
 const distance=(n,p)=>Math.abs(n.x-p.x),normal=n=>n.zone==='1-2';
 const aliens=Array.from({length:7},(_,i)=>({id:'n'+i,x:i+1,zone:'1-2',hp:100,target:'a'}));
 const gates=Array.from({length:12},(_,i)=>({id:'g'+i,x:i,zone:'gate:g',hp:100,gateNPC:true,target:'g'}));
 let slots=createNpcPursuitSlots([...aliens,...gates],players,ctx,distance,normal);
 assert.equal(aliens.filter(n=>n.target==='a').length,4);
 assert.equal(slots.available(aliens[6],a),false);
 assert.equal(slots.available(aliens[6],b),true);
 for(const n of gates){assert.equal(slots.available(n,g),true);slots.claim(n,g);}
 assert.equal(gates.filter(n=>n.target==='g').length,12);
 aliens[0].hp=0;
 slots=createNpcPursuitSlots([...aliens,...gates],players,ctx,distance,normal);
 assert.equal(slots.available(aliens[6],a),true);
 slots.claim(aliens[6],a);
 assert.equal(slots.available(aliens[5],a),false);
});
