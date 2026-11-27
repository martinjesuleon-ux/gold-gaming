'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {ROUTE,RULES,createConvoy,advance,hit,effects,explosionTargets,view}=require('../hitac-v141');
test('Hitac follows the six-map route and preserves surviving units',()=>{
 const c=createConvoy(0);assert.equal(c.units.size,7);assert.equal(c.map,'3-4');
 const boss=[...c.units.values()].find(u=>u.boss);assert.equal(boss.hp,10000000);assert.equal(boss.shield,5500000);
 for(let i=1;i<ROUTE.length;i++){advance(c,i*108000);assert.equal(c.map,ROUTE[i]);assert.equal(c.units.size,7);}
 advance(c,648000);assert.equal(c.phase,'escaped');
});
test('Hitac protection cycles, range and guard explosion',()=>{
 const c=createConvoy(0),boss=[...c.units.values()].find(u=>u.boss),guard=[...c.units.values()].find(u=>!u.boss);
 const pilot=u=>({id:'p',zone:c.map,hp:1000000,x:u.x,y:u.y});
 assert.equal(hit(c,pilot(boss),boss.id,10000,0).blocked,true);
 advance(c,10000);assert.equal(hit(c,pilot(boss),boss.id,10000,10000).blocked,false);
 assert.equal(hit(c,pilot(guard),guard.id,10000,10000).blocked,true);
 advance(c,20000);assert.equal(boss.protected,true);assert.equal(guard.protected,false);
 assert.throws(()=>hit(c,{...pilot(guard),zone:'1-1'},guard.id,100,20000));
 const r=hit(c,pilot(guard),guard.id,10000000,20000);
 assert.equal(r.killed,true);assert.equal(r.reward.uridium,4500);assert.equal(c.units.size,6);
 assert.deepEqual(explosionTargets(c,r.explosion,[pilot(guard),{...pilot(guard),id:'far',x:guard.x+701}]),[{pilotId:'p',damage:100000}]);
});
test('Hitac guard slows do not stack, target range and minimap ping',()=>{
 const c=createConvoy(0);advance(c,5000);const p={id:'p',zone:c.map,hp:100000,x:c.x,y:c.y};
 const e=effects(c,[p],5000);assert.deepEqual(e.slows,[{pilotId:'p',factor:.7,until:9000}]);assert.equal(e.targets.length,7);
 assert.equal(effects(c,[p],5001).slows.length,0);assert.equal(effects(c,[p],29999).ping,null);
 assert.equal(effects(c,[p],30000).ping.map,'3-4');assert.equal(view(c).units.length,7);
});
