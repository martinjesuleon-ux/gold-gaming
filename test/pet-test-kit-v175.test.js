'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {TEST_ACCOUNT,testKitEnabled,equipmentEnabled,gearEnabled,guardEnabled,vitalsEnabled,KIT,grant}=require('../pet-test-kit-v175');
test('kit privileges are isolated to existing test pilot',()=>{
 const keys=['GG_PET_TEST_KIT_ENABLED','GG_PET_EQUIPMENT_ENABLED','GG_PET_GEAR_EQUIP_ENABLED','GG_PET_GUARD_ENABLED','GG_PET_VITALS_ENABLED'],old=keys.map(k=>process.env[k]);
 try{for(const k of keys)delete process.env[k];assert.equal(testKitEnabled(TEST_ACCOUNT),true);assert.equal(equipmentEnabled(TEST_ACCOUNT),true);assert.equal(gearEnabled(TEST_ACCOUNT),true);assert.equal(equipmentEnabled('another-pilot'),false);assert.equal(gearEnabled('another-pilot'),false);assert.equal(guardEnabled(TEST_ACCOUNT),true);assert.equal(vitalsEnabled(TEST_ACCOUNT),true);assert.equal(guardEnabled('another-pilot'),false);assert.equal(vitalsEnabled('another-pilot'),false);process.env.GG_PET_TEST_KIT_ENABLED='0';assert.equal(equipmentEnabled(TEST_ACCOUNT),false);}
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

test('successful grant uses only authorized account and maximum PET progression, in one transaction',async()=>{
 const statements=[];let released=false;
 const c={query:async(sql,args)=>{statements.push({sql,args});if(sql.startsWith('SELECT account_id'))return {rows:[{account_id:TEST_ACCOUNT}]};if(sql.startsWith('INSERT INTO gg_pet_test_kit'))return {rowCount:1};if(sql.startsWith('SELECT count'))return {rows:[{n:'0'}]};return {rows:[]};},release(){released=true;}};
 assert.equal(await grant({connect:async()=>c}),true);
 assert.equal(statements.filter(x=>x.sql.startsWith('INSERT INTO gg_v13_inventory')).length,KIT.reduce((n,x)=>n+x[2],0));
 const progression=statements.find(x=>x.sql.startsWith('INSERT INTO gg_pet_progress'));
 assert.deepEqual(JSON.parse(progression.args[2]),{laser:12,generator:22,gear:6,protocol:12});
 assert.equal(progression.args[1],150000000);
 assert.ok(statements.filter(x=>x.args).every(x=>x.args[0]===TEST_ACCOUNT));
 assert.equal(statements.at(-1).sql,'COMMIT');assert.ok(released);
});
