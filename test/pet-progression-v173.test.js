'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {levelForExperience,profile,quoteSlot,createPetProgression}=require('../pet-progression-v173');
const {levels,costs}=require('../data/pet-progression-v173.json');
test('all 21 XP thresholds',()=>{
 assert.equal(levels.length,21);
 for(const r of levels){assert.equal(levelForExperience(r.experience).level,r.level);if(r.level)assert.equal(levelForExperience(r.experience-1).level,r.level-1);}
 assert.equal(profile(150000000).nextExperience,null);
 assert.throws(()=>levelForExperience(-1));assert.throws(()=>levelForExperience(NaN));
});
test('free base slots, limits, prices and maximum stats',()=>{
 const p=profile();assert.deepEqual(p.slots,{laser:1,generator:2,gear:1,protocol:2});
 assert.throws(()=>quoteSlot(p,'laser'),/nivel/);
 assert.deepEqual(quoteSlot(profile(8000),'laser'),{type:'laser',slot:2,price:3000});
 assert.deepEqual(quoteSlot(profile(8000),'generator'),{type:'generator',slot:3,price:5000});
 const top=profile(150000000,{laser:11,generator:21,gear:6,protocol:11});
 assert.deepEqual(top.limits,{laser:12,generator:22,gear:6,protocol:12});
 assert.equal(top.maxHp,250000);assert.equal(top.damageBonus,16);assert.equal(top.shieldBonus,18);
 assert.equal(quoteSlot(top,'generator').price,158000);assert.equal(quoteSlot(top,'laser').price,48000);
 assert.throws(()=>quoteSlot(top,'gear'));assert.throws(()=>quoteSlot(top,'heat'));
 assert.throws(()=>profile(0,{laser:12}));
 for(const [key,total] of [['generator',1191000],['protocol',229000],['laser',232000],['gear',325000],['heat',1220000]])assert.equal(costs[key].reduce((a,b)=>a+b,0),total);
});
test('slot purchase receipt prevents second debit on retry',async()=>{
 const id='00000000-0000-4000-8000-000000000001',requestId='00000000-0000-4000-8000-000000000002';
 let slots={laser:1,generator:2,gear:1,protocol:2},balance=10000,receipt=null,debits=0,commits=0;
 const c={async query(sql,args){
  if(sql==='COMMIT')commits++;
  if(sql.startsWith('SELECT uridium'))return {rows:[{uridium:balance}]};
  if(sql.startsWith('SELECT 1 FROM gg_v13_inventory'))return {rowCount:1};
  if(sql.startsWith('SELECT experience,slots'))return {rows:[{experience:8000,slots}]};
  if(sql.startsWith('SELECT kind,response'))return {rows:receipt?[receipt]:[]};
  if(sql.startsWith('UPDATE player_progress')){balance-=args[1];debits++;return {rows:[{uridium:balance}]};}
  if(sql.startsWith('UPDATE gg_pet_progress'))slots=JSON.parse(args[1]);
  if(sql.startsWith('INSERT INTO gg_pet_slot_receipts'))receipt={kind:args[2],response:JSON.parse(args[3])};
  return {rows:[]};
 },release(){}};
 const service=createPetProgression({connect:async()=>c});
 const first=await service.buySlot(id,{type:'laser',requestId});
 const second=await service.buySlot(id,{type:'laser',requestId});
 assert.deepEqual(first,second);assert.equal(debits,1);assert.equal(balance,7000);assert.equal(commits,2);
 await assert.rejects(service.buySlot(id,{type:'gear',requestId}),/utilizada/);
});
