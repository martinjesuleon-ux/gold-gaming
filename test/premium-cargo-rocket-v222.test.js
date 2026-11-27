'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {premiumCargo,rocketCooldown}=require('../boosters-v112');

const cases=[
 ['normal cargo unchanged',()=>premiumCargo(1000,false,1,false)===1000],
 ['premium adds 1500',()=>premiumCargo(1000,false,1,true)===2500],
 ['cargo CPU doubles base not premium bonus',()=>premiumCargo(1000,true,1,true)===3500],
 ['logistics multiplies base not premium bonus',()=>premiumCargo(1000,true,1.25,true)===4000],
 ['cargo bonus fixed across ships',()=>premiumCargo(500,true,1.25,true)-premiumCargo(500,true,1.25,false)===1500],
 ['normal rocket cooldown unchanged',()=>rocketCooldown(false,1,false)===2000],
 ['CPU cooldown unchanged',()=>rocketCooldown(true,1,false)===1000],
 ['premium halves standard cooldown',()=>rocketCooldown(false,1,true)===1000],
 ['premium and CPU combine to quarter cooldown',()=>rocketCooldown(true,1,true)===500],
 ['formation multiplier preserved',()=>rocketCooldown(true,.8,true)===400]
];
for(const [name,fn] of cases)test(name,()=>assert.ok(fn()));
