'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {repairRate,extraStats}=require('../cpus-v18');
const {stats,quote}=require('../equipment-v13');
test('repair robots restore at the documented rates',()=>{assert.equal(Math.round(repairRate('REP-S',100000)*60),1000);assert.equal(repairRate('REP-4',90000),1000);assert.equal(repairRate('REP-1',165000),1000);});
test('extra slot limit and only one slot-expansion CPU',()=>{const ship={extras:1};assert.throws(()=>extraStats(ship,[{code:'REP-4'},{code:'ISH-01'}]));assert.equal(extraStats(ship,[{code:'SL-01'},{code:'REP-4'},{code:'ISH-01'}]).used,3);assert.throws(()=>extraStats(ship,[{code:'SL-01'},{code:'SL-02'}]));});
test('CPU price and robot integration',()=>{assert.equal(quote('cpus','ISH-01',1).total,50000);assert.equal(quote('robots','REP-4',1).total,20000);const s=stats('goliath',[{instanceId:'a',code:'REP-4',level:1},{instanceId:'b',code:'MIN-T02',level:1}]);assert.equal(s.robot,'REP-4');assert.deepEqual(s.cpus,['MIN-T02']);});
