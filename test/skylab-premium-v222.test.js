'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const minerals=require('../minerals-v17');

const {transportDuration,autoRefinePlan,transportPlan}=minerals;
const shipment={code:'promerium',quantity:10,readyAt:1000,autoRefine:true};
const cases=[
 ['standard transport twelve minutes per hundred',()=>transportDuration(100,false)===720000],
 ['premium transport six minutes per hundred',()=>transportDuration(100,true)===360000],
 ['partial blocks rounded upward',()=>transportDuration(101,true)===720000],
 ['before arrival no delivery',()=>transportPlan(shipment,{},100,10000,true,999)===null],
 ['premium refines delivered promerium to seprom',()=>{const r=transportPlan(shipment,{},100,10000,true,1000);return r.delta.seprom===1&&r.fee===10000&&!r.blocked;}],
 ['expired premium receives original ore without charge',()=>{const r=transportPlan(shipment,{},100,10000,false,1000);return r.delta.promerium===10&&r.fee===0;}],
 ['opt out preserves all existing ore',()=>{const r=transportPlan({...shipment,autoRefine:false},{promerium:10},100,100000,true,1000);return r.delta.promerium===10&&r.fee===0;}],
 ['insufficient credits retain original ore',()=>{const r=transportPlan(shipment,{},100,9999,true,1000);return r.delta.promerium===10&&r.fee===0;}],
 ['full cargo blocks delivery without losing shipment',()=>transportPlan({...shipment,autoRefine:false},{prometium:100},100,0,false,1000).blocked],
 ['xenomit does not consume cargo space',()=>!transportPlan({code:'xenomit',quantity:500,readyAt:1000},{prometium:100},100,0,false,1000).blocked],
 ['refinement can use explicitly opted-in existing cargo',()=>{const r=transportPlan({code:'endurium',quantity:10,readyAt:1000,autoRefine:true},{prometium:20},100,250,true,1000);return r.delta.prometium===-20&&r.delta.prometid===1&&r.fee===250;}],
 ['chain preserves leftovers and exact fees',()=>{const r=autoRefinePlan({prometid:100,duranium:100,xenomit:10,promerium:1},35000);return r.contents.seprom===1&&r.contents.promerium===1&&r.fee===35000;}]
];
for(const [name,fn] of cases)test(name,()=>assert.ok(fn()));
