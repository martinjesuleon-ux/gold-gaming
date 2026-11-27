'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {validatePetEquipment,assertShipDoesNotUsePet,shipReservations}=require('../pet-equipment-rules-v173');
const owned=new Map([['laser',{code:'LF-4',category:'lasers',level:1}],['petlaser',{code:'LF-P01',category:'lasers',level:1}],['shield',{code:'SG3N-B02',category:'shields',level:1}],['engine',{code:'G3N-7900',category:'engines',level:1}]]);
const base={experience:0,slots:{laser:1,generator:2,gear:1,protocol:2}};
test('PET has its own laser and shield stats, including PET-specific laser',()=>{
 const r=validatePetEquipment(base,{laser:['petlaser'],generator:['shield']},owned);
 assert.deepEqual(r.stats,{lasers:1,generators:1,damage:280,shield:10000,absorption:.7,maxHp:50000});
});
test('PET cannot exceed purchased capacity or equip unowned or incompatible items',()=>{
 for(const e of [{laser:['laser','petlaser'],generator:[]},{laser:['missing'],generator:[]},{laser:[],generator:['engine']},{laser:[],generator:['shield','shield']},{laser:['shield'],generator:[]}])assert.throws(()=>validatePetEquipment(base,e,owned));
});
test('equipment reserved in either ship configuration or VANT is unavailable to PET',()=>{
 const configs=[{ship:['laser'],drones:[{id:'iris',items:['shield']}]},['petlaser']];
 assert.deepEqual([...shipReservations(configs)],['laser','shield','petlaser']);
 for(const e of [{laser:['laser'],generator:[]},{laser:['petlaser'],generator:[]},{laser:[],generator:['shield']}])assert.throws(()=>validatePetEquipment(base,e,owned,configs),/duplicado/);
 assert.throws(()=>assertShipDoesNotUsePet(configs,{laser:[],generator:['shield']}),/Retira primero/);
 assert.doesNotThrow(()=>assertShipDoesNotUsePet([[],[]],{laser:['laser'],generator:['shield']}));
});
test('PET level bonuses apply to equipped gear without changing the inventory',()=>{
 const r=validatePetEquipment({...base,experience:150000000},{laser:['laser'],generator:['shield']},owned);
 assert.equal(r.stats.damage,232);assert.equal(r.stats.shield,11800);assert.equal(r.stats.maxHp,250000);
 assert.equal(owned.get('laser').level,1);
});

test('module slots validate ownership, type, duplicates, capacity and actual mounted code',()=>{
 const {hasMountedGear}=require('../pet-equipment-rules-v173');
 const modules=new Map([...owned,['loot',{code:'G-AL1',category:'petGear',level:1}],['kami',{code:'G-KK1',category:'petGear',level:1}],['fake',{code:'G-AL1',category:'lasers',level:1}]]);
 const e={laser:[],generator:[],gear:['loot']};
 assert.deepEqual(validatePetEquipment(base,e,modules).equipment,e);
 for(const gear of [['loot','kami'],['missing'],['fake'],['laser']])assert.throws(()=>validatePetEquipment(base,{...e,gear},modules));
 const list=[...modules].map(([instanceId,i])=>({instanceId,...i}));
 assert.equal(hasMountedGear(e,list,'G-AL1'),true);
 assert.equal(hasMountedGear(e,list,'G-KK1'),false);
 assert.equal(hasMountedGear({gear:['fake']},list,'G-AL1'),false);
 assert.equal(hasMountedGear({},list,'G-AL1'),false);
 const level1={...base,experience:8000,slots:{...base.slots,gear:2}};
 assert.deepEqual(validatePetEquipment(level1,{...e,gear:['loot','kami']},modules).equipment.gear,['loot','kami']);
 assert.throws(()=>validatePetEquipment(level1,{...e,gear:['loot','loot']},modules));
});
