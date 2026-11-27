'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {TEST_ACCOUNT}=require('../pet-test-kit-v175');
const {kamikazeForPilot}=require('../admin-kamikaze-v1801');
test('only the authorized test administrator receives 100 million base kamikaze damage',()=>{
 const spec={damage:75000,radius:450,cooldown:30000};
 assert.deepEqual(kamikazeForPilot({accountId:TEST_ACCOUNT,godAllowed:true},spec),{...spec,damage:100000000});
 assert.equal(kamikazeForPilot({accountId:TEST_ACCOUNT,godAllowed:false},spec),spec);
 assert.equal(kamikazeForPilot({accountId:'other',godAllowed:true},spec),spec);
 assert.equal(kamikazeForPilot(null,spec),spec);
 assert.equal(spec.damage,75000);
});