'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {RULES,WAVES,tier,createEvent,enter,advance,hit,announcement,standings}=require('../invasion-v134');
test('invasion tier boundaries, entry expiry and capacity',()=>{
 assert.deepEqual([4,5,9,10,14,15,30].map(tier),[null,'easy','easy','medium','medium','hard','hard']);
 const e=createEvent('easy',0);assert.throws(()=>enter(e,'wrong',10,0));for(let i=0;i<25;i++)assert.equal(enter(e,'p'+i,5,1),true);
 assert.equal(enter(e,'p0',5,1),false);assert.throws(()=>enter(e,'overflow',5,1));assert.throws(()=>enter(e,'late',5,60000));advance(e,60000);assert.equal(e.aliens.size,20);assert.equal(e.phase,'wave');
 const empty=createEvent('hard',0);advance(empty,60000);assert.equal(empty.phase,'cancelled');
});
test('all three wave tables and boss recharge',()=>{
 for(const difficulty of Object.keys(WAVES)){
  const e=createEvent(difficulty,0);enter(e,'p',({easy:5,medium:10,hard:15})[difficulty],0);let now=60000;advance(e,now);
  for(const [name,count] of WAVES[difficulty]){
   assert.equal(e.aliens.size,count);assert.ok([...e.aliens.values()].every(a=>a.name===name));assert.throws(()=>hit(e,'outsider',e.aliens.keys().next().value,1,now));
   for(const id of [...e.aliens.keys()]){let a=e.aliens.get(id);while(a.hp>0)hit(e,'p',a.id,a.hp+a.shield,now);}
   assert.equal(e.phase,'intermission');advance(e,now+9999);assert.equal(e.aliens.size,0);now+=10000;advance(e,now);
  }
  assert.equal(e.phase,'boss');assert.equal(e.aliens.size,5);const boss=[...e.aliens.values()].find(a=>a.name==='Boss Kucurbium');assert.equal(boss.hp,20000000);assert.equal(boss.shield,20000000);
  hit(e,'p',boss.id,1000,now);assert.ok(boss.shield<boss.maxShield);advance(e,now+2000);assert.equal(boss.shield,boss.maxShield);
  for(const a of [...e.aliens.values()])while(a.hp>0)hit(e,'p',a.id,a.hp+a.shield,now+2000);
  assert.equal(e.phase,'finished');assert.ok(standings(e)[0].points>0);
 }
});
test('score announced only at the configured interval',()=>{const e=createEvent('easy',0);enter(e,'p',5,1);advance(e,60000);assert.equal(announcement(e,119999),null);assert.deepEqual(announcement(e,120000),[{id:'p',points:0}]);assert.equal(announcement(e,120001),null);});
