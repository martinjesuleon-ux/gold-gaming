'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {RULES,PUSH,REWARDS,createGame,advance,shot,rewards,view}=require('../spaceball-v138');
test('Spaceball uses three rival goals and five ammunition push multipliers',()=>{
 const g=createGame(0);assert.deepEqual(g.goals.map(p=>p.company).sort(),[1,2,3]);
 for(const [code,m] of Object.entries(PUSH)){g.ball={x:6000,y:4000};const r=shot(g,{zone:'4-4',company:1,x:5900,y:4000},code,0);assert.equal(r.ball.x,6000+m*RULES.pushPx);}
 assert.throws(()=>shot(g,{zone:'1-1',company:1,x:5900,y:4000},'LCB-10',0));assert.throws(()=>shot(g,{zone:'4-4',company:1,x:0,y:0},'LCB-10',0));assert.throws(()=>shot(g,{zone:'4-4',company:1,x:5900,y:4000},'SAB-50',0));
});
test('rival goal creates fifteen six-reward boxes with reset and expiry',()=>{
 const g=createGame(0),goal=g.goals.find(p=>p.company===2);g.ball={x:goal.x-160,y:goal.y};
 const r=shot(g,{zone:'4-4',company:1,x:goal.x-260,y:goal.y},'RSB-75',100,()=>0);assert.equal(r.scorer,1);assert.equal(g.scores[1],1);assert.equal(g.boxes.size,15);assert.equal(view(g,100).ball,null);
 for(const b of g.boxes.values()){assert.deepEqual(b.rewards,rewards(()=>0));assert.equal(b.expires,300100);}
 assert.equal(Object.keys(view(g,100).boxes[0]).includes('rewards'),false);advance(g,10099);assert.equal(g.resetAt,10100);advance(g,10100);assert.deepEqual(g.ball,{x:6000,y:4000});advance(g,300100);assert.equal(g.boxes.size,0);
});
test('reward bounds and own goal without crates',()=>{
 for(const [key,[min,max]] of Object.entries(REWARDS)){assert.equal(rewards(()=>0)[key],min);assert.equal(rewards(()=>.99999999)[key],max);}
 const g=createGame(0),goal=g.goals.find(p=>p.company===1);g.ball={x:goal.x-160,y:goal.y};const r=shot(g,{zone:'4-4',company:1,x:goal.x-260,y:goal.y},'RSB-75',100);assert.equal(r.scorer,null);assert.equal(g.boxes.size,0);assert.equal(g.scores[1],0);
});

test('Spaceball validates shot before ammunition is charged and rejects during reset',()=>{
 const {validateShot}=require('../spaceball-v138'),g=createGame(0),p={zone:'4-4',company:1,x:5900,y:4000};
 assert.equal(validateShot(g,p,'LCB-10',0),100);assert.deepEqual(g.ball,{x:6000,y:4000});
 assert.throws(()=>validateShot(g,p,'SAB-50',0));g.resetAt=10000;assert.throws(()=>validateShot(g,p,'LCB-10',9999));assert.equal(validateShot(g,p,'LCB-10',10000),100);
 g.active=false;assert.throws(()=>validateShot(g,p,'LCB-10',10001));
});

test('Spaceball crate reservations enforce proximity, expiry and one active collector',()=>{
 const {reserveBox,releaseBox}=require('../spaceball-v138'),g=createGame(0);
 const b={id:'box',x:100,y:100,expires:300000,rewards:rewards(()=>0)};g.boxes.set(b.id,b);
 const p={zone:'4-4',accountId:'a',x:100,y:100};
 assert.equal(reserveBox(g,{...p,x:200},b.id,1),null);assert.equal(reserveBox(g,{...p,zone:'1-1'},b.id,1),null);assert.equal(reserveBox(g,{...p,godMode:true},b.id,1),null);
 assert.equal(reserveBox(g,p,b.id,1),b);assert.equal(reserveBox(g,{...p,accountId:'b'},b.id,1),null);
 releaseBox(g,b,false);assert.equal(reserveBox(g,p,b.id,300000),null);assert.equal(reserveBox(g,p,b.id,2),b);releaseBox(g,b,true);assert.equal(g.boxes.size,0);
});
