'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {recordPilotAggression,pilotGuardTarget,selectPilotGuardTarget}=require('../pet-combat-rules-v173');
test('PET pilot guard reacts only to recent actual hostile actions',()=>{
 const now=10000,p={id:'p',zone:'4-1',hp:100,petMode:'guard',petUntil:20000,petX:0,petY:0,x:0,y:0};
 const n={id:'n',zone:'4-1',hp:100,x:100,y:0,target:'p'},q={id:'q',zone:'4-1',hp:100,x:200,y:0};
 const eligible=(a,b)=>a!==b&&!b.safe&&!b.protected;
 assert.equal(pilotGuardTarget(p,n,now,600,eligible),false);
 recordPilotAggression(p,n,now);recordPilotAggression(p,q,now);
 assert.equal(selectPilotGuardTarget(p,[q,n],now,600,eligible),n);
 assert.equal(pilotGuardTarget(p,n,now+5001,600,eligible),false);
 for(const extra of [{safe:true},{protected:true},{zone:'4-2'},{x:601},{deadUntil:1},{cloaked:true},{godMode:true}])assert.equal(pilotGuardTarget(p,{...n,...extra},now,600,eligible),false);
 for(const extra of [{petMode:'passive'},{petTradePending:true},{gate:true},{petVitals:{destroyed:true}},{deadUntil:1}])assert.equal(pilotGuardTarget({...p,...extra},n,now,600,eligible),false);
 assert.equal(pilotGuardTarget(p,n,now,600,()=>false),false);
});
