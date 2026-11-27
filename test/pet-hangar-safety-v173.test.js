'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createPetProgression}=require('../pet-progression-v173');
const id='00000000-0000-4000-8000-000000000001',requestId='00000000-0000-4000-8000-000000000002';
function fixture({owned=true,experience=8000,uridium=2000}={}){
 const queries=[];let released=0;
 const c={async query(sql,args){queries.push(sql);
  if(sql.startsWith('SELECT uridium'))return {rows:[{uridium}]};
  if(sql.startsWith('SELECT 1 FROM gg_v13_inventory'))return {rowCount:owned?1:0};
  if(sql.startsWith('SELECT experience,slots'))return {rows:[{experience,slots:{laser:1,generator:2,gear:1,protocol:2}}]};
  return {rows:[]};
 },release(){released++;}};
 return {service:createPetProgression({connect:async()=>c}),queries,released:()=>released};
}
test('hangar exposes next-slot price only for unlocked slot types',async()=>{
 const {service,queries}=fixture();
 const p=await service.status(id);
 assert.equal(p.level,1);assert.equal(p.uridium,'2000');
 assert.deepEqual(p.nextSlots.laser,{type:'laser',slot:2,price:3000});
 assert.equal(p.nextSlots.generator.price,5000);
 assert.equal(p.nextSlots.gear.price,10000);
 assert.equal(p.nextSlots.protocol.price,5000);
 assert.equal(typeof p.purchasesEnabled,'boolean');
 assert.equal(queries.some(s=>s.startsWith('UPDATE player_progress')),false);
});
for(const [label,options,error] of [['insufficient funds',{},/Uridium insuficiente/],['locked slot',{experience:0,uridium:100000},/bloqueada/],['no owned PET',{owned:false},/Necesitas un P.E.T./]]){
 test('rejects '+label+' without debit or committed slot change',async()=>{
  const f=fixture(options);await assert.rejects(f.service.buySlot(id,{type:'laser',requestId}),error);
  assert.equal(f.queries.some(s=>s.startsWith('UPDATE ')),false);
  assert.ok(f.queries.includes('ROLLBACK'));assert.ok(!f.queries.includes('COMMIT'));assert.equal(f.released(),1);
 });
}
