'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {TEST_ACCOUNT,testKitEnabled,equipmentEnabled,gearEnabled,KIT,grant}=require('../pet-test-kit-v175');
test('kit privileges are isolated to existing test pilot',()=>{
 const keys=['GG_PET_TEST_KIT_ENABLED','GG_PET_EQUIPMENT_ENABLED','GG_PET_GEAR_EQUIP_ENABLED'],old=keys.map(k=>process.env[k]);
 try{for(const k of keys)delete process.env[k];assert.equal(testKitEnabled(TEST_ACCOUNT),true);assert.equal(equipmentEnabled(TEST_ACCOUNT),true);assert.equal(gearEnabled(TEST_ACCOUNT),true);assert.equal(equipmentEnabled('another-pilot'),false);assert.equal(gearEnabled('another-pilot'),false);process.env.GG_PET_TEST_KIT_ENABLED='0';assert.equal(equipmentEnabled(TEST_ACCOUNT),false);}
 finally{keys.forEach((k,i)=>old[i]===undefined?delete process.env[k]:process.env[k]=old[i]);}
});
test('kit inventory levels respect real catalog and fixed drone designs',()=>{
 for(const code of ['LF-4','LF-P01','SG3N-B03'])assert.equal(KIT.find(x=>x[0]===code)[3],16);
 for(const code of ['Havoc','Hercules','Spartan'])assert.deepEqual(KIT.find(x=>x[0]===code).slice(1),['drone-designs',10,1]);
});
test('kit grant skips absent account and previously recorded grant',async()=>{
 for(const accountExists of [false,true]){
  const statements=[];const c={query:async(sql,args)=>{statements.push({sql,args});if(sql.startsWith('SELECT account_id'))return {rows:accountExists?[{account_id:TEST_ACCOUNT}]:[]};if(sql.startsWith('INSERT INTO gg_pet_test_kit'))return {rowCount:0};return {rows:[]};},release(){}};
  assert.equal(await grant({connect:async()=>c}),false);
  assert.ok(!statements.some(x=>x.sql.includes('gg_v13_inventory')));
  assert.ok(statements.some(x=>x.sql==='COMMIT'));
 }
});
