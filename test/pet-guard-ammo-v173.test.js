'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createPetProgression}=require('../pet-progression-v173');
const id='00000000-0000-4000-8000-000000000001';
test('guard authorizes actual equipped laser count and never debits insufficient ammo',async()=>{
 const oldGuard=process.env.GG_PET_GUARD_ENABLED,oldEquipment=process.env.GG_PET_EQUIPMENT_ENABLED;
 let ammo=2,queries=0,equipment={laser:['lf'],generator:[]},debits=0;
 const c={async query(sql,args){queries++;
  if(sql.startsWith('SELECT uridium'))return {rows:[{uridium:0}]};
  if(sql.startsWith('SELECT 1 FROM gg_v13_inventory'))return {rowCount:1};
  if(sql.startsWith('SELECT experience,slots'))return {rows:[{experience:0,slots:{laser:1,generator:2,gear:1,protocol:2}}]};
  if(sql.startsWith('SELECT configs'))return {rows:[{configs:[[],[]]}]};
  if(sql.startsWith('SELECT instance_id'))return {rows:[{instanceId:'lf',code:'LF-4',category:'lasers',level:1}]};
  if(sql.startsWith('SELECT equipment'))return {rows:[{equipment}]};
  if(sql.startsWith('UPDATE gg_v13_ammo')){const count=args[1];if(ammo<count)return {rows:[]};ammo-=count;debits++;return {rows:[{quantity:ammo}]};}
  return {rows:[]};
 },release(){}};
 const service=createPetProgression({connect:async()=>c});
 try{
  process.env.GG_PET_GUARD_ENABLED='0';process.env.GG_PET_EQUIPMENT_ENABLED='1';
  assert.equal(await service.authorizeGuardShot(id),null);assert.equal(queries,0);
  process.env.GG_PET_GUARD_ENABLED='1';
  assert.deepEqual(await service.authorizeGuardShot(id),{code:'LCB-10',count:1,damage:200,stock:1});
  assert.equal((await service.authorizeGuardShot(id)).stock,0);
  assert.deepEqual(await service.authorizeGuardShot(id),{blocked:'Munición LCB-10 insuficiente'});assert.equal(debits,2);
  equipment={laser:[],generator:[]};ammo=10;
  assert.deepEqual(await service.authorizeGuardShot(id),{blocked:'Equipa láseres en el hangar del P.E.T.'});assert.equal(ammo,10);
 }finally{
  if(oldGuard===undefined)delete process.env.GG_PET_GUARD_ENABLED;else process.env.GG_PET_GUARD_ENABLED=oldGuard;
  if(oldEquipment===undefined)delete process.env.GG_PET_EQUIPMENT_ENABLED;else process.env.GG_PET_EQUIPMENT_ENABLED=oldEquipment;
 }
});
