'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {configurations}=require('../equipment-v13');
const catalog=require('../data/catalog-v13.json');
const ship=catalog.ships.find(s=>s.lasers>=10&&s.generators>=10&&s.extras>=3);
const owned=new Map();function add(id,code,category){owned.set(id,{instanceId:id,code,category,level:1});return id;}
const lasers=Array.from({length:20},(_,i)=>add('l'+i,'LF-4','lasers')),shields=Array.from({length:20},(_,i)=>add('s'+i,'SG3N-B03','shields'));
const launcher=add('hst','HST-2','launchers'),cpu=add('auto','RL-LB1','cpus'),rocket=add('rocket','AROL-X','cpus'),drone=add('drone','iris','drones');
test('both configurations independently reuse the same owned LF-4, shield, launcher and CPU',()=>{assert.ok(ship);const base=[...lasers.slice(0,10),...shields.slice(0,10),launcher,cpu,rocket];const config=[{ship:base,drones:[]},{ship:[...base],drones:[]}];const result=configurations(ship.id,config,owned);assert.deepEqual(result[0],result[1]);assert.equal(result[1].launcher,'HST-2');assert.equal(result[1].lasers,10);assert.deepEqual(result[1].cpus,['RL-LB1','AROL-X']);assert.equal(owned.size,44);});
test('same item can occupy ship in one configuration and VANT in another',()=>{const result=configurations(ship.id,[{ship:[lasers[0]],drones:[]},{ship:[],drones:[{id:drone,items:[lasers[0]]}]}],owned);assert.equal(result[0].lasers,1);assert.equal(result[1].lasers,1);});
test('duplicates within a single configuration and unowned items remain rejected',()=>{assert.throws(()=>configurations(ship.id,[[lasers[0],lasers[0]],[]],owned),/duplicado/);assert.throws(()=>configurations(ship.id,[{ship:[lasers[0]],drones:[{id:drone,items:[lasers[0]]}]},[]],owned),/duplicado/);assert.throws(()=>configurations(ship.id,[['not-owned'],[]],owned),/no disponible/);});
